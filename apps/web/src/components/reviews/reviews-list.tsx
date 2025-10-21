import { ReviewCard } from "./review-card";
import { Pagination } from "@/components/ui/pagination";

interface Review {
  id: string;
  review_id: string;
  location_id: string;
  author: string | null;
  rating: number | null;
  text: string | null;
  reply: string | null;
  created_at: string;
  updated_at: string;
  gbp_locations?: {
    title: string | null;
    is_managed: boolean | null;
    org_id: string;
  };
}

interface ReviewsListProps {
  reviews: Review[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
}

export function ReviewsList({ reviews, currentPage, totalPages, totalCount }: ReviewsListProps) {
  if (!reviews || reviews.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-12 text-center">
        <p className="text-lg text-slate-400">No reviews found</p>
        <p className="text-sm text-slate-500 mt-2">
          Reviews will appear here once they are synced from Google Business Profile
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {reviews.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>

      <Pagination currentPage={currentPage} totalPages={totalPages} totalCount={totalCount} />
    </div>
  );
}
