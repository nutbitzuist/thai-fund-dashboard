// app/api/monitor/route.ts
// DB connectivity monitor — called by Vercel cron every 4 hours.
// If the database is unreachable it fires a webhook alert immediately so you
// know within hours, not days.
//
// Requires:
//   CRON_SECRET          — guards the endpoint (same secret as other crons)
//   SYNC_ALERT_WEBHOOK_URL — Discord/Slack webhook URL (optional but recommended)

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_STALE_DAYS = 4;

async function sendAlert(message: string): Promise<void> {
  const url = process.env.SYNC_ALERT_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    });
  } catch {
    // Non-critical
  }
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const t0 = Date.now();
  try {
    // Test 1: raw connectivity
    await prisma.$queryRaw`SELECT 1`;

    // Test 2: data freshness
    const latestNav = await prisma.navPrice.findFirst({
      orderBy: { navDate: 'desc' },
      select: { navDate: true },
    });
    const daysSince = latestNav
      ? Math.floor((Date.now() - new Date(latestNav.navDate).getTime()) / 86400000)
      : 999;

    if (daysSince > MAX_STALE_DAYS) {
      await sendAlert(
        `⚠️ Thai Fund Dashboard — stale data\nLast NAV: ${latestNav?.navDate?.toISOString().split('T')[0] ?? 'never'} (${daysSince} days ago). Daily sync may have stopped.`,
      );
    }

    return NextResponse.json(
      { ok: true, latencyMs: Date.now() - t0, daysSinceLastNav: daysSince },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    const msg = String(err);
    await sendAlert(
      `🚨 Thai Fund Dashboard — DATABASE DOWN\nDB unreachable as of ${new Date().toISOString()}.\nError: ${msg}\n\nRun: npx tsx scripts/recover-db.ts`,
    );
    return NextResponse.json(
      { ok: false, error: msg, latencyMs: Date.now() - t0 },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
