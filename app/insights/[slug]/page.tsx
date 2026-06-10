// app/insights/[slug]/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RiskBadge } from '@/components/metrics/risk-badge';
import { SEO_LANDING_PAGES, buildContentBrief, getSeoLandingPage } from '@/lib/bulltiq-content';
import { calculateFundHealthScore } from '@/lib/fund-health-score';
import { FUND_TYPE_LABELS } from '@/types';
import { formatPct, fundUrl, getReturnColorClass } from '@/lib/utils';

interface Props {
  params: Promise<{ slug: string }>;
}

type InsightMetricRow = Prisma.FundMetricGetPayload<{
  include: {
    fund: {
      select: {
        projId: true;
        projAbbrName: true;
        nameTh: true;
        fundType: true;
        riskLevel: true;
        regisDate: true;
        totalExpenseRatio: true;
        amc: { select: { nameTh: true } };
      };
    };
  };
}>;

export const revalidate = 21600;

export function generateStaticParams() {
  return SEO_LANDING_PAGES.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getSeoLandingPage(slug);
  if (!page) return { title: 'ไม่พบหน้า Insight' };
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: `/insights/${page.slug}` },
  };
}

function metricField(metric: string) {
  if (metric === 'volatility1Y') return 'annualizedVolatilityPct';
  if (metric === 'maxDrawdown1Y') return 'maxDrawdownPct';
  if (metric === 'sharpe1Y') return 'sharpeRatio';
  return 'returnPct';
}

function isMissingDatabaseError(error: unknown) {
  return error instanceof Error && /DATABASE_URL is not set/i.test(error.message);
}

export default async function InsightLandingPage({ params }: Props) {
  const { slug } = await params;
  const page = getSeoLandingPage(slug);
  if (!page) notFound();

  const field = metricField(page.metric);
  let rows: InsightMetricRow[];
  try {
    rows = await prisma.fundMetric.findMany({
      where: {
        period: '1Y',
        [field]: { not: null },
        navCount: { gte: 230 },
        fundClass: { isDefault: true },
        fund: {
          fundStatus: { in: ['RG', 'SE'] },
          ...(page.fundType ? { fundType: page.fundType } : {}),
          ...(page.amcQuery ? {
            amc: {
              OR: [
                { nameTh: { contains: page.amcQuery, mode: 'insensitive' as const } },
                { nameEn: { contains: page.amcQuery, mode: 'insensitive' as const } },
                { slug: { contains: page.amcQuery.toLowerCase(), mode: 'insensitive' as const } },
              ],
            },
          } : {}),
        },
      },
      orderBy: { [field]: page.sort },
      take: 12,
      include: {
        fund: {
          select: {
            projId: true,
            projAbbrName: true,
            nameTh: true,
            fundType: true,
            riskLevel: true,
            regisDate: true,
            totalExpenseRatio: true,
            amc: { select: { nameTh: true } },
          },
        },
      },
    }) as unknown as InsightMetricRow[];
  } catch (error) {
    if (!isMissingDatabaseError(error)) throw error;

    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 space-y-6">
        <Badge className="bg-amber-600 text-white">Data unavailable</Badge>
        <h1 className="text-3xl font-bold text-slate-900">{page.h1}</h1>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
          หน้านี้ต้องใช้ฐานข้อมูลกองทุนสด แต่ environment นี้ยังไม่ได้ตั้งค่า <code>DATABASE_URL</code> จึงแสดงสถานะ degraded อย่างชัดเจนแทนการ build/deploy ล้มเหลวหรือแสดงข้อมูลปลอม
        </div>
      </div>
    );
  }

  if (rows.length < page.qualityGate.minRows) {
    notFound();
  }

  const ranked = rows.map((row, idx) => {
    const returnPct = row.returnPct != null ? Number(row.returnPct) : null;
    const volatilityPct = row.annualizedVolatilityPct != null ? Number(row.annualizedVolatilityPct) : null;
    const health = calculateFundHealthScore({
      return1Y: returnPct,
      volatility1Y: volatilityPct,
      maxDrawdown1Y: row.maxDrawdownPct != null ? Number(row.maxDrawdownPct) : null,
      sharpe1Y: row.sharpeRatio != null ? Number(row.sharpeRatio) : null,
      navCount1Y: row.navCount,
      riskLevel: row.fund.riskLevel,
      totalExpenseRatio: row.fund.totalExpenseRatio != null ? Number(row.fund.totalExpenseRatio) : null,
      fundAgeYears: row.fund.regisDate ? Math.max(0, (row.endDate.getTime() - new Date(row.fund.regisDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25)) : null,
    });
    return {
      rank: idx + 1,
      row,
      returnPct,
      volatilityPct,
      health,
    };
  });

  const contentBrief = buildContentBrief({
    title: page.h1,
    slug: page.slug,
    audience: page.audience,
    rows: ranked.map((item) => ({
      rank: item.rank,
      projAbbrName: item.row.fund.projAbbrName,
      nameTh: item.row.fund.nameTh,
      returnPct: item.returnPct,
      volatilityPct: item.volatilityPct,
      healthScore: item.health.score,
      healthGrade: item.health.grade,
    })),
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-blue-700 text-white">Bulltiq Insights</Badge>
          {page.fundType && <Badge variant="outline">{FUND_TYPE_LABELS[page.fundType] ?? page.fundType}</Badge>}
        </div>
        <h1 className="text-3xl font-bold text-slate-900">{page.h1}</h1>
        <p className="max-w-3xl text-slate-600 leading-7">{page.intro}</p>
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
          <strong>วิธีอ่าน:</strong> {page.insightPrompt} — ใช้หน้านี้เป็น shortlist ก่อนอ่าน Fund Fact Sheet และเงื่อนไขจริงของกองทุน
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>รายการกองทุนที่ควรเปิดดูต่อ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3 text-left">#</th>
                  <th className="py-2 px-3 text-left">กองทุน</th>
                  <th className="py-2 px-3 text-right">Return 1Y</th>
                  <th className="py-2 px-3 text-right">Volatility</th>
                  <th className="py-2 px-3 text-right">Health</th>
                  <th className="py-2 pl-3 text-right">เปิดดู</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((item) => (
                  <tr key={item.row.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 pr-3 font-semibold text-slate-500">{item.rank}</td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900">{item.row.fund.projAbbrName ?? item.row.fund.projId}</div>
                      <div className="text-xs text-slate-500 line-clamp-1">{item.row.fund.nameTh}</div>
                      <div className="mt-1 flex items-center gap-1.5"><RiskBadge riskLevel={item.row.fund.riskLevel} /></div>
                    </td>
                    <td className={`py-3 px-3 text-right font-semibold tabular-nums ${getReturnColorClass(item.returnPct)}`}>{formatPct(item.returnPct)}</td>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-700">{formatPct(item.volatilityPct)}</td>
                    <td className="py-3 px-3 text-right">
                      <span className="font-bold text-slate-900">{item.health.score}</span>
                      <span className="ml-1 text-xs text-slate-500">{item.health.grade}</span>
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <Link className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900" href={fundUrl(item.row.fund)}>
                        ดูกองทุน <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-emerald-100 bg-emerald-50/50">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2 font-semibold text-emerald-900">
            <ShieldCheck className="h-5 w-5" />
            Plain Thai Summary
          </div>
          <p className="text-sm leading-6 text-slate-700">{contentBrief.thaiSummary}</p>
          <p className="text-xs text-slate-500">{contentBrief.disclaimer}</p>
        </CardContent>
      </Card>
    </div>
  );
}
