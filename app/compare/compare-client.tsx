'use client'

// app/compare/compare-client.tsx
// Side-by-side fund comparison: Performance, Risk, AUM, Transaction Costs, Fund Info

import { useState, useEffect, useCallback, type CSSProperties } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { X, Plus, Share2, Check, AlertTriangle, TrendingUp, TrendingDown, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FundSearch } from '@/components/fund/fund-search'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartTooltip,
  Legend,
  ReferenceLine,
} from 'recharts'
import { NormalizedChart } from '@/components/charts/normalized-chart'
import { RiskBadge } from '@/components/metrics/risk-badge'
import { COMPARE_COLORS, FUND_TYPE_LABELS, DIVIDEND_POLICY_LABELS } from '@/types'
import { cn, formatPct, formatAUM, formatDateTh, getReturnColorClass, fundUrl } from '@/lib/utils'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────────────────

interface FundResult {
  id: number
  projId: string
  projAbbrName: string | null
  nameTh: string
  nameEn: string | null
  fundStatus: string | null
  fundType: string | null
  riskLevel: number | null
  amc: { nameTh: string } | null
}

interface FundData {
  projId: string
  projAbbrName: string | null
  nameTh: string
  nameEn: string | null
  riskLevel: number | null
  fundType: string | null
  dividendPolicy: string | null
  regisDate: string | null
  ageYears: number | null
  amc: { nameTh: string; nameEn: string | null } | null
  metrics: Record<string, {
    returnPct: number | null
    annualizedVolatilityPct: number | null
    maxDrawdownPct: number | null
    sharpeRatio: number | null
    navCount: number | null
  }>
  // AUM
  aum: number | null
  aum3MAgo: number | null
  aum1YAgo: number | null
  latestNav: number | null
  latestNavDate: string | null
  // Prices
  buyPrice: number | null
  sellPrice: number | null
  // Derived fees
  frontEndLoadPct: number
  backEndLoadPct: number
  roundTripCostPct: number | null
}

interface NavPoint { date: string; normalized: number }

type Period = '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y' | 'MAX'
const PERIODS: Period[] = ['1M', '3M', '6M', '1Y', '3Y', '5Y', 'MAX']
const PERIOD_LABELS: Record<Period, string> = {
  '1M': '1 เดือน', '3M': '3 เดือน', '6M': '6 เดือน',
  '1Y': '1 ปี', '3Y': '3 ปี', '5Y': '5 ปี', MAX: 'ทั้งหมด',
}
const METRIC_LABELS: Record<string, string> = {
  '1M': '1เดือน', '3M': '3เดือน', '6M': '6เดือน',
  '1Y': '1ปี', '3Y': '3ปี', '5Y': '5ปี',
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function ColorDot({ index }: { index: number }) {
  return (
    <div
      className="h-3 w-3 rounded-full shrink-0"
      style={{ backgroundColor: COMPARE_COLORS[index % COMPARE_COLORS.length] }}
    />
  )
}

function FundLabel({ fund, index, short = false }: { fund: FundData; index: number; short?: boolean }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <ColorDot index={index} />
      <div className="min-w-0">
        <span className="font-medium text-slate-900 text-xs block truncate">
          {fund.projAbbrName ?? fund.projId}
        </span>
        {!short && <span className="text-slate-400 text-xs truncate block">{fund.amc?.nameTh}</span>}
      </div>
    </div>
  )
}

// Inline horizontal bar for visual comparison
function Bar({ value, max, color, label }: { value: number; max: number; color: string; label?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      {label && <span className="text-xs tabular-nums text-slate-500 w-20 text-right shrink-0">{label}</span>}
    </div>
  )
}

// AUM change indicator
function AumChange({ current, previous, label }: { current: number | null; previous: number | null; label: string }) {
  if (!current || !previous) return <span className="text-slate-300 text-xs">-</span>
  const pct = ((current - previous) / previous) * 100
  const isUp = pct > 0
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium', isUp ? 'text-emerald-600' : 'text-red-500')}>
      {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isUp ? '+' : ''}{pct.toFixed(1)}% {label}
    </span>
  )
}

