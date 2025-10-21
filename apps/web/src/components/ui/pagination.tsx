"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
}

export function Pagination({ currentPage, totalPages, totalCount }: PaginationProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const createPageUrl = (pageNumber: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", pageNumber.toString());
    return `${pathname}?${params.toString()}`;
  };

  const isFirstPage = currentPage === 1;
  const isLastPage = currentPage === totalPages;

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-between border-t border-slate-800 pt-4">
      <div className="text-sm text-slate-400">
        Showing page {currentPage} of {totalPages} ({totalCount} total reviews)
      </div>

      <div className="flex items-center gap-2">
        <Link
          href={createPageUrl(currentPage - 1)}
          className={`inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800 hover:text-white ${
            isFirstPage ? "pointer-events-none opacity-50" : ""
          }`}
          aria-disabled={isFirstPage}
          tabIndex={isFirstPage ? -1 : undefined}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Link>

        <div className="flex items-center gap-1">
          {/* Show first page */}
          {currentPage > 2 && (
            <>
              <Link
                href={createPageUrl(1)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
              >
                1
              </Link>
              {currentPage > 3 && <span className="px-2 text-slate-500">...</span>}
            </>
          )}

          {/* Show previous page */}
          {currentPage > 1 && (
            <Link
              href={createPageUrl(currentPage - 1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
            >
              {currentPage - 1}
            </Link>
          )}

          {/* Current page */}
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-md border-2 border-emerald-500 bg-emerald-500/10 text-emerald-400 text-sm font-medium">
            {currentPage}
          </div>

          {/* Show next page */}
          {currentPage < totalPages && (
            <Link
              href={createPageUrl(currentPage + 1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
            >
              {currentPage + 1}
            </Link>
          )}

          {/* Show last page */}
          {currentPage < totalPages - 1 && (
            <>
              {currentPage < totalPages - 2 && <span className="px-2 text-slate-500">...</span>}
              <Link
                href={createPageUrl(totalPages)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
              >
                {totalPages}
              </Link>
            </>
          )}
        </div>

        <Link
          href={createPageUrl(currentPage + 1)}
          className={`inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800 hover:text-white ${
            isLastPage ? "pointer-events-none opacity-50" : ""
          }`}
          aria-disabled={isLastPage}
          tabIndex={isLastPage ? -1 : undefined}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
