// scripts/apply-total-return.ts
// Fix understated returns for DISTRIBUTING (dividend) funds by adopting SEC's
// official TOTAL return as the displayed fund_metric.returnPct.
//
// WHY
// ---
// fund_metric.returnPct is a NAV PRICE return: (NAV_end − NAV_start)/NAV_start.
// For funds that pay out distributions, the cash leaves the NAV, so price return
// understates performance (sometimes flips sign). SEC reports a TOTAL return.
// SEC does not expose per-payment distribution data (the /dividend endpoint's
// dividend_details is empty), so we cannot reconstruct total return ourselves —
// we adopt SEC's official number, but ONLY for distributing funds and ONLY for
// periods where SEC publishes a figure (3M/6M/YTD/1Y/3Y/5Y). Accumulating funds
// are never touched. See lib/total-return.ts for the decision logic.
//
// SAFETY
// ------
//   • Only active RG/SE funds with dividend_policy === 'Y'.
//   • Only overwrites returnPct for periods SEC provides; never invents data.
//   • --dry-run prints what WOULD change without writing.
//   • --only ABBR1,ABBR2 restricts to specific funds (used for the 8 flagged).
//
// Run: npx tsx scripts/apply-total-return.ts --dry-run
//      npx tsx scripts/apply-total-return.ts --only ONE-FAS,KFFIN-D
//      npx tsx scripts/apply-total-return.ts            (apply to all dividend funds)

import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();
if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/\\n$/, '').trim();

import type { MetricPeriod, SecFundPerformance } from '@/types';
import { resolveDisplayReturn } from '@/lib/total-return';

const RATE_LIMIT_MS = 350;
const SEC_PERIODS: MetricPeriod[] = ['3M', '6M', 'YTD', '1Y', '3Y', '5Y'];

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const onlyArg = args.indexOf('--only');
  const onlyAbbrs = onlyArg >= 0
    ? (args[onlyArg + 1] ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    : null;

  const { default: prisma } = await import('@/lib/db');
  const { fetchFundPerformance, fetchDividendPolicy } = await import('@/lib/sec-api');

  const funds = await prisma.fund.findMany({
    where: {
      fundStatus: { in: ['RG', 'SE'] },
      fundClasses: { some: { isDefault: true } },
      ...(onlyAbbrs ? { projAbbrName: { in: onlyAbbrs } } : {}),
    },
    select: {
      id: true,
      projId: true,
      projAbbrName: true,
      fundClasses: { where: { isDefault: true }, select: { id: true }, take: 1 },
    },
    orderBy: { projId: 'asc' },
  });

  console.log(`[total-return] ${funds.length} candidate funds${dryRun ? ' (DRY RUN)' : ''}`);

  let dividendFunds = 0;
  let rowsUpdated = 0;
  let skippedNoSec = 0;

  for (let i = 0; i < funds.length; i++) {
    const fund = funds[i];
    const classId = fund.fundClasses[0]!.id;
    const abbr = fund.projAbbrName ?? fund.projId;

    // 1) Is this a distributing fund? Only those get the SEC-total override.
    let isDividend: boolean | null = null;
    try {
      isDividend = await fetchDividendPolicy(fund.projId);
    } catch (err) {
      console.error(`[total-return] dividend probe error ${abbr}: ${String(err)}`);
      await sleep(RATE_LIMIT_MS);
      continue;
    }
    if (isDividend !== true) { await sleep(RATE_LIMIT_MS); continue; }
    dividendFunds++;

    // Persist the dividend flag on the Fund so the nightly metric pipeline
    // (lib/sync.ts calculateMetricsForFund) keeps applying the total-return
    // override without re-probing SEC.
    if (!dryRun) {
      await prisma.fund.update({
        where: { id: fund.id },
        data: { dividendPolicy: 'Y' },
      });
    }

    // 2) SEC official total return per period.
    let perf: SecFundPerformance | null = null;
    try {
      perf = await fetchFundPerformance(fund.projId);
    } catch (err) {
      console.error(`[total-return] perf error ${abbr}: ${String(err)}`);
      await sleep(RATE_LIMIT_MS);
      continue;
    }
    if (!perf || Object.keys(perf.returnByPeriod).length === 0) {
      skippedNoSec++;
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    // 3) For each period SEC publishes, overwrite the most recent metric's returnPct.
    for (const period of SEC_PERIODS) {
      const secTotal = perf.returnByPeriod[period] ?? null;
      if (secTotal == null) continue;

      const metric = await prisma.fundMetric.findFirst({
        where: { fundClassId: classId, period },
        orderBy: { endDate: 'desc' },
        select: { id: true, returnPct: true },
      });
      if (!metric) continue;

      const pricePct = metric.returnPct != null ? Number(metric.returnPct) : null;
      const { returnPct, source } = resolveDisplayReturn({
        pricePct,
        secTotalReturnPct: secTotal,
        isDividendFund: true,
      });
      if (source !== 'sec-total' || returnPct == null) continue;

      // Skip no-op writes (already equal).
      if (pricePct != null && Math.abs(pricePct - returnPct) < 1e-6) continue;

      console.log(
        `  ${abbr.padEnd(14)} ${period.padEnd(4)} price=${(pricePct ?? NaN).toFixed(2).padStart(8)} ` +
        `→ sec-total=${returnPct.toFixed(2).padStart(8)}  (Δ=${(returnPct - (pricePct ?? 0)).toFixed(2)})`
      );

      if (!dryRun) {
        await prisma.fundMetric.update({
          where: { id: metric.id },
          data: { returnPct, secReturnPct: secTotal },
        });
      }
      rowsUpdated++;
    }

    await sleep(RATE_LIMIT_MS);
  }

  console.log('\n══════════════════════════════════════════════════');
  console.log(` TOTAL-RETURN FIX ${dryRun ? '(DRY RUN — no writes)' : '(applied)'}`);
  console.log('══════════════════════════════════════════════════');
  console.log(`Candidate funds ......... ${funds.length}`);
  console.log(`Distributing (div=Y) .... ${dividendFunds}`);
  console.log(`No SEC perf data ........ ${skippedNoSec}`);
  console.log(`Metric rows ${dryRun ? 'to update' : 'updated'} ..... ${rowsUpdated}`);
  console.log('══════════════════════════════════════════════════\n');

  await prisma.$disconnect();
}

main().catch((err) => { console.error('[total-return] crashed:', err); process.exit(1); });
