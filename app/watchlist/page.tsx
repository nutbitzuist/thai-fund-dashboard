'use client'

// app/watchlist/page.tsx
// Shows all funds the user has saved to their watchlist (localStorage)

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Heart, TrendingUp, Trash2, ArrowRight, Search } from 'lucide-react'
import { useWatchlist } from '@/hooks/useWatchlist'
import { Button } from '@/components/ui/button'
import { FUND_TYPE_LABELS } from '@/types'
import { fundUrl, formatPct, formatNav, getReturnColorClass, cn, formatDateTh } from '@/lib/utils'

interface FundLiveData {
  projId: string
  latestNav: number | null
  dailyChangePct: number | null
  return1Y: number | null
}

export default function WatchlistPage() {
  const { items, remove, hydrated } = useWatchlist()
  const [liveData, setLiveData] = useState<Record<string, FundLiveData>>({})
  const [loadingLive, setLoadingLive] = useState(false)

  // Fetch live data for watchlist funds
  useEffect(() => {
    if (!hydrated || items.length === 0) return
    const projIds = items.map((i) => i.projId)

    const fetchLive = async () => {
      setLoadingLive(true)
      try {
        // Fetch up to 20 funds at a time via /api/funds?q=... (search by projId)
        const results: FundLiveData[] = await Promise.all(
          projIds.slice(0, 30).map(async (projId) => {
            try {
              const res = await fetch(`/api/funds/${encodeURIComponent(projId)}`)
              if (!res.ok) return { projId, latestNav: null, dailyChangePct: null, return1Y: null }
              const json = await res.json()
              return {
                projId,
                latestNav: json.latestNav ?? null,
                dailyChangePct: json.dailyChangePct ?? null,
                return1Y: json.metrics?.['1Y']?.returnPct ?? null,
              }
            } catch {
              return { projId, latestNav: null, dailyChangePct: null, return1Y: null }
            }
          })
        )
        const map: Record<string, FundLiveData> = {}
        for (const r of results) map[r.projId] = r
        setLiveData(map)
      } finally {
        setLoadingLive(false)
      }
    }

    fetchLive()
  }, [hydrated, items.length]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <div className="h-8 w-48 bg-slate-200 animate-pulse rounded mx-auto" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Heart className="h-6 w-6 text-red-500 fill-current" />
            รายการติดตาม
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {items.length > 0 ? `${items.length} กองทุนที่บันทึกไว้` : 'ยังไม่มีกองทุนที่บันทึก'}
            {' '}— บันทึกในเบราว์เซอร์นี้เท่านั้น
          </p>
        </div>
        <Link href="/funds">
          <Button variant="outline" size="sm">
            <Search className="h-4 w-4 mr-1.5" />
            ค้นหากองทุน
          </Button>
        </Link>
      </div>

      {items.length === 0 ? (
        /* Empty state */
        <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-2xl">
          <Heart className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-600 mb-2">ยังไม่มีกองทุนที่ติดตาม</h2>
          <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">
            กดปุ่ม &ldquo;ติดตาม&rdquo; บนหน้าข้อมูลกองทุนเพื่อบันทึกไว้ที่นี่
          </p>
          <Link href="/rankings">
            <Button>
              <TrendingUp className="h-4 w-4 mr-1.5" />
              ดูอันดับกองทุน
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const live = liveData[item.projId]
            return (
              <div
                key={item.projId}
                className="flex items-center gap-4 bg-white rounded-xl border border-slate-200 px-4 py-4 hover:border-blue-200 hover:shadow-sm transition-all group"
              >
                {/* Fund info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 rounded px-1.5 py-0.5">
                      {item.projAbbrName ?? item.projId}
                    </span>
                    {item.fundType && (
                      <span className="text-xs text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">
                        {FUND_TYPE_LABELS[item.fundType] ?? item.fundType}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-slate-800 truncate mt-1">{item.nameTh}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    เพิ่มเมื่อ {formatDateTh(item.addedAt)}
                  </p>
                </div>

                {/* Live stats */}
                <div className="hidden sm:flex items-center gap-6 text-right shrink-0">
                  {loadingLive ? (
                    <div className="w-20 h-8 bg-slate-100 animate-pulse rounded" />
                  ) : live ? (
                    <>
                      <div>
                        <p className="text-xs text-slate-400">NAV</p>
                        <p className="text-sm font-semibold text-slate-800 tabular-nums">
                          {live.latestNav != null ? formatNav(live.latestNav) : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">วันนี้</p>
                        <p className={cn('text-sm font-semibold tabular-nums', getReturnColorClass(live.dailyChangePct))}>
                          {live.dailyChangePct != null ? formatPct(live.dailyChangePct) : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">1 ปี</p>
                        <p className={cn('text-sm font-semibold tabular-nums', getReturnColorClass(live.return1Y))}>
                          {live.return1Y != null ? formatPct(live.return1Y) : '-'}
                        </p>
                      </div>
                    </>
                  ) : null}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Link href={fundUrl(item)} className="text-blue-600 hover:text-blue-800">
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => remove(item.projId)}
                    className="text-slate-400 hover:text-red-500 transition-colors"
                    title="นำออก"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
