// app/api/compare/route.ts
// GET /api/compare?funds=CODE1,CODE2,CODE3&period=1Y
//
// Returns fund performance, metrics, NAV series, AUM history,
// buy/sell transaction prices, and fund meta for side-by-side comparison.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { createErrorResponse, handleRouteError } from '@/lib/errors';
import { checkRateLimit } from '@/lib/rate-limit';
import { getPeriodStartDate } from '@/lib/utils';
import { publicCacheHeaders } from '@/lib/cache-headers';

interface FundWithRelations {
  id: number;
  projId: string;
  projAbbrName: string | null;
  nameTh: string;
  nameEn: string | null;
  riskLevel: number | null;
  fundType: string | null;
  dividendPolicy: string | null;
  regisDate: Date | null;
  amc: { nameTh: string; nameEn: string | null } | null;
  fundClasses: Array<{ id: number; classAbbrName: string; isDefault: boolean }>;
  fundMetrics: Array<{
    period: string;
    returnPct: unknown;
    annualizedVolatilityPct: unknown;
    maxDrawdownPct: unknown;
    sharpeRatio: unknown;
    navCount: number | null;
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
    .slice(0, 5);

  if (!projIds.length) return createErrorResponse('VALIDATION_ERROR', 400);

  const { period } = parsed.data;

  try {
    const funds = await prisma.fund.findMany({
      where: { projId: { in: projIds } },
      include: {
        amc: { select: { nameTh: true, nameEn: true } },
        fundClasses: { where: { isDefault: true } },
        fundMetrics: {
          where: { period: { in: ['1M', '3M', '6M', '1Y', '3Y', '5Y'] } },
          orderBy: { calculatedAt: 'desc' },
          take: 12,
        },
      },
    });

    const endDate = new Date();
    const startDate = period === 'MAX' ? new Date('2000-01-01') : getPeriodStartDate(period, endDate);

    // Reference dates for AUM history
    const now = new Date();
    const date3MAgo = new Date(now); date3MAgo.setMonth(date3MAgo.getMonth() - 3);
    const date1YAgo = new Date(now); date1YAgo.setFullYear(date1YAgo.getFullYear() - 1);

    // NAV chart data + AUM snapshot at 3 reference points per fund
    const navDataMap: Record<string, Array<{ date: string; nav: number; normalized: number }>> = {};
    const aumSnapshots: Record<string, {
      current: number | null;
      date3MAgo: number | null;
      date1YAgo: number | null;
      latestNavDate: string | null;
      latestNav: number | null;
      buyPrice: number | null;
      sellPrice: number | null;
    }> = {};

    // Collect funds that have a default class, then fire ALL queries in parallel
    const fundEntries = funds
      .map((fund) => ({ fund, defaultClass: fund.fundClasses[0] }))
      .filter((e): e is typeof e & { defaultClass: NonNullable<typeof e.defaultClass> } => !!e.defaultClass);

    const [navResults, latestResults, snap3MResults, snap1YResults] = await Promise.all([
      Promise.all(fundEntries.map(({ defaultClass }) =>
        prisma.navPrice.findMany({
          where: { fundClassId: defaultClass.id, navDate: { gte: startDate, lte: endDate } },
          orderBy: { navDate: 'asc' },
          select: { navDate: true, lastVal: true },
        })
      )),
      Promise.all(fundEntries.map(({ defaultClass }) =>
        prisma.navPrice.findFirst({
          where: { fundClassId: defaultClass.id },
          orderBy: { navDate: 'desc' },
          select: { lastVal: true, netAsset: true, buyPrice: true, sellPrice: true, navDate: true },
        })
      )),
      Promise.all(fundEntries.map(({ defaultClass }) =>
        prisma.navPrice.findFirst({
          where: { fundClassId: defaultClass.id, navDate: { lte: date3MAgo } },
          orderBy: { navDate: 'desc' },
          select: { netAsset: true, navDate: true },
        })
      )),
      Promise.all(fundEntries.map(({ defaultClass }) =>
        prisma.navPrice.findFirst({
          where: { fundClassId: defaultClass.id, navDate: { lte: date1YAgo } },
          orderBy: { navDate: 'desc' },
          select: { netAsset: true, navDate: true },
        })
      )),
    ]);

    for (let i = 0; i < fundEntries.length; i++) {
      const { fund } = fundEntries[i];
      const navs = navResults[i];
      const latest = latestResults[i];
      const snap3M = snap3MResults[i];
      const snap1Y = snap1YResults[i];

      if (navs.length) {
        const baseNav = Number(navs[0].lastVal);
        navDataMap[fund.projId] = navs.map((n) => ({
          date: n.navDate.toISOString().split('T')[0],
          nav: Number(n.lastVal),
          normalized: baseNav > 0 ? (Number(n.lastVal) / baseNav) * 100 : 100,
        }));
      }

      aumSnapshots[fund.projId] = {
        current: latest?.netAsset != null ? Number(latest.netAsset) : null,
        date3MAgo: snap3M?.netAsset != null ? Number(snap3M.netAsset) : null,
        date1YAgo: snap1Y?.netAsset != null ? Number(snap1Y.netAsset) : null,
        latestNavDate: latest?.navDate.toISOString().split('T')[0] ?? null,
        latestNav: latest?.lastVal != null ? Number(latest.lastVal) : null,
        buyPrice: latest?.buyPrice != null ? Number(latest.buyPrice) : null,
        sellPrice: latest?.sellPrice != null ? Number(latest.sellPrice) : null,
      };
    }

    // Build fund summaries with metrics + AUM + fee data
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
          navCount: m.navCount,
        };
      }

