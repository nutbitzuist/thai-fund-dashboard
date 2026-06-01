/**
 * scripts/full-restore.ts
 *
 * Complete database restore — runs every step needed to fully populate
 * a fresh database to match production state.
 *
 * Phases:
 *   1. AMCs + Funds (basic metadata)
 *   2. Fund types + risk levels (keyword inference)
 *   3. Fix isDefault on FundClass records
 *   4. Fees + investment policy (SEC /fee + /policy)
 *   5. SEC performance data (asset allocation, benchmark, returns)
 *   6. NAV history (90 days)
 *   7. Metrics calculation (return1Y/3Y, volatility, sharpe, maxDrawdown)
 *
 * Usage:
 *   source .env.local && DATABASE_URL="$DATABASE_URL" SEC_API_KEY="$SEC_API_KEY" \
 *   SEC_NAV_API_KEY="$SEC_NAV_API_KEY" npx tsx scripts/full-restore.ts
 */

import { existsSync } from 'fs';
import { resolve } from 'path';
import { spawnSync } from 'child_process';
import { config as dotenvConfig } from 'dotenv';

const envFile = resolve(process.cwd(), '.env.local');
if (existsSync(envFile)) dotenvConfig({ path: envFile });

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const TELEGRAM_CHAT  = process.env.TELEGRAM_CHAT_ID ?? '';

function step(msg: string) { console.log(`\n━━━ ${msg} ━━━`); }
function elapsed(t: number) { return ((Date.now() - t) / 1000).toFixed(0) + 's'; }

async function tg(text: string) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text, parse_mode: 'HTML' }),
    });
  } catch { /* non-critical */ }
}

