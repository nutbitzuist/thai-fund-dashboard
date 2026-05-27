// app/api/funds/[projId]/route.ts
// GET /api/funds/[projId] — fund detail

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
      include: {
        amc: { select: { id: true, nameTh: true, nameEn: true, uniqueId: true } },
        fundClasses: {
          orderBy: { isDefault: 'desc' },
        },
        fundMetrics: {
          where: { period: { in: METRIC_PERIODS } },
          orderBy: { calculatedAt: 'desc' },
        },
        navPrices: {
          orderBy: { navDate: 'desc' },
          take: 2,
          select: { navDate: true, lastVal: true, buyPrice: true, sellPrice: true, fundClassId: true },
        },
      },
    });

    if (!fund) {
      return createErrorResponse('FUND_NOT_FOUND', 404);
    }

    const defaultClass = fund.fundClasses.find((c) => c.isDefault) ?? fund.fundClasses[0];
    const latestNavRecord = fund.navPrices.find((n) => n.fundClassId === defaultClass?.id) ?? fund.navPrices[0];
    const prevNavRecord = fund.navPrices.find((n) =>
      n.fundClassId === defaultClass?.id && n.navDate !== latestNavRecord?.navDate
    );

    const latestNav = latestNavRecord ? Number(latestNavRecord.lastVal) : null;
    const prevNav = prevNavRecord ? Number(prevNavRecord.lastVal) : null;
    const dailyChangePct =
      latestNav && prevNav ? ((latestNav - prevNav) / prevNav) * 100 : null;

    // Build metrics by period (use default class)
    const metricsByPeriod: Record<string, object> = {};
    for (const period of METRIC_PERIODS) {
      const m = fund.fundMetrics.find(
        (fm) => fm.period === period && fm.fundClassId === defaultClass?.id
      );
      if (m) {
        metricsByPeriod[period] = {
          period: m.period,
          startDate: m.startDate.toISOString().split('T')[0],
          endDate: m.endDate.toISOString().split('T')[0],
          returnPct: m.returnPct != null ? Number(m.returnPct) : null,
          annualizedVolatilityPct: m.annualizedVolatilityPct != null ? Number(m.annualizedVolatilityPct) : null,
          maxDrawdownPct: m.maxDrawdownPct != null ? Number(m.maxDrawdownPct) : null,
          sharpeRatio: m.sharpeRatio != null ? Number(m.sharpeRatio) : null,
          navCount: m.navCount,
        };
      }
    }

    return NextResponse.json({
      id: fund.id,
      projId: fund.projId,
      projAbbrName: fund.projAbbrName,
      nameTh: fund.nameTh,
      nameEn: fund.nameEn,
      fundStatus: fund.fundStatus,
      fundType: fund.fundType,
      riskLevel: fund.riskLevel,
      dividendPolicy: fund.dividendPolicy,
      amc: fund.amc,
      fundClasses: fund.fundClasses,
      latestNav,
      latestNavDate: latestNavRecord?.navDate.toISOString().split('T')[0] ?? null,
      buyPrice: latestNavRecord?.buyPrice != null ? Number(latestNavRecord.buyPrice) : null,
      sellPrice: latestNavRecord?.sellPrice != null ? Number(latestNavRecord.sellPrice) : null,
      dailyChangePct,
      metrics: metricsByPeriod,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
