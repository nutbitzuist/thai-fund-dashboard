'use client'

// components/rankings/top-rankings.tsx
// Home page leaderboard — tabs 1D | 1M | 3M | YTD | 1Y + fund type filter chips

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { TrendingUp, TrendingDown, Minus, ArrowRight, Loader2 } from 'lucide-react'
import { cn, formatPct, fundUrl } from '@/lib/utils'
import { FUND_TYPE_LABELS } from '@/types'

export interface RankEntry {
  rank: number
  projId: string
  projAbbrName: string | null
  nameTh: string
  fundType?: string | null
  amc: { nameTh: string } | null
  returnPct: number | null
}

export interface TopRankingsProps {
  data1Y: RankEntry[]
  dataYTD: RankEntry[]
  data3M: RankEntry[]
  data1M: RankEntry[]
}

type Tab = '1D' | '1M' | '3M' | 'YTD' | '1Y'

const TABS: { id: Tab; label: string; apiMetric?: string; apiPath?: 'rankings' | 'movers' }[] = [
  { id: '1D', label: 'วันนี้', apiPath: 'movers' },
  { id: '1M', label: '1 เดือน', apiPath: 'rankings', apiMetric: 'return1M' },
  { id: '3M', label: '3 เดือน', apiPath: 'rankings', apiMetric: 'return3M' },
  { id: 'YTD', label: 'ปีนี้', apiPath: 'rankings', apiMetric: 'returnYTD' },
  { id: '1Y', label: '1 ปี', apiPath: 'rankings', apiMetric: 'return1Y' },
]

// Top-level fund types for chip filter (not all types — keep it short)
const TYPE_CHIPS = [
  { value: '', label: 'ทั้งหมด' },
  { value: 'EQ', label: 'หุ้นไทย' },
  { value: 'FIF', label: 'ต่างประเทศ' },
  { value: 'FI', label: 'ตราสารหนี้' },
  { value: 'BA', label: 'ผสม' },
  { value: 'MM', label: 'ตลาดเงิน' },
  { value: 'RMF', label: 'RMF' },
  { value: 'SSF', label: 'SSF' },
]

function ReturnBadge({ value }: { value: number | null }) {
  if (value == null) return <span className="text-slate-400 text-sm">-</span>
  const isPos = value > 0
  const isNeg = value < 0
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-sm font-semibold tabular-nums',
      isPos && 'text-emerald-600',
      isNeg && 'text-red-600',
      !isPos && !isNeg && 'text-slate-500',
    )}>
      {isPos ? <TrendingUp className="h-3.5 w-3.5" /> : isNeg ? <TrendingDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
      {formatPct(value)}
    </span>
  )
}

function RankBadge({ rank }: { rank: number }) {
  const colors = [
    'bg-amber-100 text-amber-700 ring-amber-200',
    'bg-slate-100 text-slate-600 ring-slate-200',
    'bg-orange-100 text-orange-700 ring-orange-200',
  ]
  const cls = colors[rank - 1] ?? 'bg-white text-slate-500 ring-slate-100'
  return (
    <span className={cn('inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ring-1', cls)}>
      {rank}
    </span>
  )
}

const METRIC_URL_MAP: Partial<Record<Tab, string>> = {
  '1Y': 'return1Y',
  'YTD': 'returnYTD',
  '3M': 'return6M',
  '1M': 'return1M',
}

export function TopRankings({ data1Y, dataYTD, data3M, data1M }: TopRankingsProps) {
  const [tab, setTab] = useState<Tab>('1Y')
  const [fundType, setFundType] = useState('')
  const [rows, setRows] = useState<RankEntry[]>(data1Y)
  const [loading, setLoading] = useState(false)

  // Server-provided initial data (no API call needed for default state)
  const getServerData = useCallback((t: Tab): RankEntry[] | null => {
    if (fundType) return null // filtered — always fetch from API
    switch (t) {
      case '1Y': return data1Y
      case 'YTD': return dataYTD
      case '3M': return data3M
      case '1M': return data1M
      default: return null
    }
  }, [fundType, data1Y, dataYTD, data3M, data1M])

  const fetchData = useCallback(async (t: Tab, type: string) => {
    const serverData = getServerData(t)
    if (serverData && !type) {
      setRows(serverData)
      return
    }

    setLoading(true)
    try {
      let url: string
      if (t === '1D') {
        url = `/api/movers?limit=10${type ? `&fundType=${type}` : ''}`
        const res = await fetch(url)
        const json = await res.json()
        setRows((json.gainers ?? []).map((g: RankEntry) => g))
      } else {
        const metric = METRIC_URL_MAP[t] ?? 'return1Y'
        url = `/api/rankings?metric=${metric}&sort=desc&limit=10${type ? `&fundType=${type}` : ''}`
        const res = await fetch(url)
        const json = await res.json()
        setRows(json.data ?? [])
      }
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [getServerData])

  useEffect(() => {
    fetchData(tab, fundType)
  }, [tab, fundType, fetchData])

  const handleTab = (t: Tab) => {
    setTab(t)
  }

  const metricParam = METRIC_URL_MAP[tab] ?? (tab === '1D' ? '' : 'return1Y')
  const rankingsHref = tab === '1D'
    ? `/movers${fundType ? `?fundType=${fundType}` : ''}`
    : `/rankings?metric=${metricParam}&sort=desc${fundType ? `&fundType=${fundType}` : ''}`

  return (
    <div>
      {/* Fund type chips */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {TYPE_CHIPS.map((chip) => (
          <button
            key={chip.value}
            onClick={() => setFundType(chip.value)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              fundType === chip.value
                ? 'bg-slate-800 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-400 hover:text-slate-900',
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Period tabs */}
      <div className="flex gap-1.5 mb-5 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => handleTab(t.id)}
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
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : rows.length === 0 ? (
        <div className="py-10 text-center text-slate-400 text-sm">ยังไม่มีข้อมูลในช่วงเวลานี้</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {rows.map((entry) => (
            <Link
              key={entry.projId}
              href={fundUrl(entry)}
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
                  {entry.fundType && (
                    <span className="text-xs text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">
                      {FUND_TYPE_LABELS[entry.fundType] ?? entry.fundType}
                    </span>
                  )}
                  <span className="text-sm font-medium text-slate-800 truncate max-w-[180px] sm:max-w-none">
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
          href={rankingsHref}
          className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:text-blue-900 font-medium"
        >
          ดูอันดับทั้งหมด <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
