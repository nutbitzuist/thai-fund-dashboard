// app/api/funds/route.ts
// GET /api/funds — paginated fund list with filters and sorting
//
// Sort strategy:
//  • Direct sorts (nameTh, riskLevel, amc, fundType, latestNav):
//      Single Fund query with orderBy
//  • Metric sorts (return1Y, return3Y, volatility1Y, maxDrawdown1Y, sharpe1Y):
//      TWO-STEP — (1) FundMetric query returns ordered fundIds,
//                 (2) Fund + metric detail query for those IDs.
//      This avoids a circular Prisma include (FundMetric→Fund→fundMetrics→FundMetric).
//
// Caching: responses are cached 60 s at the CDN edge, stale-while-revalidate 5 min.
// Financial data changes once daily — aggressive caching is correct here.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { createErrorResponse, handleRouteError } from '@/lib/errors';
import { checkRateLimit } from '@/lib/rate-limit';
import { publicCacheHeaders } from '@/lib/cache-headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ── Cache headers ─────────────────────────────────────────────────────────────
// s-maxage: CDN caches for 60 s (Vercel Edge Cache serves instantly)
// stale-while-revalidate: CDN keeps serving stale for 5 min while refreshing
const CACHE_HEADERS = publicCacheHeaders();

// ── Metric sort config ────────────────────────────────────────────────────────
const METRIC_SORT_KEYS = ['return1Y', 'return3Y', 'volatility1Y', 'maxDrawdown1Y', 'sharpe1Y'] as const;
type MetricSortKey = (typeof METRIC_SORT_KEYS)[number];

const METRIC_PERIOD_MAP: Record<MetricSortKey, string> = {
  return1Y: '1Y', return3Y: '3Y', volatility1Y: '1Y', maxDrawdown1Y: '1Y', sharpe1Y: '1Y',
};
const METRIC_FIELD_MAP: Record<MetricSortKey, string> = {
  return1Y: 'returnPct', return3Y: 'returnPct',
  volatility1Y: 'annualizedVolatilityPct', maxDrawdown1Y: 'maxDrawdownPct', sharpe1Y: 'sharpeRatio',
};

