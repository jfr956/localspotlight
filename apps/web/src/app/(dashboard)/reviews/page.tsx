import { createServerComponentClientWithAuth } from "@/lib/supabase";
import type { Tables } from "@/types/database";

export const metadata = {
  title: "Reviews • LocalSpotlight",
};

type Review = Tables<"gbp_reviews">;

export default async function ReviewsPage() {
  const supabase = await createServerComponentClientWithAuth();
  const db = supabase as unknown as { from: typeof supabase.from };

  // Fetch all reviews across all managed locations
  const { data: reviewsData } = await db
    .from("gbp_reviews")
    .select(`
      *,
      gbp_locations!inner(title, is_managed)
    `)
    .order("created_at", { ascending: false })
    .limit(50);

  const reviews = (reviewsData as Array<Review & { gbp_locations: { title: string | null; is_managed: boolean | null } }>) ?? [];

  // Filter for managed locations only
  const managedReviews = reviews.filter(r => r.gbp_locations?.is_managed);

  // Calculate stats
  const totalReviews = managedReviews.length;
  const unrepliedReviews = managedReviews.filter(r => !r.reply).length;
  const reviewsWithRatings = managedReviews.filter(r => r.rating !== null);
  const avgRating = reviewsWithRatings.length > 0
    ? reviewsWithRatings.reduce((sum, r) => sum + (r.rating ?? 0), 0) / reviewsWithRatings.length
    : 0;

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Reviews</h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage customer reviews across all your locations
          </p>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid gap-6 sm:grid-cols-3">
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
          <p className="mt-3 text-3xl font-semibold text-white">{totalReviews}</p>
          {avgRating > 0 && (
            <p className="mt-1 text-sm text-slate-400">{avgRating.toFixed(1)} avg rating</p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-400">Needs Reply</h3>
            <svg className="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          </div>
          <p className="mt-3 text-3xl font-semibold text-white">{unrepliedReviews}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-400">Avg Rating</h3>
            <svg className="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <p className="mt-3 text-3xl font-semibold text-white">
            {avgRating > 0 ? avgRating.toFixed(1) : "—"}
          </p>
          {avgRating > 0 && (
            <div className="mt-1 flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <svg
                  key={i}
                  className={`h-4 w-4 ${
                    i < Math.round(avgRating) ? "text-yellow-500" : "text-slate-700"
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
      </div>

      {/* Reviews List */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Reviews</h2>
        {managedReviews.length === 0 ? (
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
              Reviews will appear here once customers leave feedback on your locations.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {managedReviews.map((review) => (
              <li key={review.id} className="rounded-lg border border-slate-800 p-4 hover:border-slate-700 transition">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
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
                      <span className="text-xs text-slate-500">
                        {review.gbp_locations?.title ?? "Unknown location"}
                      </span>
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
      </section>
    </div>
  );
}
