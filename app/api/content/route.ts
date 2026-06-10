// app/api/content/route.ts
// GET /api/content?slug=best-thai-equity-funds — Bulltiq content brief for posts/newsletter/shorts.

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { buildContentBrief, getSeoLandingPage } from '@/lib/bulltiq-content';
import { calculateFundHealthScore } from '@/lib/fund-health-score';
import { publicCacheHeaders } from '@/lib/cache-headers';
import { handleRouteError } from '@/lib/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function metricField(metric: string) {
  if (metric === 'volatility1Y') return 'annualizedVolatilityPct';
  if (metric === 'maxDrawdown1Y') return 'maxDrawdownPct';
  if (metric === 'sharpe1Y') return 'sharpeRatio';
  return 'returnPct';
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug') ?? 'best-thai-equity-funds';
  const page = getSeoLandingPage(slug);
  if (!page) {
    return NextResponse.json({ error: 'Unknown insight slug' }, { status: 404 });
  }

  try {
    const field = metricField(page.metric);
    const rows = await prisma.fundMetric.findMany({
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
      take: 10,
      include: {
        fund: {
          select: {
            projId: true,
            projAbbrName: true,
            nameTh: true,
            riskLevel: true,
            regisDate: true,
            totalExpenseRatio: true,
          },
        },
      },
    });

    if (rows.length < page.qualityGate.minRows) {
      return NextResponse.json({ error: 'Not enough data for this SEO page', minRows: page.qualityGate.minRows, rows: rows.length }, { status: 404 });
    }

    const contentRows = rows.map((row, idx) => {
      const health = calculateFundHealthScore({
        return1Y: row.returnPct != null ? Number(row.returnPct) : null,
        volatility1Y: row.annualizedVolatilityPct != null ? Number(row.annualizedVolatilityPct) : null,
        maxDrawdown1Y: row.maxDrawdownPct != null ? Number(row.maxDrawdownPct) : null,
        sharpe1Y: row.sharpeRatio != null ? Number(row.sharpeRatio) : null,
        navCount1Y: row.navCount,
        riskLevel: row.fund.riskLevel,
        totalExpenseRatio: row.fund.totalExpenseRatio != null ? Number(row.fund.totalExpenseRatio) : null,
        fundAgeYears: row.fund.regisDate ? Math.max(0, (row.endDate.getTime() - new Date(row.fund.regisDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25)) : null,
      });
      return {
        rank: idx + 1,
        projId: row.fund.projId,
        projAbbrName: row.fund.projAbbrName,
        nameTh: row.fund.nameTh,
        returnPct: row.returnPct != null ? Number(row.returnPct) : null,
        volatilityPct: row.annualizedVolatilityPct != null ? Number(row.annualizedVolatilityPct) : null,
        healthScore: health.score,
        healthGrade: health.grade,
      };
    });

    const brief = buildContentBrief({
      title: page.h1,
      slug: page.slug,
      audience: page.audience,
      rows: contentRows,
    });

    return NextResponse.json({ page, rows: contentRows, brief }, { headers: publicCacheHeaders() });
  } catch (err) {
    return handleRouteError(err);
  }
}
