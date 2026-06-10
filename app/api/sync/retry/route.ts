// app/api/sync/retry/route.ts
// Second daily cron at 13:00 UTC (20:00 BKK) — fires 1.5h after primary sync.
// Idempotent: skips immediately if the primary sync already succeeded today.
// This means it's safe to call any number of times.

import { NextRequest, NextResponse } from 'next/server';
import { runDailySync } from '@/lib/sync';
import { getLastWeekday } from '@/lib/utils';
import { createErrorResponse } from '@/lib/errors';
import prisma from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authenticate(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided =
    req.headers.get('x-cron-secret') ??
    (req.headers.get('authorization')?.startsWith('Bearer ')
      ? req.headers.get('authorization')!.slice(7)
      : null);
  return provided === secret;
}

export async function POST(req: NextRequest) {
  if (!authenticate(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if the most recent NAV in the DB is already up to date.
  // "Up to date" = last weekday's data is present (handles weekends correctly).
  try {
    const lastWeekday = getLastWeekday();
    const lastWeekdayStr = lastWeekday.toISOString().split('T')[0];

    const lastNav = await prisma.navPrice.findFirst({
      orderBy: { navDate: 'desc' },
      select: { navDate: true },
    });

    const lastNavStr = lastNav
      ? new Date(lastNav.navDate).toISOString().split('T')[0]
      : null;

    if (lastNavStr && lastNavStr >= lastWeekdayStr) {
      return NextResponse.json({
        skipped: true,
        reason: 'Primary sync already succeeded — data is current',
        lastNavDate: lastNavStr,
      });
    }

    // Data is behind — run the sync
    const result = await runDailySync();
    return NextResponse.json({
      success: true,
      retriggered: true,
      lastNavDateBefore: lastNavStr,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[sync/retry] Fatal error:', err);
    return createErrorResponse('SYNC_FAILED', 500, String(err));
  }
}

// Vercel Cron sends GET on Hobby plan
export async function GET(req: NextRequest) {
  return POST(req);
}
