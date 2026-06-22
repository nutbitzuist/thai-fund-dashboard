// app/api/health/route.ts
// GET /api/health — data freshness check for external uptime monitors.
//
// Returns HTTP 200 when healthy, HTTP 503 when data is stale.
// Point any free monitor (UptimeRobot, BetterUptime, etc.) at this URL
// and alert on non-200 to know when the daily sync has broken.
//
// Stale threshold: 3 business days (avoids false red on weekends while still
// failing if weekday NAV ingestion is genuinely stuck).

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STALE_THRESHOLD_BUSINESS_DAYS = 3;

function toDateOnly(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function businessDaysSince(lastDate: Date | null, now = new Date()): number {
  if (!lastDate) return 999;
  const cursor = toDateOnly(lastDate);
  const end = toDateOnly(now);
  let days = 0;

  while (cursor < end) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) days += 1;
  }

  return days;
}

export async function GET() {
  try {
    const [lastSync, lastNav, fundCount, navCount] = await Promise.all([
      prisma.syncLog.findFirst({
        where: { status: { in: ['SUCCESS', 'PARTIAL'] } },
        orderBy: { finishedAt: 'desc' },
        select: { status: true, finishedAt: true, message: true, recordsProcessed: true },
      }),
      prisma.navPrice.findFirst({
        orderBy: { navDate: 'desc' },
        select: { navDate: true },
      }),
      prisma.fund.count({ where: { fundStatus: { in: ['RG', 'SE'] } } }),
      prisma.navPrice.count(),
    ]);

    const now = new Date();
    const lastNavDate = lastNav ? new Date(lastNav.navDate) : null;
    const daysSinceNav = lastNavDate
      ? Math.floor((now.getTime() - lastNavDate.getTime()) / 86400000)
      : 999;
    const businessDaysSinceNav = businessDaysSince(lastNavDate, now);

    const healthy = businessDaysSinceNav <= STALE_THRESHOLD_BUSINESS_DAYS;

    const body = {
      healthy,
      status: healthy ? 'ok' : 'stale',
      lastNavDate: lastNavDate?.toISOString().split('T')[0] ?? null,
      daysSinceLastNav: daysSinceNav,
      businessDaysSinceLastNav: businessDaysSinceNav,
      activeFunds: fundCount,
      totalNavRecords: navCount,
      lastSync: lastSync
        ? {
            status: lastSync.status,
            finishedAt: lastSync.finishedAt?.toISOString() ?? null,
            recordsProcessed: lastSync.recordsProcessed,
            message: lastSync.message,
          }
        : null,
      checkedAt: now.toISOString(),
    };

    return NextResponse.json(body, {
      status: healthy ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    return NextResponse.json(
      { healthy: false, status: 'error', error: String(err), checkedAt: new Date().toISOString() },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
