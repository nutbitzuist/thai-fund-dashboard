'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, TrendingUp, Activity, TrendingDown, BarChart3, Medal, Download, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { RiskBadge } from '@/components/metrics/risk-badge'
import { RANKING_PRESETS, FUND_TYPE_LABELS } from '@/types'
import { fundUrl } from '@/lib/utils'
import { cn, formatPct, getReturnColorClass } from '@/lib/utils'

interface RankingRow {
  rank: number
  projId: string
  projAbbrName: string | null
  nameTh: string
  fundType: string | null
  riskLevel: number | null
  amc: { nameTh: string } | null
  returnPct: number | null
  annualizedVolatilityPct: number | null
  maxDrawdownPct: number | null
  sharpeRatio: number | null
  navCount: number | null
  endDate: string
}

// 1D movers row shape (from /api/movers)
interface MoverRow {
  rank: number
  projId: string
  projAbbrName: string | null
  nameTh: string
  fundType: string | null
  riskLevel: number | null
  amc: { nameTh: string } | null
  returnPct: number | null
}

type Metric = 'return1D' | 'return1Y' | 'return1M' | 'return3Y' | 'return6M' | 'volatility1Y' | 'maxDrawdown1Y' | 'sharpe1Y'
type SortDir = 'asc' | 'desc'

const PRESET_ICONS = [TrendingUp, Activity, TrendingDown, BarChart3]

