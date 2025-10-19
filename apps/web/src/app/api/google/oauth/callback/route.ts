import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { google } from "googleapis";
import { createRouteHandlerClientWithAuth, getServiceRoleClient } from "@/lib/supabase";
import { getOAuthClient, GOOGLE_SCOPES } from "@/lib/google-oauth";
import { fetchGoogleAccounts, fetchGoogleLocations } from "@/lib/google-business";
import { encryptRefreshToken } from "@/lib/encryption";

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
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");

  if (!code || !stateParam) {
    const redirectUrl = new URL("/integrations/google?status=missing_code", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  let state: { orgId: string; userId: string };
  try {
    state = JSON.parse(stateParam);
  } catch (error) {
    console.error("Failed to parse OAuth state", error);
    const redirectUrl = new URL("/integrations/google?status=invalid_state", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  if (!state.orgId || state.userId !== user.id) {
    const redirectUrl = new URL("/integrations/google?status=state_mismatch", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  try {
    console.log('[OAuth Callback] Starting token exchange...');
    const oauthClient = getOAuthClient();
    const { tokens } = await oauthClient.getToken(code);
    console.log('[OAuth Callback] ✓ Token exchange successful');

    if (!tokens.refresh_token) {
      console.error('[OAuth Callback] ✗ No refresh token received');
      const redirectUrl = new URL("/integrations/google?status=missing_refresh", request.url);
      return NextResponse.redirect(redirectUrl);
    }

    oauthClient.setCredentials(tokens);

    console.log('[OAuth Callback] Fetching user profile...');
    const oauth2 = google.oauth2({ auth: oauthClient, version: "v2" });
    const profile = await oauth2.userinfo.get();
    console.log('[OAuth Callback] ✓ User profile:', profile.data.email);

    console.log('[OAuth Callback] Fetching Google Business Profile accounts...');
    const accounts = await fetchGoogleAccounts(tokens.refresh_token);
    console.log('[OAuth Callback] ✓ Fetched accounts:', accounts.length);

    if (accounts.length === 0) {
      const redirectUrl = new URL("/integrations/google?status=no_accounts", request.url);
      return NextResponse.redirect(redirectUrl);
    }

    const serviceClient = getServiceRoleClient();

    const membership = await serviceClient
      .from("org_members")
      .select("role")
      .filter("org_id", "eq", state.orgId)
      .filter("user_id", "eq", user.id)
      .maybeSingle();

    const allowedRoles = new Set(["owner", "admin"]);

    if (membership.error || !membership.data || !allowedRoles.has(membership.data.role)) {
      console.warn("[OAuth Callback] Service role membership check failed", {
        error: membership.error,
        role: membership.data?.role,
        userId: user.id,
        orgId: state.orgId,
      });

      const fallbackMembership = await supabase
        .from("org_members")
        .select("role")
        .eq("org_id", state.orgId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (
        fallbackMembership.error ||
        !fallbackMembership.data ||
        !allowedRoles.has(fallbackMembership.data.role)
      ) {
        console.warn("[OAuth Callback] Fallback membership check failed", {
          error: fallbackMembership.error,
          role: fallbackMembership.data?.role,
          userId: user.id,
          orgId: state.orgId,
        });

        const redirectUrl = new URL("/integrations/google?status=not_owner", request.url);
        return NextResponse.redirect(redirectUrl);
      }
    }

    const encryptedRefreshToken = encryptRefreshToken(tokens.refresh_token);

    const connectionsPayload = accounts.map((account) => ({
      org_id: state.orgId,
      account_id: account.name ?? "unknown-account",
      refresh_token_enc: encryptedRefreshToken,
      scopes: tokens.scope ? tokens.scope.split(" ") : GOOGLE_SCOPES,
    }));

    const connectionResult = await serviceClient
      .from("connections_google")
      .upsert(connectionsPayload, { onConflict: "org_id,account_id" })
      .select("account_id");

    if (connectionResult.error) {
      console.error(connectionResult.error);
      const redirectUrl = new URL("/integrations/google?status=insert_failed", request.url);
      return NextResponse.redirect(redirectUrl);
    }

    const accountRecords = accounts.map((account) => ({
      org_id: state.orgId,
      google_account_name: account.name ?? "unknown-account",
      display_name: account.accountName ?? account.name ?? "Google Account",
    }));

    const accountsResult = await serviceClient
      .from("gbp_accounts")
      .upsert(accountRecords, { onConflict: "org_id,google_account_name" })
      .select("id, google_account_name");

    if (accountsResult.error) {
      console.error(accountsResult.error);
      const redirectUrl = new URL("/integrations/google?status=account_sync_failed", request.url);
      return NextResponse.redirect(redirectUrl);
    }

    // Fetch and store locations for each account
    console.log('[OAuth Callback] Fetching locations for each account...');
    const allLocations: Array<{
      org_id: string;
      account_id: string;
      google_location_name: string;
      title: string;
      labels: string[];
      meta: { placeId?: string; labels?: string[] };
    }> = [];
    
    for (const account of accounts) {
      if (!account.name) continue;
      
      try {
        console.log(`[OAuth Callback] Fetching locations for account: ${account.name}`);
        const locations = await fetchGoogleLocations(tokens.refresh_token!, account.name);
        console.log(`[OAuth Callback] ✓ Fetched ${locations.length} locations for account: ${account.name}`);
        
        // Find the corresponding account record ID
        const accountRecord = accountsResult.data?.find(acc => acc.google_account_name === account.name);
        if (!accountRecord) continue;
        
        // Map locations to database format
        const locationRecords = locations.map((location) => ({
          org_id: state.orgId,
          account_id: accountRecord.id,
          google_location_name: location.name ?? "unknown-location",
          title: location.title ?? "Unknown Location",
          labels: location.labels ?? [],
          meta: {
            placeId: (location as { metadata?: { placeId?: string } }).metadata?.placeId,
            labels: location.labels ?? undefined,
          },
        }));
        
        allLocations.push(...locationRecords);
      } catch (error: unknown) {
        console.error(`[OAuth Callback] Error fetching locations for account ${account.name}:`, error instanceof Error ? error.message : String(error));
        // Continue with other accounts even if one fails
      }
    }
    
    // Store all locations
    if (allLocations.length > 0) {
      console.log(`[OAuth Callback] Storing ${allLocations.length} locations...`);
      const locationsResult = await serviceClient
        .from("gbp_locations")
        .upsert(allLocations, { onConflict: "org_id,google_location_name" });
        
      if (locationsResult.error) {
        console.error('[OAuth Callback] Error storing locations:', locationsResult.error);
      } else {
        console.log('[OAuth Callback] ✓ Successfully stored locations');
      }
    }

    await serviceClient.from("audit_logs").insert({
      org_id: state.orgId,
      actor_id: user.id,
      action: "google_connection.upsert",
      target: accounts.map((account) => account.name).join(", "),
      meta: {
        email: profile.data.email,
        scopes: tokens.scope ?? GOOGLE_SCOPES.join(" "),
      },
    });

    revalidatePath("/integrations/google");
    revalidatePath(`/orgs/${state.orgId}`);

    const redirectUrl = new URL(
      `/integrations/google?orgId=${state.orgId}&status=success`,
      request.url,
    );
    return NextResponse.redirect(redirectUrl);
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string; status?: number; errors?: unknown };
    console.error("[OAuth Callback] ✗ ERROR:", err.message);
    console.error("[OAuth Callback] Error details:", {
      code: err.code,
      status: err.status,
      errors: err.errors,
    });

    const redirectUrl = new URL("/integrations/google?status=error", request.url);
    return NextResponse.redirect(redirectUrl);
  }
}
