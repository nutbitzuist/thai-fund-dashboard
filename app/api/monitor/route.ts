// app/api/monitor/route.ts
// DB connectivity monitor — called by Vercel cron every day at 08:00 UTC.
// Sends a Telegram alert if the database is unreachable or data is stale.
//
// Requires env vars:
//   CRON_SECRET           — guards the endpoint
//   TELEGRAM_BOT_TOKEN    — bot token from @BotFather
//   TELEGRAM_CHAT_ID      — your personal chat ID

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_STALE_DAYS = 4;

async function sendTelegram(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
    });
  } catch {
    // Non-critical — don't let alerting break the monitor
  }
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
    const msg = String(err);
    await sendTelegram(
      `🚨 <b>Thai Fund Dashboard — DATABASE DOWN</b>\n` +
      `DB ไม่ตอบสนอง เวลา ${new Date().toISOString()}\n\n` +
      `<code>npx tsx scripts/recover-db.ts</code>`,
    );
    return NextResponse.json(
      { ok: false, error: msg, latencyMs: Date.now() - t0 },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
