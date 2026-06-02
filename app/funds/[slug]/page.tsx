// app/funds/[slug]/page.tsx — Fund Detail Page
// URL slug = projAbbrName (e.g. /funds/K-OIL)
// Falls back to projId for backward-compat with old URLs (/funds/M0145_2549)
//
// Performance strategy:
//  • generateStaticParams: pre-builds top 100 funds at deploy time (instant first load)
//  • revalidate = 21600: all other funds use on-demand ISR, cached 6 h
//  • Suspense streaming: main fund content renders first; SimilarFunds +
//    CategoryStats render in their own Suspense boundaries so they never
//    block the NAV / metrics from appearing

import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, AlertTriangle, Clock, TrendingUp, TrendingDown, FileText } from 'lucide-react'
import prisma from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RiskBadge } from '@/components/metrics/risk-badge'
import { MetricCard } from '@/components/metrics/metric-card'
import { WatchlistButton } from '@/components/fund/watchlist-button'
import { ShareFundButton } from '@/components/fund/share-fund-button'
import { FundCharts } from './fund-charts'
import { SimilarFunds, SimilarFundsSkeleton } from './similar-funds'
import { CategoryStats, CategoryStatsSkeleton } from './category-stats'
import {
  FUND_TYPE_LABELS,
  DIVIDEND_POLICY_LABELS,
  FUND_STATUS_LABELS,
  METRIC_PERIODS,
  METRIC_TOOLTIPS,
} from '@/types'
import {
  formatNav,
  formatPct,
  formatDateTh,
  formatAUM,
  getReturnColorClass,
  cn,
  PERIOD_LABELS,
  hasSufficientData,
  PERIOD_MIN_NAV_COUNT,
  fundUrl,
} from '@/lib/utils'

interface Props {
  params: Promise<{ slug: string }>
}

// Cache fund detail HTML at Vercel's edge — fund data changes once daily.
export const revalidate = 21600

// Pre-build the top 100 funds (by 1Y return) at deploy time so the first
// visitor to popular fund pages never triggers an on-demand render.
// Other funds fall through to on-demand ISR (rendered on first visit, then cached).
export async function generateStaticParams() {
  try {
    const metrics = await prisma.fundMetric.findMany({
      where: {
        period: '1Y',
        returnPct: { not: null },
        fundClass: { isDefault: true },
        fund: { fundStatus: { in: ['RG', 'SE'] } },
      },
      orderBy: { returnPct: 'desc' },
      take: 100,
      select: { fund: { select: { projAbbrName: true } } },
    })
    return metrics
      .map((m) => m.fund.projAbbrName)
      .filter((s): s is string => s != null && s.length > 0)
      .map((slug) => ({ slug }))
  } catch {
    return []
  }
}

// Resolve slug → fund row (projAbbrName case-insensitive, then projId fallback)
async function getFundBySlug(slug: string) {
  return prisma.fund.findFirst({
    where: {
      OR: [
        { projAbbrName: { equals: slug, mode: 'insensitive' } },
        { projId: slug }, // backward-compat for old /funds/M0145_2549 links
      ],
    },
    include: {
      amc: true,
      fundClasses: { orderBy: { isDefault: 'desc' } },
      fundMetrics: {
        where: { period: { in: METRIC_PERIODS } },
        orderBy: { calculatedAt: 'desc' },
      },
      navPrices: {
        orderBy: { navDate: 'desc' },
        take: 2,
        include: { fundClass: true },
      },
    },
  })
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: rawSlug } = await params
  const slug = decodeURIComponent(rawSlug)
  const fund = await prisma.fund.findFirst({
    where: {
      OR: [
        { projAbbrName: { equals: slug, mode: 'insensitive' } },
        { projId: slug },
      ],
    },
    select: {
      nameTh: true, nameEn: true, projAbbrName: true, projId: true,
      fundType: true, riskLevel: true,
      amc: { select: { nameTh: true } },
      fundClasses: { where: { isDefault: true }, select: { id: true }, take: 1 },
    },
  })
  if (!fund) return { title: 'ไม่พบกองทุน' }

  const abbr = fund.projAbbrName ?? fund.projId
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://funds.bulltiq.com'
  const canonicalUrl = `${base}/funds/${encodeURIComponent(abbr)}`

  // Fetch 1Y metric for richer description
  const metric1Y = fund.fundClasses[0]?.id
    ? await prisma.fundMetric.findFirst({
        where: { fundClassId: fund.fundClasses[0].id, period: '1Y', returnPct: { not: null } },
        select: { returnPct: true },
      })
    : null

  const returnStr = metric1Y?.returnPct != null
    ? ` ผลตอบแทน 1 ปี ${Number(metric1Y.returnPct) >= 0 ? '+' : ''}${Number(metric1Y.returnPct).toFixed(2)}%`
    : ''
  const amcStr = fund.amc?.nameTh ? ` โดย ${fund.amc.nameTh}` : ''
  const riskStr = fund.riskLevel ? ` ระดับความเสี่ยง ${fund.riskLevel}/8` : ''
  const description = `กองทุน ${abbr}${amcStr}${riskStr}${returnStr} ดูข้อมูล NAV รายวัน กราฟผลตอบแทน และการวิเคราะห์ความเสี่ยงจาก ก.ล.ต.`

  return {
    title: `${abbr} — ${fund.nameTh}`,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: `${abbr} — ${fund.nameTh}`,
      description,
      url: canonicalUrl,
      type: 'website',
    },
  }
}

