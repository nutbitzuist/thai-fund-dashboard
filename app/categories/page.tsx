import type { Metadata } from 'next'
import Link from 'next/link'
import prisma from '@/lib/db'
import { FUND_TYPE_LABELS } from '@/types'
import { formatPct, getReturnColorClass, cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'หมวดหมู่กองทุนรวม',
  description: 'เปรียบเทียบผลตอบแทนแต่ละประเภทกองทุน',
}

export const revalidate = 3600
export const dynamic = 'force-static'

const FUND_TYPE_CODES = ['EQ', 'FI', 'MM', 'BA', 'RE', 'CM', 'AI', 'FIF', 'SSF', 'RMF'] as const

interface TopFund {
  projAbbrName: string | null
  nameTh: string
  returnPct: number
}

interface CategoryStats {
  type: string
  label: string
  fundCount: number
  avg1Y: number | null
  top3: TopFund[]
}

async function getCategoryStats(): Promise<CategoryStats[]> {
  const allFunds = await prisma.fund.findMany({
    where: {
      fundType: { in: FUND_TYPE_CODES as unknown as string[] },
      fundStatus: { in: ['RG', 'SE'] },
    },
    select: {
      fundType: true,
      projAbbrName: true,
      nameTh: true,
      fundMetrics: {
        where: {
          period: '1Y',
          fundClass: { isDefault: true },
          returnPct: { not: null },
        },
        orderBy: { calculatedAt: 'desc' },
        take: 1,
        select: { returnPct: true },
      },
    },
  })

  const byType = new Map<string, typeof allFunds>()
  for (const fund of allFunds) {
    const t = fund.fundType ?? 'OTHER'
    if (!byType.has(t)) byType.set(t, [])
    byType.get(t)!.push(fund)
  }

  return FUND_TYPE_CODES.map((type) => {
    const funds = byType.get(type) ?? []
    const returns = funds
      .flatMap((f) => f.fundMetrics)
      .map((m) => Number(m.returnPct))
      .filter((v) => !isNaN(v))
    const avg1Y = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : null
    const top3 = funds
      .map((f) => {
        const r = f.fundMetrics[0]?.returnPct
        return r != null ? { projAbbrName: f.projAbbrName, nameTh: f.nameTh, returnPct: Number(r) } : null
      })
      .filter((f): f is TopFund => f !== null)
      .sort((a, b) => b.returnPct - a.returnPct)
      .slice(0, 3)
    return { type, label: FUND_TYPE_LABELS[type] ?? type, fundCount: funds.length, avg1Y, top3 }
  }).filter((c) => c.fundCount > 0)
}

export default async function CategoriesPage() {
  const categories = await getCategoryStats()
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://funds.bulltiq.com'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'หน้าแรก',
        item: `${base}/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'หมวดหมู่กองทุนรวม',
        item: `${base}/categories`,
      },
    ],
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">หมวดหมู่กองทุนรวม</h1>
        <p className="text-slate-500 text-sm mt-1">เปรียบเทียบผลตอบแทนแต่ละประเภทกองทุน</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat) => (
          <Link
            key={cat.type}
            href={`/funds?fundType=${cat.type}`}
            className="bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all group"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">
                  {cat.label}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {cat.fundCount.toLocaleString('th-TH')} กองทุน
                </p>
              </div>
              <span className="text-xs font-mono bg-slate-100 text-slate-500 rounded px-2 py-0.5 shrink-0">
                {cat.type}
              </span>
            </div>

            <div className="mb-4">
              <p className="text-xs text-slate-400 mb-1">ผลตอบแทนเฉลี่ย 1 ปี</p>
              <p
                className={cn(
                  'text-xl font-bold tabular-nums',
                  getReturnColorClass(cat.avg1Y)
                )}
              >
                {cat.avg1Y != null ? formatPct(cat.avg1Y) : '-'}
              </p>
            </div>

            {cat.top3.length > 0 && (
              <div>
                <p className="text-xs text-slate-400 mb-2">Top 3 ผลตอบแทน 1 ปี</p>
                <div className="flex flex-col gap-1.5">
                  {cat.top3.map((fund) => (
                    <div
                      key={fund.projAbbrName ?? fund.nameTh}
                      className="flex items-center justify-between gap-2"
                    >
                      <span
                        className="text-xs bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 truncate max-w-[140px] text-slate-700"
                        title={fund.nameTh}
                      >
                        {fund.projAbbrName ?? fund.nameTh}
                      </span>
                      <span
                        className={cn(
                          'text-xs font-semibold tabular-nums shrink-0',
                          getReturnColorClass(fund.returnPct)
                        )}
                      >
                        {formatPct(fund.returnPct)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
