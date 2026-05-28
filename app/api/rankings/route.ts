// app/api/rankings/route.ts
// GET /api/rankings?metric=return1Y&sort=desc&fundType=&riskLevel=

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { createErrorResponse, handleRouteError } from '@/lib/errors';
import { checkRateLimit } from '@/lib/rate-limit';
import { publicCacheHeaders } from '@/lib/cache-headers';

// Inline type for FundMetric with includes (Prisma 7 compat)
interface MetricWithRelations {
  period: string;
  returnPct: unknown;
  annualizedVolatilityPct: unknown;
  maxDrawdownPct: unknown;
  sharpeRatio: unknown;
  navCount: number | null;
  endDate: Date;
  fund: {
    projId: string;
    projAbbrName: string | null;
    nameTh: string;
    nameEn: string | null;
    fundType: string | null;
    riskLevel: number | null;
    dividendPolicy: string | null;
    amc: { nameTh: string } | null;
  };
  fundClass: { classAbbrName: string };
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RankingSchema = z.object({
  metric: z
    .enum(['return1Y', 'return1M', 'return3M', 'return3Y', 'return6M', 'returnYTD', 'volatility1Y', 'maxDrawdown1Y', 'sharpe1Y'])
    .default('return1Y'),
  sort: z.enum(['asc', 'desc']).default('desc'),
  fundType: z.string().max(50).optional(),
  riskLevel: z.coerce.number().int().min(1).max(8).optional(),
  amcIds: z.string().optional(), // comma-separated list, e.g. "1,3,7"
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const METRIC_PERIOD_MAP: Record<string, string> = {
  return1Y: '1Y',
  return1M: '1M',
  return3M: '3M',
  return3Y: '3Y',
  return6M: '6M',
  returnYTD: 'YTD',
  volatility1Y: '1Y',
  maxDrawdown1Y: '1Y',
  sharpe1Y: '1Y',
};

const METRIC_FIELD_MAP: Record<string, string> = {
  return1Y: 'returnPct',
  return1M: 'returnPct',
  return3M: 'returnPct',
  return3Y: 'returnPct',
  return6M: 'returnPct',
  returnYTD: 'returnPct',
  volatility1Y: 'annualizedVolatilityPct',
  maxDrawdown1Y: 'maxDrawdownPct',
  sharpe1Y: 'sharpeRatio',
};

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
  const { allowed } = checkRateLimit(`rankings:${ip}`, { maxRequests: 60, windowMs: 60_000 });
  if (!allowed) return createErrorResponse('SEC_RATE_LIMIT', 429);

  const parsed = RankingSchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams)
  );
  if (!parsed.success) return createErrorResponse('VALIDATION_ERROR', 400);

  const { metric, sort, fundType, riskLevel, amcIds: amcIdsStr, page, limit } = parsed.data;
  const period = METRIC_PERIOD_MAP[metric];
  const metricField = METRIC_FIELD_MAP[metric];
  const skip = (page - 1) * limit;

  const amcIdList = amcIdsStr
    ? amcIdsStr.split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0)
    : [];

  try {
    // Get funds with metrics, applying fund-level filters
    const fundWhere: Record<string, unknown> = {
      fundStatus: { in: ['RG', 'SE'] },
    };
    if (fundType) fundWhere.fundType = fundType;
    if (riskLevel) fundWhere.riskLevel = riskLevel;
    if (amcIdList.length === 1) fundWhere.amcId = amcIdList[0];
    else if (amcIdList.length > 1) fundWhere.amcId = { in: amcIdList };

    // Fetch latest metrics for the relevant period
    // Join: FundMetric → FundClass (isDefault) → Fund (with filters)
    const metrics = await prisma.fundMetric.findMany({
      where: {
        period,
        [`${metricField}`]: { not: null },
        fundClass: { isDefault: true },
        fund: fundWhere,
      },
      orderBy: {
        [metricField]: sort,
      },
      skip,
      take: limit,
      include: {
        fund: {
          select: {
            projId: true,
            projAbbrName: true,
            nameTh: true,
            nameEn: true,
            fundType: true,
            riskLevel: true,
            dividendPolicy: true,
            amc: { select: { nameTh: true } },
          },
        },
        fundClass: {
          select: { classAbbrName: true },
        },
      },
    });

    const total = await prisma.fundMetric.count({
      where: {
        period,
        [`${metricField}`]: { not: null },
        fundClass: { isDefault: true },
        fund: fundWhere,
      },
    });

    const data = (metrics as MetricWithRelations[]).map((m, idx) => ({
      rank: skip + idx + 1,
      projId: m.fund.projId,
      projAbbrName: m.fund.projAbbrName,
      nameTh: m.fund.nameTh,
      nameEn: m.fund.nameEn,
      fundType: m.fund.fundType,
      riskLevel: m.fund.riskLevel,
      dividendPolicy: m.fund.dividendPolicy,
      amc: m.fund.amc,
      period: m.period,
      returnPct: m.returnPct != null ? Number(m.returnPct) : null,
      annualizedVolatilityPct: m.annualizedVolatilityPct != null ? Number(m.annualizedVolatilityPct) : null,
      maxDrawdownPct: m.maxDrawdownPct != null ? Number(m.maxDrawdownPct) : null,
      sharpeRatio: m.sharpeRatio != null ? Number(m.sharpeRatio) : null,
      navCount: m.navCount,
      endDate: m.endDate.toISOString().split('T')[0],
    }));

    return NextResponse.json(
      {
        data,
        metric,
        sort,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        disclaimer:
          'อันดับนี้จัดทำเพื่อการศึกษาเท่านั้น ไม่ใช่คำแนะนำการลงทุน ผลการดำเนินงานในอดีตไม่ได้รับประกันผลในอนาคต',
      },
      { headers: publicCacheHeaders() },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
