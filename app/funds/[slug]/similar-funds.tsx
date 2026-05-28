// app/funds/[slug]/similar-funds.tsx
// Async Server Component — rendered in its own Suspense boundary so it doesn't
// block the main fund header, NAV and metrics from loading first.

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import prisma from '@/lib/db'
import { FUND_TYPE_LABELS } from '@/types'
import { fundUrl, formatPct, getReturnColorClass, cn } from '@/lib/utils'

interface Props {
  fundType: string
  excludeProjId: string
}

export async function SimilarFunds({ fundType, excludeProjId }: Props) {
  const metrics = await prisma.fundMetric.findMany({
    where: {
      period: '1Y',
      returnPct: { not: null },
      fundClass: { isDefault: true },
      fund: {
        fundStatus: { in: ['RG', 'SE'] },
        fundType,
        projId: { not: excludeProjId },
      },
    },
    orderBy: { returnPct: 'desc' },
    take: 5,
    select: {
      returnPct: true,
      fund: {
        select: {
          projId: true,
          projAbbrName: true,
          nameTh: true,
          riskLevel: true,
          amc: { select: { nameTh: true } },
        },
      },
    },
  })

  if (metrics.length === 0) return null

  const funds = metrics.map((m) => ({
    ...m.fund,
    return1Y: m.returnPct != null ? Number(m.returnPct) : null,
  }))

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-900">
          กองทุนประเภทเดียวกัน — {FUND_TYPE_LABELS[fundType] ?? fundType} ผลตอบแทนสูงสุด
        </h2>
        <Link
          href={`/funds/type/${fundType.toLowerCase()}`}
          className="text-sm text-blue-700 hover:underline flex items-center gap-1"
        >
          ดูทั้งหมด <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {funds.map((sf) => (
          <Link
            key={sf.projId}
            href={fundUrl(sf)}
            className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 px-4 py-3 hover:border-blue-200 hover:shadow-sm transition-all group"
          >
            <div className="flex-1 min-w-0">
              <span className="text-xs font-mono font-bold text-blue-700">{sf.projAbbrName ?? sf.projId}</span>
              <p className="text-sm text-slate-800 truncate mt-0.5 group-hover:text-blue-700">{sf.nameTh}</p>
              <p className="text-xs text-slate-400">{sf.amc?.nameTh}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-slate-400">1Y</p>
              <p className={cn('text-sm font-bold tabular-nums', getReturnColorClass(sf.return1Y))}>
                {sf.return1Y != null ? formatPct(sf.return1Y) : '-'}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

// Skeleton shown while this component loads
export function SimilarFundsSkeleton() {
  return (
    <section className="animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-6 w-64 bg-slate-200 rounded" />
        <div className="h-4 w-16 bg-slate-100 rounded" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 bg-slate-100 rounded-xl" />
        ))}
      </div>
    </section>
  )
}
