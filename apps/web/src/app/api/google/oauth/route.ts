import { NextResponse } from "next/server";
import { buildGoogleAuthUrl } from "@/lib/google-oauth";
import { createRouteHandlerClientWithAuth, getServiceRoleClient } from "@/lib/supabase";

export async function GET(request: Request) {
  const supabase = await createRouteHandlerClientWithAuth();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const redirectUrl = new URL("/sign-in", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  const url = new URL(request.url);
  const orgId = url.searchParams.get("orgId");

  if (!orgId) {
    const redirectUrl = new URL("/integrations/google?status=missing_org", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  // Verify user is an owner of the org
  const serviceClient = getServiceRoleClient();
  const membership = await serviceClient
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  const allowedRoles = new Set(["owner", "admin"]);

  if (membership.error || !membership.data || !allowedRoles.has(membership.data.role)) {
    // Fallback: check memberships visible from session client
    const fallback = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (fallback.error || !fallback.data || !allowedRoles.has(fallback.data.role)) {
      const redirectUrl = new URL("/integrations/google?status=not_owner", request.url);
      return NextResponse.redirect(redirectUrl);
    }
  }

  const authorizeUrl = buildGoogleAuthUrl({ orgId, userId: user.id });

  // Redirect directly to Google's OAuth page
  return NextResponse.redirect(authorizeUrl);
}
