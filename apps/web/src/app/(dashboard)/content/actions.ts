"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  DEFAULT_MODEL,
  DEFAULT_MAX_RETRIES,
  DEFAULT_RISK_THRESHOLD,
  postPrompt,
} from "@localspotlight/core";
import { getAiService, DEFAULT_FALLBACK_MODEL } from "@/lib/ai-service";
import { buildPostCandidateSchema, buildPostPromptInput } from "@/lib/post-generation";
import { createServerActionClientWithAuth, getServiceRoleClient } from "@/lib/supabase";
import type { Database } from "@/types/database";

type MembershipRole = Database["public"]["Enums"]["org_member_role"];

const APPROVER_ROLES: MembershipRole[] = ["owner", "admin", "editor"];

type CandidateWithLocation = Database["public"]["Tables"]["post_candidates"]["Row"] & {
  gbp_locations: Pick<
    Database["public"]["Tables"]["gbp_locations"]["Row"],
    "id" | "org_id" | "title" | "is_managed" | "meta"
  >;
  schedules: Array<Pick<Database["public"]["Tables"]["schedules"]["Row"], "id">>;
};

type CandidateWithGeneration = Database["public"]["Tables"]["post_candidates"]["Row"] & {
  gbp_locations: Database["public"]["Tables"]["gbp_locations"]["Row"];
  ai_generations: Array<
    Pick<Database["public"]["Tables"]["ai_generations"]["Row"], "id" | "input">
  >;
};

async function requireUser() {
  const supabase = await createServerActionClientWithAuth();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  return { user, supabase };
}

async function requireMembership(orgId: string, userId: string) {
  const serviceRole = getServiceRoleClient();
  const membership = await serviceRole
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  const role = membership.data?.role as MembershipRole | undefined;

  if (!role || !APPROVER_ROLES.includes(role)) {
    redirect("/content?status=insufficient_role");
  }
}

export async function approvePostCandidateAction(formData: FormData) {
  const candidateIdValue = formData.get("candidateId");
  const candidateId =
    typeof candidateIdValue === "string" && candidateIdValue.trim().length > 0
      ? candidateIdValue.trim()
      : null;

  if (!candidateId) {
    redirect("/content?status=missing_candidate");
  }

  const publishAtValue = formData.get("publishAt");
  let publishAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
  if (typeof publishAtValue === "string" && publishAtValue.trim().length > 0) {
    const parsed = new Date(publishAtValue);
    if (!Number.isNaN(parsed.getTime())) {
      publishAt = parsed;
    }
  }

  const { user } = await requireUser();
  const serviceRole = getServiceRoleClient();

  const candidateQuery = await serviceRole
    .from("post_candidates")
    .select(
      "*, gbp_locations!inner(*), schedules(id)",
    )
    .eq("id", candidateId)
    .maybeSingle();

  if (candidateQuery.error || !candidateQuery.data) {
    redirect("/content?status=candidate_missing");
  }

  const candidate = candidateQuery.data as unknown as CandidateWithLocation;

  if (!candidate.gbp_locations?.is_managed) {
    redirect("/content?status=location_not_managed");
  }

  await requireMembership(candidate.org_id, user.id);

  if (candidate.status === "approved") {
    redirect("/content?status=already_approved");
  }

  if (candidate.status === "rejected") {
    redirect("/content?status=already_rejected");
  }

  const existingScheduleId = candidate.schedules?.[0]?.id;

  if (!existingScheduleId) {
    const { error: scheduleError } = await serviceRole.from("schedules").insert({
      org_id: candidate.org_id,
      location_id: candidate.location_id,
      target_type: "post_candidate",
      target_id: candidate.id,
      publish_at: publishAt.toISOString(),
      status: "pending",
    });

    if (scheduleError) {
      console.error("[Approvals] Failed to create schedule", scheduleError);
      redirect("/content?status=schedule_failed");
    }
  }

  const { error: updateError } = await serviceRole
    .from("post_candidates")
    .update({ status: "approved" })
    .eq("id", candidate.id);

  if (updateError) {
    console.error("[Approvals] Failed to approve candidate", updateError);
    redirect("/content?status=approval_failed");
  }

  revalidatePath("/content");
  revalidatePath(`/locations/${candidate.location_id}`);

  redirect("/content?status=post_approved");
}

