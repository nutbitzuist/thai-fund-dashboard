// app/api/movers/route.ts
// GET /api/movers?fundType=&limit=10
// Returns today's biggest gainers and losers based on daily NAV change

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { handleRouteError } from '@/lib/errors';
import { checkRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MoversSchema = z.object({
  fundType: z.string().max(50).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

interface NavRow { fundId: number; lastVal: unknown }
interface FundRow {
  fundId: number;
  lastVal: unknown;
  fund: {
    projId: string;
    projAbbrName: string | null;
    nameTh: string;
    fundType: string | null;
    riskLevel: number | null;
    amc: { nameTh: string } | null;
  };
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
  const { allowed } = checkRateLimit(`movers:${ip}`, { maxRequests: 60, windowMs: 60_000 });
  if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const parsed = MoversSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid params' }, { status: 400 });

  const { fundType, limit } = parsed.data;

  try {
    // Get the two most recent NAV dates
    const latestDateRow = await prisma.navPrice.findFirst({
      orderBy: { navDate: 'desc' },
      select: { navDate: true },
    });
    if (!latestDateRow) return NextResponse.json({ gainers: [], losers: [], date: null });

    const latestDate = latestDateRow.navDate;

    const prevDateRow = await prisma.navPrice.findFirst({
      where: { navDate: { lt: latestDate } },
      orderBy: { navDate: 'desc' },
      select: { navDate: true },
    });
    if (!prevDateRow) return NextResponse.json({ gainers: [], losers: [], date: latestDate });

    const prevDate = prevDateRow.navDate;

    const fundWhere = {
      fundStatus: { in: ['RG', 'SE'] },
      ...(fundType && { fundType }),
    };

    // Fetch today's and previous day's NAVs (default class only, active funds only)
    const [todayNavs, prevNavs] = await Promise.all([
      prisma.navPrice.findMany({
        where: {
          navDate: latestDate,
          fundClass: { isDefault: true },
          fund: fundWhere,
        },
        select: {
          fundId: true,
          lastVal: true,
          fund: {
            select: {
              projId: true,
              projAbbrName: true,
              nameTh: true,
              fundType: true,
              riskLevel: true,
              amc: { select: { nameTh: true } },
            },
          },
        },
      }),
      prisma.navPrice.findMany({
        where: {
          navDate: prevDate,
          fundClass: { isDefault: true },
        },
        select: { fundId: true, lastVal: true },
      }),
    ]);

    // Build prev NAV lookup map
    const prevMap = new Map((prevNavs as NavRow[]).map((n) => [n.fundId, Number(n.lastVal)]));

    // Compute daily change for each fund
    const movers = (todayNavs as FundRow[])
      .map((n) => {
        const prevNav = prevMap.get(n.fundId);
        const todayNav = Number(n.lastVal);
        const changePct =
          prevNav && prevNav > 0 && todayNav > 0
            ? ((todayNav - prevNav) / prevNav) * 100
            : null;
        return {
          projId: n.fund.projId,
          projAbbrName: n.fund.projAbbrName,
          nameTh: n.fund.nameTh,
          fundType: n.fund.fundType,
          riskLevel: n.fund.riskLevel,
          amc: n.fund.amc,
          returnPct: changePct,
          todayNav,
          prevNav: prevNav ?? null,
        };
      })
      .filter((m) => m.returnPct != null);

    // Sort and slice gainers / losers
    const sorted = [...movers].sort((a, b) => (b.returnPct ?? 0) - (a.returnPct ?? 0));
    const gainers = sorted.filter((m) => (m.returnPct ?? 0) > 0).slice(0, limit).map((m, i) => ({ rank: i + 1, ...m }));
    const losers = sorted.filter((m) => (m.returnPct ?? 0) < 0).slice(-limit).reverse().map((m, i) => ({ rank: i + 1, ...m }));

    return NextResponse.json(
      {
        gainers,
        losers,
        date: latestDate.toISOString().split('T')[0],
        prevDate: prevDate.toISOString().split('T')[0],
        totalFunds: movers.length,
      },
      { headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' } },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
