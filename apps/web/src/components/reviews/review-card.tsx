import { Star, MapPin, Calendar, MessageSquare } from "lucide-react";

interface ReviewCardProps {
  review: {
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
  };
}

export function ReviewCard({ review }: ReviewCardProps) {
  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300 dark:text-gray-600"
            }`}
          />
        ))}
      </div>
    );
  };

  const timeAgo = (date: string) => {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now.getTime() - past.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg text-white">{review.author || "Anonymous"}</h3>
            {review.rating && renderStars(review.rating)}
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-400">
            {review.gbp_locations?.title && (
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {review.gbp_locations.title}
              </div>
            )}
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {timeAgo(review.created_at)}
            </div>
          </div>
        </div>
      </div>

      {/* Review Comment */}
      {review.text && (
        <div className="space-y-2">
          <p className="text-sm leading-relaxed text-slate-200">{review.text}</p>
        </div>
      )}

      {/* Review Reply */}
      {review.reply && (
        <div className="ml-6 mt-4 border-l-2 border-emerald-500/20 pl-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-400">
            <MessageSquare className="h-4 w-4" />
            Business Reply
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{review.reply}</p>
        </div>
      )}

      {/* Action needed indicator */}
      {!review.reply && (
        <div className="flex items-center gap-2 text-sm text-amber-500">
          <MessageSquare className="h-4 w-4" />
          <span>Reply needed</span>
        </div>
      )}
    </div>
  );
}
