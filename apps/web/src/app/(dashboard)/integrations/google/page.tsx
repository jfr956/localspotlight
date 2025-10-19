import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import type { Database } from "@/types/database";
import { createServerComponentClientWithAuth } from "@/lib/supabase";
import { syncLocationsAction, syncReviewsAndQAAction, disconnectGoogleAction } from "./server-actions";
import { LocationsTable } from "./locations-table";
import { LocationsTableSkeleton } from "./locations-table-skeleton";

interface IntegrationsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata = {
  title: "Google Business Profile • Integrations",
};

export default async function GoogleIntegrationPage({ searchParams }: IntegrationsPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const supabase = await createServerComponentClientWithAuth();
  const db = supabase as unknown as { from: typeof supabase.from };
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const userId = user.id as Database["public"]["Tables"]["org_members"]["Row"]["user_id"];

  const memberships = await db
    .from("org_members")
    .select("org_id, role, user_id, orgs(name)")
    .filter("user_id", "eq", userId)
    .in("role", ["owner", "admin"]);

  type OwnerMembership = {
    org_id: string;
    role: Database["public"]["Enums"]["org_member_role"];
    orgs: { name: string | null } | null;
  };

  const orgOptions = (memberships.data as OwnerMembership[] | null) ?? [];
  const currentStatus = typeof params?.status === "string" ? params.status : undefined;
  const currentOrgId =
    typeof params?.orgId === "string" ? params.orgId : orgOptions[0]?.org_id;

  const connections = currentOrgId
    ? await db
        .from("connections_google")
        .select("account_id, scopes, created_at")
        .filter("org_id", "eq", currentOrgId)
        .order("created_at", { ascending: false })
    : { data: [] };

  const accounts = currentOrgId
    ? await db
        .from("gbp_accounts")
        .select("google_account_name, display_name")
        .filter("org_id", "eq", currentOrgId)
    : { data: [] };

  // Get total count for pagination
  const { count: totalLocations } = currentOrgId
    ? await db
        .from("gbp_locations")
        .select("*", { count: "exact", head: true })
        .filter("org_id", "eq", currentOrgId)
    : { count: 0 };

  // Check if any content has been synced
  const { count: totalReviews } = currentOrgId
    ? await db
        .from("gbp_reviews")
        .select("*", { count: "exact", head: true })
        .filter("org_id", "eq", currentOrgId)
    : { count: 0 };

  const { count: totalQuestions } = currentOrgId
    ? await db
        .from("gbp_qna")
        .select("*", { count: "exact", head: true })
        .filter("org_id", "eq", currentOrgId)
    : { count: 0 };

  const { count: totalPosts } = currentOrgId
    ? await db
        .from("gbp_posts")
        .select("*", { count: "exact", head: true })
        .filter("org_id", "eq", currentOrgId)
    : { count: 0 };

  const totalContent = (totalReviews ?? 0) + (totalQuestions ?? 0) + (totalPosts ?? 0);
  const hasConnections = (connections.data?.length ?? 0) > 0;
  const hasLocations = (totalLocations ?? 0) > 0;

  type AccountRow = {
    google_account_name: string | null;
    display_name: string | null;
  };

  type ConnectionRow = {
    account_id: string | null;
    scopes: string[] | null;
    created_at: string | null;
  };

  const accountRows = (accounts.data as AccountRow[] | null) ?? [];
  const connectionRows = (connections.data as ConnectionRow[] | null) ?? [];

  const accountNameMap = new Map(
    accountRows
      .filter((account) => typeof account.google_account_name === "string")
      .map((account) => [account.google_account_name as string, account.display_name]),
  );

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-white">Google Business Profile</h1>
        <p className="text-sm text-slate-400">
          Connect GBP to sync locations, reviews, Q&A, and publish AI-generated posts.
        </p>
      </header>

      {currentStatus ? (
        <div className="rounded-lg border border-emerald-500 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {buildStatusMessage(currentStatus)}
        </div>
      ) : null}

      {/* API Access Info Banner - shown if connected but no content synced */}
      {hasConnections && hasLocations && totalContent === 0 && !currentStatus ? (
        <div className="rounded-lg border border-blue-500 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
          <div className="flex items-start gap-3">
            <svg
              className="h-5 w-5 flex-shrink-0 text-blue-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="space-y-1">
              <p className="font-medium">Google API access may be pending</p>
              <p className="text-xs text-blue-300">
                No content has been synced yet. This is normal if you just connected. Google may
                require additional API access approval for reading reviews, Q&A, and posts.{" "}
                <Link
                  href="/DOCS-API-ACCESS.md"
                  className="font-medium text-blue-200 underline hover:text-blue-100"
                >
                  Learn how to request access
                </Link>
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Connect Google</h2>
            <p className="mt-1 text-sm text-slate-400">
              Requires Google account with access to the Business Profile you manage.
            </p>
          </div>
          <Link
            href="https://developers.google.com/my-business/content/location-data"
            className="text-sm text-emerald-400 hover:text-emerald-300"
            target="_blank"
            rel="noreferrer"
          >
            Learn more
          </Link>
        </div>

        {orgOptions.length === 0 ? (
          <div className="mt-6 rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
            You need to be an owner or admin of an organization to connect Google.{" "}
            <Link href="/settings/org" className="text-emerald-400 hover:text-emerald-300">
              Create an organization
            </Link>{" "}
            to continue.
          </div>
        ) : (
          <form action="/api/google/oauth" method="GET" className="mt-6 space-y-4">
            <div className="space-y-2">
              <label htmlFor="orgId" className="text-sm font-medium text-slate-200">
                Organization
              </label>
              <select
                id="orgId"
                name="orgId"
                defaultValue={currentOrgId ?? ""}
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                {orgOptions.map((membership) => (
                  <option key={membership.org_id} value={membership.org_id}>
                    {membership.orgs?.name ?? "Unknown organization"}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 transition hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:ring-offset-2 focus:ring-offset-transparent"
            >
              Continue with Google
            </button>
          </form>
        )}
      </section>

      {currentOrgId ? (
        <section className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Connected accounts</h2>
            <span className="text-xs uppercase tracking-wide text-slate-500">
              {connectionRows.length} linked
            </span>
          </div>

          {connectionRows.length === 0 ? (
            <p className="text-sm text-slate-400">
              No Google accounts connected yet. Connect with the button above to start syncing
              locations.
            </p>
          ) : (
            <>
              <ul className="divide-y divide-slate-800 text-sm text-slate-200">
                {connectionRows.map((connection, index) => {
                  const connectedAt = connection.created_at
                    ? new Date(connection.created_at).toLocaleString()
                    : "Unknown";
                  const accountId = connection.account_id ?? "unknown-account";
                  const accountDisplayName = accountNameMap.get(accountId) ?? accountId;
                  return (
                    <li
                      key={`${accountId}-${index}`}
                      className="flex items-center justify-between py-3"
                    >
                      <div>
                        <div className="font-medium text-white">{accountDisplayName}</div>
                        <div className="mt-1 text-xs text-slate-400">
                          Connected {connectedAt}
                          {connection.scopes?.length ? (
                            <span className="ml-2 text-slate-500">
                              {connection.scopes.length} scopes granted
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <Link
                        href="https://business.google.com/locations"
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-400 hover:text-emerald-300"
                      >
                        Manage
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <form action={disconnectGoogleAction} className="pt-4">
                <input type="hidden" name="orgId" value={currentOrgId} />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-lg border border-red-500 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/10"
                >
                  Disconnect Google Account
                </button>
                <p className="mt-2 text-xs text-slate-500">
                  This will remove all Google connections and synced data for this organization.
                </p>
              </form>
            </>
          )}

          <div className="flex flex-col gap-3">
            <form action={syncLocationsAction} className="flex items-center gap-3">
              <input type="hidden" name="orgId" value={currentOrgId} />
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-lg border border-emerald-500 px-4 py-2 text-sm font-medium text-emerald-400 transition hover:bg-emerald-500/10"
              >
                Sync locations from Google
              </button>
              <p className="text-xs text-slate-500">
                Refreshes titles, addresses, and labels from Google Business Profile.
              </p>
            </form>

            <form action={syncReviewsAndQAAction} className="flex items-center gap-3">
              <input type="hidden" name="orgId" value={currentOrgId} />
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-lg border border-blue-500 px-4 py-2 text-sm font-medium text-blue-400 transition hover:bg-blue-500/10"
              >
                Sync content from Google
              </button>
              <p className="text-xs text-slate-500">
                Pulls reviews, Q&A, and posts from all managed locations.
              </p>
            </form>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Managed locations</h3>
              <span className="text-xs uppercase tracking-wide text-slate-500">
                {totalLocations ?? 0} synced
              </span>
            </div>

            {totalLocations === 0 ? (
              <p className="text-sm text-slate-400">
                No locations synced yet. Run a sync above to pull locations from your account.
              </p>
            ) : (
              <Suspense fallback={<LocationsTableSkeleton />}>
                <LocationsTable orgId={currentOrgId} searchParams={params} />
              </Suspense>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function buildStatusMessage(status: string): string {
  switch (status) {
    case "success":
      return "Google account connected successfully.";
    case "missing_code":
      return "Google did not return an authorization code. Please try again.";
    case "invalid_state":
      return "We could not verify the OAuth response. Please restart the connection.";
    case "state_mismatch":
      return "The OAuth response did not match your active session. Sign in again and retry.";
    case "missing_refresh":
      return "Google did not send a refresh token. Revoke access and reconnect with 'prompt=consent'.";
    case "insert_failed":
      return "We couldn't save the Google connection. Check logs and try again.";
    case "account_sync_failed":
      return "We connected your account but couldn't sync metadata. Try reconnecting.";
    case "missing_org":
      return "Choose an organization before continuing.";
    case "not_owner":
      return "Only organization owners or admins can connect Google Business Profile.";
    case "oauth_config":
      return "Google configuration is incomplete. Check environment variables and try again.";
    case "oauth_error":
      return "We couldn't start the Google OAuth flow. Please retry in a few minutes.";
    case "no_accounts":
      return "Google returned no Business Profile accounts for this user.";
    case "no_connections":
      return "Connect Google before syncing locations.";
    case "locations_failed":
      return "We couldn't sync locations from Google. Check logs and try again.";
    case "sync_success":
      return "Locations synced from Google successfully.";
    case "save_success":
      return "Managed locations updated.";
    case "save_failed":
      return "We couldn't update managed locations. Try again.";
    case "reviews_synced":
      return "Reviews and Q&A synced successfully from Google.";
    case "content_synced":
      return "Reviews, Q&A, and posts synced successfully from Google.";
    case "sync_failed":
      return "Failed to sync content. Check logs and try again.";
    case "no_locations":
      return "No managed locations found. Mark some locations as managed first.";
    case "disconnected":
      return "Google account disconnected successfully. All connections and synced data have been removed.";
    case "disconnect_failed":
      return "Failed to disconnect Google account. Check logs and try again.";
    case "api_access_pending":
      return "Google API access may be pending. No content was found for your locations. This is normal if you just connected - Google may require additional approval to access reviews, Q&A, and posts. Learn how to request access in our API access guide below.";
    default:
      return "Something unexpected happened while connecting to Google.";
  }
}
