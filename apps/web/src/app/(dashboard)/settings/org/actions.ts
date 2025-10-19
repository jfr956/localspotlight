"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerActionClientWithAuth, getServiceRoleClient } from "@/lib/supabase";

type ActionState = {
  error?: string;
};

export async function createOrganization(_: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createServerActionClientWithAuth();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to create an organization." };
  }

  const email = user.email;

  if (!email) {
    return { error: "Your account does not have an email address." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) {
    return { error: "Organization name must be at least 2 characters." };
  }

  const serviceClient = getServiceRoleClient();

  const profileResponse = await serviceClient
    .from("users")
    .select("id")
    .filter("id", "eq", user.id)
    .maybeSingle();

  if (profileResponse.error) {
    console.error(profileResponse.error);
    return { error: "Unable to verify user profile." };
  }

  if (!profileResponse.data) {
    const insertProfile = await serviceClient.from("users").insert([
      {
        id: user.id,
        email,
        name: ((user.user_metadata as Record<string, unknown>)?.name as string | null) ?? email,
      },
    ]);

    if (insertProfile.error) {
      console.error(insertProfile.error);
      return { error: "Failed to prepare user profile for organization creation." };
    }
  }

  const orgInsert = await serviceClient
    .from("orgs")
    .insert({
      name,
      plan: "free",
    })
    .select("id")
    .single();

  if (orgInsert.error || !orgInsert.data) {
    console.error(orgInsert.error);
    return { error: "Could not create organization." };
  }

  const membership = await serviceClient.from("org_members").insert({
    org_id: orgInsert.data.id,
    user_id: user.id,
    role: "owner",
  });

  if (membership.error) {
    console.error(membership.error);
    return { error: "Organization created but membership failed. Contact support." };
  }

  revalidatePath("/settings/org");
  redirect(`/orgs/${orgInsert.data.id}`);
}
