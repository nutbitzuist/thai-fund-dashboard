'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Plus, X, Loader2, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react'
import { FundSearch } from '@/components/fund/fund-search'
import { cn, formatPct, getReturnColorClass } from '@/lib/utils'
import { COMPARE_COLORS } from '@/types'
import type { SimulatorSeries } from '@/components/charts/simulator-chart'

const SimulatorChart = dynamic(
  () => import('@/components/charts/simulator-chart').then((m) => m.SimulatorChart),
  { ssr: false, loading: () => <div className="h-80 animate-pulse rounded-xl bg-slate-100" /> }
)

interface NavPoint { date: string; nav: number }

interface SelectedFund {
  projId: string
  projAbbrName: string | null
  nameTh: string
  color: string
}

interface SimResult {
  fund: SelectedFund
  startDate: string
  startNav: number
  endNav: number
  finalValue: number
  totalReturn: number
  annualizedReturn: number | null
  days: number
  valueSeries: SimulatorSeries['data']
}

type PeriodTab = '6M' | '1Y' | 'YTD' | 'custom'

const PERIOD_TABS: { id: PeriodTab; label: string }[] = [
  { id: '6M',    label: '6 เดือน' },
  { id: '1Y',    label: '1 ปี' },
  { id: 'YTD',   label: 'ตั้งแต่ต้นปี' },
  { id: 'custom', label: 'กำหนดเอง' },
]

function getStartDate(period: PeriodTab, customFrom?: string): string {
  const now = new Date()
  if (period === 'custom' && customFrom) return customFrom
  if (period === 'YTD') return `${now.getFullYear()}-01-01`
  if (period === '6M') {
    const d = new Date(now); d.setMonth(d.getMonth() - 6); return d.toISOString().slice(0, 10)
  }
  // 1Y
  const d = new Date(now); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10)
}

function daysBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000
}

function annualize(totalReturn: number, days: number): number | null {
  if (days < 90) return null
  return Math.pow(1 + totalReturn, 365 / days) - 1
}

