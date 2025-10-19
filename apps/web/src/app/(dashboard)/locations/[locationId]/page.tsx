import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerComponentClientWithAuth } from "@/lib/supabase";
import type { Tables } from "@/types/database";

type Review = Tables<"gbp_reviews">;
type Schedule = Tables<"schedules">;
type QNA = Tables<"gbp_qna">;
type GbpPost = Tables<"gbp_posts">;

interface LocationPageProps {
  params: Promise<{ locationId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: LocationPageProps) {
  const { locationId } = await params;
  const supabase = await createServerComponentClientWithAuth();
  const db = supabase as unknown as { from: typeof supabase.from };

  const { data: location } = await db
    .from("gbp_locations")
    .select("title")
    .eq("id", locationId)
    .single();

  return {
    title: `${location?.title ?? "Location"} • LocalSpotlight`,
  };
}

export default async function LocationDetailPage({ params, searchParams }: LocationPageProps) {
  const { locationId } = await params;
  const searchParamsResolved = searchParams ? await searchParams : {};
  const activeTab = typeof searchParamsResolved.tab === "string" ? searchParamsResolved.tab : "overview";

  const supabase = await createServerComponentClientWithAuth();
  const db = supabase as unknown as { from: typeof supabase.from };

  // Fetch location details
  const { data: location } = await db
    .from("gbp_locations")
    .select("*")
    .eq("id", locationId)
    .single();

  if (!location) {
    notFound();
  }

  const meta = location.meta as Record<string, unknown> | null;
  const address = meta?.address as string | undefined;
  const phone = meta?.phone as string | undefined;
  const website = meta?.website as string | undefined;
  const categories = meta?.categories as string[] | undefined;
  const description = meta?.description as string | undefined;

  // Fetch stats
  const [reviewsResult, schedulesResult, gbpPostsResult, qnaResult, qnaCountResult, schedulesCountResult, gbpPostsCountResult] = await Promise.all([
    db
      .from("gbp_reviews")
      .select("*")
      .eq("location_id", locationId)
      .order("created_at", { ascending: false })
      .limit(50), // Fetch more for the reviews tab
    db
      .from("schedules")
      .select("*")
      .eq("location_id", locationId)
      .order("publish_at", { ascending: false })
      .limit(50), // Fetch more for posts tab
    db
      .from("gbp_posts")
      .select("*")
      .eq("location_id", locationId)
      .order("google_create_time", { ascending: false })
      .limit(50), // Fetch Google posts
    db
      .from("gbp_qna")
      .select("*")
      .eq("location_id", locationId)
      .order("created_at", { ascending: false })
      .limit(50), // Fetch Q&A items
    db
      .from("gbp_qna")
      .select("id", { count: "exact", head: true })
      .eq("location_id", locationId),
    db
      .from("schedules")
      .select("id", { count: "exact", head: true })
      .eq("location_id", locationId),
    db
      .from("gbp_posts")
      .select("id", { count: "exact", head: true })
      .eq("location_id", locationId),
  ]);

  const recentReviews = (reviewsResult.data as Review[] | null) ?? [];
  const recentSchedules = (schedulesResult.data as Schedule[] | null) ?? [];
  const gbpPosts = (gbpPostsResult.data as GbpPost[] | null) ?? [];
  const qnaItems = (qnaResult.data as QNA[] | null) ?? [];
  const qnaCount = qnaCountResult.count ?? 0;
  const schedulesCount = schedulesCountResult.count ?? 0;
  const gbpPostsCount = gbpPostsCountResult.count ?? 0;

  // Calculate average rating
  const reviewsWithRatings = recentReviews.filter((r) => r.rating !== null);
  const avgRating =
    reviewsWithRatings.length > 0
      ? reviewsWithRatings.reduce((sum, r) => sum + (r.rating ?? 0), 0) / reviewsWithRatings.length
      : 0;

  const tabs = [
    { id: "overview", name: "Overview", href: `/locations/${locationId}?tab=overview` },
    { id: "reviews", name: "Reviews", href: `/locations/${locationId}?tab=reviews` },
    { id: "posts", name: "Posts", href: `/locations/${locationId}?tab=posts` },
    { id: "qna", name: "Q&A", href: `/locations/${locationId}?tab=qna` },
    { id: "settings", name: "Settings", href: `/locations/${locationId}?tab=settings` },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <Link
          href="/locations"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-300 transition"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to locations
        </Link>

        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-3xl font-semibold text-white">
              {location.title ?? "Untitled Location"}
            </h1>
            {address && <p className="mt-2 text-sm text-slate-400">{address}</p>}
            {categories && categories.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {categories.map((category, idx) => (
                  <span
                    key={idx}
                    className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300"
                  >
                    {category}
                  </span>
                ))}
              </div>
            )}
          </div>

          <Link
            href={`https://business.google.com/locations/${location.google_location_name}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-emerald-400 hover:text-emerald-300"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
            Open in Google
          </Link>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-400">Total Reviews</h3>
            <svg className="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
              />
            </svg>
          </div>
          <p className="mt-3 text-3xl font-semibold text-white">{recentReviews.length}</p>
          {avgRating > 0 && (
            <p className="mt-1 text-sm text-slate-400">{avgRating.toFixed(1)} avg rating</p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-400">Scheduled Posts</h3>
            <svg className="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="mt-3 text-3xl font-semibold text-white">{recentSchedules.length}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-400">Q&A Items</h3>
            <svg className="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="mt-3 text-3xl font-semibold text-white">{qnaCount}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-400">Status</h3>
            <svg className="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="mt-3 text-lg font-semibold text-emerald-400">
            {location.is_managed ? "Managed" : "Not Managed"}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              className={`border-b-2 px-1 py-4 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "border-emerald-400 text-emerald-400"
                  : "border-transparent text-slate-400 hover:border-slate-700 hover:text-slate-300"
              }`}
            >
              {tab.name}
            </Link>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Location Info */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Location Information</h2>
            <dl className="space-y-4">
              {phone && (
                <div>
                  <dt className="text-sm font-medium text-slate-400">Phone</dt>
                  <dd className="mt-1 text-sm text-slate-200">{phone}</dd>
                </div>
              )}
              {website && (
                <div>
                  <dt className="text-sm font-medium text-slate-400">Website</dt>
                  <dd className="mt-1 text-sm text-slate-200">
                    <a
                      href={website}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-400 hover:text-emerald-300 transition"
                    >
                      {website}
                    </a>
                  </dd>
                </div>
              )}
              {description && (
                <div>
                  <dt className="text-sm font-medium text-slate-400">Description</dt>
                  <dd className="mt-1 text-sm text-slate-200">{description}</dd>
                </div>
              )}
              <div>
                <dt className="text-sm font-medium text-slate-400">Google Location ID</dt>
                <dd className="mt-1 text-xs font-mono text-slate-500 break-all">
                  {location.google_location_name}
                </dd>
              </div>
            </dl>
          </section>

          {/* Recent Reviews */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Recent Reviews</h2>
              <Link
                href={`/locations/${locationId}?tab=reviews`}
                className="text-sm text-emerald-400 hover:text-emerald-300 transition"
              >
                View all
              </Link>
            </div>
            {recentReviews.length === 0 ? (
              <p className="text-sm text-slate-400">No reviews yet</p>
            ) : (
              <ul className="space-y-4">
                {recentReviews.slice(0, 3).map((review) => (
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
                        {review.text && (
                          <p className="mt-2 text-sm text-slate-300 line-clamp-2">{review.text}</p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {activeTab === "reviews" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">All Reviews</h2>
            {recentReviews.length > 0 && (
              <div className="text-sm text-slate-400">
                {reviewsWithRatings.length} reviews • {avgRating.toFixed(1)} avg rating
              </div>
            )}
          </div>
          {recentReviews.length === 0 ? (
            <div className="py-12 text-center">
              <svg
                className="mx-auto h-12 w-12 text-slate-600"
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
              <h3 className="mt-4 text-lg font-medium text-white">No reviews yet</h3>
              <p className="mt-2 text-sm text-slate-400">
                Reviews will appear here once customers leave feedback on Google Business Profile.
              </p>
              <p className="mt-4 text-sm text-slate-500">
                Go to <Link href="/integrations/google" className="text-emerald-400 hover:text-emerald-300">Integrations</Link> to sync reviews from Google.
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
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
                      {review.text && (
                        <p className="mt-2 text-sm text-slate-300">{review.text}</p>
                      )}
                      {review.reply ? (
                        <div className="mt-3 rounded bg-slate-800/50 p-3">
                          <p className="text-xs font-medium text-emerald-400 mb-1">Your reply</p>
                          <p className="text-sm text-slate-400">{review.reply}</p>
                        </div>
                      ) : (
                        <button className="mt-3 inline-flex items-center gap-2 rounded-lg border border-emerald-500 px-3 py-1.5 text-sm font-medium text-emerald-400 transition hover:bg-emerald-500/10">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                            />
                          </svg>
                          Reply to review
                        </button>
                      )}
                    </div>
                  </div>
                  {review.created_at && (
                    <p className="mt-3 text-xs text-slate-500">
                      {new Date(review.created_at).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activeTab === "posts" && (
        <div className="space-y-6">
          {/* Google Business Profile Posts */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Google Business Profile Posts</h2>
              {gbpPosts.length > 0 && (
                <div className="text-sm text-slate-400">{gbpPostsCount} published</div>
              )}
            </div>

            {gbpPosts.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-slate-400">
                  No posts found. Sync content from Google to see existing posts.
                </p>
              </div>
            ) : (
              <ul className="space-y-4">
                {gbpPosts.map((post) => (
                  <li key={post.id} className="rounded-lg border border-slate-800 p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-white capitalize">
                            {post.topic_type?.toLowerCase() || "Standard Post"}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-xs uppercase tracking-wide ${
                            post.state === "LIVE"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : post.state === "EXPIRED"
                                ? "bg-slate-500/10 text-slate-400"
                                : "bg-yellow-500/10 text-yellow-400"
                          }`}>
                            {post.state || "Unknown"}
                          </span>
                        </div>

