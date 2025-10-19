import Link from "next/link";
import { createServerComponentClientWithAuth } from "@/lib/supabase";
import type { Tables, Database } from "@/types/database";

export const metadata = {
  title: "Dashboard • LocalSpotlight",
};

interface DashboardStats {
  totalLocations: number;
  totalReviews: number;
  totalPosts: number;
  pendingSchedules: number;
  unansweredQuestions: number;
  averageRating: number;
}

type ReviewWithLocation = Tables<"gbp_reviews"> & {
  gbp_locations?: { title: string | null };
};

type ScheduleWithLocation = Tables<"schedules"> & {
  gbp_locations?: { title: string | null };
};

type PostWithLocation = Tables<"gbp_posts"> & {
  gbp_locations?: { title: string | null };
};

type QnaWithLocation = Tables<"gbp_qna"> & {
  gbp_locations?: { title: string | null };
};

export default async function DashboardPage() {
  const supabase = await createServerComponentClientWithAuth();
  const db = supabase as unknown as { from: typeof supabase.from };
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id as
    | Database["public"]["Tables"]["org_members"]["Row"]["user_id"]
    | undefined;

  type OrgSummary = Pick<Tables<"orgs">, "id" | "name" | "plan" | "created_at">;
  type OrgId = Database["public"]["Tables"]["gbp_locations"]["Row"]["org_id"];

  const membershipQuery = userId
    ? await supabase
        .from("org_members")
        .select("org_id")
        .eq("user_id", userId)
    : { data: [] as unknown[] };

  const membershipOrgIds = ((membershipQuery.data as Array<{ org_id: OrgId | null }> | null) ?? [])
    .map((membership) => membership.org_id)
    .filter((orgId): orgId is OrgId => Boolean(orgId));

  const organizationQuery = membershipOrgIds.length
    ? await supabase
        .from("orgs")
        .select("id, name, plan, created_at")
        .in("id", membershipOrgIds)
        .order("created_at", { ascending: true })
    : { data: [] as unknown[] };

  const orgs = (organizationQuery.data as OrgSummary[] | null) ?? [];

  const userOrgIds: OrgId[] = orgs.length
    ? (orgs.map((org) => org.id).filter((id): id is OrgId => Boolean(id)) as OrgId[])
    : membershipOrgIds;

  const stats: DashboardStats = {
    totalLocations: 0,
    totalReviews: 0,
    totalPosts: 0,
    pendingSchedules: 0,
    unansweredQuestions: 0,
    averageRating: 0,
  };

  type LocationPreview = Pick<Tables<"gbp_locations">, "title">;

  let recentReviews: Array<ReviewWithLocation & { location?: LocationPreview }> = [];
  let recentSchedules: Array<ScheduleWithLocation & { location?: LocationPreview }> = [];
  let recentPosts: Array<PostWithLocation & { location?: LocationPreview }> = [];
  let recentQna: Array<QnaWithLocation & { location?: LocationPreview }> = [];

  if (userOrgIds.length > 0) {
    const [
      locationsResult,
      reviewsResult,
      schedulesResult,
      postsResult,
      unansweredQnaResult,
      recentReviewsResult,
      recentSchedulesResult,
      recentPostsResult,
      recentQnaResult,
    ] = await Promise.all([
      db
        .from("gbp_locations")
        .select("id", { count: "exact", head: true })
        .in("org_id", userOrgIds),
      db
        .from("gbp_reviews")
        .select("rating", { count: "exact" })
        .in("org_id", userOrgIds)
        .not("rating", "is", null),
      db
        .from("schedules")
        .select("id", { count: "exact", head: true })
        .in("org_id", userOrgIds)
        .filter("status", "eq", "pending"),
      db
        .from("gbp_posts")
        .select("id", { count: "exact", head: true })
        .in("org_id", userOrgIds),
      db
        .from("gbp_qna")
        .select("id", { count: "exact", head: true })
        .in("org_id", userOrgIds)
        .is("answer", null),
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
        .in("org_id", userOrgIds)
        .order("created_at", { ascending: false })
        .limit(5),
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
        .in("org_id", userOrgIds)
        .order("publish_at", { ascending: false })
        .limit(5),
      db
        .from("gbp_posts")
        .select(
          `
            id,
            summary,
            topic_type,
            call_to_action_type,
            call_to_action_url,
            state,
            google_create_time,
            created_at,
            location_id,
            org_id,
            gbp_locations!inner(title)
          `
        )
        .in("org_id", userOrgIds)
        .order("google_create_time", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5),
      db
        .from("gbp_qna")
        .select(
          `
            id,
            question,
            answer,
            state,
            created_at,
            location_id,
            org_id,
            gbp_locations!inner(title)
          `
        )
        .in("org_id", userOrgIds)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const reviewRows =
      (reviewsResult.data as Array<Pick<Tables<"gbp_reviews">, "rating">> | null) ?? [];

    stats.totalLocations = locationsResult.count ?? 0;
    stats.totalReviews = reviewsResult.count ?? reviewRows.length;
    stats.totalPosts = postsResult.count ?? 0;
    stats.pendingSchedules = schedulesResult.count ?? 0;
    stats.unansweredQuestions = unansweredQnaResult.count ?? 0;

    if (reviewRows.length > 0) {
      const validRatings = reviewRows.filter((r) => r.rating !== null);
      if (validRatings.length > 0) {
        const sum = validRatings.reduce((acc, r) => acc + (r.rating ?? 0), 0);
        stats.averageRating = sum / validRatings.length;
      }
    }

    if (recentReviewsResult.data) {
      recentReviews = (recentReviewsResult.data as ReviewWithLocation[]).map((review) => ({
        ...review,
        location: review.gbp_locations ? { title: review.gbp_locations.title } : undefined,
      }));
    }

    if (recentSchedulesResult.data) {
      recentSchedules = (recentSchedulesResult.data as ScheduleWithLocation[]).map((schedule) => ({
        ...schedule,
        location: schedule.gbp_locations ? { title: schedule.gbp_locations.title } : undefined,
      }));
    }

    if (recentPostsResult.data) {
      recentPosts = (recentPostsResult.data as PostWithLocation[]).map((post) => ({
        ...post,
        location: post.gbp_locations ? { title: post.gbp_locations.title } : undefined,
      }));
    }

    if (recentQnaResult.data) {
      recentQna = (recentQnaResult.data as QnaWithLocation[]).map((entry) => ({
        ...entry,
        location: entry.gbp_locations ? { title: entry.gbp_locations.title } : undefined,
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
        <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-5">
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
              <h3 className="text-sm font-medium text-slate-400">Google Posts</h3>
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
                  d="M17 8h2a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2v-9a2 2 0 012-2h2"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 12v9m-3-3h6"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 6l-3 3-3-3"
                />
              </svg>
            </div>
            <p className="mt-3 text-3xl font-semibold text-white">{stats.totalPosts}</p>
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
              <h3 className="text-sm font-medium text-slate-400">Unanswered Q&amp;A</h3>
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
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <p className="mt-3 text-3xl font-semibold text-white">{stats.unansweredQuestions}</p>
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
        <div className="grid gap-6 xl:grid-cols-2">
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
              <div>
                <h2 className="text-lg font-semibold text-white">Scheduled Posts</h2>
                <p className="text-xs text-slate-400">Pending publish: {stats.pendingSchedules}</p>
              </div>
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

          {/* Recent Google Posts */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Recent Google Posts</h2>
              <Link href="/locations" className="text-sm text-emerald-400 hover:text-emerald-300">
                Manage locations
              </Link>
            </div>
            {recentPosts.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400">
                No posts yet. Sync your Google Business Profile or publish from LocalSpotlight to
                see recent posts here.
              </p>
            ) : (
              <ul className="mt-4 space-y-4">
                {recentPosts.map((post) => (
                  <li key={post.id} className="rounded-lg border border-slate-800 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white capitalize">
                            {post.topic_type?.replace("_", " ") ?? "Post"}
                          </span>
                          {post.state && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs uppercase tracking-wide ${
                                post.state === "LIVE"
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : post.state === "REJECTED"
                                    ? "bg-red-500/10 text-red-400"
                                    : "bg-slate-500/10 text-slate-400"
                              }`}
                            >
                              {post.state}
                            </span>
                          )}
                        </div>
                        {post.location && (
                          <p className="mt-1 text-xs text-slate-500">{post.location.title}</p>
                        )}
                        {post.summary && (
                          <p className="mt-2 text-sm text-slate-300 line-clamp-2">{post.summary}</p>
                        )}
                        {post.call_to_action_type && (
                          <p className="mt-2 text-xs text-slate-400">
                            CTA: {post.call_to_action_type.replace("_", " ")}
                            {post.call_to_action_url ? (
                              <>
                                {" "}
                                <a
                                  href={post.call_to_action_url}
                                  className="text-emerald-400 hover:text-emerald-300"
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {post.call_to_action_url}
                                </a>
                              </>
                            ) : null}
                          </p>
                        )}
                      </div>
                      {(post.google_create_time ?? post.created_at) && (
                        <p className="text-xs text-slate-500">
                          {new Date(post.google_create_time ?? post.created_at!).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            },
                          )}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Recent Q&A */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Recent Q&amp;A</h2>
              <Link href="/locations" className="text-sm text-emerald-400 hover:text-emerald-300">
                View locations
              </Link>
            </div>
            {recentQna.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400">
                No questions yet. Once customers submit Q&amp;A on Google, they will appear here so
                your team can respond quickly.
              </p>
            ) : (
              <ul className="mt-4 space-y-4">
                {recentQna.map((entry) => (
                  <li key={entry.id} className="rounded-lg border border-slate-800 p-4">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white">{entry.question}</p>
                          {entry.location && (
                            <p className="mt-1 text-xs text-slate-500">{entry.location.title}</p>
                          )}
                        </div>
                        {entry.created_at && (
                          <p className="text-xs text-slate-500">
                            {new Date(entry.created_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                        )}
                      </div>
                      {entry.answer ? (
                        <div className="rounded bg-slate-800/50 p-2">
                          <p className="text-xs font-medium text-emerald-400">Your answer</p>
                          <p className="mt-1 text-sm text-slate-300 line-clamp-3">{entry.answer}</p>
                        </div>
                      ) : (
                        <button className="text-xs text-emerald-400 transition hover:text-emerald-300">
                          Respond on Google
                        </button>
                      )}
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
