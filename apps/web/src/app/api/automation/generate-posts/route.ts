import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  DEFAULT_MODEL,
  DEFAULT_MAX_RETRIES,
  DEFAULT_RISK_THRESHOLD,
  postPrompt,
} from "@localspotlight/core";
import { getAiService, DEFAULT_FALLBACK_MODEL } from "@/lib/ai-service";
import { getServiceRoleClient } from "@/lib/supabase";
import { buildPostCandidateSchema, buildPostPromptInput } from "@/lib/post-generation";
import type { Database } from "@/types/database";

type AutomationPolicy = Database["public"]["Tables"]["automation_policies"]["Row"];
type GbpLocation = Database["public"]["Tables"]["gbp_locations"]["Row"];

const HOURS_24 = 24 * 60 * 60 * 1000;

const isWithinQuietHours = (policy: AutomationPolicy | null | undefined, now: Date) => {
  if (!policy?.quiet_hours || typeof policy.quiet_hours !== "object") {
    return false;
  }

  const { start, end } = policy.quiet_hours as { start?: string; end?: string };
  if (!start || !end) {
    return false;
  }

  const [startHour, startMinute] = start.split(":").map((value) => parseInt(value, 10));
  const [endHour, endMinute] = end.split(":").map((value) => parseInt(value, 10));

  if (
    Number.isNaN(startHour) ||
    Number.isNaN(startMinute) ||
    Number.isNaN(endHour) ||
    Number.isNaN(endMinute)
  ) {
    return false;
  }

  const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
};

const toIso = (date: Date) => date.toISOString();

