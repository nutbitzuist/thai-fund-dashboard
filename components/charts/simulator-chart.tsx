'use client'

import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts'
import { formatDateTh } from '@/lib/utils'
import { COMPARE_COLORS } from '@/types'

export interface SimulatorSeries {
  projId: string
  label: string
  color?: string
  data: Array<{ date: string; value: number }>
}

interface SimulatorChartProps {
  series: SimulatorSeries[]
  investAmount: number
  height?: number
}

interface TooltipPayload {
  value: number; name: string; color: string; dataKey: string
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
            ฿{Math.round(p.value).toLocaleString('th-TH')}
          </span>
        </div>
      ))}
    </div>
  )
}

export function SimulatorChart({ series, investAmount, height = 320 }: SimulatorChartProps) {
  if (!series.length) {
    return (
      <div className="flex items-center justify-center text-slate-400 text-sm" style={{ height }}>
        ไม่มีข้อมูลสำหรับแสดงกราฟ
      </div>
    )
  }

  const allDates = Array.from(new Set(series.flatMap((s) => s.data.map((d) => d.date)))).sort()
  const step = Math.max(1, Math.floor(allDates.length / 400))
  const reduced = allDates.filter((_, i) => i % step === 0 || i === allDates.length - 1)

  const chartData = reduced.map((date) => {
    const row: Record<string, string | number> = {
      date,
      dateLabel: formatDateTh(date, { month: 'short', year: '2-digit', day: 'numeric' }),
    }
    for (const s of series) {
      const pt = s.data.find((d) => d.date === date)
      if (pt) row[s.projId] = Math.round(pt.value)
    }
    return row
  })

  const isSingle = series.length === 1
  const color = series[0]?.color ?? COMPARE_COLORS[0]

  if (isSingle) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
          <defs>
            <linearGradient id="simGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.15} />
              <stop offset="95%" stopColor={color} stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
          <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis
            tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} width={72}
            tickFormatter={(v) => `฿${(v / 1000).toFixed(0)}K`}
          />
          <ReferenceLine y={investAmount} stroke="#CBD5E1" strokeDasharray="4 4" label={{ value: 'ทุนตั้งต้น', position: 'insideTopRight', fontSize: 10, fill: '#94A3B8' }} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey={series[0].projId} name={series[0].label} stroke={color} strokeWidth={2} fill="url(#simGradient)" dot={false} activeDot={{ r: 4 }} />
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
        <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} width={72} tickFormatter={(v) => `฿${(v / 1000).toFixed(0)}K`} />
        <ReferenceLine y={investAmount} stroke="#CBD5E1" strokeDasharray="4 4" />
        <Tooltip content={<CustomTooltip />} />
        <Legend formatter={(value) => {
          const s = series.find((s) => s.projId === value)
          return <span className="text-xs text-slate-600">{s?.label ?? value}</span>
        }} />
        {series.map((s, i) => (
          <Line key={s.projId} type="monotone" dataKey={s.projId} name={s.label}
            stroke={s.color ?? COMPARE_COLORS[i % COMPARE_COLORS.length]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
