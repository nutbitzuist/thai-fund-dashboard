'use client'

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { formatDateTh } from '@/lib/utils'

interface DrawdownPoint {
  date: string
  drawdown: number
}

interface DrawdownChartProps {
  data: DrawdownPoint[]
  height?: number
  color?: string
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value: number }> }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md text-sm">
      <p className="font-semibold text-red-600">{payload[0].value.toFixed(2)}%</p>
      <p className="text-xs text-slate-500">Drawdown จากจุดสูงสุด</p>
    </div>
  )
}

export function DrawdownChart({ data, height = 200, color = '#DC2626' }: DrawdownChartProps) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-[200px] text-slate-400 text-sm">
        ไม่มีข้อมูล Drawdown
      </div>
    )
  }

  const step = Math.max(1, Math.floor(data.length / 500))
  const reduced = data.filter((_, i) => i % step === 0 || i === data.length - 1)

  const formatted = reduced.map((d) => ({
    ...d,
    dateLabel: formatDateTh(d.date, { month: 'short', year: '2-digit', day: 'numeric' }),
  }))

  const minY = Math.min(...reduced.map((d) => d.drawdown)) * 1.05

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={formatted} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
        <defs>
          <linearGradient id="ddGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0.05} />
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
          domain={[minY, 0]}
          tick={{ fontSize: 11, fill: '#94A3B8' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v.toFixed(0)}%`}
          width={45}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="drawdown"
          stroke={color}
          strokeWidth={1.5}
          fill="url(#ddGradient)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
