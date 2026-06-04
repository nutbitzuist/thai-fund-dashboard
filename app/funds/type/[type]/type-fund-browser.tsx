'use client'

// Client component: shows ranked funds for a specific type with sorting

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RiskBadge } from '@/components/metrics/risk-badge'
import { cn, getReturnColorClass, fundUrl } from '@/lib/utils'

interface FundRow {
  rank: number
  projId: string
  projAbbrName: string | null
  nameTh: string
  riskLevel: number | null
  amc: { nameTh: string } | null
  returnPct: number | null
  annualizedVolatilityPct: number | null
  sharpeRatio: number | null
}

type Metric = 'return1Y' | 'return1M' | 'return3Y' | 'return6M' | 'returnYTD' | 'volatility1Y' | 'sharpe1Y'

const METRIC_LABELS: Record<Metric, string> = {
  return1Y: '1 ปี',
  return1M: '1 เดือน',
  return3Y: '3 ปี',
  return6M: '6 เดือน',
  returnYTD: 'ปีนี้ (YTD)',
  volatility1Y: 'Volatility',
  sharpe1Y: 'Sharpe',
}

interface Props { fundType: string }

export function TypeFundBrowser({ fundType }: Props) {
  const [metric, setMetric] = useState<Metric>('return1Y')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<FundRow[]>([])
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ metric, sort: sortDir, fundType, page: String(page), limit: '25' })
      const res = await fetch(`/api/rankings?${params}`)
      const json = await res.json()
      setData(json.data ?? [])
      setPagination(json.pagination ?? { total: 0, totalPages: 0 })
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }, [metric, sortDir, fundType, page])

  useEffect(() => { fetch_() }, [fetch_])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={metric} onValueChange={(v) => { setMetric(v as Metric); setPage(1) }}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(METRIC_LABELS) as [Metric, string][]).map(([k, v]) => (
              <SelectItem key={k} value={k}>ผลตอบแทน {v}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortDir} onValueChange={(v) => { setSortDir(v as 'asc' | 'desc'); setPage(1) }}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">มากไปน้อย</SelectItem>
            <SelectItem value="asc">น้อยไปมาก</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-sm text-slate-500">พบ {pagination.total.toLocaleString('th-TH')} กองทุน</span>
      </div>

      <div className="rounded-xl border border-slate-200 overflow-x-auto bg-white">
        <table className="w-full min-w-[540px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 w-12">#</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500">กองทุน</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500">เสี่ยง</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500">
                {METRIC_LABELS[metric]}
              </th>
              {metric.startsWith('return') && (
                <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 hidden lg:table-cell">Sharpe</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}><td colSpan={5} className="px-4 py-3"><div className="h-4 bg-slate-200 animate-pulse rounded" /></td></tr>
                ))
              : data.map((row) => (
                  <tr key={row.projId} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-400 tabular-nums">{row.rank}</td>
                    <td className="px-3 py-3">
                      <Link href={fundUrl(row)} className="block group">
                        <span className="text-xs font-mono font-bold text-blue-700">{row.projAbbrName ?? row.projId}</span>
                        <span className="block text-sm text-slate-900 line-clamp-1 mt-0.5 group-hover:text-blue-700">{row.nameTh}</span>
                        <span className="text-xs text-slate-400">{row.amc?.nameTh}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-center"><RiskBadge riskLevel={row.riskLevel} showLabel={false} /></td>
                    <td className={cn('px-3 py-3 text-right text-sm font-bold tabular-nums', getReturnColorClass(row.returnPct))}>
                      {row.returnPct != null ? `${row.returnPct >= 0 ? '+' : ''}${row.returnPct.toFixed(2)}%` : '-'}
                    </td>
                    {metric.startsWith('return') && (
                      <td className="px-3 py-3 text-right text-sm text-slate-500 tabular-nums hidden lg:table-cell">
                        {row.sharpeRatio != null ? row.sharpeRatio.toFixed(2) : '-'}
                      </td>
                    )}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-slate-600 px-3">{page} / {pagination.totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
