// app/api/compare/route.ts
// GET /api/compare?funds=CODE1,CODE2,CODE3&period=1Y

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { createErrorResponse, handleRouteError } from '@/lib/errors';
import { checkRateLimit } from '@/lib/rate-limit';
import { getPeriodStartDate } from '@/lib/utils';

interface FundWithRelations {
  projId: string;
  projAbbrName: string | null;
  nameTh: string;
  nameEn: string | null;
  riskLevel: number | null;
  fundType: string | null;
  amc: { nameTh: string } | null;
  fundClasses: Array<{ id: number; classAbbrName: string; isDefault: boolean }>;
  fundMetrics: Array<{
    period: string;
    returnPct: unknown;
    annualizedVolatilityPct: unknown;
    maxDrawdownPct: unknown;
    sharpeRatio: unknown;
    calculatedAt: Date;
  }>;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CompareSchema = z.object({
  funds: z.string().max(200), // comma-separated projIds
  period: z.enum(['1M', '3M', '6M', '1Y', '3Y', '5Y', 'MAX']).default('1Y'),
});

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
  const { allowed } = checkRateLimit(`compare:${ip}`, { maxRequests: 30, windowMs: 60_000 });
  if (!allowed) return createErrorResponse('SEC_RATE_LIMIT', 429);

  const parsed = CompareSchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams)
  );
  if (!parsed.success) return createErrorResponse('VALIDATION_ERROR', 400);

  const projIds = parsed.data.funds
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5); // max 5

  if (!projIds.length) return createErrorResponse('VALIDATION_ERROR', 400);

  const { period } = parsed.data;

  try {
    const funds = await prisma.fund.findMany({
      where: { projId: { in: projIds } },
      include: {
        amc: { select: { nameTh: true } },
        fundClasses: { where: { isDefault: true } },
        fundMetrics: {
          where: { period: { in: ['1M', '3M', '6M', '1Y', '3Y', '5Y'] } },
          orderBy: { calculatedAt: 'desc' },
        },
      },
    });

    const endDate = new Date();
    const startDate = period === 'MAX' ? new Date('2000-01-01') : getPeriodStartDate(period, endDate);

    // Load NAV data for each fund's default class
    const navDataMap: Record<string, Array<{ date: string; nav: number; normalized: number }>> = {};

    for (const fund of funds) {
      const defaultClass = fund.fundClasses[0];
      if (!defaultClass) continue;

      const navs = await prisma.navPrice.findMany({
        where: {
          fundClassId: defaultClass.id,
          navDate: { gte: startDate, lte: endDate },
        },
        orderBy: { navDate: 'asc' },
        select: { navDate: true, lastVal: true },
      });

      if (!navs.length) continue;

      const baseNav = Number(navs[0].lastVal);
      navDataMap[fund.projId] = navs.map((n: { navDate: Date; lastVal: unknown }) => ({
        date: n.navDate.toISOString().split('T')[0],
        nav: Number(n.lastVal),
        normalized: baseNav > 0 ? (Number(n.lastVal) / baseNav) * 100 : 100,
      }));
    }

    // Build fund summaries with metrics
    const fundSummaries = (funds as FundWithRelations[]).map((fund) => {
      const metricsByPeriod: Record<string, object> = {};
      const seen = new Set<string>();
      for (const m of fund.fundMetrics) {
        if (seen.has(m.period)) continue;
        seen.add(m.period);
        metricsByPeriod[m.period] = {
          returnPct: m.returnPct != null ? Number(m.returnPct) : null,
          annualizedVolatilityPct: m.annualizedVolatilityPct != null ? Number(m.annualizedVolatilityPct) : null,
          maxDrawdownPct: m.maxDrawdownPct != null ? Number(m.maxDrawdownPct) : null,
          sharpeRatio: m.sharpeRatio != null ? Number(m.sharpeRatio) : null,
        };
      }

      return {
        projId: fund.projId,
        projAbbrName: fund.projAbbrName,
        nameTh: fund.nameTh,
        nameEn: fund.nameEn,
        riskLevel: fund.riskLevel,
        fundType: fund.fundType,
        amc: fund.amc,
        metrics: metricsByPeriod,
      };
    });

    return NextResponse.json({
      funds: fundSummaries,
      navData: navDataMap,
      period,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
