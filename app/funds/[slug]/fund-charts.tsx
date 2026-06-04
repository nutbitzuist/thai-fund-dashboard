'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Download } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const ChartSkeleton = () => <Skeleton className="h-[320px] w-full" />

const NavChart = dynamic(() => import('@/components/charts/nav-chart').then((m) => ({ default: m.NavChart })), { ssr: false, loading: ChartSkeleton })
const NormalizedChart = dynamic(() => import('@/components/charts/normalized-chart').then((m) => ({ default: m.NormalizedChart })), { ssr: false, loading: ChartSkeleton })
const DrawdownChart = dynamic(() => import('@/components/charts/drawdown-chart').then((m) => ({ default: m.DrawdownChart })), { ssr: false, loading: ChartSkeleton })
const AumChart = dynamic(() => import('@/components/charts/aum-chart').then((m) => ({ default: m.AumChart })), { ssr: false, loading: ChartSkeleton })
const MonthlyHeatmap = dynamic(() => import('@/components/charts/monthly-heatmap').then((m) => ({ default: m.MonthlyHeatmap })), { ssr: false, loading: ChartSkeleton })
import { calcDrawdownSeries } from '@/lib/calculations'
import { formatPct, formatNav, cn } from '@/lib/utils'

interface NavPoint {
  date: string
  nav: number
  buyPrice?: number | null
  sellPrice?: number | null
  netAsset?: number | null
}

interface NormalizedPoint {
  date: string
  value: number
}

interface FundChartsProps {
  projId: string
  defaultClassId?: number
}

type Period = '1D' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | '3Y' | 'MAX'
type ChartTab = 'nav' | 'normalized' | 'drawdown' | 'calculator' | 'aum' | 'heatmap'

const PERIOD_LABELS: Record<Period, string> = {
  '1D': 'วันนี้', '1M': '1เดือน', '3M': '3เดือน', '6M': '6เดือน',
  YTD: 'ปีนี้', '1Y': '1ปี', '3Y': '3ปี', MAX: 'ทั้งหมด',
}

function calcAnnualizedReturn(totalReturnPct: number, days: number): number | null {
  if (days < 2) return null
  const years = days / 365
  return (Math.pow(1 + totalReturnPct / 100, 1 / years) - 1) * 100
}

