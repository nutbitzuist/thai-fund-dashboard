// app/amcs/[slug]/page.tsx — AMC detail page
// URL slug = human-readable slug e.g. /amcs/krungsri
// Backward-compat: old /amcs/C0000000709 style URLs are redirected to slug

import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Building2 } from 'lucide-react'
import prisma from '@/lib/db'
import { Badge } from '@/components/ui/badge'
import { FUND_TYPE_LABELS } from '@/types'
import { formatPct, formatNav, getReturnColorClass, cn, fundUrl } from '@/lib/utils'

export const revalidate = 3600

interface Props {
  params: Promise<{ slug: string }>
}

async function getAmcBySlug(raw: string) {
  const decoded = decodeURIComponent(raw)
  // Try slug first, then fall back to uniqueId (backward-compat for old URLs)
  return prisma.amc.findFirst({
    where: { OR: [{ slug: decoded }, { uniqueId: decoded }] },
    include: {
      funds: {
        where: { fundStatus: { in: ['RG', 'SE'] } },
        orderBy: { projAbbrName: 'asc' },
        select: {
          id: true,
          projId: true,
          projAbbrName: true,
          nameTh: true,
          nameEn: true,
          fundType: true,
          riskLevel: true,
          dividendPolicy: true,
          fundClasses: {
            where: { isDefault: true },
            select: {
              id: true,
              navPrices: {
                orderBy: { navDate: 'desc' },
                take: 1,
                select: { lastVal: true, navDate: true },
              },
              fundMetrics: {
                where: { period: '1Y', returnPct: { not: null } },
                orderBy: { calculatedAt: 'desc' },
                take: 1,
                select: { returnPct: true },
              },
            },
          },
        },
      },
    },
  })
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const amc = await prisma.amc.findFirst({
    where: { OR: [{ slug: decodeURIComponent(slug) }, { uniqueId: decodeURIComponent(slug) }] },
    select: { slug: true, nameTh: true, nameEn: true },
  })
  if (!amc) return { title: 'ไม่พบ บลจ.' }

  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://funds.bulltiq.com'
  const canonicalSlug = amc.slug ?? slug
  const url = `${base}/amcs/${canonicalSlug}`
  const description = `กองทุนรวมทั้งหมดของ${amc.nameTh}${amc.nameEn ? ` (${amc.nameEn})` : ''} ดูผลตอบแทน NAV และข้อมูลกองทุนแต่ละกองจาก ก.ล.ต.`

  return {
    title: `${amc.nameTh} — กองทุนทั้งหมด`,
    description,
    alternates: { canonical: url },
    openGraph: { title: `${amc.nameTh} — กองทุนทั้งหมด`, description, url, type: 'website' },
  }
}

export async function generateStaticParams() {
  try {
    const amcs = await prisma.amc.findMany({ select: { slug: true, uniqueId: true } })
    return amcs.map((a) => ({ slug: a.slug ?? a.uniqueId }))
  } catch {
    return []
  }
}

export default async function AmcDetailPage({ params }: Props) {
  const { slug } = await params
  const amc = await getAmcBySlug(slug)
  if (!amc) notFound()

  // Redirect old uniqueId URLs to slug URL
  const decoded = decodeURIComponent(slug)
  if (amc.slug && decoded !== amc.slug) {
    redirect(`/amcs/${amc.slug}`)
  }

  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://funds.bulltiq.com'
  const canonicalSlug = amc.slug ?? slug
  const funds = amc.funds
  const returns = funds
    .flatMap((f) => f.fundClasses.flatMap((c) => c.fundMetrics))
    .map((m) => Number(m.returnPct))
    .filter((v) => !isNaN(v))
  const avg1Y = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : null

  const typeCount: Record<string, number> = {}
  for (const f of funds) {
    const t = f.fundType ?? 'OTHER'
    typeCount[t] = (typeCount[t] ?? 0) + 1
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'FinancialService',
        name: amc.nameTh,
        alternateName: amc.nameEn ?? undefined,
        areaServed: 'TH',
        url: `${base}/amcs/${canonicalSlug}`,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'หน้าแรก', item: base },
          { '@type': 'ListItem', position: 2, name: 'บลจ. ทั้งหมด', item: `${base}/amcs` },
          { '@type': 'ListItem', position: 3, name: amc.nameTh },
        ],
      },
    ],
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Link href="/amcs" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-700 mb-6 w-fit">
        <ArrowLeft className="h-4 w-4" />
        กลับไปรายชื่อ บลจ.
      </Link>

      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
          <Building2 className="h-6 w-6 text-blue-600" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">{amc.nameTh}</h1>
          {amc.nameEn && <p className="text-slate-500 text-sm">{amc.nameEn}</p>}
          <div className="flex flex-wrap gap-3 mt-2 text-sm text-slate-600">
            <span>{funds.length} กองทุน (active)</span>
            {avg1Y != null && (
              <span className={cn('font-semibold', getReturnColorClass(avg1Y))}>
                ผลตอบแทนเฉลี่ย 1Y: {formatPct(avg1Y)}
              </span>
            )}
          </div>
        </div>
      </div>

      {Object.keys(typeCount).length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {Object.entries(typeCount)
            .sort(([, a], [, b]) => b - a)
            .map(([type, count]) => (
              <Link key={type} href={`/funds/type/${type}`}>
                <Badge variant="secondary" className="cursor-pointer hover:bg-blue-100">
                  {FUND_TYPE_LABELS[type] ?? type} ({count})
                </Badge>
              </Link>
            ))}
        </div>
      )}

      <div className="space-y-2">
        {funds.map((fund) => {
          const dc = fund.fundClasses[0]
          const latestNav = dc?.navPrices[0]
          const metric1Y = dc?.fundMetrics[0]
          const ret = metric1Y?.returnPct != null ? Number(metric1Y.returnPct) : null

          return (
            <Link
              key={fund.projId}
              href={fundUrl(fund)}
              className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 px-4 py-3 hover:border-blue-200 hover:shadow-sm transition-all group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 rounded px-1.5 py-0.5">
                    {fund.projAbbrName ?? fund.projId}
                  </span>
                  {fund.fundType && (
                    <span className="text-xs text-slate-500">
                      {FUND_TYPE_LABELS[fund.fundType] ?? fund.fundType}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-700 truncate mt-0.5">{fund.nameTh}</p>
              </div>

              <div className="hidden sm:flex items-center gap-6 text-right shrink-0">
                {latestNav && (
                  <div>
                    <p className="text-xs text-slate-400">NAV</p>
                    <p className="text-sm font-semibold tabular-nums text-slate-800">
                      {formatNav(Number(latestNav.lastVal))}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-slate-400">1Y</p>
                  <p className={cn('text-sm font-bold tabular-nums', getReturnColorClass(ret))}>
                    {ret != null ? formatPct(ret) : '-'}
                  </p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {funds.length === 0 && (
        <p className="text-center text-slate-400 py-12">ไม่มีกองทุน active</p>
      )}
    </div>
  )
}