export async function POST(request: NextRequest) {
  const secret = process.env.AUTOMATION_CRON_SECRET;
  if (secret) {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (token !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const aiService = getAiService();
  const serviceRole = getServiceRoleClient();

  const now = new Date();

  const { data: policies, error: policiesError } = await serviceRole
    .from("automation_policies")
    .select("id, org_id, location_id, mode, max_per_week, quiet_hours, risk_threshold, require_disclaimers")
    .eq("content_type", "post")
    .neq("mode", "off");

  if (policiesError) {
    console.error("[Automation] Failed to fetch policies", policiesError);
    return NextResponse.json({ error: "Failed to load policies" }, { status: 500 });
  }

  const locationIds = Array.from(
    new Set(
      (policies ?? [])
        .map((policy) => policy.location_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  );

  if (locationIds.length === 0) {
    return NextResponse.json({ processed: 0, generated: 0, skipped: [] });
  }

  const { data: locationsData, error: locationsError } = await serviceRole
    .from("gbp_locations")
    .select("*")
    .in("id", locationIds);

  if (locationsError) {
    console.error("[Automation] Failed to fetch locations", locationsError);
    return NextResponse.json({ error: "Failed to load locations" }, { status: 500 });
  }

  const locationMap = new Map(
    (locationsData ?? []).map((location) => [location.id, location as GbpLocation]),
  );

  const orgIds = Array.from(
    new Set((locationsData ?? []).map((location) => location.org_id).filter(Boolean)),
  );

  const { data: orgsData } = await serviceRole
    .from("orgs")
    .select("id, name")
    .in("id", orgIds);

  const orgNameMap = new Map(orgsData?.map((org) => [org.id, org.name ?? "Your business"]));

  const { data: safetyData } = await serviceRole
    .from("safety_rules")
    .select("id, org_id, banned_terms, required_phrases, blocked_categories")
    .in("org_id", orgIds);

  const safetyMap = new Map(
    safetyData?.map((rule) => [rule.org_id, rule as Database["public"]["Tables"]["safety_rules"]["Row"]]),
  );

  const sevenDaysAgoIso = toIso(new Date(now.getTime() - 7 * HOURS_24));

  const summary = {
    processed: 0,
    generated: 0,
    autopilot: 0,
    skipped: [] as Array<{ locationId: string; reason: string }>,
    errors: [] as Array<{ locationId: string; error: string }>,
  };

  for (const policy of policies ?? []) {
    if (!policy.location_id) {
      continue;
    }

    const location = locationMap.get(policy.location_id);
    if (!location) {
      summary.skipped.push({ locationId: policy.location_id, reason: "location_missing" });
      continue;
    }

    summary.processed += 1;

    if (!location.is_managed) {
      summary.skipped.push({ locationId: location.id, reason: "not_managed" });
      continue;
    }

    if (isWithinQuietHours(policy as AutomationPolicy, now)) {
      summary.skipped.push({ locationId: location.id, reason: "quiet_hours" });
      continue;
    }

    const { count: recentSchedulesCount, error: scheduleCountError } = await serviceRole
      .from("schedules")
      .select("id", { count: "exact", head: true })
      .eq("location_id", location.id)
      .gte("publish_at", sevenDaysAgoIso);

    if (scheduleCountError) {
      summary.errors.push({
        locationId: location.id,
        error: scheduleCountError.message ?? "schedule_count_failed",
      });
      continue;
    }

    if (
      typeof policy.max_per_week === "number" &&
      policy.max_per_week > 0 &&
      (recentSchedulesCount ?? 0) >= policy.max_per_week
    ) {
      summary.skipped.push({ locationId: location.id, reason: "weekly_cap_reached" });
      continue;
    }

    const { data: reviewsData, error: reviewsError } = await serviceRole
      .from("gbp_reviews")
      .select("rating, text")
      .eq("location_id", location.id)
      .order("created_at", { ascending: false })
      .limit(3);

    if (reviewsError) {
      summary.errors.push({
        locationId: location.id,
        error: reviewsError.message ?? "reviews_fetch_failed",
      });
      continue;
    }

    const orgName = orgNameMap.get(location.org_id) ?? "Your business";
    const safety = safetyMap.get(location.org_id);

    const promptInput = buildPostPromptInput({
      orgName,
      location,
      safety,
      recentReviews: reviewsData ?? [],
      automation: policy as AutomationPolicy,
    });

    const riskThreshold = policy.risk_threshold ?? DEFAULT_RISK_THRESHOLD;

    const { data: generationRecord, error: generationInsertError } = await serviceRole
      .from("ai_generations")
      .insert({
        org_id: location.org_id,
        location_id: location.id,
        kind: "post",
        input: promptInput,
        status: "pending",
        model: DEFAULT_MODEL,
      })
      .select("id")
      .maybeSingle();

    if (generationInsertError || !generationRecord) {
      summary.errors.push({
        locationId: location.id,
        error: generationInsertError?.message ?? "generation_insert_failed",
      });
      continue;
    }

    const generationId = generationRecord.id as string;

    try {
      const generation = await aiService.generate(postPrompt, promptInput, {
        model: DEFAULT_MODEL,
        fallbackModel: DEFAULT_FALLBACK_MODEL,
        maxRetries: DEFAULT_MAX_RETRIES,
        riskThreshold,
        metadata: {
          trigger: "automation",
          orgId: location.org_id,
          locationId: location.id,
          automationPolicyId: policy.id,
        },
      });

      await serviceRole
        .from("ai_generations")
        .update({
          status: generation.blocked ? "moderated" : "completed",
          output: generation.output,
          model: generation.model,
          costs: generation.usage?.costUsd ?? 0,
          risk_score: generation.riskScore,
        })
        .eq("id", generationId);

      if (generation.blocked) {
        summary.skipped.push({ locationId: location.id, reason: "risk_threshold" });
        continue;
      }

      const postSchema = buildPostCandidateSchema({
        output: generation.output,
        model: generation.model,
        automationMode: policy.mode,
        trigger: "automation",
      });

      const { data: candidateRecord, error: candidateError } = await serviceRole
        .from("post_candidates")
        .insert({
          org_id: location.org_id,
          location_id: location.id,
          generation_id: generationId,
          schema: postSchema,
          images: [],
          status: policy.mode === "autopilot" ? "approved" : "pending",
        })
        .select("id")
        .maybeSingle();

      if (candidateError || !candidateRecord) {
        summary.errors.push({
          locationId: location.id,
          error: candidateError?.message ?? "candidate_insert_failed",
        });
        continue;
      }

      summary.generated += 1;

      if (policy.mode === "autopilot") {
        const publishAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);

        const { error: scheduleError } = await serviceRole.from("schedules").insert({
          org_id: location.org_id,
          location_id: location.id,
          target_type: "post_candidate",
          target_id: candidateRecord.id,
          publish_at: publishAt.toISOString(),
          status: "pending",
        });

        if (scheduleError) {
          summary.errors.push({
            locationId: location.id,
            error: scheduleError.message ?? "schedule_insert_failed",
          });
        } else {
          summary.autopilot += 1;
        }
      }
    } catch (error) {
      await serviceRole
        .from("ai_generations")
        .update({
          status: "failed",
          output: { error: error instanceof Error ? error.message : "generation_failed" },
        })
        .eq("id", generationId);

      summary.errors.push({
        locationId: location.id,
        error: error instanceof Error ? error.message : "generation_failed",
      });
    }
  }

  await Promise.all([
    revalidatePath("/content"),
    revalidatePath("/locations"),
    revalidatePath("/"),
  ]);

  return NextResponse.json(summary);
}