function downloadCSV(navData: NavPoint[], projId: string, period: string) {
  const header = 'Date,NAV,Buy Price,Sell Price\n'
  const rows = navData
    .map((d) => `${d.date},${d.nav},${d.buyPrice ?? ''},${d.sellPrice ?? ''}`)
    .join('\n')
  const blob = new Blob(['﻿' + header + rows], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${projId}_nav_${period}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function FundCharts({ projId, defaultClassId }: FundChartsProps) {
  const [period, setPeriod] = useState<Period>('1Y')
  const [navData, setNavData] = useState<NavPoint[]>([])
  const [normalizedData, setNormalizedData] = useState<NormalizedPoint[]>([])
  const [drawdownData, setDrawdownData] = useState<Array<{ date: string; drawdown: number }>>([])
  const [loading, setLoading] = useState(true)
  const [activeChart, setActiveChart] = useState<ChartTab>('nav')
  const [investAmount, setInvestAmount] = useState('100000')
  const [maxNavData, setMaxNavData] = useState<NavPoint[]>([])
  const [loadingMax, setLoadingMax] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const params = new URLSearchParams({ period })
        if (defaultClassId) params.set('classId', String(defaultClassId))

        const res = await fetch(`/api/funds/${projId}/nav?${params}`)
        const data = await res.json()

        const nav: NavPoint[] = data.data ?? []
        const norm: NormalizedPoint[] = data.normalized ?? []

        setNavData(nav)
        setNormalizedData(norm)
        setDrawdownData(
          calcDrawdownSeries(nav.map((d) => ({ date: new Date(d.date), nav: d.nav }))).map((d) => ({
            date: d.date.toISOString().split('T')[0],
            drawdown: d.drawdown,
          }))
        )
      } catch {
        setNavData([])
        setNormalizedData([])
        setDrawdownData([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [projId, period, defaultClassId])

  useEffect(() => {
    if (activeChart !== 'heatmap') return
    if (maxNavData.length > 0) return
    let cancelled = false
    setLoadingMax(true)
    const params = new URLSearchParams({ period: 'MAX' })
    if (defaultClassId) params.set('classId', String(defaultClassId))
    fetch(`/api/funds/${projId}/nav?${params}`)
      .then((res) => res.json())
      .then((json) => { if (!cancelled) setMaxNavData(json.data ?? []) })
      .catch(() => { if (!cancelled) setMaxNavData([]) })
      .finally(() => { if (!cancelled) setLoadingMax(false) })
    return () => { cancelled = true }
  }, [activeChart, projId, defaultClassId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Portfolio calculator derived values
  const calcResult = useCallback(() => {
    if (navData.length < 2) return null
    const amount = parseFloat(investAmount.replace(/,/g, ''))
    if (!amount || amount <= 0) return null

    const startNav = navData[0].nav
    const endNav = navData[navData.length - 1].nav
    if (startNav <= 0) return null

    const units = amount / startNav
    const currentValue = units * endNav
    const gain = currentValue - amount
    const totalReturnPct = ((endNav - startNav) / startNav) * 100

    const startDate = new Date(navData[0].date)
    const endDate = new Date(navData[navData.length - 1].date)
    const days = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000)
    const annualized = calcAnnualizedReturn(totalReturnPct, days)

    return { amount, currentValue, gain, totalReturnPct, annualized, units, startNav, endNav, days }
  }, [navData, investAmount])

  const result = calcResult()

  const periods: Period[] = ['1D', '1M', '3M', '6M', 'YTD', '1Y', '3Y', 'MAX']

  return (
    <Card>
      <CardContent className="p-6">
        {/* Period Selector + Download */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex gap-1.5 flex-wrap">
            {periods.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  period === p
                    ? 'bg-blue-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 min-w-0">
            {/* CSV Download */}
            {navData.length > 0 && (
              <button
                onClick={() => downloadCSV(navData, projId, period)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors shrink-0"
                title="ดาวน์โหลด CSV"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">CSV</span>
              </button>
            )}

            {/* Chart type selector — scrollable on mobile */}
            <div className="overflow-x-auto max-w-full">
              <Tabs value={activeChart} onValueChange={(v) => setActiveChart(v as ChartTab)}>
                <TabsList className="h-8 flex-nowrap">
                  <TabsTrigger value="nav" className="text-xs px-2.5 shrink-0">NAV</TabsTrigger>
                  <TabsTrigger value="normalized" className="text-xs px-2 shrink-0 hidden sm:flex">Normalized</TabsTrigger>
                  <TabsTrigger value="drawdown" className="text-xs px-2.5 shrink-0">Drawdown</TabsTrigger>
                  <TabsTrigger value="calculator" className="text-xs px-2.5 shrink-0">คำนวณ</TabsTrigger>
                  {navData.some((d) => d.netAsset != null) && (
                    <TabsTrigger value="aum" className="text-xs px-2.5 shrink-0">AUM</TabsTrigger>
                  )}
                  <TabsTrigger value="heatmap" className="text-xs px-2.5 shrink-0">Heatmap</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </div>

        {/* Chart / Calculator */}
        {loading ? (
          <Skeleton className="h-[320px] w-full" />
        ) : (
          <>
            {activeChart === 'nav' && (
              <>
                <NavChart data={navData} height={320} />
                <p className="text-xs text-slate-400 mt-2">มูลค่าหน่วยลงทุน (NAV) ต่อวัน</p>
              </>
            )}
            {activeChart === 'normalized' && (
              <>
                <NormalizedChart
                  series={[{
                    projId,
                    label: projId,
                    data: normalizedData.map((d) => ({ date: d.date, normalized: d.value })),
                  }]}
                  height={320}
                />
                <p className="text-xs text-slate-400 mt-2">
                  กราฟ Normalized — เริ่มต้นที่ 100 เพื่อดูการเติบโตสัมพัทธ์
                </p>
              </>
            )}
            {activeChart === 'drawdown' && (
              <>
                <DrawdownChart data={drawdownData} height={320} />
                <p className="text-xs text-slate-400 mt-2">
                  Drawdown — การลดลงจากจุดสูงสุดในช่วงเวลาที่เลือก (%)
                </p>
              </>
            )}
            {activeChart === 'calculator' && (
              <PortfolioCalculator
                result={result}
                investAmount={investAmount}
                onAmountChange={setInvestAmount}
                period={period}
                noData={navData.length < 2}
              />
            )}
            {activeChart === 'aum' && (
              <>
                <AumChart
                  data={navData.map((d) => ({ date: d.date, aum: d.netAsset ?? null }))}
                  height={320}
                />
                <p className="text-xs text-slate-400 mt-2">มูลค่าทรัพย์สินสุทธิ (AUM) รายวัน</p>
              </>
            )}
            {activeChart === 'heatmap' && (
              loadingMax ? (
                <Skeleton className="h-[320px] w-full" />
              ) : (
                <MonthlyHeatmap
                  data={maxNavData.map((d) => ({ date: d.date, nav: d.nav }))}
                />
              )
            )}
          </>
        )}

        {/* Data count info */}
        {!loading && navData.length > 0 && activeChart !== 'calculator' && (
          <p className="text-xs text-slate-400 mt-2">
            ข้อมูล {navData.length.toLocaleString('th-TH')} วันทำการ
            ตั้งแต่ {navData[0]?.date} ถึง {navData[navData.length - 1]?.date}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ── Portfolio Calculator ──────────────────────────────────────────────────────

interface CalcResult {
  amount: number
  currentValue: number
  gain: number
  totalReturnPct: number
  annualized: number | null
  units: number
  startNav: number
  endNav: number
  days: number
}

function PortfolioCalculator({
  result,
  investAmount,
  onAmountChange,
  period,
  noData,
}: {
  result: CalcResult | null
  investAmount: string
  onAmountChange: (v: string) => void
  period: Period
  noData: boolean
}) {
  const formatThb = (v: number) =>
    '฿' + v.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="py-2 space-y-5">
      {/* Amount input */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          สมมติว่าลงทุนตอนต้นงวด {PERIOD_LABELS[period]}
        </label>
        <div className="relative w-full max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium text-sm">฿</span>
          <input
            type="number"
            min="1"
            step="1000"
            value={investAmount}
            onChange={(e) => onAmountChange(e.target.value)}
            className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="100000"
          />
        </div>
      </div>

      {noData ? (
        <p className="text-sm text-slate-400">ไม่มีข้อมูล NAV ในช่วงเวลานี้</p>
      ) : !result ? (
        <p className="text-sm text-slate-400">กรุณาใส่จำนวนเงิน</p>
      ) : (
        <>
          {/* Result cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <ResultCard
              label="เงินลงทุนเริ่มต้น"
              value={formatThb(result.amount)}
              sub={`NAV ณ วันนั้น: ${formatNav(result.startNav)}`}
            />
            <ResultCard
              label="มูลค่าปัจจุบัน"
              value={formatThb(result.currentValue)}
              sub={`NAV ล่าสุด: ${formatNav(result.endNav)}`}
              positive={result.gain >= 0}
              negative={result.gain < 0}
            />
            <ResultCard
              label="กำไร / ขาดทุน"
              value={(result.gain >= 0 ? '+' : '') + formatThb(result.gain)}
              sub={`ผลตอบแทนรวม ${formatPct(result.totalReturnPct)}`}
              positive={result.gain >= 0}
              negative={result.gain < 0}
            />
            <ResultCard
              label={result.days >= 365 ? 'ผลตอบแทนต่อปี' : 'ผลตอบแทนรวม'}
              value={result.days >= 365 && result.annualized != null
                ? formatPct(result.annualized) + '/ปี'
                : formatPct(result.totalReturnPct)}
              sub={`${result.days} วันทำการ (${(result.days / 365).toFixed(1)} ปี)`}
              positive={result.totalReturnPct >= 0}
              negative={result.totalReturnPct < 0}
            />
          </div>

          <p className="text-xs text-slate-400">
            คำนวณจาก NAV ต้นงวดและ NAV ล่าสุดเท่านั้น ไม่รวมค่าธรรมเนียมซื้อขาย
            ข้อมูลนี้มีไว้เพื่อการศึกษาเท่านั้น ไม่ใช่คำแนะนำการลงทุน
          </p>
        </>
      )}
    </div>
  )
}

function ResultCard({
  label,
  value,
  sub,
  positive,
  negative,
}: {
  label: string
  value: string
  sub?: string
  positive?: boolean
  negative?: boolean
}) {
  const valueClass = positive
    ? 'text-green-600'
    : negative
    ? 'text-red-600'
    : 'text-slate-900'

  return (
    <div className={cn(
      'rounded-xl border p-3',
      positive ? 'bg-green-50 border-green-100' :
      negative ? 'bg-red-50 border-red-100' :
      'bg-slate-50 border-slate-100'
    )}>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={cn('text-base font-bold tabular-nums', valueClass)}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}