function exportToCsv(data: RankingRow[], metric: Metric) {
  const headers = ['อันดับ', 'รหัสกองทุน', 'ชื่อกองทุน', 'ประเภท', 'บลจ.', 'ความเสี่ยง', getMetricLabelStr(metric), 'Volatility 1Y', 'Sharpe 1Y', 'Max Drawdown 1Y']
  const rows = data.map((r) => [
    r.rank,
    r.projAbbrName ?? r.projId,
    `"${r.nameTh}"`,
    r.fundType ? (FUND_TYPE_LABELS[r.fundType] ?? r.fundType) : '',
    `"${r.amc?.nameTh ?? ''}"`,
    r.riskLevel ?? '',
    r.returnPct != null ? r.returnPct.toFixed(2) : '',
    r.annualizedVolatilityPct != null ? r.annualizedVolatilityPct.toFixed(2) : '',
    r.sharpeRatio != null ? r.sharpeRatio.toFixed(2) : '',
    r.maxDrawdownPct != null ? r.maxDrawdownPct.toFixed(2) : '',
  ])
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `fund-rankings-${metric}-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function getMetricLabelStr(metric: Metric): string {
  switch (metric) {
    case 'return1D': return 'ผลตอบแทนวันนี้ (%)'
    case 'return1Y': return 'ผลตอบแทน 1 ปี (%)'
    case 'return1M': return 'ผลตอบแทน 1 เดือน (%)'
    case 'return3Y': return 'ผลตอบแทน 3 ปี (%)'
    case 'return6M': return 'ผลตอบแทน 6 เดือน (%)'
    case 'volatility1Y': return 'Volatility 1 ปี (%)'
    case 'maxDrawdown1Y': return 'Max Drawdown 1 ปี (%)'
    case 'sharpe1Y': return 'Sharpe Ratio 1 ปี'
  }
}

export function RankingsClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Read initial state from URL params (enables shareable URLs)
  const [metric, setMetric] = useState<Metric>((searchParams.get('metric') as Metric) ?? 'return1Y')
  const [sortDir, setSortDir] = useState<SortDir>((searchParams.get('sort') as SortDir) ?? 'desc')
  const [fundType, setFundType] = useState(searchParams.get('fundType') ?? '')
  const [riskLevel, setRiskLevel] = useState(searchParams.get('riskLevel') ?? '')
  const [page, setPage] = useState(Number(searchParams.get('page') ?? 1))
  const [data, setData] = useState<RankingRow[]>([])
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0, page: 1 })
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  // Push state to URL so it's shareable
  const pushUrl = useCallback((m: Metric, s: SortDir, ft: string, rl: string, p: number) => {
    const params = new URLSearchParams()
    params.set('metric', m)
    params.set('sort', s)
    if (ft) params.set('fundType', ft)
    if (rl) params.set('riskLevel', rl)
    if (p > 1) params.set('page', String(p))
    router.replace(`/rankings?${params.toString()}`, { scroll: false })
  }, [router])

  const fetchRankings = useCallback(async () => {
    setLoading(true)
    try {
      if (metric === 'return1D') {
        // 1D: fetch from movers API
        const params = new URLSearchParams({ limit: '25' })
        if (fundType) params.set('fundType', fundType)
        const res = await fetch(`/api/movers?${params}`)
        const json = await res.json()
        const movers: MoverRow[] = sortDir === 'desc' ? (json.gainers ?? []) : (json.losers ?? [])
        // Reshape to RankingRow
        setData(movers.map((m, i) => ({
          rank: i + 1,
          projId: m.projId,
          projAbbrName: m.projAbbrName,
          nameTh: m.nameTh,
          fundType: m.fundType,
          riskLevel: m.riskLevel,
          amc: m.amc,
          returnPct: m.returnPct,
          annualizedVolatilityPct: null,
          maxDrawdownPct: null,
          sharpeRatio: null,
          navCount: null,
          endDate: json.date ?? '',
        })))
        setPagination({ total: movers.length, totalPages: 1, page: 1 })
      } else {
        const params = new URLSearchParams({ metric, sort: sortDir, page: String(page), limit: '25' })
        if (fundType) params.set('fundType', fundType)
        if (riskLevel) params.set('riskLevel', riskLevel)
        const res = await fetch(`/api/rankings?${params}`)
        const json = await res.json()
        setData(json.data ?? [])
        setPagination(json.pagination ?? { total: 0, totalPages: 0, page: 1 })
      }
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }, [metric, sortDir, fundType, riskLevel, page])

  useEffect(() => { fetchRankings() }, [fetchRankings])

  const applyPreset = (preset: typeof RANKING_PRESETS[0]) => {
    const m = preset.metric as Metric
    const s = preset.sort
    setMetric(m)
    setSortDir(s)
    setPage(1)
    pushUrl(m, s, fundType, riskLevel, 1)
  }

  const changeMetric = (v: string) => {
    const m = v as Metric
    setMetric(m)
    setPage(1)
    pushUrl(m, sortDir, fundType, riskLevel, 1)
  }

  const changeSortDir = (v: string) => {
    const s = v as SortDir
    setSortDir(s)
    setPage(1)
    pushUrl(metric, s, fundType, riskLevel, 1)
  }

  const changeFundType = (v: string) => {
    const ft = v === 'all' ? '' : v
    setFundType(ft)
    setPage(1)
    pushUrl(metric, sortDir, ft, riskLevel, 1)
  }

  const changeRiskLevel = (v: string) => {
    const rl = v === 'all' ? '' : v
    setRiskLevel(rl)
    setPage(1)
    pushUrl(metric, sortDir, fundType, rl, 1)
  }

  const changePage = (p: number) => {
    setPage(p)
    pushUrl(metric, sortDir, fundType, riskLevel, p)
  }

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const getMetricValue = (row: RankingRow) => {
    switch (metric) {
      case 'return1D': case 'return1Y': case 'return1M': case 'return3Y': case 'return6M': return row.returnPct
      case 'volatility1Y': return row.annualizedVolatilityPct
      case 'maxDrawdown1Y': return row.maxDrawdownPct
      case 'sharpe1Y': return row.sharpeRatio
      default: return null
    }
  }

  const getMetricLabel = (m: Metric) => {
    switch (m) {
      case 'return1D': return 'ผลตอบแทนวันนี้'
      case 'return1Y': return 'ผลตอบแทน 1 ปี'
      case 'return1M': return 'ผลตอบแทน 1 เดือน'
      case 'return3Y': return 'ผลตอบแทน 3 ปี'
      case 'return6M': return 'ผลตอบแทน 6 เดือน'
      case 'volatility1Y': return 'Volatility 1 ปี'
      case 'maxDrawdown1Y': return 'Max Drawdown 1 ปี'
      case 'sharpe1Y': return 'Sharpe Ratio 1 ปี'
    }
  }

  const isPercentMetric = metric !== 'sharpe1Y'

  return (
    <div className="space-y-5">
      {/* Preset Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {RANKING_PRESETS.map((preset, i) => {
          const Icon = PRESET_ICONS[i]
          const active = metric === preset.metric && sortDir === preset.sort
          return (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset)}
              className={cn(
                'flex items-start gap-2.5 rounded-xl border p-3.5 text-left transition-all',
                active
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
              )}
            >
              <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', active ? 'text-blue-600' : 'text-slate-400')} />
              <div>
                <p className="text-xs font-semibold">{preset.label}</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-snug hidden sm:block">{preset.description}</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={metric} onValueChange={changeMetric}>
          <SelectTrigger className="w-[190px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="return1D">ผลตอบแทนวันนี้ (1D)</SelectItem>
            <SelectItem value="return1M">ผลตอบแทน 1 เดือน</SelectItem>
            <SelectItem value="return1Y">ผลตอบแทน 1 ปี</SelectItem>
            <SelectItem value="return3Y">ผลตอบแทน 3 ปี</SelectItem>
            <SelectItem value="return6M">ผลตอบแทน 6 เดือน</SelectItem>
            <SelectItem value="volatility1Y">Volatility 1 ปี</SelectItem>
            <SelectItem value="maxDrawdown1Y">Max Drawdown</SelectItem>
            <SelectItem value="sharpe1Y">Sharpe Ratio</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortDir} onValueChange={changeSortDir}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">{metric === 'return1D' ? 'ขึ้นมากสุด' : 'มากไปน้อย'}</SelectItem>
            <SelectItem value="asc">{metric === 'return1D' ? 'ลงมากสุด' : 'น้อยไปมาก'}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={fundType || 'all'} onValueChange={changeFundType}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="ประเภท" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกประเภท</SelectItem>
            {Object.entries(FUND_TYPE_LABELS)
              .filter(([k]) => ['EQ','FI','MM','BA','RE','CM','AI','FIF','SSF','RMF'].includes(k))
              .map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
          </SelectContent>
        </Select>

        {metric !== 'return1D' && (
          <Select value={riskLevel || 'all'} onValueChange={changeRiskLevel}>
            <SelectTrigger className="w-[120px] h-9">
              <SelectValue placeholder="ความเสี่ยง" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกระดับ</SelectItem>
              {[1,2,3,4,5,6,7,8].map((r) => (
                <SelectItem key={r} value={String(r)}>ระดับ {r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex gap-2 ml-auto">
          <button
            onClick={handleCopyUrl}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            title="คัดลอก URL สำหรับแชร์"
          >
            <Share2 className="h-3.5 w-3.5" />
            {copied ? 'คัดลอกแล้ว!' : 'แชร์'}
          </button>
          {data.length > 0 && (
            <button
              onClick={() => exportToCsv(data, metric)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
          )}
        </div>
      </div>

      {/* Result count */}
      <div className="text-sm text-slate-500">
        แสดง {getMetricLabel(metric)}
        {metric !== 'return1D' && ` — พบ ${pagination.total.toLocaleString('th-TH')} กองทุน`}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 overflow-x-auto bg-white">
        <table className="w-full min-w-[640px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 w-12">อันดับ</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500">กองทุน</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 hidden md:table-cell">ประเภท</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500">ความเสี่ยง</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500">
                {getMetricLabel(metric)}
              </th>
              {metric !== 'return1D' && metric.startsWith('return') && (
                <>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 hidden lg:table-cell">Volatility</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 hidden lg:table-cell">Sharpe</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading
              ? Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="px-4 py-3">
                      <div className="h-4 bg-slate-200 animate-pulse rounded" />
                    </td>
                  </tr>
                ))
              : data.map((row) => {
                  const val = getMetricValue(row)
                  return (
                    <tr key={`${row.projId}-${row.rank}`} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className={cn(
                          'inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold tabular-nums',
                          row.rank === 1 && 'bg-amber-100 text-amber-700 ring-1 ring-amber-300',
                          row.rank === 2 && 'bg-slate-100 text-slate-600 ring-1 ring-slate-300',
                          row.rank === 3 && 'bg-orange-100 text-orange-700 ring-1 ring-orange-300',
                          row.rank > 3 && 'text-slate-400'
                        )}>
                          {row.rank}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <Link href={fundUrl(row)} className="block group">
                          <span className="text-xs font-mono font-bold text-blue-700">{row.projAbbrName ?? row.projId}</span>
                          <span className="text-sm text-slate-900 line-clamp-1 mt-0.5 group-hover:text-blue-700 transition-colors">
                            {row.nameTh}
                          </span>
                          <span className="text-xs text-slate-400">{row.amc?.nameTh}</span>
                        </Link>
                      </td>
                      <td className="px-3 py-3 hidden md:table-cell">
                        {row.fundType && (
                          <Badge variant="secondary" className="text-xs">
                            {FUND_TYPE_LABELS[row.fundType] ?? row.fundType}
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <RiskBadge riskLevel={row.riskLevel} showLabel={false} />
                      </td>
                      <td className={cn(
                        'px-3 py-3 text-right text-sm font-bold tabular-nums',
                        metric.startsWith('return') || metric === 'sharpe1Y'
                          ? getReturnColorClass(val)
                          : 'text-slate-700'
                      )}>
                        {val != null
                          ? metric === 'sharpe1Y'
                            ? val.toFixed(2)
                            : `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`
                          : '-'}
                      </td>
                      {metric !== 'return1D' && metric.startsWith('return') && (
                        <>
                          <td className="px-3 py-3 text-right text-sm tabular-nums text-slate-500 hidden lg:table-cell">
                            {row.annualizedVolatilityPct != null ? `${row.annualizedVolatilityPct.toFixed(2)}%` : '-'}
                          </td>
                          <td className="px-3 py-3 text-right text-sm tabular-nums text-slate-500 hidden lg:table-cell">
                            {row.sharpeRatio != null ? row.sharpeRatio.toFixed(2) : '-'}
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })}
          </tbody>
        </table>
      </div>

      {/* Pagination (not shown for 1D) */}
      {pagination.totalPages > 1 && metric !== 'return1D' && (
        <div className="flex items-center justify-center gap-2 py-2">
          <Button variant="outline" size="sm" onClick={() => changePage(Math.max(1, page - 1))} disabled={page === 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-slate-600 px-3">
            {page} / {pagination.totalPages}
          </span>
          <Button variant="outline" size="sm" onClick={() => changePage(Math.min(pagination.totalPages, page + 1))} disabled={page === pagination.totalPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
