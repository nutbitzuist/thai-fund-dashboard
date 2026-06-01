'use client'

// app/rankings/rankings-client.tsx
// Full screener + AMC leaderboard for Thai mutual funds
// Features: sortable columns, AMC filter, AMC leaderboard tab, CSV export, shareable URL

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, ChevronRight, TrendingUp, Activity, TrendingDown, BarChart3,
  Download, Share2, ChevronUp, ChevronDown, ChevronsUpDown, Building2,
  LayoutList, Search, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RiskBadge } from '@/components/metrics/risk-badge'
import { RANKING_PRESETS, FUND_TYPE_LABELS } from '@/types'
import { fundUrl } from '@/lib/utils'
import { cn, formatPct, getReturnColorClass } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

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

interface AmcRow {
  rank: number
  amcId: number
  amcName: string
  amcNameEn: string | null
  fundCount: number
  avgReturn: number | null
  medianReturn: number | null
  bestReturn: number | null
  bestFundName: string | null
  bestFundAbbr: string | null
  avgSharpe: number | null
  avgVolatility: number | null
}

interface AmcOption { id: number; nameTh: string; nameEn?: string | null }

type Metric = 'return1D' | 'return1Y' | 'return1M' | 'return3Y' | 'return6M' | 'returnYTD' | 'volatility1Y' | 'maxDrawdown1Y' | 'sharpe1Y'

type SortDir = 'asc' | 'desc'
type ViewMode = 'funds' | 'amcs'
type AmcSortBy = 'avgReturn' | 'medianReturn' | 'fundCount' | 'bestReturn' | 'avgSharpe' | 'avgVolatility'

const PRESET_ICONS = [TrendingUp, Activity, TrendingDown, BarChart3]

const FUND_TYPES = ['EQ', 'FI', 'MM', 'BA', 'RE', 'CM', 'AI', 'FIF', 'SSF', 'RMF']

const METRIC_TO_PERIOD: Record<Metric, string> = {
  return1D: '1D', return1M: '1M', return3Y: '3Y', return6M: '6M',
  returnYTD: 'YTD', return1Y: '1Y', volatility1Y: '1Y', maxDrawdown1Y: '1Y', sharpe1Y: '1Y',
}

function getMetricLabel(m: Metric): string {
  switch (m) {
    case 'return1D': return 'ผลตอบแทนวันนี้'
    case 'return1Y': return 'ผลตอบแทน 1 ปี'
    case 'return1M': return 'ผลตอบแทน 1 เดือน'
    case 'return3Y': return 'ผลตอบแทน 3 ปี'
    case 'return6M': return 'ผลตอบแทน 6 เดือน'
    case 'returnYTD': return 'ผลตอบแทน YTD'
    case 'volatility1Y': return 'Volatility 1 ปี'
    case 'maxDrawdown1Y': return 'Max Drawdown'
    case 'sharpe1Y': return 'Sharpe Ratio'
  }
}

// ── Sort header component ─────────────────────────────────────────────────────

interface SortHeaderProps {
  label: string
  colMetric: Metric
  activeMetric: Metric
  sortDir: SortDir
  onClick: (m: Metric) => void
  className?: string
}

function SortHeader({ label, colMetric, activeMetric, sortDir, onClick, className }: SortHeaderProps) {
  const isActive = colMetric === activeMetric
  return (
    <th
      className={cn(
        'px-3 py-3 text-right text-xs font-semibold cursor-pointer select-none whitespace-nowrap group',
        isActive ? 'text-blue-700 bg-blue-50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100',
        className
      )}
      onClick={() => onClick(colMetric)}
    >
      <span className="inline-flex items-center justify-end gap-1">
        {label}
        {isActive ? (
          sortDir === 'desc'
            ? <ChevronDown className="h-3.5 w-3.5 text-blue-600" />
            : <ChevronUp className="h-3.5 w-3.5 text-blue-600" />
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-30 group-hover:opacity-60" />
        )}
      </span>
    </th>
  )
}

// ── AMC multi-select dropdown ─────────────────────────────────────────────────

