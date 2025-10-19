import Link from "next/link";
import { createServerComponentClientWithAuth } from "@/lib/supabase";
import type { Tables } from "@/types/database";

export const metadata = {
  title: "Locations • LocalSpotlight",
};

type Location = Tables<"gbp_locations">;

export default async function LocationsPage() {
  const supabase = await createServerComponentClientWithAuth();
  const db = supabase as unknown as { from: typeof supabase.from };

  // Fetch all managed locations
  const { data: locationsData } = await db
    .from("gbp_locations")
    .select("*")
    .eq("is_managed", true)
    .order("title", { ascending: true });

  const locations = (locationsData as Location[] | null) ?? [];

  // Get stats for each location
  const locationStats = await Promise.all(
    locations.map(async (location) => {
      const [reviewsResult, schedulesResult] = await Promise.all([
        db
          .from("gbp_reviews")
          .select("rating", { count: "exact", head: true })
          .eq("location_id", location.id),
        db
          .from("schedules")
          .select("id", { count: "exact", head: true })
          .eq("location_id", location.id)
          .eq("status", "pending"),
      ]);

      return {
        locationId: location.id,
        reviewsCount: reviewsResult.count ?? 0,
        pendingPosts: schedulesResult.count ?? 0,
      };
    })
  );

  const statsMap = new Map(locationStats.map((s) => [s.locationId, s]));

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Locations</h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage your Google Business Profile locations
          </p>
        </div>
        <Link
          href="/integrations/google"
          className="inline-flex items-center justify-center rounded-lg border border-emerald-500 px-4 py-2 text-sm font-medium text-emerald-400 transition hover:bg-emerald-500/10"
        >
          Sync from Google
        </Link>
      </header>

      {locations.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-12 text-center">
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
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-white">No locations yet</h3>
          <p className="mt-2 text-sm text-slate-400">
            Connect your Google Business Profile account to sync locations.
          </p>
          <Link
            href="/integrations/google"
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 transition hover:bg-emerald-400"
          >
            Connect Google
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map((location) => {
            const stats = statsMap.get(location.id);
            const meta = location.meta as Record<string, unknown> | null;
            const address = meta?.address as string | undefined;
            const categories = meta?.categories as string[] | undefined;
            const primaryCategory = categories?.[0];

            return (
              <Link
                key={location.id}
                href={`/locations/${location.id}`}
                className="group rounded-2xl border border-slate-800 bg-slate-900/70 p-6 transition hover:border-slate-700 hover:bg-slate-900"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-white group-hover:text-emerald-400 transition truncate">
                      {location.title ?? "Untitled Location"}
                    </h3>
                    {primaryCategory && (
                      <p className="mt-1 text-xs text-slate-500">{primaryCategory}</p>
                    )}
                  </div>
                  <svg
                    className="h-5 w-5 flex-shrink-0 text-slate-600 group-hover:text-emerald-400 transition"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>

                {address && (
                  <p className="mt-3 text-sm text-slate-400 line-clamp-2">{address}</p>
                )}

                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-slate-500">Reviews</div>
                    <div className="mt-1 text-lg font-semibold text-white">
                      {stats?.reviewsCount ?? 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Pending Posts</div>
                    <div className="mt-1 text-lg font-semibold text-white">
                      {stats?.pendingPosts ?? 0}
                    </div>
                  </div>
                </div>

                {location.sync_state && typeof location.sync_state === "object" && "syncedAt" in location.sync_state && (
                  <div className="mt-4 pt-4 border-t border-slate-800">
                    <p className="text-xs text-slate-500">
                      Last synced:{" "}
                      {new Date(location.sync_state.syncedAt as string).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
