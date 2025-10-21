import { createServerComponentClientWithAuth } from "@/lib/supabase";
import { ReviewsList } from "@/components/reviews/reviews-list";
import { redirect } from "next/navigation";
import type { Tables } from "@/types/database";

export const metadata = {
  title: "Reviews • LocalSpotlight",
};

type Review = Tables<"gbp_reviews">;

interface ReviewsPageProps {
  searchParams?: Promise<{ page?: string }>;
}

export default async function ReviewsPage({ searchParams }: ReviewsPageProps) {
  const params = await searchParams;
  const supabase = await createServerComponentClientWithAuth();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Pagination setup
  const page = Number(params?.page) || 1;
  const perPage = 5;
  const start = (page - 1) * perPage;
  const end = start + perPage - 1;

  // Fetch reviews with pagination
  const { data: reviewsData, count } = await supabase
    .from("gbp_reviews")
    .select(
      `
      *,
      gbp_locations!inner(title, is_managed, org_id)
    `,
      { count: "exact" }
    )
    .eq("gbp_locations.is_managed", true)
    .range(start, end)
    .order("created_at", { ascending: false });

  const reviews =
    (reviewsData as Array<
      Review & { gbp_locations: { title: string | null; is_managed: boolean | null; org_id: string } }
    >) ?? [];

  const totalPages = Math.ceil((count || 0) / perPage);

  // Calculate stats (from all reviews, not just current page)
  const { count: totalReviews } = await supabase
    .from("gbp_reviews")
    .select("*", { count: "exact", head: true })
    .eq("gbp_locations.is_managed", true);

  const { count: unrepliedCount } = await supabase
    .from("gbp_reviews")
    .select("*", { count: "exact", head: true })
    .eq("gbp_locations.is_managed", true)
    .is("reply", null);

  const { data: ratedReviews } = await supabase
    .from("gbp_reviews")
    .select("rating, gbp_locations!inner(is_managed)")
    .eq("gbp_locations.is_managed", true)
    .not("rating", "is", null);

  const avgRating =
    ratedReviews && ratedReviews.length > 0
      ? ratedReviews.reduce((sum, r) => sum + (r.rating ?? 0), 0) / ratedReviews.length
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
          <p className="mt-3 text-3xl font-semibold text-white">{totalReviews ?? 0}</p>
          {avgRating > 0 && <p className="mt-1 text-sm text-slate-400">{avgRating.toFixed(1)} avg rating</p>}
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
          <p className="mt-3 text-3xl font-semibold text-white">{unrepliedCount ?? 0}</p>
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
                  className={`h-4 w-4 ${i < Math.round(avgRating) ? "text-yellow-500" : "text-slate-700"}`}
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

      {/* Reviews List with Pagination */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Reviews</h2>
        <ReviewsList reviews={reviews} currentPage={page} totalPages={totalPages} totalCount={count || 0} />
      </section>
    </div>
  );
}
