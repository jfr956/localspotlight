"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState, useEffect } from "react";
import { updateManagedLocationsAction } from "./server-actions";
import { Pagination } from "./pagination";

interface Location {
  id: string;
  title: string | null;
  google_location_name: string;
  is_managed: boolean | null;
  sync_state: {
    syncedAt?: string;
    labels?: string[];
  } | null;
}

interface LocationsTableProps {
  orgId: string;
  searchParams?: Record<string, string | string[] | undefined>;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const DEFAULT_PAGE_SIZE = 20;

export function LocationsTable({ orgId, searchParams }: LocationsTableProps) {
  const router = useRouter();
  const urlParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [locations, setLocations] = useState<Location[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Parse pagination params from URL
  const currentPage = parseInt(
    (typeof searchParams?.page === "string" ? searchParams.page : urlParams.get("page")) || "1",
    10,
  );
  const pageSize = parseInt(
    (typeof searchParams?.pageSize === "string"
      ? searchParams.pageSize
      : urlParams.get("pageSize")) || String(DEFAULT_PAGE_SIZE),
    10,
  );

  // Fetch locations data
  useEffect(() => {
    async function fetchLocations() {
      setIsLoading(true);
      try {
        const from = (currentPage - 1) * pageSize;
        const to = from + pageSize - 1;

        const response = await fetch(
          `/api/integrations/google/locations?orgId=${orgId}&from=${from}&to=${to}`,
        );
        const data = await response.json();

        setLocations(data.locations || []);
        setTotalCount(data.totalCount || 0);
      } catch (error) {
        console.error("Failed to fetch locations:", error);
        setLocations([]);
        setTotalCount(0);
      } finally {
        setIsLoading(false);
      }
    }

    void fetchLocations();
  }, [orgId, currentPage, pageSize]);

  const totalPages = Math.ceil(totalCount / pageSize);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(urlParams.toString());
    params.set("page", String(newPage));
    params.set("orgId", orgId);

    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false });
    });
  };

  const handlePageSizeChange = (newPageSize: number) => {
    const params = new URLSearchParams(urlParams.toString());
    params.set("pageSize", String(newPageSize));
    params.set("page", "1"); // Reset to first page when changing page size
    params.set("orgId", orgId);

    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false });
    });
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-4">
      {/* Page size selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span>Show</span>
          <select
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span>per page</span>
        </div>
        <div className="text-sm text-slate-400">
          Showing {locations.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{" "}
          {Math.min(currentPage * pageSize, totalCount)} of {totalCount} locations
        </div>
      </div>

      {/* Locations table */}
      <form action={updateManagedLocationsAction} className="space-y-3">
        <input type="hidden" name="orgId" value={orgId} />
        <div className="relative rounded-xl border border-slate-800 overflow-hidden">
          {isPending && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-emerald-400" />
                Loading...
              </div>
            </div>
          )}
          <div className="max-h-[480px] overflow-y-auto">
            <table className="min-w-full divide-y divide-slate-800 text-sm">
              <thead className="sticky top-0 bg-slate-900/95 text-left text-xs uppercase tracking-wide text-slate-400 backdrop-blur-sm">
                <tr>
                  <th className="px-4 py-3">Manage</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Last Sync</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {locations.map((location) => {
                  const syncedAt =
                    typeof location.sync_state?.syncedAt === "string"
                      ? new Date(location.sync_state.syncedAt).toLocaleString()
                      : "Never";
                  return (
                    <tr key={location.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          name="managedLocationIds"
                          value={location.id}
                          defaultChecked={location.is_managed ?? false}
                          className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500/60"
                        />
                      </td>
                      <td className="px-4 py-3 text-slate-200">
                        <div className="font-medium text-white">
                          {location.title ?? "Untitled location"}
                        </div>
                        <div className="text-xs text-slate-500 break-all">
                          {location.google_location_name}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{syncedAt}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isPending}
          >
            Save managed locations
          </button>

          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              isPending={isPending}
            />
          )}
        </div>
      </form>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="flex items-center gap-3 text-slate-400">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-400" />
        <span className="text-sm">Loading locations...</span>
      </div>
    </div>
  );
}
