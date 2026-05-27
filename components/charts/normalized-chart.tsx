'use client'

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts'
import { formatDateTh } from '@/lib/utils'
import { COMPARE_COLORS } from '@/types'

interface FundSeries {
  projId: string
  label: string
  color?: string
  data: Array<{ date: string; normalized: number }>
}

interface NormalizedChartProps {
  series: FundSeries[]
  height?: number
}

interface TooltipPayload {
  value: number
  name: string
  color: string
  dataKey: string
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md text-xs min-w-[180px]">
      <p className="text-slate-500 mb-1.5">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-slate-600">{p.name}</span>
          </div>
          <span className="font-semibold tabular-nums" style={{ color: p.color }}>
            {p.value.toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  )
}

export function NormalizedChart({ series, height = 380 }: NormalizedChartProps) {
  if (!series.length) {
    return (
      <div className="flex items-center justify-center h-[380px] text-slate-400 text-sm">
        ไม่มีข้อมูลสำหรับแสดงกราฟ
      </div>
    )
  }

  // Merge all dates into one timeline
  const allDates = Array.from(
    new Set(series.flatMap((s) => s.data.map((d) => d.date)))
  ).sort()

  const step = Math.max(1, Math.floor(allDates.length / 500))
  const reducedDates = allDates.filter((_, i) => i % step === 0 || i === allDates.length - 1)

  const chartData = reducedDates.map((date) => {
    const row: Record<string, string | number> = {
      date,
      dateLabel: formatDateTh(date, { month: 'short', year: '2-digit', day: 'numeric' }),
    }
    for (const s of series) {
      const point = s.data.find((d) => d.date === date)
      if (point) row[s.projId] = Number(point.normalized.toFixed(2))
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
          tickFormatter={(v) => `${v.toFixed(0)}`}
          width={45}
        />
        <ReferenceLine y={100} stroke="#CBD5E1" strokeDasharray="4 4" />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value) => {
            const s = series.find((s) => s.projId === value)
            return <span className="text-xs text-slate-600">{s?.label ?? value}</span>
          }}
        />
        {series.map((s, i) => (
          <Line
            key={s.projId}
            type="monotone"
            dataKey={s.projId}
            name={s.label}
            stroke={s.color ?? COMPARE_COLORS[i % COMPARE_COLORS.length]}
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
