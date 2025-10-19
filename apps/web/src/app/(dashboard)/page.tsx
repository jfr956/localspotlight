import Link from "next/link";
import { createServerComponentClientWithAuth } from "@/lib/supabase";
import type { Tables, Database } from "@/types/database";

export const metadata = {
  title: "Dashboard • LocalSpotlight",
};

interface DashboardStats {
  totalLocations: number;
  totalReviews: number;
  pendingSchedules: number;
  averageRating: number;
}

type ReviewWithLocation = Tables<"gbp_reviews"> & {
  gbp_locations?: { title: string | null };
};

type ScheduleWithLocation = Tables<"schedules"> & {
  gbp_locations?: { title: string | null };
};

export default async function DashboardPage() {
  const supabase = await createServerComponentClientWithAuth();
  const db = supabase as unknown as { from: typeof supabase.from };
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch organizations for the current user
  const organizationQuery = await supabase
    .from("orgs")
    .select("id, name, plan, created_at")
    .order("created_at", { ascending: true })
    .limit(5);

  type OrgSummary = Pick<Tables<"orgs">, "id" | "name" | "plan" | "created_at">;

  const orgs = (organizationQuery.data as OrgSummary[] | null) ?? [];

  // Get user's org IDs to filter data
  type OrgId = Database["public"]["Tables"]["gbp_locations"]["Row"]["org_id"];
  const userOrgIds = orgs
    .map((org) => org.id)
    .filter((id): id is OrgId => Boolean(id)) as OrgId[];

  // Initialize stats
  const stats: DashboardStats = {
    totalLocations: 0,
    totalReviews: 0,
    pendingSchedules: 0,
    averageRating: 0,
  };

  // Fetch recent reviews
  let recentReviews: Array<
    Tables<"gbp_reviews"> & { location?: Pick<Tables<"gbp_locations">, "title"> }
  > = [];

  // Fetch recent scheduled posts
  let recentSchedules: Array<
    Tables<"schedules"> & { location?: Pick<Tables<"gbp_locations">, "title"> }
  > = [];

  if (userOrgIds.length > 0) {
    const orgIdInClause = `(${userOrgIds.map((id) => `"${id}"`).join(",")})`;
    // Fetch dashboard statistics
    const [locationsResult, reviewsResult, schedulesResult, recentReviewsResult, recentSchedulesResult] =
      await Promise.all([
        // Total locations count
        db
          .from("gbp_locations")
          .select("id", { count: "exact", head: true })
          .filter("org_id", "in", orgIdInClause),

        // Total reviews count and average rating
        db
          .from("gbp_reviews")
          .select("rating")
          .filter("org_id", "in", orgIdInClause)
          .not("rating", "is", null),

        // Pending schedules count
        db
          .from("schedules")
          .select("id", { count: "exact", head: true })
          .filter("org_id", "in", orgIdInClause)
          .filter("status", "eq", "pending"),

        // Recent reviews with location info
        db
          .from("gbp_reviews")
          .select(
            `
            id,
            author,
            rating,
            text,
            reply,
            created_at,
            location_id,
            org_id,
            review_id,
            state,
            updated_at,
            gbp_locations!inner(title)
          `
          )
          .filter("org_id", "in", orgIdInClause)
          .order("created_at", { ascending: false })
          .limit(5),

        // Recent scheduled posts with location info
        db
          .from("schedules")
          .select(
            `
            id,
            publish_at,
            status,
            target_type,
            created_at,
            location_id,
            org_id,
            provider_ref,
            target_id,
            updated_at,
            gbp_locations!inner(title)
          `
          )
          .filter("org_id", "in", orgIdInClause)
          .order("publish_at", { ascending: false })
          .limit(5),
      ]);

    // Calculate statistics
    const reviewRows =
      (reviewsResult.data as Array<Pick<Tables<"gbp_reviews">, "rating">> | null) ?? [];

    stats.totalLocations = locationsResult.count ?? 0;
    stats.totalReviews = reviewRows.length;
    stats.pendingSchedules = schedulesResult.count ?? 0;

    // Calculate average rating
    if (reviewRows.length > 0) {
      const validRatings = reviewRows.filter((r) => r.rating !== null);
      if (validRatings.length > 0) {
        const sum = validRatings.reduce((acc, r) => acc + (r.rating ?? 0), 0);
        stats.averageRating = sum / validRatings.length;
      }
    }

    // Process recent reviews with proper typing
    if (recentReviewsResult.data) {
      recentReviews = (recentReviewsResult.data as ReviewWithLocation[]).map((review) => ({
        ...review,
        location: review.gbp_locations ? { title: review.gbp_locations.title } : undefined,
      }));
    }

    // Process recent schedules with proper typing
    if (recentSchedulesResult.data) {
      recentSchedules = (recentSchedulesResult.data as ScheduleWithLocation[]).map((schedule) => ({
        ...schedule,
        location: schedule.gbp_locations ? { title: schedule.gbp_locations.title } : undefined,
      }));
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h1 className="text-2xl font-semibold text-white">
          Good day, {user?.user_metadata?.name ?? user?.email ?? "there"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          This is your command center for AI-assisted Google Business Profile operations. Start by
          confirming your organization roster and connecting Google accounts.
        </p>
        <div className="mt-4 flex gap-3">
          <Link
            href="/settings/org"
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 transition hover:bg-emerald-400"
          >
            Create organization
          </Link>
          <Link
            href="/integrations/google"
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-emerald-400 hover:text-emerald-300"
          >
            Connect Google
          </Link>
        </div>
      </section>

      {/* Stats Grid */}
      {userOrgIds.length > 0 && (
        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-400">Total Locations</h3>
              <svg
                className="h-5 w-5 text-slate-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <p className="mt-3 text-3xl font-semibold text-white">{stats.totalLocations}</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-400">Total Reviews</h3>
              <svg
                className="h-5 w-5 text-slate-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              </svg>
            </div>
            <p className="mt-3 text-3xl font-semibold text-white">{stats.totalReviews}</p>
            {stats.averageRating > 0 && (
              <p className="mt-1 text-sm text-slate-400">
                {stats.averageRating.toFixed(1)} avg rating
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-400">Pending Posts</h3>
              <svg
                className="h-5 w-5 text-slate-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="mt-3 text-3xl font-semibold text-white">{stats.pendingSchedules}</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-400">Organizations</h3>
              <svg
                className="h-5 w-5 text-slate-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <p className="mt-3 text-3xl font-semibold text-white">{orgs.length}</p>
          </div>
        </section>
      )}

      {/* Organizations Section */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Organizations</h2>
          <Link href="/settings/org" className="text-sm text-emerald-400 hover:text-emerald-300">
            Manage all
          </Link>
        </div>
        {orgs.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">
            No organizations yet. Create your first org to invite teammates and sync locations.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-800">
            {orgs.map((org) => (
              <li
                key={org.id}
                className="flex items-center justify-between py-3 text-sm text-slate-200"
              >
                <div>
                  <span className="font-medium text-white">{org.name}</span>
                  <span className="ml-2 rounded-full bg-slate-800 px-2 py-0.5 text-xs uppercase tracking-wide text-slate-400">
                    {org.plan}
                  </span>
                </div>
                <Link
                  href={`/orgs/${org.id}`}
                  className="text-emerald-400 transition hover:text-emerald-300"
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recent Activity Grid */}
      {userOrgIds.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Reviews */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Recent Reviews</h2>
              <Link href="/reviews" className="text-sm text-emerald-400 hover:text-emerald-300">
                View all
              </Link>
            </div>
            {recentReviews.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400">
                No reviews yet. Reviews will appear here once customers leave feedback on your
                Google Business Profile.
              </p>
            ) : (
              <ul className="mt-4 space-y-4">
                {recentReviews.map((review) => (
                  <li key={review.id} className="rounded-lg border border-slate-800 p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{review.author}</span>
                          {review.rating && (
                            <div className="flex items-center gap-1">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <svg
                                  key={i}
                                  className={`h-4 w-4 ${
                                    i < review.rating! ? "text-yellow-500" : "text-slate-700"
                                  }`}
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                              ))}
                            </div>
                          )}
                        </div>
                        {review.location && (
                          <p className="mt-1 text-xs text-slate-500">{review.location.title}</p>
                        )}
                        {review.text && (
                          <p className="mt-2 text-sm text-slate-300 line-clamp-2">{review.text}</p>
                        )}
                        {review.reply ? (
                          <div className="mt-2 rounded bg-slate-800/50 p-2">
                            <p className="text-xs font-medium text-emerald-400">Your reply</p>
                            <p className="mt-1 text-sm text-slate-400 line-clamp-2">
                              {review.reply}
                            </p>
                          </div>
                        ) : (
                          <button className="mt-2 text-xs text-emerald-400 hover:text-emerald-300">
                            Reply to review
                          </button>
                        )}
                      </div>
                    </div>
                    {review.created_at && (
                      <p className="mt-2 text-xs text-slate-500">
                        {new Date(review.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Recent Scheduled Posts */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Scheduled Posts</h2>
              <Link href="/content" className="text-sm text-emerald-400 hover:text-emerald-300">
                View all
              </Link>
            </div>
            {recentSchedules.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400">
                No scheduled posts. Create and schedule posts to keep your Google Business Profile
                active.
              </p>
            ) : (
              <ul className="mt-4 space-y-4">
                {recentSchedules.map((schedule) => (
                  <li key={schedule.id} className="rounded-lg border border-slate-800 p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white capitalize">
                            {schedule.target_type.replace("_", " ")}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs uppercase tracking-wide ${
                              schedule.status === "pending"
                                ? "bg-yellow-500/10 text-yellow-400"
                                : schedule.status === "published"
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : schedule.status === "failed"
                                    ? "bg-red-500/10 text-red-400"
                                    : "bg-slate-500/10 text-slate-400"
                            }`}
                          >
                            {schedule.status}
                          </span>
                        </div>
                        {schedule.location && (
                          <p className="mt-1 text-xs text-slate-500">{schedule.location.title}</p>
                        )}
                        <p className="mt-2 text-sm text-slate-400">
                          Scheduled for{" "}
                          {new Date(schedule.publish_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
