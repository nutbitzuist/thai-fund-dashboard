// app/amcs/loading.tsx — Instant skeleton while AMC directory loads
export default function AmcsLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 animate-pulse">
      <div className="h-8 w-40 bg-slate-200 rounded-lg mb-2" />
      <div className="h-4 w-64 bg-slate-100 rounded mb-8" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-24 bg-slate-100 rounded-xl border border-slate-200" />
        ))}
      </div>
    </div>
  )
}
