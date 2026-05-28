// app/funds/[slug]/loading.tsx — Instant skeleton while fund detail loads
export default function FundDetailLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8 animate-pulse">
      {/* Back + action bar */}
      <div className="flex items-center justify-between">
        <div className="h-5 w-32 bg-slate-200 rounded" />
        <div className="flex gap-2">
          <div className="h-9 w-24 bg-slate-200 rounded-lg" />
          <div className="h-9 w-36 bg-slate-200 rounded-lg" />
        </div>
      </div>

      {/* Fund header card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 space-y-3">
            <div className="flex gap-2">
              <div className="h-6 w-20 bg-blue-100 rounded" />
              <div className="h-6 w-28 bg-slate-100 rounded" />
              <div className="h-6 w-10 bg-slate-100 rounded" />
            </div>
            <div className="h-7 w-72 bg-slate-200 rounded" />
            <div className="h-4 w-96 bg-slate-100 rounded" />
            <div className="flex gap-6 mt-2">
              <div className="h-4 w-32 bg-slate-100 rounded" />
              <div className="h-4 w-24 bg-slate-100 rounded" />
              <div className="h-4 w-28 bg-slate-100 rounded" />
            </div>
          </div>
          {/* NAV box */}
          <div className="w-56 h-36 bg-slate-100 rounded-xl" />
        </div>
      </div>

      {/* Return metrics grid */}
      <div>
        <div className="h-6 w-40 bg-slate-200 rounded mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 bg-slate-100 rounded-xl" />
          ))}
        </div>
      </div>

      {/* Risk metrics */}
      <div>
        <div className="h-6 w-56 bg-slate-200 rounded mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-slate-100 rounded-xl" />
          ))}
        </div>
      </div>

      {/* Chart placeholder */}
      <div>
        <div className="h-6 w-44 bg-slate-200 rounded mb-4" />
        <div className="h-64 bg-slate-100 rounded-xl" />
      </div>
    </div>
  )
}
