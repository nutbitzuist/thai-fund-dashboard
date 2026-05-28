// app/rankings/loading.tsx — Instant skeleton while rankings data loads
export default function RankingsLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 animate-pulse">
      {/* Header */}
      <div className="mb-6">
        <div className="h-8 w-48 bg-slate-200 rounded-lg mb-2" />
        <div className="h-4 w-80 bg-slate-100 rounded" />
      </div>

      {/* Disclaimer banner skeleton */}
      <div className="mb-6 h-14 bg-amber-50 border border-amber-100 rounded-xl" />

      {/* Filter bar */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 w-20 bg-slate-200 rounded-full" />
        ))}
      </div>

      {/* Table rows */}
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-14 bg-slate-100 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
