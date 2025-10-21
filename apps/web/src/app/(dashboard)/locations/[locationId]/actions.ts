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
