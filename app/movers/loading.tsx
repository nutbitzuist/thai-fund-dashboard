// app/movers/loading.tsx — Instant skeleton while daily movers loads
export default function MoversLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 animate-pulse">
      <div className="h-8 w-32 bg-slate-200 rounded-lg mb-2" />
      <div className="h-4 w-72 bg-slate-100 rounded mb-6" />

      {/* Fund type chips */}
      <div className="flex gap-2 mb-6">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-8 w-16 bg-slate-200 rounded-full" />
        ))}
      </div>

      {/* Two-column gainers/losers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[0, 1].map((col) => (
          <div key={col}>
            <div className="h-6 w-28 bg-slate-200 rounded mb-3" />
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-14 bg-slate-100 rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
