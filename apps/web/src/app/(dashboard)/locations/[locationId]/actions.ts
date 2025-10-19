"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  DEFAULT_MODEL,
  DEFAULT_RISK_THRESHOLD,
  DEFAULT_MAX_RETRIES,
  postPrompt,
} from "@localspotlight/core";
import { getAiService, DEFAULT_FALLBACK_MODEL } from "@/lib/ai-service";
import { createServerActionClientWithAuth, getServiceRoleClient } from "@/lib/supabase";
import type { Database } from "@/types/database";
import { buildPostPromptInput, buildPostCandidateSchema } from "@/lib/post-generation";

type MembershipRole = Database["public"]["Enums"]["org_member_role"];

const ALLOWED_ROLES: MembershipRole[] = ["owner", "admin", "editor"];

export async function generatePostDraftAction(formData: FormData) {
  const supabase = await createServerActionClientWithAuth();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const locationIdValue = formData.get("locationId");
  const locationId = typeof locationIdValue === "string" ? locationIdValue.trim() : "";

  if (!locationId) {
    redirect("/content?status=missing_location");
  }

  const serviceRole = getServiceRoleClient();

  const locationQuery = await serviceRole
    .from("gbp_locations")
    .select("id, org_id, title, is_managed, meta")
    .eq("id", locationId)
    .maybeSingle();

  const location = locationQuery.data as Database["public"]["Tables"]["gbp_locations"]["Row"] | null;

  if (locationQuery.error || !location) {
    redirect(`/locations?status=location_missing`);
  }

  if (!location.is_managed) {
    redirect(`/locations/${locationId}?status=not_managed`);
  }

  const membershipQuery = await serviceRole
    .from("org_members")
    .select("role")
    .eq("org_id", location.org_id)
    .eq("user_id", user.id)
    .maybeSingle();

  const membershipRole = membershipQuery.data?.role as MembershipRole | undefined;

  if (membershipQuery.error || !membershipRole || !ALLOWED_ROLES.includes(membershipRole)) {
    redirect(`/locations/${locationId}?status=insufficient_role`);
  }

  const [orgQuery, safetyQuery, recentReviewsQuery, automationPolicyQuery] = await Promise.all([
    serviceRole.from("orgs").select("name").eq("id", location.org_id).maybeSingle(),
    serviceRole.from("safety_rules").select("banned_terms, required_phrases, blocked_categories").eq("org_id", location.org_id).maybeSingle(),
    serviceRole
      .from("gbp_reviews")
      .select("rating, text")
      .eq("location_id", location.id)
      .order("created_at", { ascending: false })
      .limit(3),
    serviceRole
      .from("automation_policies")
      .select("mode, risk_threshold")
      .eq("org_id", location.org_id)
      .eq("content_type", "post")
      .eq("location_id", location.id)
      .maybeSingle(),
  ]);

  const orgName = orgQuery.data?.name ?? "Your business";
  const safety = safetyQuery.data as Database["public"]["Tables"]["safety_rules"]["Row"] | null;
  const recentReviews = (recentReviewsQuery.data ?? []).filter(
    (review): review is { rating?: number | null; text?: string | null } =>
      typeof review === "object" && review !== null,
  );
  const automation = automationPolicyQuery.data as
    | Database["public"]["Tables"]["automation_policies"]["Row"]
    | null
    | undefined;

  const promptInput = buildPostPromptInput({
    orgName,
    location,
    safety: safety ?? undefined,
    recentReviews,
    automation: automation ?? undefined,
  });

  const riskThreshold = automation?.risk_threshold ?? DEFAULT_RISK_THRESHOLD;

  const aiService = getAiService();

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
    console.error("[AI] Failed to log generation request", generationInsertError);
    redirect(`/locations/${locationId}?status=generation_failed`);
  }

  const generationId = generationRecord.id as string;

  try {
    const generation = await aiService.generate(postPrompt, promptInput, {
      model: DEFAULT_MODEL,
      fallbackModel: DEFAULT_FALLBACK_MODEL,
      maxRetries: DEFAULT_MAX_RETRIES,
      riskThreshold,
      metadata: {
        orgId: location.org_id,
        locationId: location.id,
        prompt: postPrompt.name,
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
      redirect(`/locations/${locationId}?status=generation_blocked`);
    }

    const postSchema = buildPostCandidateSchema({
      output: generation.output,
      model: generation.model,
      automationMode: automation?.mode ?? "off",
      userId: user.id,
      trigger: "manual",
    });

    const { error: candidateError } = await serviceRole.from("post_candidates").insert({
      org_id: location.org_id,
      location_id: location.id,
      generation_id: generationId,
      schema: postSchema,
      images: [],
      status: "pending",
    });

    if (candidateError) {
      console.error("[AI] Failed to create post candidate", candidateError);
      redirect(`/locations/${locationId}?status=generation_failed`);
    }

    revalidatePath(`/locations/${locationId}`);
    revalidatePath("/content");

    redirect(`/locations/${locationId}?tab=posts&status=generation_ready`);
  } catch (error) {
    await serviceRole
      .from("ai_generations")
      .update({
        status: "failed",
        output: { error: error instanceof Error ? error.message : "Generation failed" },
      })
      .eq("id", generationId);

    console.error("[AI] Generation failed", error);
    redirect(`/locations/${locationId}?status=generation_failed`);
  }
}
