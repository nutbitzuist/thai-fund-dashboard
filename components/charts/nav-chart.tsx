'use client'

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import { formatDateTh, formatNav } from '@/lib/utils'

interface NavDataPoint {
  date: string
  nav: number
  buyPrice?: number | null
  sellPrice?: number | null
}

interface NavChartProps {
  data: NavDataPoint[]
  color?: string
  height?: number
  showBuySell?: boolean
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value: number; name: string; dataKey: string }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md text-sm">
      <p className="font-medium text-slate-900">{formatNav(d.value)}</p>
      <p className="text-xs text-slate-500 mt-0.5">มูลค่าหน่วยลงทุน</p>
    </div>
  )
}

export function NavChart({ data, color = '#1D4ED8', height = 300, showBuySell = false }: NavChartProps) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-[300px] text-slate-400 text-sm">
        ไม่มีข้อมูล NAV
      </div>
    )
  }

  // Reduce data points for performance (max 500)
  const step = Math.max(1, Math.floor(data.length / 500))
  const reduced = data.filter((_, i) => i % step === 0 || i === data.length - 1)

  const formatted = reduced.map((d) => ({
    ...d,
    dateLabel: formatDateTh(d.date, { month: 'short', year: '2-digit', day: 'numeric' }),
  }))

  const minY = Math.min(...reduced.map((d) => d.nav)) * 0.995
  const maxY = Math.max(...reduced.map((d) => d.nav)) * 1.005

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={formatted} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
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
          tickFormatter={(v) => v.toFixed(2)}
          width={55}
        />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="nav"
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: color }}
        />
        {showBuySell && (
          <Line
            type="monotone"
            dataKey="buyPrice"
            stroke="#16A34A"
            strokeWidth={1}
            dot={false}
            strokeDasharray="3 3"
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}