                        {post.summary && (
                          <p className="mt-2 text-sm text-slate-300">{post.summary}</p>
                        )}

                        <div className="mt-2 space-y-1 text-xs text-slate-500">
                          {post.google_create_time && (
                            <div>
                              Published: {new Date(post.google_create_time).toLocaleString()}
                            </div>
                          )}
                          {post.call_to_action_type && (
                            <div>CTA: {post.call_to_action_type}</div>
                          )}
                        </div>
                      </div>
                      {post.search_url && (
                        <a
                          href={post.search_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-4 text-emerald-400 hover:text-emerald-300"
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Scheduled Posts */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Scheduled Posts</h2>
              {recentSchedules.length > 0 && (
                <div className="text-sm text-slate-400">{schedulesCount} total</div>
              )}
            </div>

          {/* Filter tabs */}
          <div className="flex gap-2 mb-6">
            <button className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-400">
              All ({schedulesCount})
            </button>
            <button className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-400 hover:bg-slate-800">
              Pending ({recentSchedules.filter(s => s.status === 'pending').length})
            </button>
            <button className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-400 hover:bg-slate-800">
              Published ({recentSchedules.filter(s => s.status === 'published').length})
            </button>
            <button className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-400 hover:bg-slate-800">
              Failed ({recentSchedules.filter(s => s.status === 'failed').length})
            </button>
          </div>

          {recentSchedules.length === 0 ? (
            <div className="py-12 text-center">
              <svg
                className="mx-auto h-12 w-12 text-slate-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-white">No scheduled posts</h3>
              <p className="mt-2 text-sm text-slate-400">
                Create and schedule posts to keep your Google Business Profile active.
              </p>
              <button className="mt-6 inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 transition hover:bg-emerald-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Post
              </button>
            </div>
          ) : (
            <ul className="space-y-4">
              {recentSchedules.map((schedule) => (
                <li key={schedule.id} className="rounded-lg border border-slate-800 p-4 hover:border-slate-700 transition">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
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
                        {schedule.target_id && (
                          <span className="text-xs text-slate-500">
                            ID: {schedule.target_id.substring(0, 8)}...
                          </span>
                        )}
                      </div>

                      <div className="mt-2 space-y-1">
                        <p className="text-sm text-slate-400">
                          {schedule.status === "pending" ? (
                            <>
                              <svg className="inline h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Scheduled for{" "}
                            </>
                          ) : schedule.status === "published" ? (
                            <>
                              <svg className="inline h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Published on{" "}
                            </>
                          ) : (
                            <>
                              <svg className="inline h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Failed at{" "}
                            </>
                          )}
                          {new Date(schedule.publish_at).toLocaleDateString("en-US", {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>

                        {schedule.provider_ref && (
                          <p className="text-xs text-slate-500">
                            Provider ref: {schedule.provider_ref}
                          </p>
                        )}
                      </div>

                      {schedule.status === "pending" && (
                        <div className="mt-3 flex gap-2">
                          <button className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-800">
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                            Edit
                          </button>
                          <button className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/10">
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Cancel
                          </button>
                        </div>
                      )}

                      {schedule.status === "failed" && (
                        <div className="mt-3">
                          <button className="inline-flex items-center gap-1 rounded-lg border border-emerald-500 px-3 py-1.5 text-xs font-medium text-emerald-400 transition hover:bg-emerald-500/10">
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Retry
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          </div>
        </div>
      )}

      {activeTab === "qna" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Questions & Answers</h2>
            {qnaItems.length > 0 && (
              <div className="text-sm text-slate-400">{qnaItems.length} Q&A items</div>
            )}
          </div>
          {qnaItems.length === 0 ? (
            <div className="py-12 text-center">
              <svg
                className="mx-auto h-12 w-12 text-slate-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-white">No Q&A yet</h3>
              <p className="mt-2 text-sm text-slate-400">
                Questions and answers will appear here once customers ask questions on Google Business Profile.
              </p>
              <p className="mt-4 text-sm text-slate-500">
                Go to <Link href="/integrations/google" className="text-emerald-400 hover:text-emerald-300">Integrations</Link> to sync Q&A from Google.
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {qnaItems.map((qna) => (
                <li key={qna.id} className="rounded-lg border border-slate-800 p-4">
                  <div className="space-y-3">
                    {/* Question */}
                    <div>
                      <div className="flex items-start gap-2">
                        <svg className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white">{qna.question}</p>
                          {qna.created_at && (
                            <p className="mt-1 text-xs text-slate-500">
                              Asked {new Date(qna.created_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Answer */}
                    {qna.answer ? (
                      <div className="ml-7 rounded bg-slate-800/50 p-3">
                        <div className="flex items-start gap-2">
                          <svg className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="flex-1">
                            <p className="text-xs font-medium text-emerald-400 mb-1">Answer</p>
                            <p className="text-sm text-slate-300">{qna.answer}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button className="ml-7 inline-flex items-center gap-2 rounded-lg border border-emerald-500 px-3 py-1.5 text-sm font-medium text-emerald-400 transition hover:bg-emerald-500/10">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                          />
                        </svg>
                        Answer question
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activeTab === "settings" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <p className="text-sm text-slate-400">Location settings coming soon...</p>
        </div>
      )}
    </div>
  );
}
