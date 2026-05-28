// app/funds/[slug]/category-stats.tsx
// Async Server Component — category comparison + percentile rank.
// Rendered in its own Suspense boundary to avoid blocking the main fund view.

import prisma from '@/lib/db'
import { Card, CardContent } from '@/components/ui/card'
import { FUND_TYPE_LABELS } from '@/types'
import { formatPct, getReturnColorClass, cn } from '@/lib/utils'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface Props {
  fundType: string
  myReturn1Y: number | null
}

export async function CategoryStats({ fundType, myReturn1Y }: Props) {
  if (myReturn1Y == null) return null

  const metrics = await prisma.fundMetric.findMany({
    where: {
      period: '1Y',
      returnPct: { not: null },
      fundClass: { isDefault: true },
      fund: { fundStatus: { in: ['RG', 'SE'] }, fundType },
    },
    select: { returnPct: true },
  })

  if (metrics.length === 0) return null

  const returns = metrics.map((m) => Number(m.returnPct)).filter((v) => !isNaN(v))
  const avg = returns.reduce((a, b) => a + b, 0) / returns.length
  const sorted = [...returns].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)] ?? null

  const diff = myReturn1Y - avg
  const beatCount = sorted.filter((r) => r < myReturn1Y).length
  const percentile = Math.round((beatCount / sorted.length) * 100)
  const isTop = percentile >= 75
  const isBottom = percentile < 25

  return (
    <section>
      <h2 className="text-lg font-bold text-slate-900 mb-4">
        เปรียบเทียบกับกองทุนประเภทเดียวกัน
      </h2>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-slate-500 mb-3">
            {FUND_TYPE_LABELS[fundType] ?? fundType} — จากข้อมูล {returns.length.toLocaleString('th-TH')} กองทุน (ผลตอบแทน 1 ปี)
          </p>
          <div className="grid grid-cols-3 gap-4 mb-3">
            <div className="text-center">
              <p className="text-xs text-slate-400 mb-1">กองทุนนี้</p>
              <p className={cn('text-xl font-bold tabular-nums', getReturnColorClass(myReturn1Y))}>
                {formatPct(myReturn1Y)}
              </p>
            </div>
            <div className="text-center border-x border-slate-100">
              <p className="text-xs text-slate-400 mb-1">ค่าเฉลี่ยประเภท</p>
              <p className={cn('text-xl font-bold tabular-nums', getReturnColorClass(avg))}>
                {formatPct(avg)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-400 mb-1">มัธยฐาน</p>
              <p className={cn('text-xl font-bold tabular-nums', getReturnColorClass(median))}>
                {median != null ? formatPct(median) : '-'}
              </p>
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className={cn('text-sm font-medium flex items-center gap-1', diff >= 0 ? 'text-emerald-600' : 'text-red-600')}>
              {diff >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {diff >= 0 ? 'สูงกว่า' : 'ต่ำกว่า'} ค่าเฉลี่ย {Math.abs(diff).toFixed(2)}%
            </p>
            <div className={cn(
              'text-xs font-semibold rounded-full px-3 py-1.5',
              isTop ? 'bg-emerald-100 text-emerald-700' :
              isBottom ? 'bg-red-100 text-red-700' :
              'bg-slate-100 text-slate-600'
            )}>
              {isTop ? '🏆 ' : isBottom ? '⚠️ ' : ''}
              Top {100 - percentile}% ของกองทุนประเภทนี้ (เปอร์เซ็นไทล์ที่ {percentile})
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

// Skeleton shown while this component loads
export function CategoryStatsSkeleton() {
  return (
    <section className="animate-pulse">
      <div className="h-6 w-56 bg-slate-200 rounded mb-4" />
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="h-4 w-48 bg-slate-100 rounded mb-3" />
        <div className="grid grid-cols-3 gap-4 mb-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="h-3 w-16 bg-slate-100 rounded" />
              <div className="h-7 w-20 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
        <div className="h-8 bg-slate-100 rounded-lg" />
      </div>
    </section>
  )
}
