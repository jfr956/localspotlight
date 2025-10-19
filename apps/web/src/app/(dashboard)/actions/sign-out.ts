"use server";

import { redirect } from "next/navigation";
import { createServerActionClientWithAuth } from "@/lib/supabase";

export async function signOut() {
  const supabase = await createServerActionClientWithAuth();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
