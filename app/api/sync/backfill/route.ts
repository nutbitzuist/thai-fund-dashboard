// app/api/sync/backfill/route.ts
// Incremental NAV history backfill cron — runs daily at 05:00 UTC (12:00 BKK).
// Extends existing funds toward a 2-year NAV history, 5 funds × 30 days per run.
// Becomes a no-op once all eligible funds have 2 years of data.
// Protected by CRON_SECRET — same secret as the daily sync.

import { NextRequest, NextResponse } from 'next/server';
import { backfillNavHistory, calculateAllMetrics } from '@/lib/sync';
import { createErrorResponse } from '@/lib/errors';

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

  const startTime = Date.now();

  try {
    // Extend history: 2-year target, 30 days per fund, 5 funds per run
    const { inserted, fundsProcessed, updatedFundIds } = await backfillNavHistory(730, 30, 5);

    // Recalculate metrics for funds that received new historical data
    let metricsCalculated = 0;
    if (updatedFundIds.length > 0) {
      metricsCalculated = await calculateAllMetrics(updatedFundIds);
    }

    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      fundsProcessed,
      navInserted: inserted,
      metricsCalculated,
      durationMs,
      timestamp: new Date().toISOString(),
      note: fundsProcessed === 0
        ? 'All eligible funds have 2 years of NAV history — nothing to backfill'
        : `Extended history for ${fundsProcessed} fund(s) toward 2-year target`,
    });
  } catch (err) {
    console.error('[sync/backfill] Error:', err);
    return createErrorResponse('SYNC_FAILED', 500, String(err));
  }
}

// Vercel Cron sends GET on Hobby plan
export async function GET(req: NextRequest) {
  return POST(req);
}