// ── Validation ────────────────────────────────────────────────────────────────
const FundListSchema = z.object({
  q: z.string().max(100).optional(),
  amcId: z.coerce.number().int().positive().optional(),
  fundType: z.string().max(50).optional(),
  riskLevel: z.coerce.number().int().min(1).max(8).optional(),
  dividendPolicy: z.string().max(20).optional(),
  fundStatus: z.string().max(10).optional(),
  sortBy: z
    .enum(['return1Y', 'return3Y', 'volatility1Y', 'maxDrawdown1Y', 'sharpe1Y',
           'latestNav', 'nameTh', 'riskLevel', 'amc', 'fundType'])
    .optional()
    .default('nameTh'),
  sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

// ── Shared fund select (basic fields + latest 2 NAVs for daily-change calc) ───
const FUND_BASE_SELECT = {
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

// ── Shape helper ──────────────────────────────────────────────────────────────
type FundBaseRow = {
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
};

type MetricRow = {
  fundId: number;
  period: string;
  returnPct: unknown;
  annualizedVolatilityPct: unknown;
  maxDrawdownPct: unknown;
  sharpeRatio: unknown;
};

function buildFundDto(
  f: FundBaseRow,
  m1Y: MetricRow | undefined,
  m3Y: MetricRow | undefined,
) {
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
    latestNavDate: latestNav ? (latestNav.navDate as Date).toISOString().split('T')[0] : null,
    dailyChangePct,
    return1Y: m1Y?.returnPct != null ? Number(m1Y.returnPct) : null,
    return3Y: m3Y?.returnPct != null ? Number(m3Y.returnPct) : null,
    volatility1Y: m1Y?.annualizedVolatilityPct != null ? Number(m1Y.annualizedVolatilityPct) : null,
    maxDrawdown1Y: m1Y?.maxDrawdownPct != null ? Number(m1Y.maxDrawdownPct) : null,
    sharpe1Y: m1Y?.sharpeRatio != null ? Number(m1Y.sharpeRatio) : null,
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
  const { allowed } = checkRateLimit(`funds:${ip}`, { maxRequests: 120, windowMs: 60_000 });
  if (!allowed) return createErrorResponse('SEC_RATE_LIMIT', 429);

  const parsed = FundListSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return createErrorResponse('VALIDATION_ERROR', 400);

  const { q, amcId, fundType, riskLevel, dividendPolicy, fundStatus, sortBy, sortDir, page, limit } = parsed.data;
  const skip = (page - 1) * limit;

  // Build fund-level where clause
  const where: Record<string, unknown> = {};
  where.fundStatus = fundStatus ? fundStatus : { in: ['RG', 'SE'] };
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
    // ── PATH A: Metric sort — two-step to avoid circular Prisma include ──────
    if (METRIC_SORT_KEYS.includes(sortBy as MetricSortKey)) {
      const period = METRIC_PERIOD_MAP[sortBy as MetricSortKey];
      const field = METRIC_FIELD_MAP[sortBy as MetricSortKey];

      const metricWhere = {
        period,
        [field]: { not: null },
        fundClass: { isDefault: true },
        fund: where,
      };

      // Step 1: count total + get ordered fundIds (no fund data yet)
      const [total, sortedRows] = await Promise.all([
        prisma.fundMetric.count({ where: metricWhere }),
        prisma.fundMetric.findMany({
          where: metricWhere,
          orderBy: { [field]: sortDir },
          skip,
          take: limit,
          select: { fundId: true },
        }),
      ]);

      const fundIds = sortedRows.map((r) => r.fundId);

      if (!fundIds.length) {
        // Don't CDN-cache empty results — a zero-result response from a DB hiccup
        // would otherwise be served stale for up to 6h+24h (max-age + swr).
        return NextResponse.json(
          { data: [], pagination: { page, limit, total: 0, totalPages: 0 } },
          { headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' } },
        );
      }

      // Step 2: fund details + 1Y & 3Y metrics for those IDs (parallel)
      const [funds, allMetrics] = await Promise.all([
        prisma.fund.findMany({
          where: { id: { in: fundIds } },
          select: FUND_BASE_SELECT,
        }),
        prisma.fundMetric.findMany({
          where: {
            fundId: { in: fundIds },
            period: { in: ['1Y', '3Y'] },
            fundClass: { isDefault: true },
          },
          select: {
            fundId: true,
            period: true,
            returnPct: true,
            annualizedVolatilityPct: true,
            maxDrawdownPct: true,
            sharpeRatio: true,
          },
        }),
      ]);

      // Build lookup maps
      const fundMap = new Map((funds as FundBaseRow[]).map((f) => [f.id, f]));
      const metricMap = new Map<number, Record<string, MetricRow>>();
      for (const m of allMetrics as MetricRow[]) {
        if (!metricMap.has(m.fundId)) metricMap.set(m.fundId, {});
        metricMap.get(m.fundId)![m.period] = m;
      }

      // Rebuild in sort order
      const fundList = fundIds
        .map((id) => {
          const f = fundMap.get(id);
          if (!f) return null;
          const fm = metricMap.get(id) ?? {};
          return buildFundDto(f, fm['1Y'], fm['3Y']);
        })
        .filter(Boolean);

      return NextResponse.json(
        { data: fundList, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
        { headers: CACHE_HEADERS },
      );
    }

    // ── PATH B: Direct sort on Fund table ─────────────────────────────────────
    const [total, funds] = await Promise.all([
      prisma.fund.count({ where }),
      prisma.fund.findMany({
        where,
        skip,
        take: limit,
        orderBy: buildDirectOrderBy(sortBy, sortDir),
        select: {
          ...FUND_BASE_SELECT,
          fundMetrics: {
            where: { period: { in: ['1Y', '3Y'] }, fundClass: { isDefault: true } },
            orderBy: { calculatedAt: 'desc' as const },
            take: 4,
            select: {
              period: true,
              returnPct: true,
              annualizedVolatilityPct: true,
              maxDrawdownPct: true,
              sharpeRatio: true,
            },
          },
        },
      }),
    ]);

    const fundList = (funds as (FundBaseRow & { fundMetrics: MetricRow[] })[]).map((f) => {
      const m1Y = f.fundMetrics.find((m) => m.period === '1Y');
      const m3Y = f.fundMetrics.find((m) => m.period === '3Y');
      return buildFundDto(f, m1Y, m3Y);
    });

    const headers = total === 0
      ? { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' }
      : CACHE_HEADERS;

    return NextResponse.json(
      { data: fundList, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
      { headers },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

function buildDirectOrderBy(sortBy: string, sortDir: 'asc' | 'desc'): Record<string, unknown> {
  switch (sortBy) {
    case 'nameTh':   return { nameTh: sortDir };
    case 'riskLevel': return { riskLevel: sortDir };
    case 'fundType': return { fundType: sortDir };
    case 'amc':      return { amc: { nameTh: sortDir } };
    // latestNav: sort by the max lastVal among the fund's recent prices (approximate)
    case 'latestNav': return { navPrices: { _max: { lastVal: sortDir } } };
    default:         return { nameTh: 'asc' };
  }
}
