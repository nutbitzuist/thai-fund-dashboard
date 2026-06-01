// app/api/monitor/route.ts
// DB connectivity monitor — called by Vercel cron daily at 08:00 UTC.
//
// On DB failure:
//   1. Sends a Telegram alert
//   2. Triggers the db-recovery GitHub Actions workflow automatically
//
// Required env vars:
//   CRON_SECRET           — guards the endpoint
//   TELEGRAM_BOT_TOKEN    — bot token from @BotFather
//   TELEGRAM_CHAT_ID      — your personal chat ID
//   GITHUB_DISPATCH_TOKEN — GitHub PAT with repo scope (to trigger workflow)
//   GITHUB_REPO           — e.g. nutbitzuist/thai-fund-dashboard

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_STALE_DAYS = 4;
const GITHUB_REPO = process.env.GITHUB_REPO ?? 'nutbitzuist/thai-fund-dashboard';

async function sendTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
  } catch { /* non-critical */ }
}

async function triggerRecovery(): Promise<boolean> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) return false;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github+json',
        },
        body: JSON.stringify({ event_type: 'db-recovery' }),
      },
    );
    return res.status === 204;
  } catch { return false; }
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const t0 = Date.now();
  try {
    // Test 1: raw DB connectivity
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
      await sendTelegram(
        `⚠️ <b>Thai Fund Dashboard — ข้อมูลเก่า</b>\n` +
        `NAV ล่าสุด: ${latestNav?.navDate?.toISOString().split('T')[0] ?? 'ไม่มีข้อมูล'} (${daysSince} วันที่แล้ว)\n` +
        `ระบบ sync อาจหยุดทำงาน`,
      );
    }

    return NextResponse.json(
      { ok: true, latencyMs: Date.now() - t0, daysSinceLastNav: daysSince },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    // DB is down — alert + auto-recover
    const triggered = await triggerRecovery();
    await sendTelegram(
      `🚨 <b>Thai Fund Dashboard — DATABASE DOWN</b>\n` +
      `DB ไม่ตอบสนอง เวลา ${new Date().toISOString()}\n\n` +
      (triggered
        ? '🤖 Auto-recovery workflow triggered — รอประมาณ 25 นาที'
        : '⚠️ Auto-recovery ไม่ได้ตั้งค่า — รัน <code>npx tsx scripts/recover-db.ts</code>'),
    );
    return NextResponse.json(
      { ok: false, error: String(err), latencyMs: Date.now() - t0, recoveryTriggered: triggered },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