function shortAmcName(name: string): string {
  return name
    .replace(/บริษัท\s*หลักทรัพย์จัดการกองทุนรวม/g, 'บลจ. ')
    .replace(/บริษัท\s*หลักทรัพย์จัดการกองทุน/g, 'บลจ. ')
    .replace(/บริษัท\s*จัดการกองทุนรวม/g, 'บลจ. ')
    .replace(/บริษัท\s*จัดการกองทุน/g, 'บลจ. ')
    .replace(/จำกัด|\(มหาชน\)|\(ประเทศไทย\)|บมจ\.|บจก\./g, '')
    .replace(/,/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

interface AmcPickerProps {
  amcs: AmcOption[]
  value: number[]
  onChange: (ids: number[]) => void
}

function AmcPicker({ amcs, value, onChange }: AmcPickerProps) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const filtered = amcs.filter(
    (a) => !q || a.nameTh.toLowerCase().includes(q.toLowerCase()) || (a.nameEn ?? '').toLowerCase().includes(q.toLowerCase())
  )

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const toggle = (id: number) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])

  const buttonLabel = () => {
    if (value.length === 0) return 'บลจ. ทั้งหมด'
    if (value.length === 1) {
      const a = amcs.find((a) => a.id === value[0])
      return a ? shortAmcName(a.nameTh) : 'บลจ. 1 แห่ง'
    }
    return `บลจ. (${value.length})`
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm transition-colors',
          value.length > 0
            ? 'border-blue-300 bg-blue-50 text-blue-700 font-medium'
            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
        )}
      >
        <Building2 className="h-3.5 w-3.5 shrink-0" />
        <span className="max-w-[160px] truncate">{buttonLabel()}</span>
        {value.length > 0 && (
          <X
            className="h-3 w-3 ml-0.5 shrink-0 opacity-60 hover:opacity-100"
            onClick={(e) => { e.stopPropagation(); onChange([]) }}
          />
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-72 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
          <div className="p-2 border-b border-slate-100 space-y-1.5">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50">
              <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ค้นหา บลจ. ..."
                className="flex-1 text-sm bg-transparent outline-none placeholder:text-slate-400"
              />
              {q && <X className="h-3 w-3 text-slate-400 cursor-pointer" onClick={() => setQ('')} />}
            </div>
            {value.length > 0 && (
              <div className="flex items-center justify-between px-1">
                <span className="text-xs text-blue-700 font-medium">เลือก {value.length} บลจ.</span>
                <button
                  className="text-xs text-slate-500 hover:text-red-600 transition-colors"
                  onClick={() => onChange([])}
                >
                  ล้างทั้งหมด
                </button>
              </div>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto">
            <button
              className={cn('w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors', value.length === 0 && 'bg-blue-50 text-blue-700 font-medium')}
              onClick={() => { onChange([]); setOpen(false); setQ('') }}
            >
              ทุก บลจ.
            </button>
            {filtered.map((a) => {
              const selected = value.includes(a.id)
              return (
                <button
                  key={a.id}
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors flex items-start gap-2',
                    selected && 'bg-blue-50'
                  )}
                  onClick={() => toggle(a.id)}
                >
                  <span className={cn(
                    'mt-0.5 flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center text-[10px]',
                    selected ? 'bg-blue-700 border-blue-700 text-white' : 'border-slate-300'
                  )}>
                    {selected && '✓'}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className={cn('block leading-tight', selected && 'text-blue-700 font-medium')}>
                      {shortAmcName(a.nameTh)}
                    </span>
                    {a.nameEn && <span className="block text-xs text-slate-400 mt-0.5">{a.nameEn}</span>}
                  </span>
                </button>
              )
            })}
            {filtered.length === 0 && <p className="px-3 py-4 text-sm text-slate-400 text-center">ไม่พบ บลจ. ที่ค้นหา</p>}
          </div>
        </div>
      )}
    </div>
  )
}

// ── CSV helpers ───────────────────────────────────────────────────────────────

function exportFundsCsv(data: RankingRow[], metric: Metric) {
  const headers = ['อันดับ', 'รหัสกองทุน', 'ชื่อกองทุน', 'ประเภท', 'บลจ.', 'ความเสี่ยง',
    getMetricLabel(metric), 'Volatility 1Y (%)', 'Max Drawdown 1Y (%)', 'Sharpe 1Y']
  const rows = data.map((r) => [
    r.rank,
    r.projAbbrName ?? r.projId,
    `"${r.nameTh}"`,
    r.fundType ? (FUND_TYPE_LABELS[r.fundType] ?? r.fundType) : '',
    `"${r.amc?.nameTh ?? ''}"`,
    r.riskLevel ?? '',
    r.returnPct != null ? r.returnPct.toFixed(2) : '',
    r.annualizedVolatilityPct != null ? r.annualizedVolatilityPct.toFixed(2) : '',
    r.maxDrawdownPct != null ? r.maxDrawdownPct.toFixed(2) : '',
    r.sharpeRatio != null ? r.sharpeRatio.toFixed(2) : '',
  ])
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `fund-rankings-${metric}-${new Date().toISOString().split('T')[0]}.csv`; a.click()
  URL.revokeObjectURL(url)
}

