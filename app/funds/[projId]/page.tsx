// app/funds/[projId]/page.tsx — Fund Detail Page

import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, GitCompare, ExternalLink, AlertTriangle, Clock } from 'lucide-react'
import prisma from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RiskBadge } from '@/components/metrics/risk-badge'
import { MetricCard, PeriodMetricRow } from '@/components/metrics/metric-card'
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
  getReturnColorClass,
  cn,
  PERIOD_LABELS,
  hasSufficientData,
  PERIOD_MIN_NAV_COUNT,
} from '@/lib/utils'

interface Props {
  params: Promise<{ projId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { projId } = await params
  const fund = await prisma.fund.findUnique({
    where: { projId },
    select: { nameTh: true, projAbbrName: true },
  })
  if (!fund) return { title: 'ไม่พบกองทุน' }
  return {
    title: `${fund.projAbbrName ?? projId} — ${fund.nameTh}`,
    description: `ข้อมูล NAV ผลตอบแทน และความเสี่ยงของกองทุน ${fund.nameTh}`,
  }
}

async function getFundDetail(projId: string) {
  const fund = await prisma.fund.findUnique({
    where: { projId },
    include: {
      amc: true,
      fundClasses: { orderBy: { isDefault: 'desc' } },
      fundMetrics: {
        where: { period: { in: METRIC_PERIODS } },
        orderBy: { calculatedAt: 'desc' },
        // include navCount and endDate for data quality checks
      },
      navPrices: {
        orderBy: { navDate: 'desc' },
        take: 2,
        include: { fundClass: true },
      },
    },
  })
  return fund
}

export default async function FundDetailPage({ params }: Props) {
  const { projId } = await params
  const fund = await getFundDetail(projId)

  if (!fund) notFound()

  const defaultClass = fund.fundClasses.find((c) => c.isDefault) ?? fund.fundClasses[0]
  const latestNavRecord = fund.navPrices.find((n) => n.fundClassId === defaultClass?.id) ?? fund.navPrices[0]
  const prevNavRecord = fund.navPrices.find((n) =>
    n.fundClassId === defaultClass?.id &&
    n.navDate.getTime() !== latestNavRecord?.navDate.getTime()
  )

  const latestNav = latestNavRecord ? Number(latestNavRecord.lastVal) : null
  const prevNav = prevNavRecord ? Number(prevNavRecord.lastVal) : null
  const dailyChangePct = latestNav && prevNav ? ((latestNav - prevNav) / prevNav) * 100 : null

  // Data freshness: days since last NAV
  const daysSinceNav = latestNavRecord
    ? Math.floor((Date.now() - latestNavRecord.navDate.getTime()) / (1000 * 60 * 60 * 24))
    : null
  const isStaleNav = daysSinceNav != null && daysSinceNav > 5

  // Deduplicate metrics by period
  const metricsByPeriod: Record<string, typeof fund.fundMetrics[0]> = {}
  for (const m of fund.fundMetrics) {
    if (m.fundClassId === defaultClass?.id && !metricsByPeriod[m.period]) {
      metricsByPeriod[m.period] = m
    }
  }

  // Determine maximum available NAV history
  const maxNavCount = Math.max(
    0,
    ...Object.values(metricsByPeriod).map((m) => m.navCount ?? 0)
  )
  // Warn if we have fewer than 1Y of data points (230 trading days)
  const hasLimitedHistory = maxNavCount < PERIOD_MIN_NAV_COUNT['1Y']

  const m1Y = metricsByPeriod['1Y']

  const compareUrl = `/compare?funds=${projId}`

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Back + Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Link href="/funds" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-700 w-fit">
          <ArrowLeft className="h-4 w-4" />
          กลับไปค้นหากองทุน
        </Link>
        <Link href={compareUrl}>
          <Button variant="outline" size="sm">
            <GitCompare className="h-4 w-4 mr-1.5" />
            เพิ่มเข้าเปรียบเทียบ
          </Button>
        </Link>
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
            {/* Fund Name & Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-xs font-mono font-bold bg-blue-50 text-blue-700 rounded px-2 py-0.5">
                  {fund.projAbbrName ?? projId}
                </span>
                <Badge variant="secondary" className="text-xs">{projId}</Badge>
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
              </div>
            </div>

            {/* NAV Box */}
            <div className="bg-slate-50 rounded-xl p-4 min-w-[200px] text-right lg:text-center border border-slate-200">
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
              {latestNavRecord?.buyPrice && (
                <div className="flex justify-between text-xs text-slate-500 mt-2 border-t border-slate-200 pt-2">
                  <span>ซื้อ: {formatNav(Number(latestNavRecord.buyPrice))}</span>
                  {latestNavRecord.sellPrice && (
                    <span>ขาย: {formatNav(Number(latestNavRecord.sellPrice))}</span>
                  )}
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
          <FundCharts projId={projId} defaultClassId={defaultClass?.id} />
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

      {/* Disclaimer */}
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
        <strong>ข้อจำกัดความรับผิดชอบ:</strong> ข้อมูลนี้จัดทำเพื่อการศึกษาเท่านั้น
        ไม่ใช่คำแนะนำการลงทุน ผลการดำเนินงานในอดีตไม่ได้รับประกันผลในอนาคต
        กรุณาอ่าน{' '}
        <a
          href={`https://www.sec.or.th/`}
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