export async function rejectPostCandidateAction(formData: FormData) {
  const candidateIdValue = formData.get("candidateId");
  const candidateId =
    typeof candidateIdValue === "string" && candidateIdValue.trim().length > 0
      ? candidateIdValue.trim()
      : null;

  if (!candidateId) {
    redirect("/content?status=missing_candidate");
  }

  const { user } = await requireUser();
  const serviceRole = getServiceRoleClient();

  const candidateQuery = await serviceRole
    .from("post_candidates")
    .select(
      "*, gbp_locations!inner(*)",
    )
    .eq("id", candidateId)
    .maybeSingle();

  if (candidateQuery.error || !candidateQuery.data) {
    redirect("/content?status=candidate_missing");
  }

  const candidate = candidateQuery.data as unknown as CandidateWithLocation;

  await requireMembership(candidate.org_id, user.id);

  const { error: updateError } = await serviceRole
    .from("post_candidates")
    .update({ status: "rejected" })
    .eq("id", candidate.id);

  if (updateError) {
    console.error("[Approvals] Failed to reject candidate", updateError);
    redirect("/content?status=reject_failed");
  }

  revalidatePath("/content");
  revalidatePath(`/locations/${candidate.location_id}`);

  redirect("/content?status=post_rejected");
}

export async function regeneratePostCandidateAction(formData: FormData) {
  const candidateIdValue = formData.get("candidateId");
  const candidateId =
    typeof candidateIdValue === "string" && candidateIdValue.trim().length > 0
      ? candidateIdValue.trim()
      : null;

  if (!candidateId) {
    redirect("/content?status=missing_candidate");
  }

  const { user } = await requireUser();
  const serviceRole = getServiceRoleClient();

  const candidateQuery = await serviceRole
    .from("post_candidates")
    .select(
      "*, gbp_locations(*), ai_generations!left(id, input)",
    )
    .eq("id", candidateId)
    .maybeSingle();

  if (candidateQuery.error || !candidateQuery.data) {
    redirect("/content?status=candidate_missing");
  }

  const candidate = candidateQuery.data as unknown as CandidateWithGeneration;

  await requireMembership(candidate.org_id, user.id);

  if (!candidate.gbp_locations?.is_managed) {
    redirect("/content?status=location_not_managed");
  }

  const { data: orgQuery } = await serviceRole
    .from("orgs")
    .select("*")
    .eq("id", candidate.org_id)
    .maybeSingle();

  const { data: safetyQuery } = await serviceRole
    .from("safety_rules")
    .select("*")
    .eq("org_id", candidate.org_id)
    .maybeSingle();

  const { data: automationQuery } = await serviceRole
    .from("automation_policies")
    .select("*")
    .eq("org_id", candidate.org_id)
    .eq("location_id", candidate.location_id)
    .eq("content_type", "post")
    .maybeSingle();

  const { data: reviewsQuery } = await serviceRole
    .from("gbp_reviews")
    .select("rating, text")
    .eq("location_id", candidate.location_id)
    .order("created_at", { ascending: false })
    .limit(3);

  const promptInput =
    candidate.ai_generations?.[0]?.input ??
    buildPostPromptInput({
      orgName: orgQuery?.name ?? "Your business",
      location: candidate.gbp_locations,
      safety: safetyQuery ?? undefined,
      recentReviews: reviewsQuery ?? [],
      automation: automationQuery ?? undefined,
    });

  const aiService = getAiService();
  const riskThreshold = automationQuery?.risk_threshold ?? DEFAULT_RISK_THRESHOLD;

  const generationResult = await aiService.generate(postPrompt, promptInput, {
    model: DEFAULT_MODEL,
    fallbackModel: DEFAULT_FALLBACK_MODEL,
    maxRetries: DEFAULT_MAX_RETRIES,
    riskThreshold,
    metadata: {
      trigger: "manual_regenerate",
      orgId: candidate.org_id,
      locationId: candidate.location_id,
      candidateId: candidate.id,
    },
  });

  if (generationResult.blocked) {
    redirect("/content?status=regenerate_blocked");
  }

  const { data: newGeneration, error: generationInsertError } = await serviceRole
    .from("ai_generations")
    .insert({
      org_id: candidate.org_id,
      location_id: candidate.location_id,
      kind: "post",
      input: promptInput,
      output: generationResult.output,
      status: "completed",
      model: generationResult.model,
      costs: generationResult.usage?.costUsd ?? 0,
      risk_score: generationResult.riskScore,
    })
    .select("id")
    .maybeSingle();

  if (generationInsertError || !newGeneration) {
    console.error("[Approvals] Failed to insert regenerated output", generationInsertError);
    redirect("/content?status=regenerate_failed");
  }

  const postSchema = buildPostCandidateSchema({
    output: generationResult.output,
    model: generationResult.model,
    automationMode: automationQuery?.mode ?? "off",
    userId: user.id,
    trigger: "manual",
  });

  const { error: candidateUpdateError } = await serviceRole
    .from("post_candidates")
    .update({
      schema: postSchema as unknown as Database["public"]["Tables"]["post_candidates"]["Update"]["schema"],
      images: [],
      status: "pending",
      generation_id: newGeneration.id,
    })
    .eq("id", candidate.id);

  if (candidateUpdateError) {
    console.error("[Approvals] Failed to update candidate after regeneration", candidateUpdateError);
    redirect("/content?status=regenerate_failed");
  }

  revalidatePath("/content");
  revalidatePath(`/locations/${candidate.location_id}`);

  redirect("/content?status=regenerate_success");
}