function exportAmcsCsv(data: AmcRow[], period: string) {
  const headers = ['อันดับ', 'บลจ.', 'จำนวนกองทุน', `ผลตอบแทนเฉลี่ย (${period})`, `มัธยฐาน (${period})`, 'กองทุนดีสุด', `ผลตอบแทนสูงสุด (${period})`, 'Sharpe เฉลี่ย', 'Volatility เฉลี่ย']
  const rows = data.map((r) => [
    r.rank, `"${r.amcName}"`, r.fundCount,
    r.avgReturn != null ? r.avgReturn.toFixed(2) : '',
    r.medianReturn != null ? r.medianReturn.toFixed(2) : '',
    `"${r.bestFundAbbr ?? ''}"`,
    r.bestReturn != null ? r.bestReturn.toFixed(2) : '',
    r.avgSharpe != null ? r.avgSharpe.toFixed(2) : '',
    r.avgVolatility != null ? r.avgVolatility.toFixed(2) : '',
  ])
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `amc-rankings-${period}-${new Date().toISOString().split('T')[0]}.csv`; a.click()
  URL.revokeObjectURL(url)
}

// ── Main component ────────────────────────────────────────────────────────────

export function RankingsClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // ── State ─────────────────────────────────────────────────────────
  const [view, setView] = useState<ViewMode>((searchParams.get('view') as ViewMode) ?? 'funds')
  const [metric, setMetric] = useState<Metric>((searchParams.get('metric') as Metric) ?? 'return1Y')
  const [sortDir, setSortDir] = useState<SortDir>((searchParams.get('sort') as SortDir) ?? 'desc')
  const [fundType, setFundType] = useState(searchParams.get('fundType') ?? '')
  const [riskLevel, setRiskLevel] = useState(searchParams.get('riskLevel') ?? '')
  const [amcIds, setAmcIds] = useState<number[]>(
    searchParams.get('amcIds') ? searchParams.get('amcIds')!.split(',').map(Number).filter(Boolean) : []
  )
  const [page, setPage] = useState(Number(searchParams.get('page') ?? 1))

  // AMC leaderboard state
  const [amcPeriod, setAmcPeriod] = useState<string>(searchParams.get('amcPeriod') ?? '1Y')
  const [amcSortBy, setAmcSortBy] = useState<AmcSortBy>((searchParams.get('amcSortBy') as AmcSortBy) ?? 'avgReturn')
  const [amcSortDir, setAmcSortDir] = useState<SortDir>((searchParams.get('amcSort') as SortDir) ?? 'desc')
  const [amcFundType, setAmcFundType] = useState(searchParams.get('amcFundType') ?? '')

  // Data
  const [data, setData] = useState<RankingRow[]>([])
  const [amcData, setAmcData] = useState<AmcRow[]>([])
  const [amcList, setAmcList] = useState<AmcOption[]>([])
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0, page: 1 })
  const [loading, setLoading] = useState(true)
  const [amcLoading, setAmcLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  // ── URL sync ─────────────────────────────────────────────────────
  const pushUrl = useCallback((overrides: Record<string, string | number | null>) => {
    const current = {
      view, metric, sort: sortDir, fundType, riskLevel,
      amcIds: amcIds.length > 0 ? amcIds.join(',') : null,
      page: page > 1 ? String(page) : null,
      amcPeriod: view === 'amcs' ? amcPeriod : null,
      amcSortBy: view === 'amcs' ? amcSortBy : null,
      amcSort: view === 'amcs' ? amcSortDir : null,
      amcFundType: view === 'amcs' ? amcFundType : null,
      ...overrides,
    }
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(current)) {
      if (v && v !== '' && v !== '1' && k !== 'page') params.set(k, String(v))
      if (k === 'page' && v && v !== '1') params.set(k, String(v))
    }
    router.replace(`/rankings?${params.toString()}`, { scroll: false })
  }, [router, view, metric, sortDir, fundType, riskLevel, amcIds, page, amcPeriod, amcSortBy, amcSortDir, amcFundType])

  // ── Load AMC list once ────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/amcs').then((r) => r.json()).then((j) => setAmcList(j.data ?? [])).catch(() => {})
  }, [])

  // ── Fetch fund rankings ───────────────────────────────────────────
  const fetchRankings = useCallback(async () => {
    setLoading(true)
    try {
      if (metric === 'return1D') {
        const params = new URLSearchParams({ limit: '25' })
        if (fundType) params.set('fundType', fundType)
        if (amcIds.length > 0) params.set('amcIds', amcIds.join(','))
        const res = await fetch(`/api/movers?${params}`)
        const json = await res.json()
        const movers: MoverRow[] = sortDir === 'desc' ? (json.gainers ?? []) : (json.losers ?? [])
        setData(movers.map((m, i) => ({
          rank: i + 1, projId: m.projId, projAbbrName: m.projAbbrName, nameTh: m.nameTh,
          fundType: m.fundType, riskLevel: m.riskLevel, amc: m.amc, returnPct: m.returnPct,
          annualizedVolatilityPct: null, maxDrawdownPct: null, sharpeRatio: null,
          navCount: null, endDate: json.date ?? '',
        })))
        setPagination({ total: movers.length, totalPages: 1, page: 1 })
      } else {
        const params = new URLSearchParams({ metric, sort: sortDir, page: String(page), limit: '25' })
        if (fundType) params.set('fundType', fundType)
        if (riskLevel) params.set('riskLevel', riskLevel)
        if (amcIds.length > 0) params.set('amcIds', amcIds.join(','))
        const res = await fetch(`/api/rankings?${params}`)
        const json = await res.json()
        setData(json.data ?? [])
        setPagination(json.pagination ?? { total: 0, totalPages: 0, page: 1 })
      }
    } catch { setData([]) } finally { setLoading(false) }
  }, [metric, sortDir, fundType, riskLevel, amcIds, page])

  // ── Fetch AMC leaderboard ─────────────────────────────────────────
  const fetchAmcRankings = useCallback(async () => {
    setAmcLoading(true)
    try {
      const params = new URLSearchParams({ period: amcPeriod, sortBy: amcSortBy, sort: amcSortDir })
      if (amcFundType) params.set('fundType', amcFundType)
      const res = await fetch(`/api/rankings/amcs?${params}`)
      const json = await res.json()
      setAmcData(json.data ?? [])
    } catch { setAmcData([]) } finally { setAmcLoading(false) }
  }, [amcPeriod, amcSortBy, amcSortDir, amcFundType])

  useEffect(() => { if (view === 'funds') fetchRankings() }, [view, fetchRankings])
  useEffect(() => { if (view === 'amcs') fetchAmcRankings() }, [view, fetchAmcRankings])

  // ── Handlers — funds view ─────────────────────────────────────────

  const handleColumnSort = (col: Metric) => {
    let newDir: SortDir = 'desc'
    if (col === metric) {
      newDir = sortDir === 'desc' ? 'asc' : 'desc'
    } else {
      // Default direction per metric
      newDir = (col === 'volatility1Y' || col === 'maxDrawdown1Y') ? 'asc' : 'desc'
    }
    setMetric(col); setSortDir(newDir); setPage(1)
    pushUrl({ metric: col, sort: newDir, page: null })
  }

  const applyPreset = (preset: typeof RANKING_PRESETS[0]) => {
    const m = preset.metric as Metric; const s = preset.sort
    setMetric(m); setSortDir(s); setPage(1)
    pushUrl({ metric: m, sort: s, page: null })
  }

  const changeFundType = (v: string) => {
    const ft = v; setFundType(ft); setPage(1)
    pushUrl({ fundType: ft || null, page: null })
  }

  const changeRiskLevel = (v: string) => {
    const rl = v; setRiskLevel(rl); setPage(1)
    pushUrl({ riskLevel: rl || null, page: null })
  }

  const changeAmcIds = (ids: number[]) => {
    setAmcIds(ids); setPage(1)
    pushUrl({ amcIds: ids.length > 0 ? ids.join(',') : null, page: null })
  }

  const changePage = (p: number) => { setPage(p); pushUrl({ page: p > 1 ? String(p) : null }) }

  // ── Handlers — AMC leaderboard ────────────────────────────────────

  const handleAmcColSort = (col: AmcSortBy) => {
    let dir: SortDir = 'desc'
    if (col === amcSortBy) dir = amcSortDir === 'desc' ? 'asc' : 'desc'
    else dir = (col === 'avgVolatility') ? 'asc' : 'desc'
    setAmcSortBy(col); setAmcSortDir(dir)
    pushUrl({ amcSortBy: col, amcSort: dir })
  }

  // ── AMC view — drill into funds ───────────────────────────────────
  const drillIntoAmc = (id: number) => {
    setView('funds'); setAmcIds([id]); setPage(1)
    pushUrl({ view: 'funds', amcIds: String(id), page: null })
  }

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }

  // ── Helpers ───────────────────────────────────────────────────────

  const getMetricValue = (row: RankingRow): number | null => {
    switch (metric) {
      case 'return1D': case 'return1Y': case 'return1M': case 'return3Y':
      case 'return6M': case 'returnYTD': return row.returnPct
      case 'volatility1Y': return row.annualizedVolatilityPct
      case 'maxDrawdown1Y': return row.maxDrawdownPct
      case 'sharpe1Y': return row.sharpeRatio
      default: return null
    }
  }

  const fmtVal = (v: number | null, m: Metric) =>
    v == null ? '-'
    : m === 'sharpe1Y' ? v.toFixed(2)
    : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`

  const fmtPct = (v: number | null) => v == null ? '-' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
  const fmtRatio = (v: number | null) => v == null ? '-' : v.toFixed(2)


  const selectedAmcNames = amcIds.map((id) => amcList.find((a) => a.id === id)?.nameTh).filter(Boolean) as string[]

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── View Tabs ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        <button
          onClick={() => { setView('funds'); pushUrl({ view: 'funds' }) }}
          className={cn(
            'inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
            view === 'funds' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          )}
        >
          <LayoutList className="h-3.5 w-3.5" />
          จัดอันดับกองทุน
        </button>
        <button
          onClick={() => { setView('amcs'); pushUrl({ view: 'amcs' }) }}
          className={cn(
            'inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
            view === 'amcs' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          )}
        >
          <Building2 className="h-3.5 w-3.5" />
          จัดอันดับ บลจ.
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          FUNDS VIEW
      ══════════════════════════════════════════════════════════════ */}
      {view === 'funds' && (
        <>
          {/* Preset quick-select buttons */}
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
                    active ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
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

          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Period chips */}
            <div className="flex gap-1 flex-wrap">
              {(['return1D', 'return1M', 'return6M', 'return1Y', 'return3Y', 'returnYTD'] as Metric[]).map((m) => (
                <button
                  key={m}
                  onClick={() => handleColumnSort(m)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                    metric === m
                      ? 'bg-blue-700 text-white border-blue-700'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-700'
                  )}
                >
                  {METRIC_TO_PERIOD[m]}
                </button>
              ))}
              {(['volatility1Y', 'maxDrawdown1Y', 'sharpe1Y'] as Metric[]).map((m) => (
                <button
                  key={m}
                  onClick={() => handleColumnSort(m)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                    metric === m
                      ? 'bg-blue-700 text-white border-blue-700'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-700'
                  )}
                >
                  {m === 'volatility1Y' ? 'Vol' : m === 'maxDrawdown1Y' ? 'Drawdown' : 'Sharpe'}
                </button>
              ))}
            </div>

            {/* Sort direction */}
            <button
              onClick={() => { const d = sortDir === 'desc' ? 'asc' : 'desc'; setSortDir(d); setPage(1); pushUrl({ sort: d, page: null }) }}
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-600 hover:bg-slate-50 transition-colors"
            >
              {sortDir === 'desc' ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
              {sortDir === 'desc' ? 'มากไปน้อย' : 'น้อยไปมาก'}
            </button>

            <div className="h-5 w-px bg-slate-200" />

            {/* Fund type chips */}
            <div className="flex gap-1 flex-wrap">
              {['', ...FUND_TYPES].map((ft) => (
                <button
                  key={ft || 'all'}
                  onClick={() => changeFundType(ft)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                    fundType === ft
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                  )}
                >
                  {ft ? (FUND_TYPE_LABELS[ft] ?? ft) : 'ทุกประเภท'}
                </button>
              ))}
            </div>

            <div className="h-5 w-px bg-slate-200" />

            {/* Risk level */}
            <div className="flex gap-1">
              <button
                onClick={() => changeRiskLevel('')}
                className={cn('px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                  !riskLevel ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400')}
              >ทุกระดับ</button>
              {[1,2,3,4,5,6,7,8].map((r) => (
                <button
                  key={r}
                  onClick={() => changeRiskLevel(String(r))}
                  className={cn('w-7 h-7 rounded-full text-xs font-bold border transition-colors',
                    riskLevel === String(r) ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400')}
                >
                  {r}
                </button>
              ))}
            </div>

            <div className="h-5 w-px bg-slate-200" />

            {/* AMC multi-picker */}
            <AmcPicker amcs={amcList} value={amcIds} onChange={changeAmcIds} />

            {/* Utility buttons */}
            <div className="flex gap-2 ml-auto">
              <button
                onClick={handleCopyUrl}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Share2 className="h-3.5 w-3.5" />
                {copied ? 'คัดลอกแล้ว!' : 'แชร์'}
              </button>
              {data.length > 0 && (
                <button
                  onClick={() => exportFundsCsv(data, metric)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  CSV
                </button>
              )}
            </div>
          </div>

          {/* Active filters summary */}
          {(fundType || riskLevel || amcIds.length > 0 || metric !== 'return1Y') && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>กรอง:</span>
              {metric !== 'return1Y' && <Badge variant="secondary">{getMetricLabel(metric)}</Badge>}
              {fundType && <Badge variant="secondary">{FUND_TYPE_LABELS[fundType] ?? fundType}</Badge>}
              {riskLevel && <Badge variant="secondary">ความเสี่ยงระดับ {riskLevel}</Badge>}
              {selectedAmcNames.map((name) => (
                <Badge key={name} variant="secondary" className="max-w-[180px] truncate">{shortAmcName(name)}</Badge>
              ))}
              <button
                onClick={() => { setFundType(''); setRiskLevel(''); setAmcIds([]); setMetric('return1Y'); setSortDir('desc'); setPage(1); pushUrl({ fundType: null, riskLevel: null, amcIds: null, metric: 'return1Y', sort: 'desc', page: null }) }}
                className="text-blue-700 hover:underline"
              >
                ล้างทั้งหมด
              </button>
            </div>
          )}

          {/* Result count */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {loading ? 'กำลังโหลด...' : (
                metric !== 'return1D'
                  ? `พบ ${pagination.total.toLocaleString('th-TH')} กองทุน — เรียงตาม${getMetricLabel(metric)}`
                  : 'วันนี้ — เรียงตามผลตอบแทน 1 วัน'
              )}
            </p>
            {amcIds.length === 1 && (
              <button onClick={() => drillIntoAmc(amcIds[0])} className="text-xs text-blue-700 hover:underline">
                ดูอันดับ บลจ. →
              </button>
            )}
          </div>

          {/* ── Table ──────────────────────────────────────────────── */}
          <div className="rounded-xl border border-slate-200 overflow-x-auto bg-white shadow-sm">
            <table className="w-full min-w-[700px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 w-12">อันดับ</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500">กองทุน</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 hidden md:table-cell w-24">ประเภท</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 w-16">
                    <span
                      className="cursor-pointer hover:text-slate-800"
                      title="คลิกเพื่อเรียงตามระดับความเสี่ยง"
                    >เสี่ยง</span>
                  </th>
                  <SortHeader label={`ผลตอบแทน (${METRIC_TO_PERIOD[metric]})`} colMetric={metric.startsWith('return') ? metric : 'return1Y'} activeMetric={metric} sortDir={sortDir} onClick={handleColumnSort} />
                  <SortHeader label="Volatility" colMetric="volatility1Y" activeMetric={metric} sortDir={sortDir} onClick={handleColumnSort} className="hidden lg:table-cell" />
                  <SortHeader label="Drawdown" colMetric="maxDrawdown1Y" activeMetric={metric} sortDir={sortDir} onClick={handleColumnSort} className="hidden lg:table-cell" />
                  <SortHeader label="Sharpe" colMetric="sharpe1Y" activeMetric={metric} sortDir={sortDir} onClick={handleColumnSort} className="hidden lg:table-cell" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading
                  ? Array.from({ length: 10 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={8} className="px-4 py-3">
                          <div className="h-4 bg-slate-200 animate-pulse rounded" style={{ width: `${70 + (i % 3) * 10}%` }} />
                        </td>
                      </tr>
                    ))
                  : data.length === 0
                  ? <tr><td colSpan={8} className="py-12 text-center text-slate-400 text-sm">ยังไม่มีข้อมูลในช่วงเวลานี้</td></tr>
                  : data.map((row) => {
                      const val = getMetricValue(row)
                      return (
                        <tr key={`${row.projId}-${row.rank}`} className="hover:bg-blue-50/40 transition-colors group">
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
                            <Link href={fundUrl(row)} className="block group/link">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-mono font-bold text-blue-700 group-hover/link:underline">
                                  {row.projAbbrName ?? row.projId}
                                </span>
                                <span className="text-xs text-slate-400 hidden sm:inline">{row.amc?.nameTh ? shortAmcName(row.amc.nameTh) : ''}</span>
                              </div>
                              <span className="text-sm text-slate-800 line-clamp-1 mt-0.5 group-hover/link:text-blue-700 transition-colors">
                                {row.nameTh}
                              </span>
                            </Link>
                          </td>
                          <td className="px-3 py-3 hidden md:table-cell">
                            {row.fundType && (
                              <button
                                onClick={() => changeFundType(row.fundType!)}
                                className="text-xs bg-slate-100 hover:bg-blue-100 hover:text-blue-700 text-slate-600 rounded px-1.5 py-0.5 transition-colors"
                                title="กรองตามประเภทนี้"
                              >
                                {FUND_TYPE_LABELS[row.fundType] ?? row.fundType}
                              </button>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <RiskBadge riskLevel={row.riskLevel} showLabel={false} />
                          </td>
                          <td className={cn(
                            'px-3 py-3 text-right text-sm font-bold tabular-nums',
                            metric === 'volatility1Y' || metric === 'maxDrawdown1Y' ? 'text-slate-700' : getReturnColorClass(val)
                          )}>
                            {fmtVal(val, metric)}
                          </td>
                          <td className="px-3 py-3 text-right text-sm tabular-nums text-slate-500 hidden lg:table-cell">
                            {row.annualizedVolatilityPct != null ? `${row.annualizedVolatilityPct.toFixed(2)}%` : '-'}
                          </td>
                          <td className={cn('px-3 py-3 text-right text-sm tabular-nums hidden lg:table-cell',
                            row.maxDrawdownPct != null && Number(row.maxDrawdownPct) < -10 ? 'text-red-500' : 'text-slate-500'
                          )}>
                            {row.maxDrawdownPct != null ? `${row.maxDrawdownPct.toFixed(2)}%` : '-'}
                          </td>
                          <td className={cn('px-3 py-3 text-right text-sm tabular-nums hidden lg:table-cell',
                            row.sharpeRatio != null && row.sharpeRatio > 1 ? 'text-emerald-600 font-medium' : 'text-slate-500'
                          )}>
                            {row.sharpeRatio != null ? row.sharpeRatio.toFixed(2) : '-'}
                          </td>
                        </tr>
                      )
                    })
                }
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && metric !== 'return1D' && (
            <div className="flex items-center justify-center gap-2 py-2">
              <Button variant="outline" size="sm" onClick={() => changePage(Math.max(1, page - 1))} disabled={page === 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-slate-600 px-3">{page} / {pagination.totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => changePage(Math.min(pagination.totalPages, page + 1))} disabled={page === pagination.totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════
          AMC LEADERBOARD VIEW
      ══════════════════════════════════════════════════════════════ */}
      {view === 'amcs' && (
        <>
          {/* AMC filter bar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Period */}
            <div className="flex gap-1">
              {['1M', '3M', '6M', '1Y', '3Y', 'YTD'].map((p) => (
                <button
                  key={p}
                  onClick={() => { setAmcPeriod(p); pushUrl({ amcPeriod: p }) }}
                  className={cn('px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                    amcPeriod === p ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300')}
                >{p}</button>
              ))}
            </div>

            <div className="h-5 w-px bg-slate-200" />

            {/* Fund type filter for AMC view */}
            <div className="flex gap-1 flex-wrap">
              {['', ...FUND_TYPES].map((ft) => (
                <button
                  key={ft || 'all'}
                  onClick={() => { setAmcFundType(ft); pushUrl({ amcFundType: ft || null }) }}
                  className={cn('px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                    amcFundType === ft ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400')}
                >
                  {ft ? (FUND_TYPE_LABELS[ft] ?? ft) : 'ทุกประเภท'}
                </button>
              ))}
            </div>

            <div className="flex gap-2 ml-auto">
              <button
                onClick={handleCopyUrl}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Share2 className="h-3.5 w-3.5" />
                {copied ? 'คัดลอกแล้ว!' : 'แชร์'}
              </button>
              {amcData.length > 0 && (
                <button
                  onClick={() => exportAmcsCsv(amcData, amcPeriod)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  CSV
                </button>
              )}
            </div>
          </div>

          <p className="text-sm text-slate-500">
            {amcLoading ? 'กำลังโหลด...' : `${amcData.length} บลจ. — เรียงตามผลตอบแทนเฉลี่ย ${amcPeriod}`}
          </p>

          {/* AMC Table */}
          <div className="rounded-xl border border-slate-200 overflow-x-auto bg-white shadow-sm">
            <table className="w-full min-w-[700px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 w-12">อันดับ</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500">บลจ.</th>
                  {/* Sortable columns */}
                  {([
                    { col: 'fundCount', label: 'กองทุน' },
                    { col: 'avgReturn', label: `เฉลี่ย (${amcPeriod})` },
                    { col: 'medianReturn', label: 'มัธยฐาน' },
                    { col: 'bestReturn', label: 'กองทุนดีสุด' },
                    { col: 'avgSharpe', label: 'Sharpe เฉลี่ย', className: 'hidden lg:table-cell' },
                    { col: 'avgVolatility', label: 'Vol เฉลี่ย', className: 'hidden lg:table-cell' },
                  ] as Array<{ col: AmcSortBy; label: string; className?: string }>).map(({ col, label, className }) => (
                    <th
                      key={col}
                      onClick={() => handleAmcColSort(col)}
                      className={cn(
                        'px-3 py-3 text-right text-xs font-semibold cursor-pointer select-none whitespace-nowrap group',
                        amcSortBy === col ? 'text-blue-700 bg-blue-50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100',
                        className
                      )}
                    >
                      <span className="inline-flex items-center justify-end gap-1">
                        {label}
                        {amcSortBy === col
                          ? amcSortDir === 'desc'
                            ? <ChevronDown className="h-3.5 w-3.5 text-blue-600" />
                            : <ChevronUp className="h-3.5 w-3.5 text-blue-600" />
                          : <ChevronsUpDown className="h-3 w-3 opacity-30 group-hover:opacity-60" />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {amcLoading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i}><td colSpan={8} className="px-4 py-3">
                        <div className="h-4 bg-slate-200 animate-pulse rounded" style={{ width: `${60 + (i % 3) * 15}%` }} />
                      </td></tr>
                    ))
                  : amcData.length === 0
                  ? <tr><td colSpan={8} className="py-12 text-center text-slate-400 text-sm">ยังไม่มีข้อมูล</td></tr>
                  : amcData.map((row) => (
                      <tr
                        key={row.amcId}
                        className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                        onClick={() => drillIntoAmc(row.amcId)}
                        title="คลิกเพื่อดูกองทุนของ บลจ. นี้"
                      >
                        <td className="px-4 py-3.5">
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
                        <td className="px-3 py-3.5">
                          <p className="text-sm font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">
                            {shortAmcName(row.amcName)}
                          </p>
                          {row.amcNameEn && <p className="text-xs text-slate-400 mt-0.5">{row.amcNameEn}</p>}
                          {row.bestFundAbbr && (
                            <p className="text-xs text-slate-400 mt-1">
                              🏆 {row.bestFundAbbr}
                              {row.bestFundName && ` — ${row.bestFundName.substring(0, 40)}${row.bestFundName.length > 40 ? '…' : ''}`}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3.5 text-right text-sm text-slate-600 tabular-nums">
                          {row.fundCount}
                        </td>
                        <td className={cn('px-3 py-3.5 text-right text-sm font-bold tabular-nums', getReturnColorClass(row.avgReturn))}>
                          {fmtPct(row.avgReturn)}
                        </td>
                        <td className={cn('px-3 py-3.5 text-right text-sm tabular-nums', getReturnColorClass(row.medianReturn))}>
                          {fmtPct(row.medianReturn)}
                        </td>
                        <td className={cn('px-3 py-3.5 text-right text-sm tabular-nums', getReturnColorClass(row.bestReturn))}>
                          {fmtPct(row.bestReturn)}
                        </td>
                        <td className={cn('px-3 py-3.5 text-right text-sm tabular-nums hidden lg:table-cell',
                          row.avgSharpe != null && row.avgSharpe > 1 ? 'text-emerald-600 font-medium' : 'text-slate-500'
                        )}>
                          {fmtRatio(row.avgSharpe)}
                        </td>
                        <td className="px-3 py-3.5 text-right text-sm tabular-nums text-slate-500 hidden lg:table-cell">
                          {row.avgVolatility != null ? `${row.avgVolatility.toFixed(2)}%` : '-'}
                        </td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>

          <p className="text-xs text-slate-400 text-center">
            คลิกที่แถว บลจ. เพื่อดูกองทุนของ บลจ. นั้นในหน้าจัดอันดับกองทุน
          </p>
        </>
      )}
    </div>
  )
}
