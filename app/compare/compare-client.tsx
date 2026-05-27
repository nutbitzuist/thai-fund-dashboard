'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { X, Plus, Share2, Check, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FundSearch } from '@/components/fund/fund-search'
import { NormalizedChart } from '@/components/charts/normalized-chart'
import { DrawdownChart } from '@/components/charts/drawdown-chart'
import { RiskBadge } from '@/components/metrics/risk-badge'
import { COMPARE_COLORS, FUND_TYPE_LABELS } from '@/types'
import { cn, formatPct, getReturnColorClass } from '@/lib/utils'

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
  amc: { nameTh: string } | null
  metrics: Record<string, {
    returnPct: number | null
    annualizedVolatilityPct: number | null
    maxDrawdownPct: number | null
    sharpeRatio: number | null
  }>
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

  // Update URL when selectedFunds changes
  useEffect(() => {
    const params = new URLSearchParams()
    if (selectedFunds.length) params.set('funds', selectedFunds.join(','))
    router.replace(`/compare?${params}`, { scroll: false })
  }, [selectedFunds, router])

  // Fetch compare data
  const fetchData = useCallback(async () => {
    if (!selectedFunds.length) {
      setFundData([])
      setNavData({})
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/compare?funds=${selectedFunds.join(',')}&period=${period}`)
      const data = await res.json()
      setFundData(data.funds ?? [])

      // Transform nav data
      const nav: Record<string, NavPoint[]> = {}
      for (const [projId, points] of Object.entries(data.navData ?? {})) {
        nav[projId] = (points as Array<{ date: string; normalized: number }>).map((p) => ({
          date: p.date,
          normalized: p.normalized,
        }))
      }
      setNavData(nav)
    } catch {
      setFundData([])
    } finally {
      setLoading(false)
    }
  }, [selectedFunds, period])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const addFund = (fund: FundResult) => {
    if (selectedFunds.length >= 5) return
    if (!selectedFunds.includes(fund.projId)) {
      setSelectedFunds((prev) => [...prev, fund.projId])
    }
  }

  const removeFund = (projId: string) => {
    setSelectedFunds((prev) => prev.filter((id) => id !== projId))
  }

  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Prepare normalized chart series
  const chartSeries = fundData
    .filter((f) => navData[f.projId]?.length)
    .map((f, i) => ({
      projId: f.projId,
      label: f.projAbbrName ?? f.projId,
      color: COMPARE_COLORS[i % COMPARE_COLORS.length],
      data: navData[f.projId] ?? [],
    }))

  return (
    <div className="space-y-6">
      {/* Fund Selector */}
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

          {/* Selected Fund Chips */}
          {selectedFunds.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {fundData.map((fund, i) => (
                <div
                  key={fund.projId}
                  className="flex items-center gap-2 rounded-full border px-3 py-1.5 bg-white text-sm"
                  style={{ borderColor: COMPARE_COLORS[i % COMPARE_COLORS.length] + '80' }}
                >
                  <div
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: COMPARE_COLORS[i % COMPARE_COLORS.length] }}
                  />
                  <span className="font-medium">{fund.projAbbrName ?? fund.projId}</span>
                  <span className="text-slate-400 text-xs hidden sm:inline">{fund.nameTh.slice(0, 20)}...</span>
                  <button
                    onClick={() => removeFund(fund.projId)}
                    className="text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {selectedFunds.length < 5 && (
                <span className="text-xs text-slate-400 self-center">
                  เพิ่มได้อีก {5 - selectedFunds.length} กองทุน
                </span>
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
          {/* Period Selector */}
          <div className="flex gap-1.5 flex-wrap">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  period === p ? 'bg-blue-700 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          {/* Normalized Chart */}
          <Card>
            <CardHeader>
              <CardTitle>กราฟเปรียบเทียบ (Normalized = 100)</CardTitle>
              <p className="text-sm text-slate-500">
                ปรับให้ทุกกองทุนเริ่มต้นที่ 100 เพื่อเปรียบเทียบการเติบโตสัมพัทธ์
              </p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[380px] bg-slate-100 animate-pulse rounded-lg" />
              ) : (
                <NormalizedChart series={chartSeries} height={380} />
              )}
            </CardContent>
          </Card>

          {/* Return Comparison Table */}
          <Card>
            <CardHeader>
              <CardTitle>เปรียบเทียบผลตอบแทน</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2.5 pr-4 text-slate-500 font-medium w-[200px]">กองทุน</th>
                      {Object.keys(METRIC_LABELS).map((p) => (
                        <th key={p} className="text-right py-2.5 px-3 text-slate-500 font-medium whitespace-nowrap">
                          {METRIC_LABELS[p]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fundData.map((fund, i) => (
                      <tr key={fund.projId} className="border-b border-slate-100 last:border-0">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-3 w-3 rounded-full shrink-0"
                              style={{ backgroundColor: COMPARE_COLORS[i % COMPARE_COLORS.length] }}
                            />
                            <div>
                              <span className="font-medium text-slate-900 text-xs block">
                                {fund.projAbbrName ?? fund.projId}
                              </span>
                              <span className="text-slate-400 text-xs">{fund.amc?.nameTh}</span>
                            </div>
                          </div>
                        </td>
                        {Object.keys(METRIC_LABELS).map((p) => {
                          const m = fund.metrics[p]
                          return (
                            <td
                              key={p}
                              className={cn(
                                'py-3 px-3 text-right font-medium tabular-nums',
                                getReturnColorClass(m?.returnPct)
                              )}
                            >
                              {m?.returnPct != null ? formatPct(m.returnPct) : '-'}
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

          {/* Risk Comparison Table */}
          <Card>
            <CardHeader>
              <CardTitle>เปรียบเทียบความเสี่ยง (1 ปีย้อนหลัง)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2.5 pr-4 text-slate-500 font-medium">กองทุน</th>
                      <th className="text-left py-2.5 px-3 text-slate-500 font-medium">ประเภท</th>
                      <th className="text-center py-2.5 px-3 text-slate-500 font-medium">ความเสี่ยง</th>
                      <th className="text-right py-2.5 px-3 text-slate-500 font-medium">Volatility</th>
                      <th className="text-right py-2.5 px-3 text-slate-500 font-medium">Max Drawdown</th>
                      <th className="text-right py-2.5 px-3 text-slate-500 font-medium">Sharpe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fundData.map((fund, i) => {
                      const m1Y = fund.metrics['1Y']
                      return (
                        <tr key={fund.projId} className="border-b border-slate-100 last:border-0">
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <div
                                className="h-3 w-3 rounded-full shrink-0"
                                style={{ backgroundColor: COMPARE_COLORS[i % COMPARE_COLORS.length] }}
                              />
                              <span className="font-medium text-slate-900">{fund.projAbbrName ?? fund.projId}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-600 text-xs">
                            {fund.fundType ? FUND_TYPE_LABELS[fund.fundType] ?? fund.fundType : '-'}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <RiskBadge riskLevel={fund.riskLevel} showLabel={false} />
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums text-slate-600">
                            {m1Y?.annualizedVolatilityPct != null ? `${m1Y.annualizedVolatilityPct.toFixed(2)}%` : '-'}
                          </td>
                          <td className={cn(
                            'py-3 px-3 text-right tabular-nums',
                            m1Y?.maxDrawdownPct != null && m1Y.maxDrawdownPct < -10 ? 'text-red-600' : 'text-slate-600'
                          )}>
                            {m1Y?.maxDrawdownPct != null ? `${m1Y.maxDrawdownPct.toFixed(2)}%` : '-'}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums text-slate-600">
                            {m1Y?.sharpeRatio != null ? m1Y.sharpeRatio.toFixed(2) : '-'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Disclaimer */}
      <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <span>การเปรียบเทียบนี้จัดทำเพื่อการศึกษาเท่านั้น ไม่ใช่คำแนะนำให้เลือกลงทุนในกองทุนใดกองทุนหนึ่ง
        ผลตอบแทนในอดีตไม่ได้รับประกันอนาคต กรุณาศึกษาหนังสือชี้ชวนก่อนลงทุน</span>
      </div>
    </div>
  )
}