export default async function FundDetailPage({ params }: Props) {
  const { slug: rawSlug } = await params
  const slug = decodeURIComponent(rawSlug)
  const fund = await getFundBySlug(slug)

  if (!fund) notFound()

  // Canonical redirect: if accessed by old projId URL and fund has a projAbbrName
  if (
    fund.projAbbrName &&
    slug !== fund.projAbbrName &&
    slug.toLowerCase() !== fund.projAbbrName.toLowerCase()
  ) {
    redirect(fundUrl(fund))
  }

  const defaultClass = fund.fundClasses.find((c) => c.isDefault) ?? fund.fundClasses[0]

  // Only fetch AUM-trend data here (lightweight) — similar funds + category stats
  // are deferred to their own streaming Suspense components below.
  const threeMonthsAgo = new Date(); threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  const [oldNavRecord, latestMarketNavRecord] = await Promise.all([
    defaultClass?.id ? prisma.navPrice.findFirst({
      where: {
        fundClassId: defaultClass.id,
        navDate: { lte: threeMonthsAgo },
        netAsset: { not: null },
      },
      orderBy: { navDate: 'desc' },
      select: { netAsset: true, navDate: true },
    }) : null,
    prisma.navPrice.findFirst({
      orderBy: { navDate: 'desc' },
      select: { navDate: true },
    }),
  ])

  const latestNavRecord = fund.navPrices.find((n) => n.fundClassId === defaultClass?.id) ?? fund.navPrices[0]
  const prevNavRecord = fund.navPrices.find(
    (n) =>
      n.fundClassId === defaultClass?.id &&
      n.navDate.getTime() !== latestNavRecord?.navDate.getTime()
  )

  const latestNav = latestNavRecord ? Number(latestNavRecord.lastVal) : null
  const prevNav = prevNavRecord ? Number(prevNavRecord.lastVal) : null
  const dailyChangePct = latestNav && prevNav ? ((latestNav - prevNav) / prevNav) * 100 : null

  const referenceDateMs = latestMarketNavRecord?.navDate.getTime() ?? latestNavRecord?.navDate.getTime() ?? null
  const daysSinceNav = latestNavRecord && referenceDateMs != null
    ? Math.max(0, Math.floor((referenceDateMs - latestNavRecord.navDate.getTime()) / (1000 * 60 * 60 * 24)))
    : null
  const isStaleNav = daysSinceNav != null && daysSinceNav > 5

  // Deduplicate metrics by period (default class)
  const metricsByPeriod: Record<string, (typeof fund.fundMetrics)[0]> = {}
  for (const m of fund.fundMetrics) {
    if (m.fundClassId === defaultClass?.id && !metricsByPeriod[m.period]) {
      metricsByPeriod[m.period] = m
    }
  }

  const maxNavCount = Math.max(0, ...Object.values(metricsByPeriod).map((m) => m.navCount ?? 0))
  const hasLimitedHistory = maxNavCount < PERIOD_MIN_NAV_COUNT['1Y']

  // Is this fund genuinely new (registered < 1 year ago)?
  // New funds don't have 1Y of data by definition — different message than "backfill in progress".
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  const isNewFund = !fund.regisDate || new Date(fund.regisDate) > oneYearAgo

  const m1Y = metricsByPeriod['1Y']
  const my1YReturn = m1Y?.returnPct != null ? Number(m1Y.returnPct) : null
  const compareUrl = `/compare?funds=${fund.projId}`

  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://funds.bulltiq.com'
  const abbr = fund.projAbbrName ?? fund.projId
  const fundUrl_ = `${base}/funds/${encodeURIComponent(abbr)}`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'FinancialProduct',
        name: fund.nameTh,
        alternateName: fund.nameEn ?? undefined,
        description: `กองทุนรวม ${abbr} จดทะเบียนกับ ก.ล.ต. ประเทศไทย`,
        url: fundUrl_,
        provider: fund.amc ? {
          '@type': 'FinancialService',
          name: fund.amc.nameTh,
          areaServed: 'TH',
        } : undefined,
        ...(my1YReturn != null && {
          annualPercentageRate: { '@type': 'QuantitativeValue', value: Number(my1YReturn.toFixed(2)), unitText: '%' },
        }),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'หน้าแรก', item: base },
          { '@type': 'ListItem', position: 2, name: 'กองทุนทั้งหมด', item: `${base}/funds` },
          { '@type': 'ListItem', position: 3, name: abbr, item: fundUrl_ },
        ],
      },
    ],
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Back + Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Link href="/funds" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-700 w-fit">
          <ArrowLeft className="h-4 w-4" />
          กลับไปค้นหากองทุน
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <WatchlistButton
            fund={{
              projId: fund.projId,
              projAbbrName: fund.projAbbrName,
              nameTh: fund.nameTh,
              fundType: fund.fundType,
            }}
          />
          <a
            href={`https://secdocumentstorage.blob.core.windows.net/fundfactsheet/${fund.projId}.pdf`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">Fund Fact Sheet</span>
              <span className="sm:hidden">Fact Sheet</span>
            </Button>
          </a>
          <ShareFundButton
            abbr={abbr}
            nameTh={fund.nameTh}
            return1Y={my1YReturn}
            fundPageUrl={fundUrl_}
            compareUrl={compareUrl}
            twinUrl={`/tools/twin?projId=${encodeURIComponent(fund.projId)}`}
          />
        </div>
      </div>

      {/* Stale NAV Warning */}
      {isStaleNav && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Clock className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            ข้อมูล NAV ล่าสุดอยู่เมื่อ <strong>{daysSinceNav} วันที่แล้ว</strong> ({formatDateTh(latestNavRecord!.navDate)})
            — อาจยังไม่มีข้อมูลวันทำการล่าสุด
          </span>
        </div>
      )}

      {/* Limited History Warning */}
      {hasLimitedHistory && isNewFund && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            <strong>กองทุนใหม่</strong> — มีประวัติ NAV <strong>~{maxNavCount} วันทำการ</strong> ({Math.round(maxNavCount / 22)} เดือน)
            ซึ่งเป็นเรื่องปกติสำหรับกองทุนที่จัดตั้งไม่นาน ผลตอบแทนระยะยาว (6M, 1Y) จะแสดงได้ครบเมื่อมีข้อมูลเพียงพอ
          </span>
        </div>
      )}
      {hasLimitedHistory && !isNewFund && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            ระบบอยู่ระหว่างดึงข้อมูล NAV ย้อนหลัง — ปัจจุบันมีข้อมูล <strong>~{maxNavCount} วันทำการ</strong> ({Math.round(maxNavCount / 22)} เดือน)
            ผลตอบแทนระยะยาว (6M, 1Y, 3Y) คำนวณจากข้อมูลเท่าที่มี และจะสมบูรณ์ขึ้นอัตโนมัติ
          </span>
        </div>
      )}

      {/* Fund Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-start gap-6">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-xs font-mono font-bold bg-blue-50 text-blue-700 rounded px-2 py-0.5">
                  {fund.projAbbrName ?? fund.projId}
                </span>
                <Badge variant="secondary" className="text-xs">{fund.projId}</Badge>
                <RiskBadge riskLevel={fund.riskLevel} />
                {fund.fundStatus && (
                  <Badge variant={fund.fundStatus === 'RG' ? 'success' : 'warning'}>
                    {FUND_STATUS_LABELS[fund.fundStatus] ?? fund.fundStatus}
                  </Badge>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">{fund.nameTh}</h1>
              {fund.nameEn && <p className="text-slate-500 text-sm mb-3">{fund.nameEn}</p>}

              <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-sm text-slate-600">
                {fund.amc && (
                  <span><span className="text-slate-400">บลจ.:</span> {fund.amc.nameTh}</span>
                )}
                {fund.fundType && (
                  <span title="อนุมานจากชื่อกองทุน ไม่ใช่ข้อมูลจาก ก.ล.ต. โดยตรง">
                    <span className="text-slate-400">ประเภท:</span> {FUND_TYPE_LABELS[fund.fundType] ?? fund.fundType}
                    <span className="ml-1 text-xs text-slate-400">(อนุมาน)</span>
                  </span>
                )}
                {fund.dividendPolicy && (
                  <span><span className="text-slate-400">นโยบายปันผล:</span> {DIVIDEND_POLICY_LABELS[fund.dividendPolicy] ?? fund.dividendPolicy}</span>
                )}
                {fund.regisDate && (() => {
                  const ageYears = referenceDateMs != null
                    ? Math.floor((referenceDateMs - new Date(fund.regisDate!).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
                    : 0;
                  return (
                    <span>
                      <span className="text-slate-400">จัดตั้ง:</span>{' '}
                      {formatDateTh(fund.regisDate!)}
                      <span className="text-slate-400 ml-1">({ageYears} ปี)</span>
                    </span>
                  );
                })()}
                {fund.benchmark && (
                  <span className="truncate max-w-xs">
                    <span className="text-slate-400">Benchmark:</span>{' '}
                    {fund.benchmark.split(' · ')[0]}
                  </span>
                )}
              </div>
            </div>

            {/* NAV Box */}
            <div className="bg-slate-50 rounded-xl p-4 min-w-[220px] text-right lg:text-center border border-slate-200 space-y-2">
              <div>
                <p className="text-xs text-slate-500 mb-1">NAV ล่าสุด</p>
                <p className="text-3xl font-bold text-slate-900 tabular-nums">
                  {latestNav != null ? formatNav(latestNav) : '-'}
                </p>
                <p className={cn('text-sm font-medium mt-1 tabular-nums', getReturnColorClass(dailyChangePct))}>
                  {formatPct(dailyChangePct)} วันนี้
                </p>
                {latestNavRecord?.navDate && (
                  <p className={cn('text-xs mt-1', isStaleNav ? 'text-amber-600 font-medium' : 'text-slate-400')}>
                    ข้อมูล ณ {formatDateTh(latestNavRecord.navDate)}
                    {isStaleNav && ` (${daysSinceNav}d ago)`}
                  </p>
                )}
              </div>

              {/* Buy / Sell prices */}
              {latestNavRecord?.buyPrice && latestNavRecord?.sellPrice && (() => {
                const buy = Number(latestNavRecord.buyPrice);
                const sell = Number(latestNavRecord.sellPrice);
                const spreadPct = latestNav && latestNav > 0
                  ? Math.abs(sell - buy) / latestNav * 100
                  : null;
                return (
                  <div className="border-t border-slate-200 pt-2 text-xs text-slate-500 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">ราคาขาย</span>
                      <span className="tabular-nums font-medium">{formatNav(sell)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">ราคารับซื้อคืน</span>
                      <span className="tabular-nums font-medium">{formatNav(buy)}</span>
                    </div>
                    {spreadPct != null && spreadPct > 0 && (
                      <div className="flex justify-between border-t border-slate-100 pt-1 mt-1">
                        <span className="text-slate-400">ค่าใช้จ่าย/รอบ</span>
                        <span className="tabular-nums text-amber-700 font-medium">
                          ~{spreadPct.toFixed(2)}%
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* AUM + trend */}
              {latestNavRecord?.netAsset && (
                <div className="border-t border-slate-200 pt-2 text-xs">
                  <p className="text-slate-400 mb-0.5">ขนาดกองทุน (AUM)</p>
                  <p className="font-semibold text-slate-700 tabular-nums">
                    {formatAUM(Number(latestNavRecord.netAsset))}
                  </p>
                  {oldNavRecord?.netAsset && (() => {
                    const current = Number(latestNavRecord.netAsset)
                    const old = Number(oldNavRecord.netAsset)
                    const aumChangePct = old > 0 ? ((current - old) / old) * 100 : null
                    if (!aumChangePct || Math.abs(aumChangePct) < 0.5) return null
                    const isGrowing = aumChangePct > 0
                    return (
                      <p className={cn('mt-0.5 flex items-center gap-0.5', isGrowing ? 'text-emerald-600' : 'text-red-500')}>
                        {isGrowing ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {isGrowing ? '+' : ''}{aumChangePct.toFixed(1)}% (3 เดือน)
                      </p>
                    )
                  })()}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">ผลตอบแทนย้อนหลัง</h2>
          {hasLimitedHistory && (
            <span className={`text-xs rounded px-2 py-1 ${isNewFund ? 'text-emerald-700 bg-emerald-50' : 'text-blue-600 bg-blue-50'}`}>
              {isNewFund ? `กองทุนใหม่ ~${Math.round(maxNavCount / 22)} เดือน` : `กำลังดึงข้อมูลย้อนหลัง ~${Math.round(maxNavCount / 22)} เดือน`}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {METRIC_PERIODS.filter((p) => p !== 'MAX').map((period) => {
            const m = metricsByPeriod[period]
            const sufficient = hasSufficientData(period, m?.navCount)
            const periodLabel = PERIOD_LABELS[period] ?? period
            return (
              <div key={period} className={cn(!sufficient && m && 'opacity-50')}>
                <MetricCard
                  label={periodLabel}
                  value={sufficient && m?.returnPct != null ? Number(m.returnPct) : null}
                  type="percent"
                  description={
                    !sufficient && m
                      ? `ข้อมูลไม่ครบช่วง ${periodLabel} (มี ${m.navCount ?? 0} วัน, ต้องการ ${PERIOD_MIN_NAV_COUNT[period] ?? '-'})`
                      : METRIC_TOOLTIPS.return.description
                  }
                  size="sm"
                />
              </div>
            )
          })}
          {fund.secReturnYtd != null && Number(fund.secReturnYtd) !== 0 && (
            <MetricCard
              label="YTD"
              value={Number(fund.secReturnYtd)}
              type="percent"
              description="ผลตอบแทนนับจากต้นปีถึงปัจจุบัน (ข้อมูลจาก ก.ล.ต.)"
              size="sm"
            />
          )}
        </div>
        {hasLimitedHistory && (
          <p className="text-xs text-slate-400 mt-2">
            {isNewFund
              ? '* กองทุนใหม่: ผลตอบแทนคำนวณจากช่วงที่กองทุนมีอยู่ ไม่ใช่ช่วงเวลาตามชื่อ'
              : '* ระบบกำลังดึงข้อมูลย้อนหลัง: ผลตอบแทนคำนวณจากข้อมูลที่มี จะสมบูรณ์ขึ้นโดยอัตโนมัติ'}
          </p>
        )}
      </section>

      {/* Risk Metrics */}
      <section>
        <h2 className="text-lg font-bold text-slate-900 mb-4">ตัวชี้วัดความเสี่ยง (1 ปีย้อนหลัง)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MetricCard
            label="ความผันผวน (Volatility)"
            value={m1Y?.annualizedVolatilityPct != null ? Number(m1Y.annualizedVolatilityPct) : null}
            type="percent"
            description={
              !hasSufficientData('1Y', m1Y?.navCount)
                ? `ข้อมูลไม่ครบ 1 ปี (มี ${m1Y?.navCount ?? 0} วัน)`
                : METRIC_TOOLTIPS.volatility.description
            }
            positive="down"
          />
          <MetricCard
            label="Max Drawdown"
            value={m1Y?.maxDrawdownPct != null ? Number(m1Y.maxDrawdownPct) : null}
            type="percent"
            description={
              !hasSufficientData('1Y', m1Y?.navCount)
                ? `ข้อมูลไม่ครบ 1 ปี (มี ${m1Y?.navCount ?? 0} วัน)`
                : METRIC_TOOLTIPS.maxDrawdown.description
            }
            positive="down"
          />
          <MetricCard
            label="Sharpe Ratio"
            value={m1Y?.sharpeRatio != null ? Number(m1Y.sharpeRatio) : null}
            type="ratio"
            description={
              !hasSufficientData('1Y', m1Y?.navCount)
                ? `ข้อมูลไม่ครบ 1 ปี (มี ${m1Y?.navCount ?? 0} วัน)`
                : METRIC_TOOLTIPS.sharpe.description
            }
          />
        </div>
      </section>

      {/* Charts */}
      <section>
        <h2 className="text-lg font-bold text-slate-900 mb-4">กราฟ NAV ย้อนหลัง</h2>
        <Suspense fallback={<div className="h-64 bg-slate-100 animate-pulse rounded-xl" />}>
          <FundCharts projId={fund.projId} defaultClassId={defaultClass?.id} />
        </Suspense>
      </section>

      {/* Full Performance Table */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle>ตารางผลตอบแทนและความเสี่ยงทุกช่วง</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 pr-4 text-slate-500 font-medium">ช่วงเวลา</th>
                    <th className="text-right py-2 px-3 text-slate-500 font-medium">ผลตอบแทน</th>
                    <th className="text-right py-2 px-3 text-slate-500 font-medium hidden md:table-cell">Benchmark</th>
                    <th className="text-right py-2 px-3 text-slate-500 font-medium hidden md:table-cell">Peer Avg</th>
                    <th className="text-right py-2 px-3 text-slate-500 font-medium">Volatility</th>
                    <th className="text-right py-2 px-3 text-slate-500 font-medium">Max Drawdown</th>
                    <th className="text-right py-2 px-3 text-slate-500 font-medium">Sharpe</th>
                    <th className="text-right py-2 px-3 text-slate-500 font-medium hidden sm:table-cell">วันที่มีข้อมูล</th>
                  </tr>
                </thead>
                <tbody>
                  {METRIC_PERIODS.filter((p) => p !== 'MAX').map((period) => {
                    const m = metricsByPeriod[period]
                    const periodLabel = PERIOD_LABELS[period] ?? period
                    const sufficient = hasSufficientData(period, m?.navCount)
                    return (
                      <tr
                        key={period}
                        className={cn(
                          'border-b border-slate-100 last:border-0',
                          !sufficient && m && 'opacity-60'
                        )}
                      >
                        <td className="py-3 pr-4 text-sm font-medium text-slate-600">
                          {periodLabel}
                          {!sufficient && m && (
                            <span className="ml-1.5 text-xs text-amber-600 font-normal">*</span>
                          )}
                        </td>
                        <td className={cn('py-3 text-right text-sm font-semibold tabular-nums', getReturnColorClass(sufficient && m?.returnPct != null ? Number(m.returnPct) : null))}>
                          {sufficient && m?.returnPct != null ? formatPct(Number(m.returnPct)) : '-'}
                        </td>
                        <td className={cn('py-3 text-right text-sm tabular-nums hidden md:table-cell', getReturnColorClass(sufficient && m?.secBenchmarkReturnPct != null ? Number(m.secBenchmarkReturnPct) : null))}>
                          {sufficient && m?.secBenchmarkReturnPct != null ? formatPct(Number(m.secBenchmarkReturnPct)) : '-'}
                        </td>
                        <td className={cn('py-3 text-right text-sm tabular-nums hidden md:table-cell', getReturnColorClass(sufficient && m?.secPeerAvgReturnPct != null ? Number(m.secPeerAvgReturnPct) : null))}>
                          {sufficient && m?.secPeerAvgReturnPct != null ? formatPct(Number(m.secPeerAvgReturnPct)) : '-'}
                        </td>
                        <td className="py-3 text-right text-sm tabular-nums text-slate-600">
                          {sufficient && m?.annualizedVolatilityPct != null ? `${Number(m.annualizedVolatilityPct).toFixed(2)}%` : '-'}
                        </td>
                        <td className={cn('py-3 text-right text-sm tabular-nums', sufficient && m?.maxDrawdownPct != null && Number(m.maxDrawdownPct) < -5 ? 'text-red-600' : 'text-slate-600')}>
                          {sufficient && m?.maxDrawdownPct != null ? `${Number(m.maxDrawdownPct).toFixed(2)}%` : '-'}
                        </td>
                        <td className="py-3 text-right text-sm tabular-nums text-slate-600">
                          {sufficient && m?.sharpeRatio != null ? Number(m.sharpeRatio).toFixed(2) : '-'}
                        </td>
                        <td className="py-3 text-right text-xs tabular-nums text-slate-400 hidden sm:table-cell">
                          {m?.navCount != null ? `${m.navCount} วัน` : '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-400 mt-3">
              {hasLimitedHistory && (
                <span className="text-amber-600 mr-2">
                  {isNewFund ? '* กองทุนใหม่: ข้อมูลยังไม่ครบตามช่วงเวลา' : '* กำลังดึงข้อมูลย้อนหลัง: ข้อมูลยังไม่ครบตามช่วงเวลา'}
                </span>
              )}
              คำนวณจาก NAV ของกลุ่ม {defaultClass?.classAbbrName ?? 'default'} ·
              อัตราดอกเบี้ยไร้ความเสี่ยงที่ใช้คำนวณ Sharpe = 1.5% ต่อปี ·
              <Link href="/methodology" className="text-blue-700 hover:underline ml-1">วิธีคำนวณ</Link>
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Fees */}
      {(fund.totalExpenseRatio != null || fund.managementFee != null ||
        fund.frontEndFee != null || fund.backEndFee != null) && (
        <section>
          <Card>
            <CardHeader>
              <CardTitle>ค่าธรรมเนียมและค่าใช้จ่าย</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {fund.totalExpenseRatio != null && (
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-center">
                    <p className="text-xs text-slate-500 mb-1">Total Expense Ratio (TER)</p>
                    <p className="text-2xl font-bold text-slate-900 tabular-nums">
                      {Number(fund.totalExpenseRatio).toFixed(2)}%
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">ต่อปี</p>
                  </div>
                )}
                {fund.managementFee != null && (
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-center">
                    <p className="text-xs text-slate-500 mb-1">ค่าธรรมเนียมการจัดการ</p>
                    <p className="text-2xl font-bold text-slate-900 tabular-nums">
                      {Number(fund.managementFee).toFixed(2)}%
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">ต่อปี</p>
                  </div>
                )}
                {fund.frontEndFee != null && (
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-center">
                    <p className="text-xs text-slate-500 mb-1">Front-end Fee (ขาย)</p>
                    <p className={cn('text-2xl font-bold tabular-nums',
                      Number(fund.frontEndFee) === 0 ? 'text-emerald-600' : 'text-slate-900'
                    )}>
                      {Number(fund.frontEndFee).toFixed(2)}%
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">ต่อครั้ง</p>
                  </div>
                )}
                {fund.backEndFee != null && (
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-center">
                    <p className="text-xs text-slate-500 mb-1">Back-end Fee (รับซื้อคืน)</p>
                    <p className={cn('text-2xl font-bold tabular-nums',
                      Number(fund.backEndFee) === 0 ? 'text-emerald-600' : 'text-slate-900'
                    )}>
                      {Number(fund.backEndFee).toFixed(2)}%
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">ต่อครั้ง</p>
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-3">
                ค่าธรรมเนียมที่เรียกเก็บจริง ณ ปัจจุบัน ข้อมูลจาก ก.ล.ต. ·
                อาจมีการเปลี่ยนแปลงได้ โปรดตรวจสอบจาก Fund Fact Sheet ล่าสุด
              </p>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Top Holdings */}
      {Array.isArray(fund.topHoldings) && (fund.topHoldings as {name:string;pct:number}[]).length > 0 && (() => {
        const holdings = (fund.topHoldings as {name:string;pct:number}[])
          .filter(h => h.name && h.name.trim() !== '' && !/^\d+\.?\d*$/.test(h.name.trim()) && h.pct > 0)
          .sort((a, b) => b.pct - a.pct)
        if (!holdings.length) return null
        const maxPct = holdings[0].pct
        const asOf = (fund as { topHoldingsAsOf?: string | null }).topHoldingsAsOf
        return (
          <section>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle>ถือครองหลัก (Top Holdings)</CardTitle>
                  {asOf && (
                    <span className="text-xs text-slate-400 bg-slate-50 rounded px-2 py-1 shrink-0 mt-0.5">
                      ข้อมูล ณ {new Date(asOf + 'T00:00:00').toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {holdings.map((h, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-slate-400 w-4 shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-sm text-slate-800 truncate">{h.name}</span>
                          <span className="text-sm font-semibold text-slate-900 shrink-0">{h.pct.toFixed(2)}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-500"
                            style={{ width: `${(h.pct / maxPct) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-3">ที่มา: Fund Factsheet จาก ก.ล.ต. · อัปเดตอัตโนมัติทุกวันที่ 26 ของเดือน</p>
              </CardContent>
            </Card>
          </section>
        )
      })()}

      {/* Asset Allocation */}
      {Array.isArray(fund.assetAllocation) && (fund.assetAllocation as {asset_name:string;asset_ratio:string}[]).length > 0 && (() => {
        const assets = fund.assetAllocation as {asset_name:string;asset_ratio:string}[]
        const ASSET_COLORS: Record<string, string> = {
          'ตราสารทุน':       'bg-blue-500',
          'พันธบัตร':        'bg-emerald-500',
          'หุ้นกู้':          'bg-teal-500',
          'เงินฝาก':         'bg-slate-400',
          'ตราสารตลาดเงิน': 'bg-cyan-500',
          'กองทุนรวม':       'bg-violet-500',
          'ตราสารอนุพันธ์':  'bg-amber-500',
          'สินทรัพย์ทางเลือก': 'bg-orange-500',
        }
        const getColor = (name: string | null) => {
          if (!name) return 'bg-slate-300'
          for (const [key, cls] of Object.entries(ASSET_COLORS)) {
            if (name.includes(key)) return cls
          }
          return 'bg-slate-300'
        }
        const validAssets = assets.filter((a) => a.asset_name && parseFloat(a.asset_ratio) > 0)
        if (validAssets.length === 0) return null
        return (
          <section>
            <Card>
              <CardHeader>
                <CardTitle>สัดส่วนการลงทุน (Asset Allocation)</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Stacked bar */}
                <div className="flex h-6 rounded-lg overflow-hidden mb-4 gap-px">
                  {validAssets.map((a) => {
                    const pct = parseFloat(a.asset_ratio)
                    return (
                      <div
                        key={a.asset_name}
                        className={cn(getColor(a.asset_name), 'transition-all')}
                        style={{ width: `${pct}%` }}
                        title={`${a.asset_name}: ${pct}%`}
                      />
                    )
                  })}
                </div>
                {/* Legend */}
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {validAssets.map((a) => {
                    const pct = parseFloat(a.asset_ratio)
                    return (
                      <div key={a.asset_name} className="flex items-center gap-1.5 text-sm">
                        <span className={cn('w-3 h-3 rounded-sm shrink-0', getColor(a.asset_name))} />
                        <span className="text-slate-600">{a.asset_name}</span>
                        <span className="font-semibold tabular-nums text-slate-900">{pct.toFixed(1)}%</span>
                      </div>
                    )
                  })}
                </div>
                <p className="text-xs text-slate-400 mt-3">ข้อมูลจาก ก.ล.ต. อัปเดตรายเดือนตาม Fund Fact Sheet</p>
              </CardContent>
            </Card>
          </section>
        )
      })()}

      {/* Investment Policy */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle>นโยบายการลงทุน</CardTitle>
          </CardHeader>
          <CardContent>
            {fund.investmentPolicy ? (
              <>
                <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                  {fund.investmentPolicy
                    .replace(/<br\s*\/?>/gi, '\n')
                    .replace(/<[^>]+>/g, '')
                    .replace(/\n{3,}/g, '\n\n')
                    .trim()}
                </p>
                <p className="text-xs text-slate-400 mt-3">ข้อมูลจาก ก.ล.ต.</p>
              </>
            ) : (
              <p className="text-sm text-slate-500 italic">ยังไม่มีข้อมูลนโยบายการลงทุนจาก ก.ล.ต. สำหรับกองทุนนี้</p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── Streamed sections — render in parallel, don't block above content ── */}

      {/* Category Comparison + Percentile Rank */}
      {fund.fundType && (
        <Suspense fallback={<CategoryStatsSkeleton />}>
          <CategoryStats fundType={fund.fundType} myReturn1Y={my1YReturn} />
        </Suspense>
      )}

      {/* Similar Funds */}
      {fund.fundType && (
        <Suspense fallback={<SimilarFundsSkeleton />}>
          <SimilarFunds fundType={fund.fundType} excludeProjId={fund.projId} />
        </Suspense>
      )}

      {/* Disclaimer */}
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
        <strong>ข้อจำกัดความรับผิดชอบ:</strong> ข้อมูลนี้จัดทำเพื่อการศึกษาเท่านั้น
        ไม่ใช่คำแนะนำการลงทุน ผลการดำเนินงานในอดีตไม่ได้รับประกันผลในอนาคต
        กรุณาอ่าน{' '}
        <a
          href={`https://secdocumentstorage.blob.core.windows.net/fundfactsheet/${fund.projId}.pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline inline-flex items-center gap-0.5"
        >
          Fund Fact Sheet <ExternalLink className="h-3 w-3" />
        </a>{' '}
        (อัปเดตรายเดือนโดย บลจ.) ก่อนตัดสินใจลงทุน
      </div>
    </div>
  )
}
