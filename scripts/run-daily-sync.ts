// scripts/run-daily-sync.ts
// Long-running production data sync entrypoint for GitHub Actions.

import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();
if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/\\n$/, '').trim();

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

async function main() {
  const { default: prisma } = await import('@/lib/db');
  const { runDailySync } = await import('@/lib/sync');

  let result;
  try {
    result = await runDailySync();
  } catch (err) {
    await sendTelegram(
      `❌ <b>Thai Fund Dashboard — Sync FAILED</b>\n` +
      `Error: ${String(err)}\n` +
      `เวลา: ${new Date().toISOString()}`
    );
    console.error('[daily-sync] Failed:', err);
    process.exitCode = 1;
    await prisma.$disconnect();
    return;
  }

  console.log(JSON.stringify({
    success: result.errors.length === 0,
    ...result,
    timestamp: new Date().toISOString(),
  }, null, 2));

  const icon = result.errors.length === 0 ? '✅' : '⚠️';
  const lines = [
    `${icon} <b>Thai Fund Dashboard — Daily Sync</b>`,
    `NAV: +${result.navInserted} | Metrics: +${result.metricsCalculated}`,
    result.lastNavDate ? `ข้อมูล NAV ล่าสุด: ${result.lastNavDate}` : null,
    `ใช้เวลา: ${(result.durationMs / 1000).toFixed(0)}s`,
    result.errors.length ? `\nErrors:\n${result.errors.map((e) => `• ${e}`).join('\n')}` : null,
  ].filter(Boolean);
  await sendTelegram(lines.join('\n'));

  await prisma.$disconnect();

  // Don't red the whole run on a partial. If we made real progress (NAVs or metrics),
  // treat errors as a warning (the ⚠️ Telegram above already flags them) and let the
  // dedicated `audit-data-health --fail-on-stale` workflow step be the authority on whether
  // the data is actually too stale to pass. Only hard-fail when we errored AND got nowhere
  // (e.g. a SEC 429 that inserted nothing) — a clean run with nothing-new stays green.
  const madeProgress = result.navInserted > 0 || result.metricsCalculated > 0;
  if (result.errors.length > 0 && !madeProgress) {
    process.exitCode = 1;
  }
}

main().catch(async (err) => {
  await sendTelegram(
    `❌ <b>Thai Fund Dashboard — Sync crashed</b>\n${String(err)}`
  );
  console.error('[daily-sync] Unhandled crash:', err);
  process.exitCode = 1;
});
