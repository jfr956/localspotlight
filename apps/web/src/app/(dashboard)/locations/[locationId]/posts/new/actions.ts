"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerActionClientWithAuth } from "@/lib/supabase";
import type { Database } from "@/types/database";

type LocationRow = Database["public"]["Tables"]["gbp_locations"]["Row"];

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

const isValidUrl = (value: string) => {
  try {
    // eslint-disable-next-line no-new
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

export async function createManualPostAction(formData: FormData) {
  const supabase = await createServerActionClientWithAuth();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

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
  const imageUrlRaw = formData.get("imageUrl");

  const title = typeof titleRaw === "string" ? titleRaw.trim() : "";
  const description = typeof descriptionRaw === "string" ? descriptionRaw.trim() : "";

  if (!title || !description) {
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

  const images: string[] = [];
  const imageUrl =
    typeof imageUrlRaw === "string" && imageUrlRaw.trim().length > 0
      ? imageUrlRaw.trim()
      : null;

  if (imageUrl) {
    if (!isValidUrl(imageUrl)) {
      redirect(`/locations/${locationId}/posts/new?status=invalid_image_url`);
    }
    images.push(imageUrl);
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
    title,
    description,
    source: "manual",
    createdAt: new Date().toISOString(),
  };

  if (ctaAction) {
    (schema as { cta: { action: string; url: string | null } }).cta = {
      action: ctaAction,
      url: ctaUrl,
    };
  }

  const { data: postCandidate, error: insertCandidateError } = await supabase
    .from("post_candidates")
    .insert({
      org_id: location.org_id,
      location_id: location.id,
      schema,
      images,
      status: "pending",
    })
    .select("id")
    .maybeSingle();

  if (insertCandidateError || !postCandidate) {
    console.error("Failed to create post candidate", insertCandidateError);
    redirect(`/locations/${locationId}/posts/new?status=create_failed`);
  }

  const { error: scheduleError } = await supabase.from("schedules").insert({
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
}
