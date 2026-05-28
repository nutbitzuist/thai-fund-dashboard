// GET /api/heatmap          → category summaries
// GET /api/heatmap?type=EQ  → individual fund cells for a type

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { handleRouteError } from '@/lib/errors';
import { FUND_TYPE_LABELS } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ACTIVE_TYPES = ['EQ', 'FIF', 'FI', 'MM', 'BA', 'RE', 'CM', 'AI', 'RMF', 'SSF'];

const QuerySchema = z.object({
  type: z.string().max(20).optional(),
});

interface NavRow { fundId: number; lastVal: unknown }
interface FundNavRow {
  fundId: number;
  lastVal: unknown;
  fund: { projId: string; projAbbrName: string | null; nameTh: string; fundType: string | null };
}

export async function GET(req: NextRequest) {
  const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid params' }, { status: 400 });

  const { type } = parsed.data;

  try {
    // Get 2 most recent NAV dates
    const recentDates = await prisma.$queryRaw<{ navDate: Date }[]>`
      SELECT DISTINCT "navDate" FROM nav_price ORDER BY "navDate" DESC LIMIT 2
    `;
    if (recentDates.length < 2) {
      return NextResponse.json({ categories: [], funds: [], date: null, prevDate: null });
    }

    const [latestDate, prevDate] = [recentDates[0].navDate, recentDates[1].navDate];

    const fundWhere: Record<string, unknown> = {
      fundStatus: { in: ['RG', 'SE'] },
      ...(type ? { fundType: type } : {}),
    };

    // Fetch today's NAVs (with fund info) + prev NAVs (just values)
    const [todayNavs, prevNavs] = await Promise.all([
      prisma.navPrice.findMany({
        where: { navDate: latestDate, fundClass: { isDefault: true }, fund: fundWhere },
        select: {
          fundId: true,
          lastVal: true,
          fund: { select: { projId: true, projAbbrName: true, nameTh: true, fundType: true } },
        },
      }),
      prisma.navPrice.findMany({
        where: { navDate: prevDate, fundClass: { isDefault: true } },
        select: { fundId: true, lastVal: true },
      }),
    ]);

    const prevMap = new Map((prevNavs as NavRow[]).map((n) => [n.fundId, Number(n.lastVal)]));

    // Compute daily change per fund
    const allFunds = (todayNavs as FundNavRow[]).map((n) => {
      const prevNav = prevMap.get(n.fundId);
      const todayNav = Number(n.lastVal);
      const dailyChange =
        prevNav && prevNav > 0 && todayNav > 0
          ? ((todayNav - prevNav) / prevNav) * 100
          : null;
      return {
        projId: n.fund.projId,
        projAbbrName: n.fund.projAbbrName,
        nameTh: n.fund.nameTh,
        fundType: n.fund.fundType,
        dailyChange,
      };
    });

    const dateStr = latestDate.toISOString().split('T')[0];
    const prevDateStr = prevDate.toISOString().split('T')[0];

    // Mode B: return individual fund cells for a specific type
    if (type) {
      const funds = allFunds
        .filter((f) => f.fundType === type)
        .sort((a, b) => (b.dailyChange ?? -99) - (a.dailyChange ?? -99));
      return NextResponse.json(
        { type, date: dateStr, prevDate: prevDateStr, funds },
        { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
      );
    }

    // Mode A: return category summaries
    const categoryMap = new Map<string, typeof allFunds>();
    for (const t of ACTIVE_TYPES) categoryMap.set(t, []);
    for (const f of allFunds) {
      const t = f.fundType ?? 'OTHER';
      if (categoryMap.has(t)) categoryMap.get(t)!.push(f);
    }

    const categories = ACTIVE_TYPES.map((t) => {
      const funds = categoryMap.get(t) ?? [];
      const withData = funds.filter((f) => f.dailyChange !== null);
      const avg = withData.length > 0
        ? withData.reduce((s, f) => s + f.dailyChange!, 0) / withData.length
        : null;
      const sorted = [...withData].sort((a, b) => (b.dailyChange ?? 0) - (a.dailyChange ?? 0));
      return {
        type: t,
        label: FUND_TYPE_LABELS[t] ?? t,
        fundCount: funds.length,
        withDataCount: withData.length,
        avgChange: avg,
        best: sorted[0] ? { projAbbrName: sorted[0].projAbbrName ?? sorted[0].projId, dailyChange: sorted[0].dailyChange! } : null,
        worst: sorted.at(-1) ? { projAbbrName: sorted.at(-1)!.projAbbrName ?? sorted.at(-1)!.projId, dailyChange: sorted.at(-1)!.dailyChange! } : null,
      };
    }).filter((c) => c.fundCount > 0);

    return NextResponse.json(
      { date: dateStr, prevDate: prevDateStr, categories },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
