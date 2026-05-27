// app/api/search/route.ts
// GET /api/search?q=TEXT
// Returns matching funds (code, name, AMC)

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { createErrorResponse, handleRouteError } from '@/lib/errors';
import { checkRateLimit } from '@/lib/rate-limit';
import { normalizeSearchQuery } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SearchSchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export async function GET(req: NextRequest) {
  // Rate limit: 60 searches per minute per IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
  const { allowed } = checkRateLimit(`search:${ip}`, { maxRequests: 60, windowMs: 60_000 });
  if (!allowed) {
    return createErrorResponse('SEC_RATE_LIMIT', 429);
  }

  // Validate query
  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = SearchSchema.safeParse(params);
  if (!parsed.success) {
    return createErrorResponse('VALIDATION_ERROR', 400, parsed.error.message);
  }

  const { q, limit } = parsed.data;
  const query = normalizeSearchQuery(q);

  try {
    const funds = await prisma.fund.findMany({
      where: {
        OR: [
          { projAbbrName: { contains: q, mode: 'insensitive' } },
          { nameTh: { contains: q, mode: 'insensitive' } },
          { nameEn: { contains: q, mode: 'insensitive' } },
          { projId: { contains: q, mode: 'insensitive' } },
          { amc: { nameTh: { contains: q, mode: 'insensitive' } } },
          { amc: { nameEn: { contains: q, mode: 'insensitive' } } },
        ],
      },
      take: limit,
      select: {
        id: true,
        projId: true,
        projAbbrName: true,
        nameTh: true,
        nameEn: true,
        fundStatus: true,
        fundType: true,
        riskLevel: true,
        amc: {
          select: { nameTh: true, nameEn: true },
        },
      },
      orderBy: [
        { fundStatus: 'asc' }, // active funds first
        { projAbbrName: 'asc' },
      ],
    });

    // Log search anonymously
    await prisma.searchLog.create({
      data: { query: query.slice(0, 200), resultCount: funds.length },
    }).catch(() => {}); // non-critical

    return NextResponse.json({ results: funds, total: funds.length });
  } catch (err) {
    return handleRouteError(err);
  }
}
