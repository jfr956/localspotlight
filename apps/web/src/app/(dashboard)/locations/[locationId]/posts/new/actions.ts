"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { buildPostPromptInput } from "@/lib/post-generation";
import { createServerActionClientWithAuth, getServiceRoleClient } from "@/lib/supabase";
import type { Database } from "@/types/database";

type Tables = Database["public"]["Tables"];
type LocationRow = Tables["gbp_locations"]["Row"];
type OrgRow = Tables["orgs"]["Row"];
type SafetyRow = Tables["safety_rules"]["Row"];
type AutomationPolicyRow = Tables["automation_policies"]["Row"];

const POST_TYPES = new Set(["WHATS_NEW", "EVENT", "OFFER"]);
const CTA_ACTIONS = new Set([
  "BOOK",
  "CALL",
  "LEARN_MORE",
  "ORDER",
  "SHOP",
  "SIGN_UP",
  "VISIT_WEBSITE",
]);

const MAX_IMAGE_BYTES = 900 * 1024;

const createIsoFromDateTime = (dateValue: string | null, timeValue: string | null) => {
  if (!dateValue) {
    return new Date(Date.now() + 60 * 60 * 1000).toISOString();
  }

  const timePart = timeValue && timeValue.trim().length > 0 ? timeValue : "09:00";
  const normalized = `${dateValue}T${timePart.length === 5 ? `${timePart}:00` : timePart}`;
  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
};

const estimateBase64Bytes = (value: string) => {
  const base64 = value.includes(",") ? value.split(",")[1] ?? "" : value;
  return Math.ceil((base64.length * 3) / 4);
};

const isValidUrl = (value: string) => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
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

async function loadLocation(locationId: string) {
  const serviceRole = getServiceRoleClient();
  const { data, error } = await serviceRole
    .from("gbp_locations")
    .select("*")
    .eq("id", locationId)
    .maybeSingle();

  if (error || !data) {
    redirect(`/locations?status=location_missing`);
  }

  return data as LocationRow;
}

async function ensureMembership(orgId: string, userId: string) {
  const serviceRole = getServiceRoleClient();
  const membership = await serviceRole
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  const allowedRoles: Tables["org_members"]["Row"]["role"][] = ["owner", "admin", "editor"];
  const role = membership.data?.role;

  if (!role || !allowedRoles.includes(role)) {
    redirect("/content?status=insufficient_role");
  }
}