// Tooltip helper (title attribute — simple, no JS needed)
function InfoTip({ text }: { text: string }) {
  return (
    <span title={text} className="inline ml-1 cursor-help">
      <Info className="h-3.5 w-3.5 text-slate-400 inline" aria-hidden />
    </span>
  )
}

// Compute running drawdown (%) from normalized nav series
function computeDrawdown(navPoints: NavPoint[]): Array<{ date: string; drawdown: number }> {
  let peak = -Infinity
  return navPoints.map(({ date, normalized }) => {
    if (normalized > peak) peak = normalized
    const dd = peak > 0 ? ((normalized - peak) / peak) * 100 : 0
    return { date, drawdown: Number(dd.toFixed(3)) }
  })
}

// Multi-fund drawdown chart using Recharts directly
function MultiDrawdownChart({
  series,
  height = 280,
}: {
  series: Array<{ projId: string; label: string; color: string; data: NavPoint[] }>
  height?: number
}) {
  if (!series.length) return null

  // Build chart data: merge all dates, attach drawdown per fund
  const allDates = Array.from(
    new Set(series.flatMap((s) => s.data.map((d) => d.date)))
  ).sort()

  const step = Math.max(1, Math.floor(allDates.length / 500))
  const reducedDates = allDates.filter((_, i) => i % step === 0 || i === allDates.length - 1)

  // Pre-compute drawdown per series
  const ddByFund: Record<string, Map<string, number>> = {}
  for (const s of series) {
    const ddArr = computeDrawdown(s.data)
    ddByFund[s.projId] = new Map(ddArr.map(({ date, drawdown }) => [date, drawdown]))
  }

  const chartData = reducedDates.map((date) => {
    const row: Record<string, string | number> = {
      date,
      dateLabel: formatDateTh(date, { month: 'short', year: '2-digit', day: 'numeric' }),
    }
    for (const s of series) {
      const val = ddByFund[s.projId].get(date)
      if (val !== undefined) row[s.projId] = val
    }
    return row
  })

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
        <XAxis
          dataKey="dateLabel"
          tick={{ fontSize: 11, fill: '#94A3B8' }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#94A3B8' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v.toFixed(1)}%`}
          width={52}
        />
        <ReferenceLine y={0} stroke="#CBD5E1" strokeDasharray="4 4" />
        <RechartTooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => {
            const s = series.find((s) => s.projId === name)
            const numVal = typeof value === 'number' ? value : parseFloat(String(value))
            return [`${numVal.toFixed(2)}%`, s?.label ?? String(name)]
          }}
          labelFormatter={(label) => String(label)}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Legend
          formatter={(value) => {
            const s = series.find((s) => s.projId === value)
            return <span className="text-xs text-slate-600">{s?.label ?? value}</span>
          }}
        />
        {series.map((s) => (
          <Line
            key={s.projId}
            type="monotone"
            dataKey={s.projId}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function CompareClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [selectedFunds, setSelectedFunds] = useState<string[]>(() => {
    const f = searchParams.get('funds')
    return f ? f.split(',').filter(Boolean).slice(0, 5) : []
  })
  const [period, setPeriod] = useState<Period>('1Y')
  const [fundData, setFundData] = useState<FundData[]>([])
  const [navData, setNavData] = useState<Record<string, NavPoint[]>>({})
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  // URL sync
  useEffect(() => {
    const params = new URLSearchParams()
    if (selectedFunds.length) params.set('funds', selectedFunds.join(','))
    router.replace(`/compare?${params}`, { scroll: false })
  }, [selectedFunds, router])

  // Fetch compare data
  const fetchData = useCallback(async () => {
    if (!selectedFunds.length) { setFundData([]); setNavData({}); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/compare?funds=${selectedFunds.join(',')}&period=${period}`)
      const data = await res.json()
      setFundData(data.funds ?? [])
      const nav: Record<string, NavPoint[]> = {}
      for (const [projId, points] of Object.entries(data.navData ?? {})) {
        nav[projId] = (points as Array<{ date: string; normalized: number }>)
          .map((p) => ({ date: p.date, normalized: p.normalized }))
      }
      setNavData(nav)
    } catch { setFundData([]) } finally { setLoading(false) }
  }, [selectedFunds, period])

  useEffect(() => { fetchData() }, [fetchData])

  const addFund = (fund: FundResult) => {
    if (selectedFunds.length >= 5 || selectedFunds.includes(fund.projId)) return
    setSelectedFunds((prev) => [...prev, fund.projId])
  }
  const removeFund = (projId: string) => setSelectedFunds((prev) => prev.filter((id) => id !== projId))
  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const chartSeries = fundData
    .filter((f) => navData[f.projId]?.length)
    .map((f, i) => ({
      projId: f.projId,
      label: f.projAbbrName ?? f.projId,
      color: COMPARE_COLORS[i % COMPARE_COLORS.length],
      data: navData[f.projId] ?? [],
    }))

  // Max AUM for bar scaling
  const maxAum = Math.max(0, ...fundData.map((f) => f.aum ?? 0))
  // Max round-trip cost for bar scaling
  const maxRoundTrip = Math.max(0, ...fundData.map((f) => f.roundTripCostPct ?? 0))

  const hasFeeData = fundData.some((f) => f.buyPrice != null || f.sellPrice != null)
  const hasAumData = fundData.some((f) => f.aum != null)

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Fund Selector ──────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center mb-4">
            <div className="flex-1">
              <FundSearch
                placeholder="ค้นหากองทุนเพื่อเพิ่มในการเปรียบเทียบ..."
                onSelect={addFund}
              />
            </div>
            <Button variant="outline" size="sm" onClick={copyShareLink} className="shrink-0">
              {copied ? <Check className="h-4 w-4 mr-1.5 text-green-600" /> : <Share2 className="h-4 w-4 mr-1.5" />}
              {copied ? 'คัดลอกแล้ว!' : 'แชร์ลิงก์'}
            </Button>
          </div>

          {selectedFunds.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {fundData.map((fund, i) => (
                <div
                  key={fund.projId}
                  className="flex items-center gap-2 rounded-full border px-3 py-1.5 bg-white text-sm"
                  style={{ borderColor: COMPARE_COLORS[i % COMPARE_COLORS.length] + '80' }}
                >
                  <ColorDot index={i} />
                  <Link href={fundUrl(fund)} className="font-medium hover:text-blue-700 transition-colors">
                    {fund.projAbbrName ?? fund.projId}
                  </Link>
                  <span className="text-slate-400 text-xs hidden sm:inline max-w-[120px] truncate">{fund.nameTh}</span>
                  <button onClick={() => removeFund(fund.projId)} className="text-slate-400 hover:text-red-500 transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {selectedFunds.length < 5 && (
                <span className="text-xs text-slate-400 self-center">เพิ่มได้อีก {5 - selectedFunds.length} กองทุน</span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Plus className="h-4 w-4" />
              ค้นหาและเพิ่มกองทุนเพื่อเปรียบเทียบ (สูงสุด 5 กองทุน)
            </div>
          )}
        </CardContent>
      </Card>

      {fundData.length > 0 && (
        <>
          {/* ── Period Selector ──────────────────────────────────── */}
          <div className="flex gap-1.5 flex-wrap">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  period === p ? 'bg-blue-700 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                )}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          {/* ── NAV Chart ──────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>กราฟผลตอบแทนเทียบกัน (Normalized = 100)</CardTitle>
              <p className="text-sm text-slate-500">ปรับให้ทุกกองทุนเริ่มต้นที่ 100 — เปรียบเทียบการเติบโตสัมพัทธ์ในช่วง {PERIOD_LABELS[period]}</p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[380px] bg-slate-100 animate-pulse rounded-lg" />
              ) : (
                <NormalizedChart series={chartSeries} height={380} />
              )}
            </CardContent>
          </Card>

          {/* ── Return Table ──────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>ผลตอบแทนย้อนหลัง</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2.5 pr-4 text-slate-500 font-medium min-w-[160px]">กองทุน</th>
                      {Object.keys(METRIC_LABELS).map((p) => (
                        <th key={p} className="text-right py-2.5 px-3 text-slate-500 font-medium whitespace-nowrap">{METRIC_LABELS[p]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fundData.map((fund, i) => (
                      <tr key={fund.projId} className="border-b border-slate-100 last:border-0">
                        <td className="py-3 pr-4"><FundLabel fund={fund} index={i} /></td>
                        {Object.keys(METRIC_LABELS).map((p) => {
                          const m = fund.metrics[p]
                          // Highlight the best return in each column
                          const allVals = fundData.map((f) => f.metrics[p]?.returnPct ?? null).filter((v) => v != null) as number[]
                          const isBest = allVals.length > 1 && m?.returnPct != null && m.returnPct === Math.max(...allVals)
                          return (
                            <td key={p} className={cn(
                              'py-3 px-3 text-right font-medium tabular-nums',
                              getReturnColorClass(m?.returnPct),
                              isBest && 'ring-1 ring-inset ring-emerald-200 bg-emerald-50 rounded'
                            )}>
                              {m?.returnPct != null ? formatPct(m.returnPct) : '-'}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-400 mt-2">🟩 ไฮไลต์คือผลตอบแทนสูงสุดในแต่ละช่วงเวลา</p>
            </CardContent>
          </Card>

          {/* ── Risk Table ────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>ความเสี่ยง (ย้อนหลัง 1 ปี)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2.5 pr-4 text-slate-500 font-medium">กองทุน</th>
                      <th className="text-left py-2.5 px-3 text-slate-500 font-medium">ประเภท</th>
                      <th className="text-center py-2.5 px-3 text-slate-500 font-medium">ระดับเสี่ยง</th>
                      <th className="text-right py-2.5 px-3 text-slate-500 font-medium">Volatility<InfoTip text="ความผันผวนของผลตอบแทนรายวัน คำนวณเป็นรายปี — ยิ่งต่ำยิ่งดี" /></th>
                      <th className="text-right py-2.5 px-3 text-slate-500 font-medium">Max Drawdown<InfoTip text="การลดลงสูงสุดจากจุดสูงสุด — ยิ่งน้อย (ใกล้ 0) ยิ่งดี" /></th>
                      <th className="text-right py-2.5 px-3 text-slate-500 font-medium">Sharpe<InfoTip text="ผลตอบแทนต่อหน่วยความเสี่ยง — ยิ่งสูงยิ่งดี (>1 = ดี)" /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {fundData.map((fund, i) => {
                      const m1Y = fund.metrics['1Y']
                      const allVol = fundData.map((f) => f.metrics['1Y']?.annualizedVolatilityPct ?? null).filter((v) => v != null) as number[]
                      const allDD = fundData.map((f) => f.metrics['1Y']?.maxDrawdownPct ?? null).filter((v) => v != null) as number[]
                      const allSharpe = fundData.map((f) => f.metrics['1Y']?.sharpeRatio ?? null).filter((v) => v != null) as number[]
                      const bestVol = allVol.length > 1 && m1Y?.annualizedVolatilityPct != null && m1Y.annualizedVolatilityPct === Math.min(...allVol)
                      const bestDD = allDD.length > 1 && m1Y?.maxDrawdownPct != null && m1Y.maxDrawdownPct === Math.max(...allDD)
                      const bestSharpe = allSharpe.length > 1 && m1Y?.sharpeRatio != null && m1Y.sharpeRatio === Math.max(...allSharpe)
                      return (
                        <tr key={fund.projId} className="border-b border-slate-100 last:border-0">
                          <td className="py-3 pr-4"><FundLabel fund={fund} index={i} /></td>
                          <td className="py-3 px-3 text-slate-600 text-xs">{fund.fundType ? (FUND_TYPE_LABELS[fund.fundType] ?? fund.fundType) : '-'}</td>
                          <td className="py-3 px-3 text-center"><RiskBadge riskLevel={fund.riskLevel} showLabel={false} /></td>
                          <td className={cn('py-3 px-3 text-right tabular-nums text-slate-600', bestVol && 'bg-emerald-50 rounded text-emerald-700 font-medium')}>
                            {m1Y?.annualizedVolatilityPct != null ? `${m1Y.annualizedVolatilityPct.toFixed(2)}%` : '-'}
                          </td>
                          <td className={cn('py-3 px-3 text-right tabular-nums', bestDD && 'bg-emerald-50 rounded text-emerald-700 font-medium', !bestDD && m1Y?.maxDrawdownPct != null && m1Y.maxDrawdownPct < -10 ? 'text-red-600' : 'text-slate-600')}>
                            {m1Y?.maxDrawdownPct != null ? `${m1Y.maxDrawdownPct.toFixed(2)}%` : '-'}
                          </td>
                          <td className={cn('py-3 px-3 text-right tabular-nums', bestSharpe && 'bg-emerald-50 rounded text-emerald-700 font-medium', !bestSharpe && 'text-slate-600')}>
                            {m1Y?.sharpeRatio != null ? m1Y.sharpeRatio.toFixed(2) : '-'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-400 mt-2">🟩 ไฮไลต์คือตัวเลขที่ดีที่สุดในแต่ละคอลัมน์</p>
            </CardContent>
          </Card>

          {/* ── Drawdown Chart ────────────────────────────────────── */}
          {chartSeries.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>กราฟ Drawdown</CardTitle>
                <p className="text-sm text-slate-500">แสดงการลดลงจากจุดสูงสุดของแต่ละกองทุน — ยิ่งใกล้ 0% ยิ่งมั่นคง</p>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-[280px] bg-slate-100 animate-pulse rounded-lg" />
                ) : (
                  <MultiDrawdownChart series={chartSeries} height={280} />
                )}
              </CardContent>
            </Card>
          )}

          {/* ── AUM Comparison ───────────────────────────────────── */}
          {hasAumData && (
            <Card>
              <CardHeader>
                <CardTitle>ขนาดกองทุน (AUM)</CardTitle>
                <p className="text-sm text-slate-500">
                  มูลค่าทรัพย์สินสุทธิรวมของกองทุน — กองทุนขนาดใหญ่มักมีสภาพคล่องดีกว่า แต่ไม่ได้หมายความว่าผลตอบแทนจะดีกว่าเสมอ
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-5">
                  {/* Current AUM bars */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">AUM ปัจจุบัน</p>
                    <div className="space-y-3">
                      {fundData.map((fund, i) => (
                        <div key={fund.projId}>
                          <div className="flex items-center justify-between mb-1">
                            <FundLabel fund={fund} index={i} short />
                            <div className="text-right">
                              <span className="text-sm font-semibold tabular-nums text-slate-900">
                                {fund.aum != null ? formatAUM(fund.aum) : 'ไม่มีข้อมูล'}
                              </span>
                              <div className="flex justify-end gap-2 mt-0.5">
                                <AumChange current={fund.aum} previous={fund.aum3MAgo} label="(3M)" />
                                <AumChange current={fund.aum} previous={fund.aum1YAgo} label="(1Y)" />
                              </div>
                            </div>
                          </div>
                          {fund.aum != null && (
                            <Bar
                              value={fund.aum}
                              max={maxAum}
                              color={COMPARE_COLORS[i % COMPARE_COLORS.length]}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AUM history table */}
                  {fundData.some((f) => f.aum3MAgo != null || f.aum1YAgo != null) && (
                    <div className="border-t border-slate-100 pt-4">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">ประวัติขนาดกองทุน</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-200">
                              <th className="text-left py-2 pr-4 text-slate-500 font-medium">กองทุน</th>
                              <th className="text-right py-2 px-3 text-slate-500 font-medium">ปัจจุบัน</th>
                              <th className="text-right py-2 px-3 text-slate-500 font-medium">3 เดือนที่แล้ว</th>
                              <th className="text-right py-2 px-3 text-slate-500 font-medium">1 ปีที่แล้ว</th>
                            </tr>
                          </thead>
                          <tbody>
                            {fundData.map((fund, i) => (
                              <tr key={fund.projId} className="border-b border-slate-100 last:border-0">
                                <td className="py-2.5 pr-4"><FundLabel fund={fund} index={i} short /></td>
                                <td className="py-2.5 px-3 text-right tabular-nums text-slate-900 font-medium text-sm">
                                  {fund.aum != null ? formatAUM(fund.aum) : '-'}
                                </td>
                                <td className="py-2.5 px-3 text-right tabular-nums text-slate-600 text-sm">
                                  {fund.aum3MAgo != null ? formatAUM(fund.aum3MAgo) : '-'}
                                </td>
                                <td className="py-2.5 px-3 text-right tabular-nums text-slate-600 text-sm">
                                  {fund.aum1YAgo != null ? formatAUM(fund.aum1YAgo) : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Transaction Cost (Buy/Sell Spread) ───────────────── */}
          {hasFeeData && (
            <Card>
              <CardHeader>
                <CardTitle>ค่าใช้จ่ายในการซื้อขาย</CardTitle>
                <p className="text-sm text-slate-500">
                  คำนวณจากส่วนต่างระหว่างราคาซื้อ-ราคารับซื้อคืนกับ NAV — เป็นต้นทุนในการซื้อขายรอบเดียว
                  <span className="ml-1 text-amber-600 font-medium">ไม่ใช่ค่าธรรมเนียมการจัดการรายปี</span>
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-5">
                  {/* Price table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-2.5 pr-4 text-slate-500 font-medium">กองทุน</th>
                          <th className="text-right py-2.5 px-3 text-slate-500 font-medium">NAV</th>
                          <th className="text-right py-2.5 px-3 text-slate-500 font-medium">
                            ราคาขาย (ซื้อ)
                            <InfoTip text="ราคาที่นักลงทุนจ่ายเมื่อซื้อกองทุน — สูงกว่า NAV เท่ากับค่า front-end load" />
                          </th>
                          <th className="text-right py-2.5 px-3 text-slate-500 font-medium">
                            ราคารับซื้อคืน
                            <InfoTip text="ราคาที่นักลงทุนได้รับเมื่อขายคืน — ต่ำกว่า NAV เท่ากับค่า back-end load" />
                          </th>
                          <th className="text-right py-2.5 px-3 text-slate-500 font-medium">
                            Front-end
                            <InfoTip text="(ราคาซื้อ - NAV) ÷ NAV × 100 — ต้นทุนเมื่อซื้อ" />
                          </th>
                          <th className="text-right py-2.5 px-3 text-slate-500 font-medium">
                            Back-end
                            <InfoTip text="(NAV - ราคารับซื้อคืน) ÷ NAV × 100 — ต้นทุนเมื่อขาย" />
                          </th>
                          <th className="text-right py-2.5 px-3 text-slate-500 font-medium font-semibold">
                            รวมรอบเดียว
                            <InfoTip text="Front-end + Back-end = ต้นทุนทั้งหมดในการซื้อแล้วขายครั้งเดียว" />
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {fundData.map((fund, i) => {
                          const allRT = fundData.map((f) => f.roundTripCostPct ?? null).filter((v) => v != null) as number[]
                          const isCheapest = allRT.length > 1 && fund.roundTripCostPct != null && fund.roundTripCostPct === Math.min(...allRT)
                          return (
                            <tr key={fund.projId} className="border-b border-slate-100 last:border-0">
                              <td className="py-3 pr-4"><FundLabel fund={fund} index={i} /></td>
                              <td className="py-3 px-3 text-right tabular-nums text-slate-600">
                                {fund.latestNav != null ? fund.latestNav.toFixed(4) : '-'}
                              </td>
                              <td className="py-3 px-3 text-right tabular-nums text-slate-600">
                                {fund.buyPrice != null ? fund.buyPrice.toFixed(4) : '-'}
                              </td>
                              <td className="py-3 px-3 text-right tabular-nums text-slate-600">
                                {fund.sellPrice != null ? fund.sellPrice.toFixed(4) : '-'}
                              </td>
                              <td className={cn('py-3 px-3 text-right tabular-nums font-medium',
                                fund.frontEndLoadPct > 1.5 ? 'text-red-600' : fund.frontEndLoadPct > 0 ? 'text-amber-600' : 'text-emerald-600'
                              )}>
                                {fund.frontEndLoadPct > 0 ? `${fund.frontEndLoadPct.toFixed(3)}%` : '0%'}
                              </td>
                              <td className={cn('py-3 px-3 text-right tabular-nums font-medium',
                                fund.backEndLoadPct > 1.5 ? 'text-red-600' : fund.backEndLoadPct > 0 ? 'text-amber-600' : 'text-emerald-600'
                              )}>
                                {fund.backEndLoadPct > 0 ? `${fund.backEndLoadPct.toFixed(3)}%` : '0%'}
                              </td>
                              <td className={cn('py-3 px-3 text-right tabular-nums font-bold',
                                isCheapest && 'bg-emerald-50 text-emerald-700 rounded',
                                !isCheapest && (fund.roundTripCostPct ?? 0) > 2 ? 'text-red-600' : 'text-slate-900'
                              )}>
                                {fund.roundTripCostPct != null ? `${fund.roundTripCostPct.toFixed(3)}%` : '-'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Visual cost bars */}
                  {maxRoundTrip > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">ต้นทุนรวมรอบเดียว (เปรียบเทียบ)</p>
                      <div className="space-y-3">
                        {fundData.map((fund, i) => (
                          <div key={fund.projId} className="flex items-center gap-3">
                            <FundLabel fund={fund} index={i} short />
                            <div className="flex-1">
                              <Bar
                                value={fund.roundTripCostPct ?? 0}
                                max={maxRoundTrip}
                                color={COMPARE_COLORS[i % COMPARE_COLORS.length]}
                                label={fund.roundTripCostPct != null ? `${fund.roundTripCostPct.toFixed(3)}%` : 'ไม่มีข้อมูล'}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                    <strong>หมายเหตุเรื่องค่าธรรมเนียม:</strong>{' '}
                    ตัวเลขข้างต้นคือ&quot;ค่าใช้จ่ายในการซื้อขาย&quot; ที่คำนวณจากราคา ณ วันล่าสุด
                    ไม่รวมค่าธรรมเนียมการจัดการรายปี (Management Fee / TER) ซึ่งมีผลโดยตรงต่อผลตอบแทนสุทธิ
                    กรุณาอ่านหนังสือชี้ชวนของแต่ละกองทุนเพื่อดูค่าธรรมเนียมทั้งหมด
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Fund Info ─────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>ข้อมูลกองทุน</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2.5 pr-4 text-slate-500 font-medium">กองทุน</th>
                      <th className="text-left py-2.5 px-3 text-slate-500 font-medium">บลจ.</th>
                      <th className="text-left py-2.5 px-3 text-slate-500 font-medium">ประเภท</th>
                      <th className="text-center py-2.5 px-3 text-slate-500 font-medium">ระดับเสี่ยง</th>
                      <th className="text-left py-2.5 px-3 text-slate-500 font-medium">นโยบายปันผล</th>
                      <th className="text-right py-2.5 px-3 text-slate-500 font-medium">วันจดทะเบียน</th>
                      <th className="text-right py-2.5 px-3 text-slate-500 font-medium">อายุกองทุน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fundData.map((fund, i) => (
                      <tr key={fund.projId} className="border-b border-slate-100 last:border-0">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <ColorDot index={i} />
                            <Link href={fundUrl(fund)} className="font-medium text-blue-700 hover:underline text-xs">
                              {fund.projAbbrName ?? fund.projId}
                            </Link>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 ml-5 line-clamp-1">{fund.nameTh}</p>
                        </td>
                        <td className="py-3 px-3 text-slate-600 text-xs">{fund.amc?.nameTh ?? '-'}</td>
                        <td className="py-3 px-3">
                          {fund.fundType ? (
                            <span className="text-xs bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">
                              {FUND_TYPE_LABELS[fund.fundType] ?? fund.fundType}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="py-3 px-3 text-center"><RiskBadge riskLevel={fund.riskLevel} showLabel={false} /></td>
                        <td className="py-3 px-3 text-slate-600 text-xs">
                          {fund.dividendPolicy ? (DIVIDEND_POLICY_LABELS[fund.dividendPolicy] ?? fund.dividendPolicy) : '-'}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-600 text-xs tabular-nums">
                          {fund.regisDate ? formatDateTh(new Date(fund.regisDate)) : '-'}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-600 text-xs tabular-nums">
                          {fund.ageYears != null ? `${fund.ageYears} ปี` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

        </>
      )}

      {/* ── Correlation Matrix ───────────────────────────────── */}
      {(() => {
        const fundsWithNav = fundData.filter((f) => navData[f.projId]?.length > 0)
        if (fundsWithNav.length < 2) return null

        // Find intersection of dates across all series
        const dateSets = fundsWithNav.map((f) => new Set(navData[f.projId].map((p) => p.date)))
        const commonDates = Array.from(
          fundsWithNav.reduce<Set<string>>(
            (intersection, f) => new Set([...intersection].filter((d) => dateSets[fundsWithNav.indexOf(f)].has(d))),
            dateSets[0]
          )
        ).sort()

        if (commonDates.length < 2) return null

        // Align each series to common dates
        const aligned: Record<string, number[]> = {}
        for (const f of fundsWithNav) {
          const byDate = new Map(navData[f.projId].map((p) => [p.date, p.normalized]))
          aligned[f.projId] = commonDates.map((d) => byDate.get(d) ?? 0)
        }

        // Pearson correlation
        function pearson(xs: number[], ys: number[]): number {
          const n = xs.length
          if (n === 0) return 0
          const meanX = xs.reduce((a, b) => a + b, 0) / n
          const meanY = ys.reduce((a, b) => a + b, 0) / n
          let num = 0, denX = 0, denY = 0
          for (let i = 0; i < n; i++) {
            const dx = xs[i] - meanX
            const dy = ys[i] - meanY
            num += dx * dy
            denX += dx * dx
            denY += dy * dy
          }
          const den = Math.sqrt(denX * denY)
          return den === 0 ? 0 : num / den
        }

        // Build correlation matrix
        const matrix: number[][] = fundsWithNav.map((fi) =>
          fundsWithNav.map((fj) => {
            if (fi.projId === fj.projId) return 1
            return pearson(aligned[fi.projId], aligned[fj.projId])
          })
        )

        function cellStyle(r: number, isDiag: boolean): CSSProperties {
          if (isDiag) return { backgroundColor: '#16A34A', color: '#fff' }
          if (r >= 0.8) return { backgroundColor: `rgba(22,163,74,${0.15 + (r - 0.8) * 1.75})`, color: '#166534' }
          if (r >= 0.5) return { backgroundColor: `rgba(234,179,8,${0.15 + (r - 0.5) * 0.67})`, color: '#854d0e' }
          if (r >= 0) return { backgroundColor: 'rgba(241,245,249,0.6)', color: '#475569' }
          return { backgroundColor: `rgba(239,68,68,${Math.min(0.5, Math.abs(r) * 0.7)})`, color: '#991b1b' }
        }

        return (
          <Card>
            <CardHeader>
              <CardTitle>ความสัมพันธ์ระหว่างกองทุน (Correlation Matrix)</CardTitle>
              <p className="text-xs text-slate-400">ค่าใกล้ 1.0 = เคลื่อนไหวไปในทิศทางเดียวกัน, ค่าใกล้ 0 = ไม่สัมพันธ์กัน</p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="text-xs border-separate border-spacing-1">
                  <thead>
                    <tr>
                      <th className="w-24" />
                      {fundsWithNav.map((f, j) => (
                        <th key={j} className="text-center px-2 py-1 text-slate-500 font-medium whitespace-nowrap max-w-[80px] truncate">
                          {f.projAbbrName ?? f.projId}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fundsWithNav.map((fi, i) => (
                      <tr key={i}>
                        <td className="text-right pr-2 py-1 text-slate-500 font-medium whitespace-nowrap max-w-[96px] truncate">
                          {fi.projAbbrName ?? fi.projId}
                        </td>
                        {fundsWithNav.map((_, j) => {
                          const r = matrix[i][j]
                          const isDiag = i === j
                          return (
                            <td
                              key={j}
                              className="text-center tabular-nums rounded px-3 py-1.5 font-semibold"
                              style={cellStyle(r, isDiag)}
                            >
                              {r.toFixed(2)}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )
      })()}

      {/* ── Disclaimer ──────────────────────────────────────────── */}
      <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          การเปรียบเทียบนี้จัดทำเพื่อการศึกษาเท่านั้น ไม่ใช่คำแนะนำการลงทุน
          ผลตอบแทนในอดีตไม่ได้รับประกันอนาคต
          ค่าใช้จ่ายที่แสดงไม่รวมค่าธรรมเนียมการจัดการรายปี กรุณาอ่านหนังสือชี้ชวนก่อนลงทุน
        </span>
      </div>
    </div>
  )
}
