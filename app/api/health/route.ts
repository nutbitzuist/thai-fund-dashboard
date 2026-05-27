// app/api/health/route.ts
// GET /api/health — system health check

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const startMs = Date.now();
  let dbOk = false;
  let lastSync: Date | null = null;
  let fundCount = 0;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;

    const [syncLog, count] = await Promise.all([
      prisma.syncLog.findFirst({
        where: { status: { in: ['SUCCESS', 'PARTIAL'] } },
        orderBy: { finishedAt: 'desc' },
        select: { finishedAt: true },
      }),
      prisma.fund.count(),
    ]);

    lastSync = syncLog?.finishedAt ?? null;
    fundCount = count;
  } catch {
    dbOk = false;
  }

  const latencyMs = Date.now() - startMs;

  return NextResponse.json({
    status: dbOk ? 'ok' : 'degraded',
    db: dbOk,
    latencyMs,
    fundCount,
    lastSync: lastSync?.toISOString() ?? null,
    timestamp: new Date().toISOString(),
  });
}