export async function startPostGenerationAction(formData: FormData) {
  const { user } = await requireUser();

  const locationIdRaw = formData.get("locationId");
  const locationId = typeof locationIdRaw === "string" ? locationIdRaw.trim() : "";

  if (!locationId) {
    redirect("/content?status=missing_location");
  }

  const serviceRole = getServiceRoleClient();
  const location = await loadLocation(locationId);

  if (!location.is_managed) {
    redirect(`/locations/${locationId}?status=not_managed`);
  }

  await ensureMembership(location.org_id, user.id);

  const [{ data: orgData }, { data: safetyData }, { data: automationData }, { data: reviewsData }] =
    await Promise.all([
      serviceRole.from("orgs").select("*").eq("id", location.org_id).maybeSingle(),
      serviceRole.from("safety_rules").select("*").eq("org_id", location.org_id).maybeSingle(),
      serviceRole
        .from("automation_policies")
        .select("*")
        .eq("org_id", location.org_id)
        .eq("location_id", location.id)
        .eq("content_type", "post")
        .maybeSingle(),
      serviceRole
        .from("gbp_reviews")
        .select("rating, text")
        .eq("location_id", location.id)
        .order("created_at", { ascending: false })
        .limit(3),
    ]);

  const org = (orgData ?? {}) as OrgRow;
  const safety = safetyData ?? (null as unknown as SafetyRow | null);
  const automation = automationData ?? (null as unknown as AutomationPolicyRow | null);

  const promptInput = buildPostPromptInput({
    orgName: org?.name ?? "Your business",
    location,
    safety: safety ?? undefined,
    recentReviews: (reviewsData ?? []) as Array<{ rating: number | null; text: string | null }>,
    automation: automation ?? undefined,
  });

  const { data, error } = await serviceRole
    .from("ai_generations")
    .insert({
      org_id: location.org_id,
      location_id: location.id,
      kind: "post",
      input: promptInput,
      status: "pending",
      model: null,
      meta: { trigger: "manual" },
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    console.error("[AI] Failed to enqueue generation", error);
    redirect(`/locations/${locationId}?status=generation_failed`);
  }

  redirect(`/locations/${locationId}/posts/new?mode=ai&gen=${data.id}`);
}

export async function createManualPostAction(formData: FormData) {
  try {
    const { user, supabase } = await requireUser();

    const locationIdRaw = formData.get("locationId");
    const locationId = typeof locationIdRaw === "string" ? locationIdRaw.trim() : "";

    if (!locationId) {
      redirect("/content?status=missing_location");
    }

    const postTypeRaw = formData.get("postType");
    const postType =
      typeof postTypeRaw === "string" && POST_TYPES.has(postTypeRaw) ? postTypeRaw : "WHATS_NEW";

    const titleRaw = formData.get("title");
    const descriptionRaw = formData.get("description");
    const publishDateRaw = formData.get("publishDate");
    const publishTimeRaw = formData.get("publishTime");
    const ctaActionRaw = formData.get("ctaAction");
    const ctaUrlRaw = formData.get("ctaUrl");
    const imageDataRaw = formData.get("imageData");
    const endDateRaw = formData.get("endDate");
    const endTimeRaw = formData.get("endTime");
    const couponCodeRaw = formData.get("couponCode");
    const termsUrlRaw = formData.get("termsUrl");

    const title = typeof titleRaw === "string" ? titleRaw.trim() : "";
    const description = typeof descriptionRaw === "string" ? descriptionRaw.trim() : "";

    console.log("[createManualPostAction] Form data:", {
      locationId,
      postType,
      title,
      descriptionLength: description.length,
      hasImageData: !!imageDataRaw,
      imageDataLength: typeof imageDataRaw === "string" ? imageDataRaw.length : 0,
    });

    // Title is only required for EVENT and OFFER posts
    if ((postType === "EVENT" || postType === "OFFER") && !title) {
      redirect(`/locations/${locationId}/posts/new?status=missing_fields`);
    }

    if (!description) {
      redirect(`/locations/${locationId}/posts/new?status=missing_fields`);
    }

    const publishAtIso = createIsoFromDateTime(
      typeof publishDateRaw === "string" ? publishDateRaw : null,
      typeof publishTimeRaw === "string" ? publishTimeRaw : null,
    );

    if (!publishAtIso) {
      redirect(`/locations/${locationId}/posts/new?status=invalid_publish_at`);
    }

    const locationResult = await supabase
      .from("gbp_locations")
      .select("id, org_id, is_managed")
      .eq("id", locationId)
      .maybeSingle();

    if (locationResult.error || !locationResult.data) {
      redirect(`/locations/${locationId}?status=location_not_found`);
    }

    const location = locationResult.data as LocationRow;

    if (!location.is_managed) {
      redirect(`/locations/${locationId}?status=not_managed`);
    }

    await ensureMembership(location.org_id, user.id);

    const images: string[] = [];
    const imageData =
      typeof imageDataRaw === "string" && imageDataRaw.trim().length > 0
        ? imageDataRaw.trim()
        : null;

    // For now, store base64 image data directly
    // TODO: Upload to Supabase Storage and store the URL instead
    if (imageData) {
      const imageBytes = estimateBase64Bytes(imageData);

      if (imageBytes > MAX_IMAGE_BYTES) {
        redirect(`/locations/${locationId}/posts/new?status=image_too_large`);
      }

      images.push(imageData);
    }

    const ctaAction =
      typeof ctaActionRaw === "string" && CTA_ACTIONS.has(ctaActionRaw) ? ctaActionRaw : null;
    const ctaUrl =
      typeof ctaUrlRaw === "string" && ctaUrlRaw.trim().length > 0 ? ctaUrlRaw.trim() : null;

    if (ctaUrl && !isValidUrl(ctaUrl)) {
      redirect(`/locations/${locationId}/posts/new?status=invalid_cta_url`);
    }

    const schema: Record<string, unknown> = {
      type: postType,
      description,
      source: "manual",
      createdAt: new Date().toISOString(),
      authorId: user.id,
    };

    // Only include title for EVENT and OFFER posts
    if (title && (postType === "EVENT" || postType === "OFFER")) {
      schema.title = title;
    }

    // Add event-specific fields
    if (postType === "EVENT" || postType === "OFFER") {
      const endAtIso = createIsoFromDateTime(
        typeof endDateRaw === "string" ? endDateRaw : null,
        typeof endTimeRaw === "string" ? endTimeRaw : null,
      );

      if (endAtIso) {
        schema.endDate = endAtIso;
      }
    }

    // Add offer-specific fields
    if (postType === "OFFER") {
      const couponCode = typeof couponCodeRaw === "string" ? couponCodeRaw.trim() : "";
      const termsUrl = typeof termsUrlRaw === "string" ? termsUrlRaw.trim() : "";

      if (couponCode) {
        schema.couponCode = couponCode;
      }

      if (termsUrl && isValidUrl(termsUrl)) {
        schema.termsUrl = termsUrl;
      }
    }

    if (ctaAction) {
      (schema as { cta: { action: string; url: string | null } }).cta = {
        action: ctaAction,
        url: ctaUrl,
      };
    }

    console.log("[createManualPostAction] Inserting post candidate:", {
      org_id: location.org_id,
      location_id: location.id,
      schema,
      imagesCount: images.length,
      imagesSizes: images.map((img) => img.length),
    });

    const { data: postCandidate, error: insertCandidateError } = await getServiceRoleClient()
      .from("post_candidates")
      .insert({
        org_id: location.org_id,
        location_id: location.id,
        schema: schema as Tables["post_candidates"]["Insert"]["schema"],
        images,
        status: "pending",
      })
      .select("id")
      .maybeSingle();

    if (insertCandidateError || !postCandidate) {
      console.error("Failed to create post candidate", insertCandidateError);
      redirect(`/locations/${locationId}/posts/new?status=create_failed`);
    }

    const { error: scheduleError } = await getServiceRoleClient()
      .from("schedules")
      .insert({
        org_id: location.org_id,
        location_id: location.id,
        target_type: "post_candidate",
        target_id: postCandidate.id,
        publish_at: publishAtIso,
        status: "pending",
      });

    if (scheduleError) {
      console.error("Failed to schedule new post", scheduleError);
      redirect(`/locations/${locationId}?status=schedule_failed`);
    }

    revalidatePath(`/locations/${locationId}`);
    revalidatePath("/content");

    redirect(`/locations/${locationId}?tab=posts&status=post_created`);
  } catch (error) {
    console.error("[createManualPostAction] Error:", error);

    // If it's a redirect, re-throw it
    if (error && typeof error === "object" && "digest" in error) {
      throw error;
    }

    // For other errors, redirect with error status
    const locationIdRaw = formData.get("locationId");
    const locationId = typeof locationIdRaw === "string" ? locationIdRaw.trim() : "";
    redirect(`/locations/${locationId || "unknown"}/posts/new?status=create_failed`);
  }
}
