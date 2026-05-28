'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { formatDateTh } from '@/lib/utils'

interface AumPoint {
  date: string
  aum: number | null
}

interface AumChartProps {
  data: AumPoint[]
  height?: number
}

function formatBillions(value: number): string {
  if (value >= 1_000_000_000) {
    return `฿${(value / 1_000_000_000).toFixed(2)} พันล้าน`
  }
  if (value >= 1_000_000) {
    return `฿${(value / 1_000_000).toFixed(2)} ล้าน`
  }
  return `฿${value.toLocaleString('th-TH')}`
}

function yAxisFormatter(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M`
  return value.toFixed(0)
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md text-sm">
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p className="font-semibold text-blue-700">{formatBillions(payload[0].value)}</p>
      <p className="text-xs text-slate-400 mt-0.5">มูลค่าทรัพย์สินสุทธิ</p>
    </div>
  )
}

export function AumChart({ data, height = 280 }: AumChartProps) {
  const filtered = data.filter((d): d is { date: string; aum: number } => d.aum != null)

  if (!filtered.length) {
    return (
      <div className="flex items-center justify-center text-slate-400 text-sm" style={{ height }}>
        ไม่มีข้อมูล AUM ในช่วงนี้
      </div>
    )
  }

  const step = Math.max(1, Math.floor(filtered.length / 500))
  const reduced = filtered.filter((_, i) => i % step === 0 || i === filtered.length - 1)

  const formatted = reduced.map((d) => ({
    ...d,
    dateLabel: formatDateTh(d.date, { month: 'short', year: '2-digit', day: 'numeric' }),
  }))

  const values = reduced.map((d) => d.aum)
  const minY = Math.min(...values) * 0.98
  const maxY = Math.max(...values) * 1.02

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={formatted} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
        <defs>
          <linearGradient id="aumGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#1D4ED8" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#1D4ED8" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
        <XAxis
          dataKey="dateLabel"
          tick={{ fontSize: 11, fill: '#94A3B8' }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[minY, maxY]}
          tick={{ fontSize: 11, fill: '#94A3B8' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={yAxisFormatter}
          width={55}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="aum"
          stroke="#1D4ED8"
          strokeWidth={2}
          fill="url(#aumGradient)"
          dot={false}
          activeDot={{ r: 4, fill: '#1D4ED8' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