      const snap = aumSnapshots[fund.projId];
      const nav = snap?.latestNav;
      const buy = snap?.buyPrice;
      const sell = snap?.sellPrice;

      // Transaction cost from buy/sell spread:
      // front-end load = (buyPrice - NAV) / NAV × 100
      // back-end load  = (NAV - sellPrice) / NAV × 100
      // round-trip     = (buyPrice - sellPrice) / NAV × 100
      const frontEndLoadPct =
        buy != null && nav != null && nav > 0 && buy > nav
          ? ((buy - nav) / nav) * 100
          : 0;
      const backEndLoadPct =
        sell != null && nav != null && nav > 0 && sell < nav
          ? ((nav - sell) / nav) * 100
          : 0;
      const roundTripCostPct =
        buy != null && sell != null && nav != null && nav > 0
          ? ((buy - sell) / nav) * 100
          : null;

      // Fund age in years
      const ageYears = fund.regisDate
        ? Math.floor((now.getTime() - new Date(fund.regisDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
        : null;

      return {
        projId: fund.projId,
        projAbbrName: fund.projAbbrName,
        nameTh: fund.nameTh,
        nameEn: fund.nameEn,
        riskLevel: fund.riskLevel,
        fundType: fund.fundType,
        dividendPolicy: fund.dividendPolicy,
        regisDate: fund.regisDate?.toISOString().split('T')[0] ?? null,
        ageYears,
        amc: fund.amc,
        metrics: metricsByPeriod,
        // AUM snapshots
        aum: snap?.current ?? null,
        aum3MAgo: snap?.date3MAgo ?? null,
        aum1YAgo: snap?.date1YAgo ?? null,
        latestNav: snap?.latestNav ?? null,
        latestNavDate: snap?.latestNavDate ?? null,
        buyPrice: snap?.buyPrice ?? null,
        sellPrice: snap?.sellPrice ?? null,
        // Derived fee fields
        frontEndLoadPct,
        backEndLoadPct,
        roundTripCostPct,
      };
    });

    // Preserve original query order
    const ordered = projIds
      .map((id) => fundSummaries.find((f) => f.projId === id))
      .filter(Boolean);

    return NextResponse.json(
      { funds: ordered, navData: navDataMap, period },
      { headers: publicCacheHeaders() },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
