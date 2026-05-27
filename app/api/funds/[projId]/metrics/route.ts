// app/api/funds/[projId]/metrics/route.ts
// GET /api/funds/[projId]/metrics

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { createErrorResponse, handleRouteError } from '@/lib/errors';
import { METRIC_PERIODS } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projId: string }> }
) {
  const { projId } = await params;

  try {
    const fund = await prisma.fund.findUnique({
      where: { projId },
      select: { id: true },
    });
    if (!fund) return createErrorResponse('FUND_NOT_FOUND', 404);

    const defaultClass = await prisma.fundClass.findFirst({
      where: { fundId: fund.id, isDefault: true },
      select: { id: true, classAbbrName: true },
    });

    if (!defaultClass) return createErrorResponse('NAV_NOT_FOUND', 404);

    const metrics = await prisma.fundMetric.findMany({
      where: {
        fundId: fund.id,
        fundClassId: defaultClass.id,
        period: { in: METRIC_PERIODS },
      },
      orderBy: { calculatedAt: 'desc' },
    });

    // Deduplicate — keep most recent per period
    const byPeriod = new Map<string, typeof metrics[number]>();
    for (const m of metrics) {
      if (!byPeriod.has(m.period)) byPeriod.set(m.period, m);
    }

    const result: Record<string, object> = {};
    for (const [period, m] of byPeriod.entries()) {
      result[period] = {
        period,
        startDate: m.startDate.toISOString().split('T')[0],
        endDate: m.endDate.toISOString().split('T')[0],
        returnPct: m.returnPct != null ? Number(m.returnPct) : null,
        annualizedVolatilityPct: m.annualizedVolatilityPct != null ? Number(m.annualizedVolatilityPct) : null,
        maxDrawdownPct: m.maxDrawdownPct != null ? Number(m.maxDrawdownPct) : null,
        sharpeRatio: m.sharpeRatio != null ? Number(m.sharpeRatio) : null,
        navCount: m.navCount,
        calculatedAt: m.calculatedAt.toISOString(),
      };
    }

    return NextResponse.json({
      projId,
      fundClassId: defaultClass.id,
      classAbbrName: defaultClass.classAbbrName,
      metrics: result,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
