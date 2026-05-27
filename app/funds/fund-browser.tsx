'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Filter, ChevronLeft, ChevronRight, Zap, Trophy, TrendingUp, Shield, AlertTriangle, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FundTable } from '@/components/fund/fund-table'
import { RISK_LEVEL_LABELS } from '@/types'
import { cn } from '@/lib/utils'

type SortKey = 'nameTh' | 'riskLevel' | 'amc' | 'fundType' | 'return1Y' | 'return3Y' | 'volatility1Y' | 'maxDrawdown1Y' | 'sharpe1Y' | 'latestNav'

interface Amc { id: number; nameTh: string; nameEn: string | null }

interface Fund {
  projId: string; projAbbrName: string | null; nameTh: string; nameEn: string | null
  fundStatus: string | null; fundType: string | null; riskLevel: number | null
  dividendPolicy: string | null
  amc: { id: number; nameTh: string; nameEn?: string | null } | null
  latestNav: number | null; latestNavDate: string | null; dailyChangePct: number | null
  return1Y: number | null; return3Y: number | null
  volatility1Y: number | null; maxDrawdown1Y: number | null; sharpe1Y: number | null
}

interface Pagination { page: number; limit: number; total: number; totalPages: number }

const SCREENER_PRESETS: {
  id: string; label: string; Icon: React.ComponentType<{ className?: string }>
  sortBy: SortKey; sortDir: 'asc' | 'desc'
}[] = [
  { id: 'return1Y',       label: 'ผลตอบแทน 1 ปีสูงสุด',  Icon: Trophy,     sortBy: 'return1Y',      sortDir: 'desc' },
  { id: 'return3Y',       label: 'ผลตอบแทน 3 ปีสูงสุด',  Icon: TrendingUp, sortBy: 'return3Y',      sortDir: 'desc' },
  { id: 'volatility_low', label: 'ความผันผวนต่ำสุด',       Icon: Shield,     sortBy: 'volatility1Y',  sortDir: 'asc'  },
  { id: 'sharpe_high',    label: 'Sharpe Ratio สูงสุด',   Icon: Zap,        sortBy: 'sharpe1Y',      sortDir: 'desc' },
]

