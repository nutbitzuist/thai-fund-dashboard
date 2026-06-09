// scripts/check-data-quality.ts
// Data completeness check — runs after every daily sync.
// Queries DB for fund/metric coverage, alerts Telegram on issues,
// and exits 1 if auto-repair is needed (so the workflow can respond).

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
  const { assessDataQuality, formatQualityAlert } = await import('@/lib/data-quality');

  const fiveDaysAgo = new Date(Date.now() - 5 * 86_400_000);

  const [
    activeFunds,
    fundsWithAnyNav,
    fundsWithRecentNav,
    fundsWithAnyMetric,
    fundsWithNoDefaultClass,
  ] = await Promise.all([
    prisma.fund.count({ where: { fundStatus: { in: ['RG', 'SE'] } } }),
    prisma.fund.count({
      where: { fundStatus: { in: ['RG', 'SE'] }, navPrices: { some: {} } },
    }),
    prisma.fund.count({
      where: {
        fundStatus: { in: ['RG', 'SE'] },
        navPrices: { some: { navDate: { gte: fiveDaysAgo } } },
      },
    }),
    prisma.fund.count({
      where: { fundStatus: { in: ['RG', 'SE'] }, fundMetrics: { some: {} } },
    }),
    // Funds with no default fund class (bootstrapping backlog)
    prisma.fund.count({
      where: {
        fundStatus: { in: ['RG', 'SE'] },
        fundClasses: { none: { isDefault: true } },
      },
    }),
  ]);

  // return1Y coverage: funds that appear in the 1Y return sort
  // Uses the same logic as /api/funds PATH A: latest metric row per default class,
  // period = '1Y', returnPct IS NOT NULL.
  const [return1YRow] = await prisma.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(DISTINCT fm."fundId")::int AS count
    FROM fund_metric fm
    JOIN fund_class fc ON fc.id = fm."fundClassId" AND fc."isDefault" = TRUE
    JOIN fund f ON f.id = fm."fundId" AND f."fundStatus" IN ('RG', 'SE')
    WHERE fm.period = '1Y'
      AND fm."returnPct" IS NOT NULL
  `;

  const [return3MRow] = await prisma.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(DISTINCT fm."fundId")::int AS count
    FROM fund_metric fm
    JOIN fund_class fc ON fc.id = fm."fundClassId" AND fc."isDefault" = TRUE
    JOIN fund f ON f.id = fm."fundId" AND f."fundStatus" IN ('RG', 'SE')
    WHERE fm.period = '3M'
      AND fm."returnPct" IS NOT NULL
  `;

  const input = {
    activeFunds,
    fundsWithAnyNav,
    fundsWithRecentNav,
    fundsWithAnyMetric,
    fundsWithReturn1Y: return1YRow?.count ?? 0,
    fundsWithReturn3M: return3MRow?.count ?? 0,
    fundsWithNoDefaultClass,
  };

  const assessment = assessDataQuality(input);

  const report = {
    ...input,
    return1YCoverage: activeFunds > 0 ? input.fundsWithReturn1Y / activeFunds : 0,
    return3MCoverage: activeFunds > 0 ? input.fundsWithReturn3M / activeFunds : 0,
    severity: assessment.severity,
    messages: assessment.messages,
    autoRepairNeeded: assessment.autoRepairNeeded,
    checkedAt: new Date().toISOString(),
  };

  console.log(JSON.stringify(report, null, 2));

  if (assessment.alertNeeded) {
    await sendTelegram(formatQualityAlert(input, assessment));
  }

  await prisma.$disconnect();

  // Exit 1 signals the GitHub Actions workflow to trigger metric-repair
  if (assessment.autoRepairNeeded) {
    console.error('[data-quality] Auto-repair needed — exiting 1');
    process.exitCode = 1;
  }
}

main().catch(async (err) => {
  await sendTelegram(
    `❌ <b>Thai Fund Dashboard — Data quality check crashed</b>\n${String(err)}`
  );
  console.error('[data-quality] Crash:', err);
  process.exitCode = 1;
});
