// app/api/funds/route.ts
// GET /api/funds — paginated fund list with filters and sorting

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { createErrorResponse, handleRouteError } from '@/lib/errors';
import { checkRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const METRIC_SORT_KEYS = ['return1Y', 'return3Y', 'volatility1Y', 'maxDrawdown1Y', 'sharpe1Y'] as const;
type MetricSortKey = (typeof METRIC_SORT_KEYS)[number];

const METRIC_PERIOD_MAP: Record<MetricSortKey, string> = {
  return1Y: '1Y',
  return3Y: '3Y',
  volatility1Y: '1Y',
  maxDrawdown1Y: '1Y',
  sharpe1Y: '1Y',
};

const METRIC_FIELD_MAP: Record<MetricSortKey, string> = {
  return1Y: 'returnPct',
  return3Y: 'returnPct',
  volatility1Y: 'annualizedVolatilityPct',
  maxDrawdown1Y: 'maxDrawdownPct',
  sharpe1Y: 'sharpeRatio',
};

const FundListSchema = z.object({
  q: z.string().max(100).optional(),
  amcId: z.coerce.number().int().positive().optional(),
  fundType: z.string().max(50).optional(),
  riskLevel: z.coerce.number().int().min(1).max(8).optional(),
  dividendPolicy: z.string().max(20).optional(),
  fundStatus: z.string().max(10).optional(),
  sortBy: z
    .enum(['return1Y', 'return3Y', 'volatility1Y', 'maxDrawdown1Y', 'sharpe1Y', 'latestNav', 'nameTh', 'riskLevel', 'amc', 'fundType'])
    .optional()
    .default('nameTh'),
  sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

// Shared fund select shape
const FUND_SELECT = {
  id: true,
  projId: true,
  projAbbrName: true,
  nameTh: true,
  nameEn: true,
  fundStatus: true,
  fundType: true,
  riskLevel: true,
  dividendPolicy: true,
  amc: { select: { id: true, nameTh: true, nameEn: true } },
  navPrices: {
    orderBy: { navDate: 'desc' as const },
    take: 2,
    select: { navDate: true, lastVal: true },
  },
} as const;

// Format raw fund DB row into FundSummaryDto shape (no metrics yet)
function formatFundBase(f: {
  id: number;
  projId: string;
  projAbbrName: string | null;
  nameTh: string;
  nameEn: string | null;
  fundStatus: string | null;
  fundType: string | null;
  riskLevel: number | null;
  dividendPolicy: string | null;
  amc: { id: number; nameTh: string; nameEn: string | null } | null;
  navPrices: { navDate: Date; lastVal: unknown }[];
}) {
  const latestNav = f.navPrices[0];
  const prevNav = f.navPrices[1];
  const dailyChangePct =
    latestNav && prevNav
      ? ((Number(latestNav.lastVal) - Number(prevNav.lastVal)) / Number(prevNav.lastVal)) * 100
      : null;

  return {
    id: f.id,
    projId: f.projId,
    projAbbrName: f.projAbbrName,
    nameTh: f.nameTh,
    nameEn: f.nameEn,
    fundStatus: f.fundStatus,
    fundType: f.fundType,
    riskLevel: f.riskLevel,
    dividendPolicy: f.dividendPolicy,
    amc: f.amc,
    latestNav: latestNav ? Number(latestNav.lastVal) : null,
    latestNavDate: latestNav ? latestNav.navDate.toISOString().split('T')[0] : null,
    dailyChangePct,
  };
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
  const { allowed } = checkRateLimit(`funds:${ip}`, { maxRequests: 120, windowMs: 60_000 });
  if (!allowed) return createErrorResponse('SEC_RATE_LIMIT', 429);

  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = FundListSchema.safeParse(params);
  if (!parsed.success) return createErrorResponse('VALIDATION_ERROR', 400);

  const { q, amcId, fundType, riskLevel, dividendPolicy, fundStatus, sortBy, sortDir, page, limit } =
    parsed.data;

  const skip = (page - 1) * limit;

  // Build where clause — default to active funds only (RG=Registered, SE=Seeking)
  const where: Record<string, unknown> = {};
  if (fundStatus) {
    where.fundStatus = fundStatus;
  } else {
    where.fundStatus = { in: ['RG', 'SE'] };
  }
  if (q) {
    where.OR = [
      { projAbbrName: { contains: q, mode: 'insensitive' } },
      { nameTh: { contains: q, mode: 'insensitive' } },
      { nameEn: { contains: q, mode: 'insensitive' } },
      { projId: { contains: q, mode: 'insensitive' } },
    ];
  }
  if (amcId) where.amcId = amcId;
  if (fundType) where.fundType = fundType;
  if (riskLevel) where.riskLevel = riskLevel;
  if (dividendPolicy) where.dividendPolicy = dividendPolicy;

  try {
    // ── Metric-based sorts: query via FundMetric table ──────────────────
    if (METRIC_SORT_KEYS.includes(sortBy as MetricSortKey)) {
      const metricKey = sortBy as MetricSortKey;
      const period = METRIC_PERIOD_MAP[metricKey];
      const field = METRIC_FIELD_MAP[metricKey];

      const metricWhere = {
        period,
        [field]: { not: null },
        fundClass: { isDefault: true },
        fund: where,
      };

      const [total, metrics] = await Promise.all([
        prisma.fundMetric.count({ where: metricWhere }),
        prisma.fundMetric.findMany({
          where: metricWhere,
          orderBy: { [field]: sortDir },
          skip,
          take: limit,
          include: {
            fund: {
              select: {
                ...FUND_SELECT,
                fundMetrics: {
                  where: { period: { in: ['1Y', '3Y'] } },
                  orderBy: { calculatedAt: 'desc' as const },
                  take: 4,
                  select: {
                    period: true,
                    returnPct: true,
                    annualizedVolatilityPct: true,
                    maxDrawdownPct: true,
                    sharpeRatio: true,
                    endDate: true,
                  },
                },
              },
            },
          },
        }),
      ]);

      const fundList = metrics.map((m) => {
        const f = m.fund as typeof m.fund & {
          fundMetrics: { period: string; returnPct: unknown; annualizedVolatilityPct: unknown; maxDrawdownPct: unknown; sharpeRatio: unknown; endDate: Date }[];
        };
        const m1Y = f.fundMetrics.find((x) => x.period === '1Y');
        const m3Y = f.fundMetrics.find((x) => x.period === '3Y');
        return {
          ...formatFundBase(f),
          return1Y: m1Y?.returnPct != null ? Number(m1Y.returnPct) : null,
          return3Y: m3Y?.returnPct != null ? Number(m3Y.returnPct) : null,
          volatility1Y: m1Y?.annualizedVolatilityPct != null ? Number(m1Y.annualizedVolatilityPct) : null,
          maxDrawdown1Y: m1Y?.maxDrawdownPct != null ? Number(m1Y.maxDrawdownPct) : null,
          sharpe1Y: m1Y?.sharpeRatio != null ? Number(m1Y.sharpeRatio) : null,
        };
      });

      return NextResponse.json({
        data: fundList,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    }

    // ── Direct fund sorts ────────────────────────────────────────────────
    const [total, funds] = await Promise.all([
      prisma.fund.count({ where }),
      prisma.fund.findMany({
        where,
        skip,
        take: limit,
        orderBy: buildDirectOrderBy(sortBy, sortDir),
        select: {
          ...FUND_SELECT,
          fundMetrics: {
            where: { period: { in: ['1Y', '3Y'] } },
            orderBy: { calculatedAt: 'desc' as const },
            take: 4,
            select: {
              period: true,
              returnPct: true,
              annualizedVolatilityPct: true,
              maxDrawdownPct: true,
              sharpeRatio: true,
              endDate: true,
            },
          },
        },
      }),
    ]);

    const fundList = funds.map((f) => {
      const m1Y = f.fundMetrics.find((m) => m.period === '1Y');
      const m3Y = f.fundMetrics.find((m) => m.period === '3Y');
      return {
        ...formatFundBase(f),
        return1Y: m1Y?.returnPct != null ? Number(m1Y.returnPct) : null,
        return3Y: m3Y?.returnPct != null ? Number(m3Y.returnPct) : null,
        volatility1Y: m1Y?.annualizedVolatilityPct != null ? Number(m1Y.annualizedVolatilityPct) : null,
        maxDrawdown1Y: m1Y?.maxDrawdownPct != null ? Number(m1Y.maxDrawdownPct) : null,
        sharpe1Y: m1Y?.sharpeRatio != null ? Number(m1Y.sharpeRatio) : null,
      };
    });

    return NextResponse.json({
      data: fundList,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

function buildDirectOrderBy(sortBy: string, sortDir: 'asc' | 'desc'): Record<string, unknown> {
  switch (sortBy) {
    case 'nameTh':
      return { nameTh: sortDir };
    case 'riskLevel':
      return { riskLevel: sortDir };
    case 'fundType':
      return { fundType: sortDir };
    case 'amc':
      return { amc: { nameTh: sortDir } };
    case 'latestNav':
      return { navPrices: { _max: { lastVal: sortDir } } };
    default:
      return { nameTh: 'asc' };
  }
}
