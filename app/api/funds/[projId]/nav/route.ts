// app/api/funds/[projId]/nav/route.ts
// GET /api/funds/[projId]/nav?period=1Y&classId=

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { createErrorResponse, handleRouteError } from '@/lib/errors';
import { getPeriodStartDate } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NavQuerySchema = z.object({
  period: z.enum(['1M', '3M', '6M', '1Y', '3Y', '5Y', 'MAX']).default('1Y'),
  classId: z.coerce.number().int().positive().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projId: string }> }
) {
  const { projId } = await params;
  const parsed = NavQuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams)
  );
  if (!parsed.success) return createErrorResponse('VALIDATION_ERROR', 400);

  const { period, classId } = parsed.data;

  try {
    const fund = await prisma.fund.findUnique({
      where: { projId },
      select: { id: true },
    });
    if (!fund) return createErrorResponse('FUND_NOT_FOUND', 404);

    // Determine class to use
    let fundClassId = classId;
    if (!fundClassId) {
      const defaultClass = await prisma.fundClass.findFirst({
        where: { fundId: fund.id, isDefault: true },
        select: { id: true },
      });
      fundClassId = defaultClass?.id;
    }

    if (!fundClassId) return createErrorResponse('NAV_NOT_FOUND', 404);

    // Calculate start date
    const endDate = new Date();
    const startDate =
      period === 'MAX'
        ? new Date('2000-01-01')
        : getPeriodStartDate(period, endDate);

    const navPrices = await prisma.navPrice.findMany({
      where: {
        fundClassId,
        navDate: { gte: startDate, lte: endDate },
      },
      orderBy: { navDate: 'asc' },
      select: {
        navDate: true,
        lastVal: true,
        buyPrice: true,
        sellPrice: true,
      },
    });

    if (!navPrices.length) return createErrorResponse('NAV_NOT_FOUND', 404);

    const data = navPrices.map((n) => ({
      date: n.navDate.toISOString().split('T')[0],
      nav: Number(n.lastVal),
      buyPrice: n.buyPrice != null ? Number(n.buyPrice) : null,
      sellPrice: n.sellPrice != null ? Number(n.sellPrice) : null,
    }));

    // Calculate normalized series
    const baseNav = data[0].nav;
    const normalized = data.map((d) => ({
      date: d.date,
      value: baseNav > 0 ? (d.nav / baseNav) * 100 : 100,
    }));

    return NextResponse.json({ data, normalized, period, fundClassId });
  } catch (err) {
    return handleRouteError(err);
  }
}