export function SimulateClient() {
  const [funds, setFunds] = useState<SelectedFund[]>([])
  const [investAmount, setInvestAmount] = useState(10_000)
  const [period, setPeriod] = useState<PeriodTab>('1Y')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Cache raw MAX NAV data per fund
  const navCache = useRef<Map<string, NavPoint[]>>(new Map())

  const fetchNav = useCallback(async (projId: string): Promise<NavPoint[] | null> => {
    if (navCache.current.has(projId)) return navCache.current.get(projId)!
    setLoading((l) => ({ ...l, [projId]: true }))
    setErrors((e) => { const n = { ...e }; delete n[projId]; return n })
    try {
      const res = await fetch(`/api/funds/${encodeURIComponent(projId)}/nav?period=MAX`)
      if (!res.ok) throw new Error('ไม่พบข้อมูล NAV')
      const json = await res.json()
      const points: NavPoint[] = (json.data ?? []).map((d: { date: string; nav: number }) => ({ date: d.date, nav: d.nav }))
      navCache.current.set(projId, points)
      return points
    } catch (err) {
      setErrors((e) => ({ ...e, [projId]: (err as Error).message }))
      return null
    } finally {
      setLoading((l) => { const n = { ...l }; delete n[projId]; return n })
    }
  }, [])

  const handleAddFund = useCallback(async (fund: { projId: string; projAbbrName: string | null; nameTh: string }) => {
    if (funds.length >= 3 || funds.some((f) => f.projId === fund.projId)) return
    const color = COMPARE_COLORS[funds.length % COMPARE_COLORS.length]
    setFunds((prev) => [...prev, { ...fund, color }])
    await fetchNav(fund.projId)
  }, [funds, fetchNav])

  const handleRemoveFund = (projId: string) => {
    setFunds((prev) => prev.filter((f) => f.projId !== projId))
  }

  // Compute sliced NAV series for current period
  const startDate = getStartDate(period, customFrom || undefined)
  const endDate = period === 'custom' ? customTo : new Date().toISOString().slice(0, 10)

  const simulationResults = useMemo(() => {
    return funds.map((fund) => {
      const all = navCache.current.get(fund.projId)
      if (!all || all.length < 2) return null

      const sliced = all.filter((p) => p.date >= startDate && p.date <= endDate)
      if (sliced.length < 2) return null

      // If exact start date has no data, use first available point
      const actualStartDate = sliced[0].date
      const startNav = sliced[0].nav
      const endNav = sliced[sliced.length - 1].nav
      const units = investAmount / startNav
      const finalValue = units * endNav
      const totalReturn = (finalValue - investAmount) / investAmount
      const days = daysBetween(actualStartDate, sliced[sliced.length - 1].date)
      const annualizedReturn = annualize(totalReturn, days)

      const valueSeries: SimulatorSeries['data'] = sliced.map((p) => ({
        date: p.date,
        value: units * p.nav,
      }))

      return {
        fund,
        startDate: actualStartDate,
        startNav,
        endNav,
        finalValue,
        totalReturn,
        annualizedReturn,
        days,
        valueSeries,
      }
    }).filter((r): r is SimResult => r !== null)
  }, [funds, startDate, endDate, investAmount])

  const chartSeries: SimulatorSeries[] = simulationResults.map((r) => ({
    projId: r.fund.projId,
    label: r.fund.projAbbrName ?? r.fund.projId,
    color: r.fund.color,
    data: r.valueSeries,
  }))

  const isAnyLoading = Object.keys(loading).length > 0

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
        {/* Fund selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            เลือกกองทุน {funds.length > 0 && `(${funds.length}/3)`}
          </label>
          <div className="space-y-2">
            {funds.map((fund) => (
              <div key={fund.projId} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: fund.color }} />
                <span className="text-xs font-mono font-bold text-blue-700">{fund.projAbbrName ?? fund.projId}</span>
                <span className="text-xs text-slate-600 flex-1 truncate">{fund.nameTh}</span>
                {loading[fund.projId] && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400 shrink-0" />}
                {errors[fund.projId] && <span className="text-xs text-red-500 shrink-0">{errors[fund.projId]}</span>}
                <button onClick={() => handleRemoveFund(fund.projId)} className="text-slate-400 hover:text-red-500 shrink-0">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {funds.length < 3 && (
              <FundSearch
                placeholder={funds.length === 0 ? 'ค้นหากองทุน...' : 'เพิ่มกองทุนเปรียบเทียบ...'}
                onSelect={handleAddFund}
                size="sm"
              />
            )}
          </div>
          {funds.length < 3 && funds.length > 0 && (
            <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1">
              <Plus className="h-3 w-3" /> เพิ่มกองทุนได้อีก {3 - funds.length} กองทุน
            </p>
          )}
        </div>

        {/* Investment amount */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">เงินลงทุน (บาท)</label>
          <input
            type="number"
            min={100}
            step={1000}
            value={investAmount}
            onChange={(e) => setInvestAmount(Math.max(100, Number(e.target.value)))}
            className="w-full max-w-xs h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {/* Period tabs */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">ช่วงเวลา</label>
          <div className="flex flex-wrap gap-2">
            {PERIOD_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setPeriod(tab.id)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-sm border transition-colors',
                  period === tab.id
                    ? 'bg-blue-700 text-white border-blue-700'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="flex items-center gap-2 mt-3">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-9 rounded-lg border border-slate-200 px-3 text-sm focus:border-blue-400 focus:outline-none"
              />
              <span className="text-slate-400 text-sm">ถึง</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-9 rounded-lg border border-slate-200 px-3 text-sm focus:border-blue-400 focus:outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      {funds.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          {isAnyLoading ? (
            <div className="h-80 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : chartSeries.length > 0 ? (
            <>
              <h2 className="text-sm font-semibold text-slate-700 mb-4">
                มูลค่าพอร์ต (เริ่มลงทุน ฿{investAmount.toLocaleString('th-TH')})
              </h2>
              <SimulatorChart series={chartSeries} investAmount={investAmount} />
            </>
          ) : (
            <div className="h-80 flex items-center justify-center text-slate-400 text-sm">
              ไม่มีข้อมูล NAV ในช่วงเวลาที่เลือก
            </div>
          )}
        </div>
      )}

      {/* Results table */}
      {simulationResults.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">กองทุน</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">เงินลงทุน</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">มูลค่าสุดท้าย</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">ผลตอบแทน</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">ต่อปี</th>
                </tr>
              </thead>
              <tbody>
                {simulationResults.map((r) => (
                  <tr key={r.fund.projId} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: r.fund.color }} />
                        <div>
                          <p className="text-xs font-mono font-bold text-blue-700">{r.fund.projAbbrName ?? r.fund.projId}</p>
                          <p className="text-xs text-slate-500 truncate max-w-[180px]">{r.fund.nameTh}</p>
                          {r.startDate !== startDate && (
                            <p className="text-xs text-amber-600">ใช้ NAV วันที่ {r.startDate}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700 tabular-nums">
                      ฿{investAmount.toLocaleString('th-TH')}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      <span className={getReturnColorClass(r.totalReturn)}>
                        ฿{Math.round(r.finalValue).toLocaleString('th-TH')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn('font-bold tabular-nums flex items-center justify-end gap-1', getReturnColorClass(r.totalReturn))}>
                        {r.totalReturn >= 0
                          ? <TrendingUp className="h-3.5 w-3.5" />
                          : <TrendingDown className="h-3.5 w-3.5" />}
                        {formatPct(r.totalReturn * 100)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.annualizedReturn != null ? (
                        <span className={cn('text-sm font-medium tabular-nums', getReturnColorClass(r.annualizedReturn * 100))}>
                          {formatPct(r.annualizedReturn * 100)}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {funds.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-16 text-center">
          <TrendingUp className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm font-medium">ค้นหาและเลือกกองทุนเพื่อเริ่มจำลอง</p>
          <p className="text-slate-400 text-xs mt-1">เปรียบเทียบได้สูงสุด 3 กองทุน</p>
        </div>
      )}

      <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400 text-center">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
        การจำลองนี้ใช้ข้อมูล NAV ในอดีต ผลตอบแทนในอดีตไม่รับประกันอนาคต ไม่ใช่คำแนะนำการลงทุน
      </p>
    </div>
  )
}
