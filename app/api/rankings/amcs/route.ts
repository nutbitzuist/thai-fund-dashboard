// app/api/rankings/amcs/route.ts
// GET /api/rankings/amcs?period=1Y&sort=desc&fundType=
//
// Returns AMC-level aggregated performance rankings.
// Fetches all fund metrics for the period, groups by AMC in JS,
// then computes avg, median, best fund, and sorts.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { handleRouteError } from '@/lib/errors';
import { checkRateLimit } from '@/lib/rate-limit';
import { publicCacheHeaders } from '@/lib/cache-headers';
import { PERIOD_MIN_NAV_COUNT } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Schema = z.object({
  period: z.enum(['1M', '3M', '6M', '1Y', '3Y', 'YTD']).default('1Y'),
  sort: z.enum(['asc', 'desc']).default('desc'),
  sortBy: z.enum(['avgReturn', 'medianReturn', 'fundCount', 'bestReturn', 'avgSharpe', 'avgVolatility']).default('avgReturn'),
  fundType: z.string().max(50).optional(),
});

interface MetricRow {
  fundClassId: number;
  returnPct: unknown;
  sharpeRatio: unknown;
  annualizedVolatilityPct: unknown;
  navCount: number | null;
  endDate: Date;
  fund: {
    projId: string;
    projAbbrName: string | null;
    nameTh: string;
    amcId: number | null;
    amc: { id: number; nameTh: string; nameEn: string | null } | null;
  };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
  const { allowed } = checkRateLimit(`rankings-amcs:${ip}`, { maxRequests: 60, windowMs: 60_000 });
  if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const parsed = Schema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid params' }, { status: 400 });

  const { period, sort, sortBy, fundType } = parsed.data;

  // Map period to DB period string (YTD is stored as 'YTD', others match)
  const periodMap: Record<string, string> = {
    '1M': '1M', '3M': '3M', '6M': '6M', '1Y': '1Y', '3Y': '3Y', 'YTD': 'YTD',
  };
  const dbPeriod = periodMap[period] ?? '1Y';

  try {
    const fundWhere: Record<string, unknown> = { fundStatus: { in: ['RG', 'SE'] } };
    if (fundType) fundWhere.fundType = fundType;

    // Fetch metrics for the period, then reduce to the latest row per default
    // fund class so AMC rankings cannot be inflated by stale backfill rows.
    const allMetrics = await prisma.fundMetric.findMany({
      where: {
        period: dbPeriod,
        returnPct: { not: null },
        fundClass: { isDefault: true },
        fund: fundWhere,
      },
      orderBy: [{ fundClassId: 'asc' }, { endDate: 'desc' }],
      select: {
        fundClassId: true,
        returnPct: true,
        sharpeRatio: true,
        annualizedVolatilityPct: true,
        navCount: true,
        endDate: true,
        fund: {
          select: {
            projId: true,
            projAbbrName: true,
            nameTh: true,
            amcId: true,
            amc: { select: { id: true, nameTh: true, nameEn: true } },
          },
        },
      },
    }) as MetricRow[];

    const latestByClass = new Map<number, MetricRow>();
    for (const metricRow of allMetrics) {
      if (!latestByClass.has(metricRow.fundClassId)) latestByClass.set(metricRow.fundClassId, metricRow);
    }

    const minNavCount = PERIOD_MIN_NAV_COUNT[dbPeriod] ?? 0;
    const metrics = Array.from(latestByClass.values())
      .filter((m) => (m.navCount ?? 0) >= minNavCount);

    // Group by AMC
    const amcMap = new Map<number, {
      amcId: number;
      amcName: string;
      amcNameEn: string | null;
      returns: number[];
      sharpes: number[];
      volatilities: number[];
      bestReturn: number | null;
      bestFundName: string | null;
      bestFundAbbr: string | null;
    }>();

    for (const m of metrics) {
      const { fund } = m;
      if (!fund.amcId || !fund.amc) continue;

      const ret = m.returnPct != null ? Number(m.returnPct) : null;
      const sharpe = m.sharpeRatio != null ? Number(m.sharpeRatio) : null;
      const vol = m.annualizedVolatilityPct != null ? Number(m.annualizedVolatilityPct) : null;

      if (!amcMap.has(fund.amcId)) {
        amcMap.set(fund.amcId, {
          amcId: fund.amcId,
          amcName: fund.amc.nameTh,
          amcNameEn: fund.amc.nameEn,
          returns: [],
          sharpes: [],
          volatilities: [],
          bestReturn: null,
          bestFundName: null,
          bestFundAbbr: null,
        });
      }

      const entry = amcMap.get(fund.amcId)!;
      if (ret != null) {
        entry.returns.push(ret);
        if (entry.bestReturn == null || ret > entry.bestReturn) {
          entry.bestReturn = ret;
          entry.bestFundName = fund.nameTh;
          entry.bestFundAbbr = fund.projAbbrName;
        }
      }
      if (sharpe != null) entry.sharpes.push(sharpe);
      if (vol != null) entry.volatilities.push(vol);
    }

    // Build result rows
    const rows = Array.from(amcMap.values())
      .filter((a) => a.returns.length >= 1) // only AMCs with at least 1 fund having data
      .map((a) => ({
        amcId: a.amcId,
        amcName: a.amcName,
        amcNameEn: a.amcNameEn,
        fundCount: a.returns.length,
        avgReturn: a.returns.length > 0 ? a.returns.reduce((s, v) => s + v, 0) / a.returns.length : null,
        medianReturn: median(a.returns),
        bestReturn: a.bestReturn,
        bestFundName: a.bestFundName,
        bestFundAbbr: a.bestFundAbbr,
        avgSharpe: a.sharpes.length > 0 ? a.sharpes.reduce((s, v) => s + v, 0) / a.sharpes.length : null,
        avgVolatility: a.volatilities.length > 0 ? a.volatilities.reduce((s, v) => s + v, 0) / a.volatilities.length : null,
      }));

    // Sort
    rows.sort((a, b) => {
      const valA = a[sortBy as keyof typeof a] as number | null;
      const valB = b[sortBy as keyof typeof b] as number | null;
      if (valA == null && valB == null) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;
      return sort === 'desc' ? valB - valA : valA - valB;
    });

    // Add rank
    const data = rows.map((r, i) => ({ rank: i + 1, ...r }));

    return NextResponse.json(
      { data, period, sortBy, sort, totalAmcs: data.length, totalFunds: metrics.length },
      { headers: publicCacheHeaders() }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