async function main() {
  const totalStart = Date.now();
  console.log('Starting full database restore...');
  await tg('🔄 <b>Full DB Restore Started</b>\nAll 7 phases will run sequentially.');

  const { syncAmcs, syncFunds, syncNavForFund, calculateMetricsForFund } = await import('../lib/sync');
  const { inferFundType, inferRiskLevel, getLastWeekday, chunkArray, sleep } = await import('../lib/utils');
  const { default: prisma } = await import('../lib/db');

  // ── Phase 1: AMCs + Funds ────────────────────────────────────────────────
  step('1. Sync AMCs + Funds');
  const p1 = Date.now();
  const amcCount = await syncAmcs();
  const fundCount = await syncFunds();
  console.log(`✅ ${amcCount} AMCs, ${fundCount} funds (${elapsed(p1)})`);

  // ── Phase 2: Fund types ──────────────────────────────────────────────────
  step('2. Infer fund types + risk levels');
  const p2 = Date.now();
  const untyped = await prisma.fund.findMany({
    where: { OR: [{ fundType: null }, { riskLevel: null }] },
    select: { id: true, nameTh: true, nameEn: true },
  });
  let typedCount = 0;
  for (const fund of untyped) {
    const fundType = inferFundType(fund.nameTh, fund.nameEn, null);
    const riskLevel = inferRiskLevel(fundType, null);
    if (fundType || riskLevel) {
      await prisma.fund.update({ where: { id: fund.id }, data: { fundType, riskLevel } });
      typedCount++;
    }
  }
  console.log(`✅ Inferred types for ${typedCount} funds (${elapsed(p2)})`);

  // ── Phase 3: Fix isDefault ───────────────────────────────────────────────
  step('3. Fix isDefault on FundClass');
  const p3 = Date.now();
  const fundsWithClasses = await prisma.fund.findMany({
    where: { fundClasses: { some: {} } },
    select: { id: true, fundClasses: { select: { id: true, isDefault: true, classAbbrName: true } } },
  });
  let fixedCount = 0;
  for (const fund of fundsWithClasses) {
    const hasDefault = fund.fundClasses.some(c => c.isDefault);
    if (!hasDefault && fund.fundClasses.length > 0) {
      // Prefer class with "A" suffix, else first alphabetically
      const sorted = [...fund.fundClasses].sort((a, b) => a.classAbbrName.localeCompare(b.classAbbrName));
      const preferred = sorted.find(c => c.classAbbrName.endsWith('-A')) ?? sorted[0];
      await prisma.fundClass.update({ where: { id: preferred.id }, data: { isDefault: true } });
      fixedCount++;
    }
  }
  console.log(`✅ Fixed ${fixedCount} fund classes (${elapsed(p3)})`);

  // ── Phase 4: Fees + investment policy ────────────────────────────────────
  step('4. Backfill fees + investment policy');
  const p4 = Date.now();
  await tg('⏳ Phase 4: Fetching fees from SEC API...');
  spawnSync('npx', ['tsx', 'scripts/backfill-fees.ts'], { stdio: 'inherit', encoding: 'utf8' });
  console.log(`✅ Fees done (${elapsed(p4)})`);

  // ── Phase 5: SEC performance (asset allocation, benchmark, returns) ───────
  step('5. Backfill SEC performance data');
  const p5 = Date.now();
  await tg('⏳ Phase 5: Fetching SEC performance data...');
  spawnSync('npx', ['tsx', 'scripts/backfill-sec-performance.ts'], { stdio: 'inherit', encoding: 'utf8' });
  console.log(`✅ SEC performance done (${elapsed(p5)})`);

  // ── Phase 6: NAV history ─────────────────────────────────────────────────
  step('6. NAV history (90 days)');
  const p6 = Date.now();
  await tg('⏳ Phase 6: Fetching 90 days of NAV data...');
  const DAYS = 90, BATCH = 20, DELAY = 1500;
  const endDate = getLastWeekday();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - DAYS);

  const activeFunds = await prisma.fund.findMany({
    where: { fundStatus: { in: ['RG', 'SE'] } },
    select: { id: true, projId: true },
    orderBy: { id: 'asc' },
  });

  let navTotal = 0, done = 0;
  for (const batch of chunkArray(activeFunds, BATCH)) {
    const results = await Promise.allSettled(
      batch.map(f => syncNavForFund(f.id, f.projId, startDate, endDate))
    );
    for (const r of results) if (r.status === 'fulfilled') navTotal += r.value;
    done += batch.length;
    process.stdout.write(`\r  ${done}/${activeFunds.length} funds, ${navTotal.toLocaleString()} NAVs  `);
    if (done < activeFunds.length) await sleep(DELAY);
  }
  console.log(`\n✅ ${navTotal.toLocaleString()} NAV records (${elapsed(p6)})`);

  // ── Phase 7: Metrics ─────────────────────────────────────────────────────
  step('7. Calculate metrics');
  const p7 = Date.now();
  await tg('⏳ Phase 7: Calculating performance metrics...');
  const allFunds = await prisma.fund.findMany({ select: { id: true } });
  let metricsDone = 0, metricsCount = 0;
  for (const batch of chunkArray(allFunds, 50)) {
    const results = await Promise.allSettled(batch.map(f => calculateMetricsForFund(f.id)));
    for (const r of results) if (r.status === 'fulfilled') metricsCount += r.value;
    metricsDone += batch.length;
    process.stdout.write(`\r  ${metricsDone}/${allFunds.length} funds  `);
  }
  console.log(`\n✅ ${metricsCount} metrics calculated (${elapsed(p7)})`);

  // ── Verification ──────────────────────────────────────────────────────────
  step('Verification');
  const [activeFundCount, withType, withFees, withBenchmark, withNav, withMetrics, defaultClasses] =
    await Promise.all([
      prisma.fund.count({ where: { fundStatus: { in: ['RG', 'SE'] } } }),
      prisma.fund.count({ where: { fundType: { not: null }, fundStatus: { in: ['RG', 'SE'] } } }),
      prisma.fund.count({ where: { totalExpenseRatio: { not: null } } }),
      prisma.fund.count({ where: { benchmark: { not: null } } }),
      prisma.fund.count({ where: { navPrices: { some: {} } } }),
      prisma.fundMetric.count({ where: { period: '1Y' } }),
      prisma.fundClass.count({ where: { isDefault: true } }),
    ]);

  const summary = [
    `Active funds: ${activeFundCount}`,
    `Fund types: ${withType}/${activeFundCount}`,
    `Fees (TER): ${withFees}`,
    `Benchmark: ${withBenchmark}`,
    `With NAV: ${withNav}`,
    `1Y metrics: ${withMetrics}`,
    `Default classes: ${defaultClasses}`,
  ].join('\n');

  console.log('\n' + summary);
  const totalTime = Math.round((Date.now() - totalStart) / 60000);
  await tg(`✅ <b>Full DB Restore Complete</b> (${totalTime} min)\n\n${summary}`);

  process.exit(0);
}

main().catch(async e => {
  console.error('Restore failed:', e);
  await tg(`❌ Full restore failed: ${e.message}`);
  process.exit(1);
});
