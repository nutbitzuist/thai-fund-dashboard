'use client'

// components/rankings/top-rankings.tsx
// Homepage leaderboard tabs: 1Y Return / YTD / 3M Return

import { useState } from 'react'
import Link from 'next/link'
import { TrendingUp, TrendingDown, Minus, ArrowRight, Trophy } from 'lucide-react'
import { cn, formatPct } from '@/lib/utils'

export interface RankEntry {
  rank: number
  projId: string
  projAbbrName: string | null
  nameTh: string
  amc: { nameTh: string } | null
  returnPct: number | null
}

export interface TopRankingsProps {
  data1Y: RankEntry[]
  dataYTD: RankEntry[]
  data3M: RankEntry[]
}

type Tab = '1Y' | 'YTD' | '3M'

const TABS: { id: Tab; label: string }[] = [
  { id: '1Y', label: 'ผลตอบแทน 1 ปี' },
  { id: 'YTD', label: 'ปีนี้ (YTD)' },
  { id: '3M', label: '3 เดือน' },
]

function ReturnBadge({ value }: { value: number | null }) {
  if (value == null) return <span className="text-slate-400 text-sm">-</span>
  const isPos = value > 0
  const isNeg = value < 0
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-sm font-semibold tabular-nums',
        isPos && 'text-emerald-600',
        isNeg && 'text-red-600',
        !isPos && !isNeg && 'text-slate-500',
      )}
    >
      {isPos ? <TrendingUp className="h-3.5 w-3.5" /> : isNeg ? <TrendingDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
      {formatPct(value)}
    </span>
  )
}

function RankBadge({ rank }: { rank: number }) {
  const colors = [
    'bg-amber-100 text-amber-700 ring-amber-200',   // 1st
    'bg-slate-100 text-slate-600 ring-slate-200',   // 2nd
    'bg-orange-100 text-orange-700 ring-orange-200', // 3rd
  ]
  const cls = colors[rank - 1] ?? 'bg-white text-slate-500 ring-slate-100'
  return (
    <span className={cn('inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ring-1', cls)}>
      {rank}
    </span>
  )
}

export function TopRankings({ data1Y, dataYTD, data3M }: TopRankingsProps) {
  const [tab, setTab] = useState<Tab>('1Y')

  const rows = tab === '1Y' ? data1Y : tab === 'YTD' ? dataYTD : data3M
  const metricParam = tab === '1Y' ? 'return1Y' : tab === 'YTD' ? 'returnYTD' : 'return6M'

  return (
    <div>
      {/* Tab pills */}
      <div className="flex gap-1.5 mb-5 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              tab === t.id
                ? 'bg-blue-700 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Leaderboard */}
      {rows.length === 0 ? (
        <div className="py-10 text-center text-slate-400 text-sm">ยังไม่มีข้อมูลในช่วงเวลานี้</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {rows.map((entry) => (
            <Link
              key={entry.projId}
              href={`/funds/${entry.projId}`}
              className="flex items-center gap-3 py-3 px-2 -mx-2 rounded-lg hover:bg-blue-50 transition-colors group"
            >
              <RankBadge rank={entry.rank} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {entry.projAbbrName && (
                    <span className="text-xs font-mono font-semibold text-blue-700 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5 group-hover:bg-blue-100">
                      {entry.projAbbrName}
                    </span>
                  )}
                  <span className="text-sm font-medium text-slate-800 truncate max-w-[200px] sm:max-w-none">
                    {entry.nameTh}
                  </span>
                </div>
                {entry.amc && (
                  <div className="text-xs text-slate-400 mt-0.5 truncate">{entry.amc.nameTh}</div>
                )}
              </div>
              <ReturnBadge value={entry.returnPct} />
            </Link>
          ))}
        </div>
      )}

      {/* Footer link */}
      <div className="mt-5 text-center">
        <Link
          href={`/rankings?metric=${metricParam}&sort=desc`}
          className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:text-blue-900 font-medium"
        >
          ดูอันดับทั้งหมด <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
