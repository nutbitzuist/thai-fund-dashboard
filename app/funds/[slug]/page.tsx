// app/funds/[slug]/page.tsx — Fund Detail Page
// URL slug = projAbbrName (e.g. /funds/K-OIL)
// Falls back to projId for backward-compat with old URLs (/funds/M0145_2549)

import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, GitCompare, ExternalLink, AlertTriangle, Clock, TrendingUp, TrendingDown, ChevronRight } from 'lucide-react'
import prisma from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RiskBadge } from '@/components/metrics/risk-badge'
import { MetricCard } from '@/components/metrics/metric-card'
import { WatchlistButton } from '@/components/fund/watchlist-button'
import { FundCharts } from './fund-charts'
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

// Similar funds: same type, different fund, active, with 1Y metrics
async function getSimilarFunds(fundType: string | null, excludeProjId: string) {
  if (!fundType) return []
  try {
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
    return metrics.map((m) => ({
      ...m.fund,
      return1Y: m.returnPct != null ? Number(m.returnPct) : null,
    }))
  } catch {
    return []
  }
}

// Category stats + percentile rank (performance attribution — Feature 15)
async function getCategoryStats(fundType: string | null) {
  if (!fundType) return null
  try {
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
    // Percentile rank: what % of funds does this fund beat?
    // (computed later in the component once we know the fund's own return)
    return { avg, median, count: returns.length, sorted }
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const fund = await prisma.fund.findFirst({
    where: {
      OR: [
        { projAbbrName: { equals: slug, mode: 'insensitive' } },
        { projId: slug },
      ],
    },
    select: { nameTh: true, nameEn: true, projAbbrName: true, projId: true, fundType: true, riskLevel: true, regisDate: true },
  })
  if (!fund) return { title: 'ไม่พบกองทุน' }

  const abbr = fund.projAbbrName ?? fund.projId
  const canonicalUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://thai-fund-dashboard.vercel.app'}/funds/${encodeURIComponent(abbr)}`

  return {
    title: `${abbr} — ${fund.nameTh}`,
    description: `ข้อมูล NAV ผลตอบแทน และความเสี่ยงของกองทุน ${fund.nameTh}${fund.nameEn ? ` (${fund.nameEn})` : ''}`,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${abbr} — ${fund.nameTh}`,
      description: `ข้อมูล NAV ผลตอบแทน ความเสี่ยง ของกองทุน ${abbr}`,
      url: canonicalUrl,
      type: 'website',
    },
  }
}

export default async function FundDetailPage({ params }: Props) {
  const { slug } = await params
  const fund = await getFundBySlug(slug)

  if (!fund) notFound()

  // Canonical redirect: if accessed by old projId URL and fund has a projAbbrName
  // e.g. /funds/M0145_2549 → /funds/K-OIL (301 implicit via redirect())
  if (
    fund.projAbbrName &&
    slug !== fund.projAbbrName &&
    slug.toLowerCase() !== fund.projAbbrName.toLowerCase()
  ) {
    redirect(fundUrl(fund))
  }

  const defaultClass = fund.fundClasses.find((c) => c.isDefault) ?? fund.fundClasses[0]

  // Fetch similar funds, category stats, and AUM trend in parallel (non-blocking)
  const threeMonthsAgo = new Date(); threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  const [similarFunds, categoryStats, oldNavRecord] = await Promise.all([
    getSimilarFunds(fund.fundType, fund.projId),
    getCategoryStats(fund.fundType),
    defaultClass?.id ? prisma.navPrice.findFirst({
      where: {
        fundClassId: defaultClass.id,
        navDate: { lte: threeMonthsAgo },
        netAsset: { not: null },
      },
      orderBy: { navDate: 'desc' },
      select: { netAsset: true, navDate: true },
    }) : null,
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

  const daysSinceNav = latestNavRecord
    ? Math.floor((Date.now() - latestNavRecord.navDate.getTime()) / (1000 * 60 * 60 * 24))
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

  const m1Y = metricsByPeriod['1Y']
  const compareUrl = `/compare?funds=${fund.projId}`

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Back + Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Link href="/funds" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-700 w-fit">
          <ArrowLeft className="h-4 w-4" />
          กลับไปค้นหากองทุน
        </Link>
        <div className="flex items-center gap-2">
          <WatchlistButton
            fund={{
              projId: fund.projId,
              projAbbrName: fund.projAbbrName,
              nameTh: fund.nameTh,
              fundType: fund.fundType,
            }}
          />
          <Link href={compareUrl}>
            <Button variant="outline" size="sm">
              <GitCompare className="h-4 w-4 mr-1.5" />
              เพิ่มเข้าเปรียบเทียบ
            </Button>
          </Link>
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
      {hasLimitedHistory && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            ระบบมีประวัติ NAV <strong>~{maxNavCount} วันทำการ</strong> ({Math.round(maxNavCount / 22)} เดือน) —
            ผลตอบแทนระยะยาว (6M, 1Y, 3Y) คำนวณจากข้อมูลเท่าที่มี ซึ่งอาจไม่ครบช่วงเวลา
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
                  <span><span className="text-slate-400">ประเภท:</span> {FUND_TYPE_LABELS[fund.fundType] ?? fund.fundType}</span>
                )}
                {fund.dividendPolicy && (
                  <span><span className="text-slate-400">นโยบายปันผล:</span> {DIVIDEND_POLICY_LABELS[fund.dividendPolicy] ?? fund.dividendPolicy}</span>
                )}
                {fund.regisDate && (() => {
                  const ageYears = Math.floor((Date.now() - new Date(fund.regisDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
                  return (
                    <span>
                      <span className="text-slate-400">จัดตั้ง:</span>{' '}
                      {formatDateTh(fund.regisDate)}
                      <span className="text-slate-400 ml-1">({ageYears} ปี)</span>
                    </span>
                  );
                })()}
              </div>
            </div>

            {/* NAV Box */}
            <div className="bg-slate-50 rounded-xl p-4 min-w-[220px] text-right lg:text-center border border-slate-200 space-y-2">
              {/* NAV + daily change */}
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

              {/* Buy / Sell prices + transaction cost */}
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
            <span className="text-xs text-blue-600 bg-blue-50 rounded px-2 py-1">
              ข้อมูลจำกัด ~{Math.round(maxNavCount / 22)} เดือน
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {METRIC_PERIODS.filter((p) => p !== 'MAX').map((period) => {
            const m = metricsByPeriod[period]
            const sufficient = hasSufficientData(period, m?.navCount)
            const periodLabel = PERIOD_LABELS[period] ?? period
            return (
              <div key={period} className={cn(!sufficient && m && 'opacity-60')}>
                <MetricCard
                  label={periodLabel}
                  value={m?.returnPct != null ? Number(m.returnPct) : null}
                  type="percent"
                  description={
                    !sufficient && m
                      ? `ข้อมูลไม่ครบช่วง ${periodLabel} (มีแค่ ${m.navCount ?? 0} วัน, ต้องการ ${PERIOD_MIN_NAV_COUNT[period] ?? '-'})`
                      : METRIC_TOOLTIPS.return.description
                  }
                  size="sm"
                />
              </div>
            )
          })}
        </div>
        {hasLimitedHistory && (
          <p className="text-xs text-slate-400 mt-2">
            * ผลตอบแทนที่แสดงคำนวณจากระยะเวลาที่มีข้อมูล ไม่ใช่ช่วงเวลาตามชื่อ
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
          {/* Pass actual projId (not slug) — API uses projId for DB lookups */}
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
                        <td className={cn('py-3 text-right text-sm font-semibold tabular-nums', getReturnColorClass(m?.returnPct != null ? Number(m.returnPct) : null))}>
                          {m?.returnPct != null ? formatPct(Number(m.returnPct)) : '-'}
                        </td>
                        <td className="py-3 text-right text-sm tabular-nums text-slate-600">
                          {m?.annualizedVolatilityPct != null ? `${Number(m.annualizedVolatilityPct).toFixed(2)}%` : '-'}
                        </td>
                        <td className={cn('py-3 text-right text-sm tabular-nums', m?.maxDrawdownPct != null && Number(m.maxDrawdownPct) < -5 ? 'text-red-600' : 'text-slate-600')}>
                          {m?.maxDrawdownPct != null ? `${Number(m.maxDrawdownPct).toFixed(2)}%` : '-'}
                        </td>
                        <td className="py-3 text-right text-sm tabular-nums text-slate-600">
                          {m?.sharpeRatio != null ? Number(m.sharpeRatio).toFixed(2) : '-'}
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
                <span className="text-amber-600 mr-2">* ข้อมูลไม่ครบตามช่วงเวลา</span>
              )}
              คำนวณจาก NAV ของกลุ่ม {defaultClass?.classAbbrName ?? 'default'} ·
              อัตราดอกเบี้ยไร้ความเสี่ยงที่ใช้คำนวณ Sharpe = 1.5% ต่อปี ·
              <Link href="/methodology" className="text-blue-700 hover:underline ml-1">วิธีคำนวณ</Link>
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Category Comparison + Percentile Rank (Features 12, 15) */}
      {categoryStats && fund.fundType && (
        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-4">
            เปรียบเทียบกับกองทุนประเภทเดียวกัน
          </h2>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-slate-500 mb-3">
                {FUND_TYPE_LABELS[fund.fundType] ?? fund.fundType} — จากข้อมูล {categoryStats.count.toLocaleString('th-TH')} กองทุน (ผลตอบแทน 1 ปี)
              </p>
              <div className="grid grid-cols-3 gap-4 mb-3">
                <div className="text-center">
                  <p className="text-xs text-slate-400 mb-1">กองทุนนี้</p>
                  <p className={cn('text-xl font-bold tabular-nums', getReturnColorClass(m1Y?.returnPct != null ? Number(m1Y.returnPct) : null))}>
                    {m1Y?.returnPct != null ? formatPct(Number(m1Y.returnPct)) : '-'}
                  </p>
                </div>
                <div className="text-center border-x border-slate-100">
                  <p className="text-xs text-slate-400 mb-1">ค่าเฉลี่ยประเภท</p>
                  <p className={cn('text-xl font-bold tabular-nums', getReturnColorClass(categoryStats.avg))}>
                    {formatPct(categoryStats.avg)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-400 mb-1">มัธยฐาน</p>
                  <p className={cn('text-xl font-bold tabular-nums', getReturnColorClass(categoryStats.median))}>
                    {categoryStats.median != null ? formatPct(categoryStats.median) : '-'}
                  </p>
                </div>
              </div>
              {m1Y?.returnPct != null && (() => {
                const myReturn = Number(m1Y.returnPct)
                const diff = myReturn - categoryStats.avg
                // Percentile: count funds this fund beats
                const beatCount = categoryStats.sorted.filter((r) => r < myReturn).length
                const percentile = Math.round((beatCount / categoryStats.sorted.length) * 100)
                const isTop = percentile >= 75
                const isBottom = percentile < 25
                return (
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
                )
              })()}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Similar Funds (Feature 5) */}
      {similarFunds.length > 0 && fund.fundType && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">
              กองทุนประเภทเดียวกัน — {FUND_TYPE_LABELS[fund.fundType] ?? fund.fundType} ผลตอบแทนสูงสุด
            </h2>
            <Link
              href={`/funds/type/${fund.fundType.toLowerCase()}`}
              className="text-sm text-blue-700 hover:underline flex items-center gap-1"
            >
              ดูทั้งหมด <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {similarFunds.map((sf) => (
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
      )}

      {/* Disclaimer */}
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
        <strong>ข้อจำกัดความรับผิดชอบ:</strong> ข้อมูลนี้จัดทำเพื่อการศึกษาเท่านั้น
        ไม่ใช่คำแนะนำการลงทุน ผลการดำเนินงานในอดีตไม่ได้รับประกันผลในอนาคต
        กรุณาอ่าน{' '}
        <a
          href="https://www.sec.or.th/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline inline-flex items-center gap-0.5"
        >
          หนังสือชี้ชวน <ExternalLink className="h-3 w-3" />
        </a>{' '}
        ก่อนตัดสินใจลงทุน
      </div>
    </div>
  )
}
