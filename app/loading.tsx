// app/loading.tsx — Global fallback skeleton (shown during top-level page transitions)
export default function GlobalLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-64 bg-slate-200 rounded-lg" />
        <div className="h-4 w-96 bg-slate-100 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 bg-slate-100 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
