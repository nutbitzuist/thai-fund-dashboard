/**
 * scripts/initial-sync.ts
 * Run this locally to seed the database for the first time.
 * Connects directly to Railway and runs in resumable phases.
 *
 * Usage:
 *   DATABASE_URL="..." SEC_API_KEY="..." SEC_NAV_API_KEY="..." npx tsx scripts/initial-sync.ts
 */

import { existsSync } from 'fs';
import { resolve } from 'path';
import { config as dotenvConfig } from 'dotenv';

// Load .env.local if it exists
const envFile = resolve(process.cwd(), '.env.local');
if (existsSync(envFile)) {
  dotenvConfig({ path: envFile });
}

function checkEnv() {
  const missing: string[] = [];
  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
  if (!process.env.SEC_API_KEY) missing.push('SEC_API_KEY');
  if (!process.env.SEC_NAV_API_KEY) missing.push('SEC_NAV_API_KEY');
  if (missing.length) {
    console.error('❌  Missing env vars:', missing.join(', '));
    process.exit(1);
  }
}

function fmt(n: number) { return n.toLocaleString(); }
function elapsed(start: number) { return ((Date.now() - start) / 1000).toFixed(1) + 's'; }

async function main() {
  checkEnv();

  // Dynamic imports AFTER env is confirmed
  const { syncAmcs, syncFunds, syncNavForFund, calculateMetricsForFund } = await import('../lib/sync');
  const { default: prisma } = await import('../lib/db');
  const { getLastWeekday, chunkArray, sleep } = await import('../lib/utils');

  // 90 days covers 1M + 3M metrics. Daily cron fills in the rest.
  // SEC API lags ~4 weeks, so we fetch up to today and let 204s be skipped.
  // RG (2,060 active funds) not all 12K — filter is now correct in sync.ts.
  const DAYS_HISTORY = 90;
  const BATCH_SIZE = 20;         // higher parallelism for local runs
  const BATCH_DELAY = 1500;      // ms between batches

  const totalStart = Date.now();

  // ── Phase 1: AMCs ────────────────────────────────────────────────────────
  console.log('\n━━━ Phase 1: Sync AMCs ━━━');
  const p1Start = Date.now();
  try {
    const count = await syncAmcs();
    console.log(`✅  ${fmt(count)} AMCs synced  (${elapsed(p1Start)})`);
  } catch (e) {
    console.error('❌  AMC sync failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  }

  // ── Phase 2: Funds ───────────────────────────────────────────────────────
  console.log('\n━━━ Phase 2: Sync Funds ━━━');
  const p2Start = Date.now();
  try {
    const count = await syncFunds();
    console.log(`✅  ${fmt(count)} funds synced  (${elapsed(p2Start)})`);
  } catch (e) {
    console.error('❌  Fund sync failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  }

  // ── Phase 3: NAV History ─────────────────────────────────────────────────
  console.log(`\n━━━ Phase 3: NAV History (last ${DAYS_HISTORY} days) ━━━`);
  const p3Start = Date.now();

  const endDate = getLastWeekday();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - DAYS_HISTORY);

  console.log(`  Range: ${startDate.toISOString().split('T')[0]} → ${endDate.toISOString().split('T')[0]}`);

  // Only RG (registered/active) and SE funds — not LI/EX/CA
  const funds = await prisma.fund.findMany({
    where: { fundStatus: { in: ['RG', 'SE'] } },
    select: { id: true, projId: true },
    orderBy: { id: 'asc' },
  });

  console.log(`  Active funds: ${fmt(funds.length)}`);

  let navTotal = 0;
  let done = 0;
  const batches = chunkArray(funds, BATCH_SIZE);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchResults = await Promise.allSettled(
      batch.map((f) => syncNavForFund(f.id, f.projId, startDate, endDate))
    );

    for (const r of batchResults) {
      if (r.status === 'fulfilled') navTotal += r.value;
      else console.error('\n  NAV error:', r.reason);
    }

    done += batch.length;
    const pct = ((done / funds.length) * 100).toFixed(1);
    process.stdout.write(
      `\r  Progress: ${fmt(done)}/${fmt(funds.length)} funds (${pct}%)  NAVs: ${fmt(navTotal)}  Elapsed: ${elapsed(p3Start)}   `
    );

    if (i < batches.length - 1) await sleep(BATCH_DELAY);
  }

  console.log(`\n✅  NAV sync complete — ${fmt(navTotal)} records  (${elapsed(p3Start)})`);

  // ── Phase 4: Metrics ─────────────────────────────────────────────────────
  console.log('\n━━━ Phase 4: Calculate Metrics ━━━');
  const p4Start = Date.now();

  const allFunds = await prisma.fund.findMany({ select: { id: true } });
  let metricsTotal = 0;
  let metricsDone = 0;
  const metricBatches = chunkArray(allFunds, 50);

  for (const batch of metricBatches) {
    const results = await Promise.allSettled(
      batch.map((f) => calculateMetricsForFund(f.id))
    );
    for (const r of results) {
      if (r.status === 'fulfilled') metricsTotal += r.value;
    }
    metricsDone += batch.length;
    const pct = ((metricsDone / allFunds.length) * 100).toFixed(1);
    process.stdout.write(
      `\r  Progress: ${fmt(metricsDone)}/${fmt(allFunds.length)} funds (${pct}%)  Metrics: ${fmt(metricsTotal)}  Elapsed: ${elapsed(p4Start)}   `
    );
  }

  console.log(`\n✅  Metrics done — ${fmt(metricsTotal)} records  (${elapsed(p4Start)})`);

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🎉  Initial sync complete! Total: ${elapsed(totalStart)}`);

  const [fundCount, navCount, metCount] = await Promise.all([
    prisma.fund.count(),
    prisma.navPrice.count(),
    prisma.fundMetric.count(),
  ]);
  console.log(`   Funds:   ${fmt(fundCount)}`);
  console.log(`   NAVs:    ${fmt(navCount)}`);
  console.log(`   Metrics: ${fmt(metCount)}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('\n💥  Fatal error:', e);
  process.exit(1);
});
