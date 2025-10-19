export function LocationsTableSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Page size selector skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-4 w-12 bg-slate-800 rounded" />
          <div className="h-8 w-16 bg-slate-800 rounded" />
          <div className="h-4 w-16 bg-slate-800 rounded" />
        </div>
        <div className="h-4 w-48 bg-slate-800 rounded" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <div className="max-h-[480px] overflow-y-auto">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="bg-slate-900/95 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">
                  <div className="h-4 w-16 bg-slate-700 rounded" />
                </th>
                <th className="px-4 py-3">
                  <div className="h-4 w-20 bg-slate-700 rounded" />
                </th>
                <th className="px-4 py-3">
                  <div className="h-4 w-24 bg-slate-700 rounded" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {Array.from({ length: 8 }).map((_, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-3">
                    <div className="h-4 w-4 bg-slate-800 rounded" />
                  </td>
                  <td className="px-4 py-3 space-y-2">
                    <div className="h-4 w-48 bg-slate-800 rounded" />
                    <div className="h-3 w-64 bg-slate-800/60 rounded" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-3 w-32 bg-slate-800 rounded" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action buttons skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-9 w-48 bg-slate-800 rounded-lg" />
        <div className="flex items-center gap-1">
          <div className="h-9 w-10 bg-slate-800 rounded-lg" />
          <div className="h-9 w-10 bg-slate-800 rounded-lg" />
          <div className="h-9 w-10 bg-slate-800 rounded-lg" />
          <div className="h-9 w-10 bg-slate-800 rounded-lg" />
          <div className="h-9 w-10 bg-slate-800 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