export function FundBrowser() {
  const searchParams = useSearchParams()

  const [funds, setFunds] = useState<Fund[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  // 'idle' | 'loading' | 'refreshing' | 'error'
  const [status, setStatus] = useState<'idle' | 'loading' | 'refreshing' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [amcs, setAmcs] = useState<Amc[]>([])
  const [activePreset, setActivePreset] = useState<string | null>('return1Y')

  const [q, setQ] = useState(searchParams.get('q') ?? '')
  const [amcId, setAmcId] = useState(searchParams.get('amcId') ?? '')
  const [fundType, setFundType] = useState(searchParams.get('fundType') ?? '')
  const [riskLevel, setRiskLevel] = useState(searchParams.get('riskLevel') ?? '')
  const [sortBy, setSortBy] = useState<SortKey>((searchParams.get('sortBy') as SortKey) ?? 'return1Y')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>((searchParams.get('sortDir') as 'asc' | 'desc') ?? 'desc')
  const [page, setPage] = useState(parseInt(searchParams.get('page') ?? '1'))

  // Used to abort stale requests when a newer one starts
  const abortRef = useRef<AbortController | null>(null)

  // Load AMC list once
  useEffect(() => {
    fetch('/api/amcs')
      .then((r) => r.json())
      .then((d) => setAmcs(d.data ?? []))
      .catch(() => {})
  }, [])

  const fetchFunds = useCallback(async () => {
    // Abort any in-flight request
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    // Show 'refreshing' (keep current data visible) if we already have data,
    // 'loading' (show skeleton) only on first load.
    setStatus((s) => (s === 'idle' || s === 'error' ? 'loading' : 'refreshing'))
    setErrorMsg('')

    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (amcId) params.set('amcId', amcId)
      if (fundType) params.set('fundType', fundType)
      if (riskLevel) params.set('riskLevel', riskLevel)
      params.set('sortBy', sortBy)
      params.set('sortDir', sortDir)
      params.set('page', String(page))
      params.set('limit', '20')

      const res = await fetch(`/api/funds?${params}`, { signal: controller.signal })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.messageTh ?? `ข้อผิดพลาด HTTP ${res.status}`)
      }

      const data = await res.json()
      setFunds(data.data ?? [])
      setPagination(data.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 0 })
      setStatus('idle')
    } catch (err: unknown) {
      if ((err as { name?: string }).name === 'AbortError') return // ignore cancelled
      setErrorMsg((err as Error).message || 'ไม่สามารถโหลดข้อมูลได้')
      setStatus('error')
    }
  }, [q, amcId, fundType, riskLevel, sortBy, sortDir, page])

  useEffect(() => { fetchFunds() }, [fetchFunds])

  const handleSort = (key: SortKey) => {
    if (key === sortBy) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(key)
      setSortDir(key === 'volatility1Y' || key === 'maxDrawdown1Y' || key === 'nameTh' || key === 'amc' ? 'asc' : 'desc')
    }
    setPage(1)
    setActivePreset(null)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    setActivePreset(null)
  }

  const handleReset = () => {
    setQ(''); setAmcId(''); setFundType(''); setRiskLevel('')
    setSortBy('return1Y'); setSortDir('desc')
    setPage(1); setActivePreset('return1Y')
  }

  const applyPreset = (preset: (typeof SCREENER_PRESETS)[number]) => {
    setSortBy(preset.sortBy)
    setSortDir(preset.sortDir)
    setPage(1)
    setActivePreset(preset.id)
  }

  const isLoading = status === 'loading'
  const isRefreshing = status === 'refreshing'
  const isError = status === 'error'

  return (
    <div className="space-y-4">
      {/* Screener Presets */}
      <div>
        <div className="flex items-center gap-1.5 mb-2 text-xs text-slate-500 font-medium">
          <Zap className="h-3.5 w-3.5 text-amber-500" />
          คัดกรองด่วน
        </div>
        <div className="flex flex-wrap gap-2">
          {SCREENER_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors border',
                activePreset === preset.id
                  ? 'bg-blue-700 text-white border-blue-700 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-700',
              )}
            >
              <preset.Icon className="h-3.5 w-3.5" />
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search + filter toggle */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหาด้วยชื่อ รหัส หรือ บลจ."
          className="flex-1"
        />
        <Button type="submit" disabled={isLoading}>ค้นหา</Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowFilters((v) => !v)}
          className={cn(showFilters && 'bg-blue-50 border-blue-300 text-blue-700')}
        >
          <Filter className="h-4 w-4 mr-1.5" />
          ตัวกรอง
        </Button>
      </form>

      {/* Filter Panel */}
      {showFilters && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* AMC */}
            <div className="col-span-2 sm:col-span-1 lg:col-span-2">
              <label className="block text-xs text-slate-500 mb-1.5">บริษัทจัดการ (บลจ.)</label>
              <Select value={amcId || 'all'} onValueChange={(v) => { setAmcId(v === 'all' ? '' : v); setPage(1) }}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="ทั้งหมด" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  {amcs.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.nameTh}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Fund type */}
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">ประเภทกองทุน</label>
              <Select value={fundType || 'all'} onValueChange={(v) => { setFundType(v === 'all' ? '' : v); setPage(1) }}>
                <SelectTrigger className="h-9"><SelectValue placeholder="ทั้งหมด" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="EQUITY">หุ้น</SelectItem>
                  <SelectItem value="FIXED_INCOME">ตราสารหนี้</SelectItem>
                  <SelectItem value="MIXED">ผสม</SelectItem>
                  <SelectItem value="MONEY_MARKET">ตลาดเงิน</SelectItem>
                  <SelectItem value="PROPERTY">อสังหาริมทรัพย์</SelectItem>
                  <SelectItem value="COMMODITY">สินค้าโภคภัณฑ์</SelectItem>
                  <SelectItem value="FOREIGN">ต่างประเทศ</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Risk level */}
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">ระดับความเสี่ยง</label>
              <Select value={riskLevel || 'all'} onValueChange={(v) => { setRiskLevel(v === 'all' ? '' : v); setPage(1) }}>
                <SelectTrigger className="h-9"><SelectValue placeholder="ทั้งหมด" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  {Object.entries(RISK_LEVEL_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{k} - {v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sort by */}
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">เรียงตาม</label>
              <Select value={sortBy} onValueChange={(v) => { setSortBy(v as SortKey); setPage(1); setActivePreset(null) }}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="return1Y">ผลตอบแทน 1 ปี</SelectItem>
                  <SelectItem value="return3Y">ผลตอบแทน 3 ปี</SelectItem>
                  <SelectItem value="volatility1Y">ความผันผวน</SelectItem>
                  <SelectItem value="maxDrawdown1Y">Max Drawdown</SelectItem>
                  <SelectItem value="sharpe1Y">Sharpe Ratio</SelectItem>
                  <SelectItem value="latestNav">NAV ล่าสุด</SelectItem>
                  <SelectItem value="nameTh">ชื่อกองทุน</SelectItem>
                  <SelectItem value="riskLevel">ระดับความเสี่ยง</SelectItem>
                  <SelectItem value="amc">บลจ.</SelectItem>
                  <SelectItem value="fundType">ประเภทกองทุน</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort direction */}
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">ทิศทาง</label>
              <Select value={sortDir} onValueChange={(v) => { setSortDir(v as 'asc' | 'desc'); setPage(1) }}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">มากไปน้อย</SelectItem>
                  <SelectItem value="asc">น้อยไปมาก</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button variant="ghost" size="sm" onClick={handleReset}>รีเซ็ต</Button>
          </div>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-700">โหลดข้อมูลไม่สำเร็จ</p>
            <p className="text-xs text-red-600 mt-0.5">{errorMsg}</p>
          </div>
          <Button size="sm" variant="outline" onClick={fetchFunds} className="shrink-0 gap-1.5 border-red-200 text-red-700 hover:bg-red-100">
            <RefreshCw className="h-3.5 w-3.5" />
            ลองใหม่
          </Button>
        </div>
      )}

      {/* Results count + loading indicator */}
      {!isLoading && !isError && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span className="flex items-center gap-2">
            พบ {pagination.total.toLocaleString('th-TH')} กองทุน
            {isRefreshing && (
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-500" />
            )}
          </span>
          <span className="text-xs">หน้า {page} จาก {pagination.totalPages}</span>
        </div>
      )}

      {/* Table — show skeleton on first load, keep data visible while refreshing */}
      <FundTable
        funds={funds}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={handleSort}
        loading={isLoading}
      />

      {/* Pagination */}
      {!isLoading && !isError && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-4">
          <Button
            variant="outline" size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || isRefreshing}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-slate-600 px-3">{page} / {pagination.totalPages}</span>
          <Button
            variant="outline" size="sm"
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page === pagination.totalPages || isRefreshing}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400 text-center pb-4">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
        ข้อมูลนี้จัดทำเพื่อการศึกษาเท่านั้น ไม่ใช่คำแนะนำการลงทุน
      </p>
    </div>
  )
}
