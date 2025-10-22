"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerActionClientWithAuth, getServiceRoleClient } from "@/lib/supabase";
import type { Database } from "@/types/database";

type MembershipRole = Database["public"]["Enums"]["org_member_role"];

const EDITOR_ROLES: MembershipRole[] = ["owner", "admin", "editor"];

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

  if (!role || !EDITOR_ROLES.includes(role)) {
    return false;
  }

  return true;
}

export async function cancelScheduleAction(formData: FormData) {
  const scheduleIdValue = formData.get("scheduleId");
  const scheduleId =
    typeof scheduleIdValue === "string" && scheduleIdValue.trim().length > 0
      ? scheduleIdValue.trim()
      : null;

  const locationIdValue = formData.get("locationId");
  const locationId =
    typeof locationIdValue === "string" && locationIdValue.trim().length > 0
      ? locationIdValue.trim()
      : null;

  if (!scheduleId || !locationId) {
    redirect(`/locations/${locationId}?tab=posts&status=missing_schedule`);
  }

  const { user } = await requireUser();
  const serviceRole = getServiceRoleClient();

  // Fetch the schedule to verify it exists and get the org_id
  const scheduleQuery = await serviceRole
    .from("schedules")
    .select("id, org_id, location_id, status")
    .eq("id", scheduleId)
    .maybeSingle();

  if (scheduleQuery.error || !scheduleQuery.data) {
    redirect(`/locations/${locationId}?tab=posts&status=schedule_not_found`);
  }

  const schedule = scheduleQuery.data;

  // Check membership
  const hasPermission = await requireMembership(schedule.org_id, user.id);
  if (!hasPermission) {
    redirect(`/locations/${locationId}?tab=posts&status=insufficient_role`);
  }

  // Only allow canceling pending schedules
  if (schedule.status !== "pending") {
    redirect(`/locations/${locationId}?tab=posts&status=cannot_cancel_${schedule.status}`);
  }

  // Delete the schedule
  const { error: deleteError } = await serviceRole
    .from("schedules")
    .delete()
    .eq("id", scheduleId);

  if (deleteError) {
    console.error("[Schedules] Failed to cancel schedule", deleteError);
    redirect(`/locations/${locationId}?tab=posts&status=cancel_failed`);
  }

  revalidatePath(`/locations/${locationId}`);
  revalidatePath("/content");

  redirect(`/locations/${locationId}?tab=posts&status=schedule_cancelled`);
}

export async function publishNowAction(formData: FormData) {
  const scheduleIdValue = formData.get("scheduleId");
  const scheduleId =
    typeof scheduleIdValue === "string" && scheduleIdValue.trim().length > 0
      ? scheduleIdValue.trim()
      : null;

  const locationIdValue = formData.get("locationId");
  const locationId =
    typeof locationIdValue === "string" && locationIdValue.trim().length > 0
      ? locationIdValue.trim()
      : null;

  if (!scheduleId || !locationId) {
    redirect(`/locations/${locationId}?tab=posts&status=missing_schedule`);
  }

  const { user } = await requireUser();
  const serviceRole = getServiceRoleClient();

  // Fetch the schedule to verify it exists and get the org_id
  const scheduleQuery = await serviceRole
    .from("schedules")
    .select("id, org_id, location_id, status")
    .eq("id", scheduleId)
    .maybeSingle();

  if (scheduleQuery.error || !scheduleQuery.data) {
    redirect(`/locations/${locationId}?tab=posts&status=schedule_not_found`);
  }

  const schedule = scheduleQuery.data;

  // Check membership
  const hasPermission = await requireMembership(schedule.org_id, user.id);
  if (!hasPermission) {
    redirect(`/locations/${locationId}?tab=posts&status=insufficient_role`);
  }

  // Only allow publishing pending schedules
  if (schedule.status !== "pending") {
    redirect(`/locations/${locationId}?tab=posts&status=cannot_publish_${schedule.status}`);
  }

  // Update the schedule to publish immediately
  const { error: updateError } = await serviceRole
    .from("schedules")
    .update({
      publish_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", scheduleId);

  if (updateError) {
    console.error("[Schedules] Failed to update schedule for immediate publish", updateError);
    redirect(`/locations/${locationId}?tab=posts&status=publish_failed`);
  }

  // Trigger the publish-posts edge function immediately
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[Schedules] Missing Supabase credentials");
      redirect(`/locations/${locationId}?tab=posts&status=config_error`);
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/publish-posts`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error("[Schedules] Edge function call failed", await response.text());
      // Don't redirect with error - the scheduler will pick it up anyway
    }
  } catch (error) {
    console.error("[Schedules] Failed to trigger edge function", error);
    // Don't redirect with error - the scheduler will pick it up anyway
  }

  revalidatePath(`/locations/${locationId}`);
  revalidatePath("/content");

  redirect(`/locations/${locationId}?tab=posts&status=publishing_now`);
}
