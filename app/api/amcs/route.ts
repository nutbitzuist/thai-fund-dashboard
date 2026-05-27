// app/api/amcs/route.ts
// GET /api/amcs — list all AMCs (for dropdown filters)

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { handleRouteError } from '@/lib/errors';
import { checkRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
// Cache for 1 hour — AMC list rarely changes
export const revalidate = 3600;

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
  const { allowed } = checkRateLimit(`amcs:${ip}`, { maxRequests: 60, windowMs: 60_000 });
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const amcs = await prisma.amc.findMany({
      orderBy: { nameTh: 'asc' },
      select: { id: true, uniqueId: true, nameTh: true, nameEn: true },
    });
    return NextResponse.json({ data: amcs });
  } catch (err) {
    return handleRouteError(err);
  }
}
