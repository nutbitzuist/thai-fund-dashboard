// app/api/sync/daily/route.ts
// POST /api/sync/daily — Vercel Cron trigger (11:30 UTC = 18:30 TH)
// Protected by CRON_SECRET header

import { NextRequest, NextResponse } from 'next/server';
import { runDailySync } from '@/lib/sync';
import { createErrorResponse } from '@/lib/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel Hobby hard limit is 60s; Pro allows 300s

export async function POST(req: NextRequest) {
  // Verify CRON_SECRET — accept from header or Authorization Bearer
  const authHeader = req.headers.get('authorization');
  const cronHeader = req.headers.get('x-cron-secret');
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  const providedSecret =
    cronHeader ??
    (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);

  if (providedSecret !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runDailySync();
    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[sync/daily] Fatal error:', err);
    return createErrorResponse('SYNC_FAILED', 500, String(err));
  }
}

// Vercel Cron sends GET for free hobby cron (not POST) — support both
export async function GET(req: NextRequest) {
  return POST(req);
}
