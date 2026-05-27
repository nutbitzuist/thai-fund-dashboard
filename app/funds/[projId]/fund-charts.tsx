'use client'

import { useState, useEffect } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { NavChart } from '@/components/charts/nav-chart'
import { NormalizedChart } from '@/components/charts/normalized-chart'
import { DrawdownChart } from '@/components/charts/drawdown-chart'
import { calcDrawdownSeries } from '@/lib/calculations'

interface NavPoint {
  date: string
  nav: number
  buyPrice?: number | null
  sellPrice?: number | null
}

interface NormalizedPoint {
  date: string
  value: number
}

interface FundChartsProps {
  projId: string
  defaultClassId?: number
}

type Period = '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y' | 'MAX'

export function FundCharts({ projId, defaultClassId }: FundChartsProps) {
  const [period, setPeriod] = useState<Period>('1Y')
  const [navData, setNavData] = useState<NavPoint[]>([])
  const [normalizedData, setNormalizedData] = useState<NormalizedPoint[]>([])
  const [drawdownData, setDrawdownData] = useState<Array<{ date: string; drawdown: number }>>([])
  const [loading, setLoading] = useState(true)
  const [activeChart, setActiveChart] = useState<'nav' | 'normalized' | 'drawdown'>('nav')

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

        // Calculate drawdown series from NAV
        const ddSeries = calcDrawdownSeries(
          nav.map((d) => ({ date: new Date(d.date), nav: d.nav }))
        )
        setDrawdownData(
          ddSeries.map((d) => ({
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

  const periods: Period[] = ['1M', '3M', '6M', '1Y', '3Y', '5Y', 'MAX']
  const periodLabels: Record<Period, string> = {
    '1M': '1เดือน', '3M': '3เดือน', '6M': '6เดือน',
    '1Y': '1ปี', '3Y': '3ปี', '5Y': '5ปี', MAX: 'ทั้งหมด',
  }

  return (
    <Card>
      <CardContent className="p-6">
        {/* Period Selector */}
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
                {periodLabels[p]}
              </button>
            ))}
          </div>

          {/* Chart type selector */}
          <Tabs value={activeChart} onValueChange={(v) => setActiveChart(v as typeof activeChart)}>
            <TabsList className="h-8">
              <TabsTrigger value="nav" className="text-xs px-2.5">NAV</TabsTrigger>
              <TabsTrigger value="normalized" className="text-xs px-2.5">Normalized</TabsTrigger>
              <TabsTrigger value="drawdown" className="text-xs px-2.5">Drawdown</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Chart */}
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
          </>
        )}

        {/* Data count info */}
        {!loading && navData.length > 0 && (
          <p className="text-xs text-slate-400 mt-2">
            ข้อมูล {navData.length.toLocaleString('th-TH')} วันทำการ
            ตั้งแต่ {navData[0]?.date} ถึง {navData[navData.length - 1]?.date}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
