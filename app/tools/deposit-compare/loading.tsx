export default function DepositCompareLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 animate-pulse">
      <div className="mb-6">
        <div className="h-8 w-56 bg-slate-200 rounded-lg mb-2" />
        <div className="h-4 w-80 bg-slate-100 rounded" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-80 bg-slate-100 rounded-xl" />
        <div className="h-80 bg-slate-100 rounded-xl" />
      </div>
    </div>
  )
}
