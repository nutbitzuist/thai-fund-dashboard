// app/api/funds/route.ts
// GET /api/funds — paginated fund list with filters and sorting

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import { createErrorResponse, handleRouteError } from '@/lib/errors';
import { checkRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FundListSchema = z.object({
  q: z.string().max(100).optional(),
  amcId: z.coerce.number().int().positive().optional(),
  fundType: z.string().max(50).optional(),
  riskLevel: z.coerce.number().int().min(1).max(8).optional(),
  dividendPolicy: z.string().max(20).optional(),
  fundStatus: z.string().max(10).optional(),
  sortBy: z
    .enum(['return1Y', 'return3Y', 'volatility', 'maxDrawdown', 'sharpe', 'latestNav', 'nameTh', 'riskLevel'])
    .optional()
    .default('nameTh'),
  sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

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

  // Build where clause
  const where: Prisma.FundWhereInput = {};
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
  if (fundStatus) where.fundStatus = fundStatus;

  try {
    const [total, funds] = await Promise.all([
      prisma.fund.count({ where }),
      prisma.fund.findMany({
        where,
        skip,
        take: limit,
        orderBy: buildOrderBy(sortBy, sortDir),
        select: {
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
          fundMetrics: {
            where: { period: { in: ['1Y', '3Y'] } },
            orderBy: { calculatedAt: 'desc' },
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
          navPrices: {
            orderBy: { navDate: 'desc' },
            take: 2,
            select: { navDate: true, lastVal: true },
          },
        },
      }),
    ]);

    // Flatten metrics into summary
    const fundList = funds.map((f) => {
      const m1Y = f.fundMetrics.find((m) => m.period === '1Y');
      const m3Y = f.fundMetrics.find((m) => m.period === '3Y');
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
        return1Y: m1Y?.returnPct != null ? Number(m1Y.returnPct) : null,
        return3Y: m3Y?.returnPct != null ? Number(m3Y.returnPct) : null,
        volatility1Y: m1Y?.annualizedVolatilityPct != null ? Number(m1Y.annualizedVolatilityPct) : null,
        maxDrawdown1Y: m1Y?.maxDrawdownPct != null ? Number(m1Y.maxDrawdownPct) : null,
        sharpe1Y: m1Y?.sharpeRatio != null ? Number(m1Y.sharpeRatio) : null,
      };
    });

    return NextResponse.json({
      data: fundList,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

function buildOrderBy(sortBy: string, sortDir: 'asc' | 'desc'): Prisma.FundOrderByWithRelationInput {
  switch (sortBy) {
    case 'nameTh':
      return { nameTh: sortDir };
    case 'riskLevel':
      return { riskLevel: sortDir };
    default:
      return { nameTh: 'asc' };
  }
}
