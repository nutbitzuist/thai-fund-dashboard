// GET /api/twin?projId=KFFLEX&period=1Y → find same-type funds with better return

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { handleRouteError } from '@/lib/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  projId: z.string().max(50),
  period: z.enum(['1M', '3M', '6M', '1Y']).optional().default('1Y'),
});

export async function GET(req: NextRequest) {
  const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid params' }, { status: 400 });

  const { projId, period } = parsed.data;

  try {
    // Look up the target fund and its metric for the requested period
    const targetMetric = await prisma.fundMetric.findFirst({
      where: {
        period,
        fundClass: { isDefault: true },
        fund: { projId },
      },
      select: {
        returnPct: true,
        fund: {
          select: {
            id: true,
            projId: true,
            projAbbrName: true,
            nameTh: true,
            fundType: true,
            riskLevel: true,
            amc: { select: { nameTh: true } },
          },
        },
      },
    });

    if (!targetMetric) {
      return NextResponse.json({ error: `ไม่พบข้อมูลกองทุนหรือผลตอบแทน ${period}` }, { status: 404 });
    }

    const { fund: target } = targetMetric;
    const targetReturn = targetMetric.returnPct != null ? Number(targetMetric.returnPct) : null;

    // Build risk filter: ±1 if riskLevel exists, else skip
    const riskFilter =
      target.riskLevel != null
        ? { gte: Math.max(1, target.riskLevel - 1), lte: Math.min(8, target.riskLevel + 1) }
        : undefined;

    const alternatives = await prisma.fundMetric.findMany({
      where: {
        period,
        returnPct: targetReturn != null ? { not: null, gt: targetReturn } : { not: null },
        fundClass: { isDefault: true },
        fund: {
          fundStatus: { in: ['RG', 'SE'] },
          fundType: target.fundType ?? undefined,
          projId: { not: projId },
          ...(riskFilter ? { riskLevel: riskFilter } : {}),
        },
      },
      orderBy: { returnPct: 'desc' },
      take: 8,
      select: {
        returnPct: true,
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
    });

    return NextResponse.json(
      {
        period,
        target: {
          projId: target.projId,
          projAbbrName: target.projAbbrName,
          nameTh: target.nameTh,
          fundType: target.fundType,
          riskLevel: target.riskLevel,
          returnPct: targetReturn,
          amcName: target.amc?.nameTh ?? null,
        },
        alternatives: alternatives.map((a) => ({
          projId: a.fund.projId,
          projAbbrName: a.fund.projAbbrName,
          nameTh: a.fund.nameTh,
          fundType: a.fund.fundType,
          riskLevel: a.fund.riskLevel,
          returnPct: a.returnPct != null ? Number(a.returnPct) : null,
          gainPct: a.returnPct != null && targetReturn != null ? Number(a.returnPct) - targetReturn : null,
          amcName: a.fund.amc?.nameTh ?? null,
        })),
      },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' } },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
