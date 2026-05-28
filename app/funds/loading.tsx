// app/funds/loading.tsx — Instant skeleton while fund list loads
export default function FundsLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 animate-pulse">
      {/* Search bar */}
      <div className="h-11 bg-slate-200 rounded-xl mb-4 max-w-lg" />

      {/* Filter chips */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-8 w-16 bg-slate-200 rounded-full" />
        ))}
      </div>

      {/* Fund cards */}
      <div className="space-y-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-16 bg-slate-100 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
