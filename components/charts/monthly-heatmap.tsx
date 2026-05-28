'use client'

import { cn } from '@/lib/utils'

interface NavPoint {
  date: string
  nav: number
}

interface MonthlyHeatmapProps {
  data: NavPoint[]
}

const MONTH_LABELS_TH = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

function interpolateColor(pct: number): string {
  const clamped = Math.max(-15, Math.min(15, pct))
  if (clamped >= 0) {
    const t = clamped / 15
    const r = Math.round(255 * (1 - t) + 22 * t)
    const g = Math.round(255 * (1 - t) + 163 * t)
    const b = Math.round(255 * (1 - t) + 74 * t)
    return `rgb(${r},${g},${b})`
  } else {
    const t = Math.abs(clamped) / 15
    const r = Math.round(255 * (1 - t) + 220 * t)
    const g = Math.round(255 * (1 - t) + 38 * t)
    const b = Math.round(255 * (1 - t) + 38 * t)
    return `rgb(${r},${g},${b})`
  }
}

function textColorForBg(pct: number): string {
  return Math.abs(pct) > 7 ? 'text-white' : 'text-slate-800'
}

export function MonthlyHeatmap({ data }: MonthlyHeatmapProps) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        ต้องการข้อมูลอย่างน้อย 2 เดือน
      </div>
    )
  }

  // Build map: "YYYY-MM" → last NAV of that month
  const monthlyLastNav = new Map<string, number>()
  for (const point of data) {
    const ym = point.date.slice(0, 7) // "YYYY-MM"
    monthlyLastNav.set(ym, point.nav)
  }

  // Collect sorted year-month keys
  const sortedKeys = Array.from(monthlyLastNav.keys()).sort()

  // Extract unique years
  const years = Array.from(new Set(sortedKeys.map((k) => k.slice(0, 4)))).sort()

  // Compute monthly returns: return[YYYY-MM] = (lastNav / prevMonthLastNav - 1) * 100
  const returns = new Map<string, number>()
  for (let i = 1; i < sortedKeys.length; i++) {
    const prev = monthlyLastNav.get(sortedKeys[i - 1])!
    const curr = monthlyLastNav.get(sortedKeys[i])!
    if (prev > 0) {
      returns.set(sortedKeys[i], (curr / prev - 1) * 100)
    }
  }

  const hasAnyReturn = returns.size > 0
  if (!hasAnyReturn) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        ต้องการข้อมูลอย่างน้อย 2 เดือน
      </div>
    )
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-xs select-none">
        <thead>
          <tr>
            <th className="text-left text-slate-400 font-normal pr-3 py-1 w-10">เดือน</th>
            {years.map((y) => (
              <th key={y} className="text-center text-slate-500 font-semibold px-1 py-1 min-w-[52px]">
                {y}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MONTH_LABELS_TH.map((label, monthIdx) => {
            const monthStr = String(monthIdx + 1).padStart(2, '0')
            return (
              <tr key={monthIdx}>
                <td className="text-slate-500 pr-3 py-0.5 whitespace-nowrap">{label}</td>
                {years.map((year) => {
                  const key = `${year}-${monthStr}`
                  const ret = returns.get(key)
                  if (ret == null) {
                    return (
                      <td key={year} className="px-1 py-0.5">
                        <div className="rounded h-8 bg-slate-50 border border-slate-100" />
                      </td>
                    )
                  }
                  const bg = interpolateColor(ret)
                  const txtClass = textColorForBg(ret)
                  return (
                    <td key={year} className="px-1 py-0.5">
                      <div
                        className={cn('rounded h-8 flex items-center justify-center font-medium tabular-nums', txtClass)}
                        style={{ backgroundColor: bg }}
                        title={`${year}-${monthStr}: ${ret >= 0 ? '+' : ''}${ret.toFixed(2)}%`}
                      >
                        {ret >= 0 ? '+' : ''}{ret.toFixed(1)}%
                      </div>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="text-xs text-slate-400 mt-2">
        ผลตอบแทนรายเดือน — คำนวณจาก NAV สิ้นเดือน เขียว = บวก, แดง = ลบ
      </p>
    </div>
  )
}
