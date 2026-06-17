// scripts/reconcile-metrics.ts
// Window-aligned SEC reconciliation (READ-ONLY — no DB writes).
//
// PURPOSE
// -------
// Answer the question: "Is the dashboard's computed return data actually wrong,
// or does it just *look* wrong because we compare different time windows?"
//
// THE MEASUREMENT ARTIFACT WE FIX
// -------------------------------
// Our stored fund_metric.returnPct ends at the LATEST NAV (~2026-06-15).
// SEC's official performance ends at a MONTH-END as_of_date (~2026-04-30),
// roughly 7 weeks earlier. A 1Y return ending in June vs ending in April can
// legitimately differ by several points for a volatile fund. Comparing those
// two directly is apples-to-oranges and over-flags almost everything.
//
// WHAT THIS SCRIPT DOES INSTEAD — align the windows
// -------------------------------------------------
// For each fund/period we recompute OUR return over the EXACT window SEC used:
//   end   = SEC as_of_date          (nearest NAV on/just before that date)
//   start = period-appropriate date relative to as_of:
//             1Y  = as_of − 1 year
//             YTD = Jan 1 of as_of's year
//             3M  = as_of − 3 months
//           (nearest NAV on/just before that target date)
// return = (endNav − startNav) / startNav × 100, using the DEFAULT class's NAVs.
//
// Then OUR aligned return is compared to SEC's official fund return
// (ผลตอบแทนกองทุนรวม) for 1Y / YTD / 3M and classified:
//   ALIGNED : |ours − sec| ≤ 2.0 pp
//   MILD    : 2–10 pp           (NAV-date snapping / share-class differences)
//   CRAZY   : sign flip, OR |ours − sec| > 20 pp, OR ratio outside [0.33x, 3x]
//            ← genuine bad-data candidates
//
// Run: npx tsx scripts/reconcile-metrics.ts                 (all eligible funds)
//      npx tsx scripts/reconcile-metrics.ts --limit 200     (representative sample)
//      npx tsx scripts/reconcile-metrics.ts --json out.json (also dump raw rows)

import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();
if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/\\n$/, '').trim();

import type { MetricPeriod, SecFundPerformance } from '@/types';
import {
  COMPARE_PERIODS,
  classifyReturnPair,
  startTargetFor,
  toUtcDate,
  type ComparePeriod,
  type Verdict,
} from '@/lib/reconciliation';

const RATE_LIMIT_MS = 300;     // polite spacing between SEC calls

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

interface Comparison {
  projId: string;
  abbr: string;
  period: ComparePeriod;
  ours: number;       // our window-aligned return %
  sec: number;        // SEC official fund return %
  delta: number;      // ours − sec
  verdict: Verdict;
  reason: string;     // why CRAZY/MILD (for the report)
  asOf: string;       // SEC as_of_date used
  startDate: string;  // NAV date actually used for start
  endDate: string;    // NAV date actually used for end
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.indexOf('--limit');
  const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : undefined;
  const jsonArg = args.indexOf('--json');
  const jsonPath = jsonArg >= 0 ? args[jsonArg + 1] : undefined;

  const { default: prisma } = await import('@/lib/db');
  const { fetchFundPerformance } = await import('@/lib/sec-api');

  // Active RG/SE funds that have a default class. We require NAV history depth at
  // query time (per-fund), so just pull candidates here.
  const funds = await prisma.fund.findMany({
    where: {
      fundStatus: { in: ['RG', 'SE'] },
      fundClasses: { some: { isDefault: true } },
    },
    select: {
      id: true,
      projId: true,
      projAbbrName: true,
      fundClasses: { where: { isDefault: true }, select: { id: true }, take: 1 },
    },
    orderBy: { projId: 'asc' },
    ...(limit ? { take: limit } : {}),
  });

  console.log(`[reconcile] ${funds.length} candidate funds (active RG/SE + default class), read-only`);

  // Tallies
  let checked = 0;        // funds we actually compared >=1 period for
  let noSecData = 0;      // SEC returned nothing / no as_of_date
  let noNavHistory = 0;   // default class had too few NAVs to align any window
  let secErrors = 0;
  let comparedPairs = 0;

  const perPeriod: Record<ComparePeriod, { aligned: number; mild: number; crazy: number }> = {
    '1Y': { aligned: 0, mild: 0, crazy: 0 },
    'YTD': { aligned: 0, mild: 0, crazy: 0 },
    '3M': { aligned: 0, mild: 0, crazy: 0 },
  };

  const comparisons: Comparison[] = [];
  const crazy: Comparison[] = [];
  const crazyFundIds = new Set<string>();

  for (let i = 0; i < funds.length; i++) {
    const fund = funds[i];
    const classId = fund.fundClasses[0]!.id;
    const abbr = fund.projAbbrName ?? fund.projId;

    // 1) SEC official performance + as_of_date.
    let perf: SecFundPerformance | null = null;
    try {
      perf = await fetchFundPerformance(fund.projId);
    } catch (err) {
      secErrors++;
      if (secErrors <= 10) console.error(`[reconcile] SEC error ${abbr}: ${String(err)}`);
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    if (!perf || !perf.asOfDate || Object.keys(perf.returnByPeriod).length === 0) {
      noSecData++;
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    const asOf = toUtcDate(perf.asOfDate);
    if (Number.isNaN(asOf.getTime())) {
      noSecData++;
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    // 2) Pull the default class's NAVs from earliest-needed start (1Y back from as_of,
    //    with a small buffer) through as_of. One query per fund.
    const earliestNeeded = startTargetFor('1Y', asOf);
    const lowerBound = new Date(earliestNeeded);
    lowerBound.setUTCDate(lowerBound.getUTCDate() - 14); // buffer so snapping has room
    const upperBound = new Date(asOf);

    const navs = await prisma.navPrice.findMany({
      where: { fundClassId: classId, navDate: { gte: lowerBound, lte: upperBound } },
      orderBy: { navDate: 'asc' },
      select: { navDate: true, lastVal: true },
    });

    if (navs.length < 2) {
      noNavHistory++;
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    // navOnOrBefore: nearest NAV with navDate <= target. navs is ascending.
    const navOnOrBefore = (target: Date): { date: Date; nav: number } | null => {
      let found: { date: Date; nav: number } | null = null;
      for (const n of navs) {
        if (n.navDate.getTime() <= target.getTime()) {
          found = { date: n.navDate, nav: Number(n.lastVal) };
        } else {
          break;
        }
      }
      return found;
    };

    const endPoint = navOnOrBefore(asOf);
    if (!endPoint || endPoint.nav <= 0) {
      noNavHistory++;
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    let fundCompared = false;

    for (const period of COMPARE_PERIODS) {
      const sec = perf.returnByPeriod[period as MetricPeriod];
      if (sec == null) continue;

      const startTarget = startTargetFor(period, asOf);
      const startPoint = navOnOrBefore(startTarget);
      if (!startPoint || startPoint.nav <= 0) continue;

      // Guard: start must actually be before end.
      if (startPoint.date.getTime() >= endPoint.date.getTime()) continue;

      const ours = ((endPoint.nav - startPoint.nav) / startPoint.nav) * 100;

      const { verdict, reason } = classifyReturnPair(ours, sec);
      comparedPairs++;
      fundCompared = true;
      perPeriod[period][verdict === 'ALIGNED' ? 'aligned' : verdict === 'MILD' ? 'mild' : 'crazy']++;

      const cmp: Comparison = {
        projId: fund.projId,
        abbr,
        period,
        ours,
        sec,
        delta: ours - sec,
        verdict,
        reason,
        asOf: perf.asOfDate,
        startDate: startPoint.date.toISOString().slice(0, 10),
        endDate: endPoint.date.toISOString().slice(0, 10),
      };
      comparisons.push(cmp);
      if (verdict === 'CRAZY') {
        crazy.push(cmp);
        crazyFundIds.add(fund.projId);
      }
    }

    if (fundCompared) checked++;

    if ((i + 1) % 50 === 0) {
      console.log(
        `[reconcile] [${i + 1}/${funds.length}] checked=${checked} ` +
        `pairs=${comparedPairs} crazy=${crazy.length} ` +
        `noSec=${noSecData} noNav=${noNavHistory} secErr=${secErrors}`
      );
    }

    await sleep(RATE_LIMIT_MS);
  }

  // ── Report ──────────────────────────────────────────────────────────────
  const totals = COMPARE_PERIODS.reduce(
    (acc, p) => {
      acc.aligned += perPeriod[p].aligned;
      acc.mild += perPeriod[p].mild;
      acc.crazy += perPeriod[p].crazy;
      return acc;
    },
    { aligned: 0, mild: 0, crazy: 0 }
  );
  const grand = totals.aligned + totals.mild + totals.crazy;
  const pct = (n: number) => (grand ? ((n / grand) * 100).toFixed(1) : '0.0');

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(' SEC RECONCILIATION REPORT — window-aligned (read-only)');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(`Candidate funds ............. ${funds.length}`);
  console.log(`  compared (>=1 period) ..... ${checked}`);
  console.log(`  SEC had no perf/as_of ..... ${noSecData}`);
  console.log(`  insufficient NAV history .. ${noNavHistory}`);
  console.log(`  SEC fetch errors .......... ${secErrors}`);
  console.log(`Comparisons (fund×period) ... ${comparedPairs}`);
  console.log('');
  console.log('OVERALL DISTRIBUTION (window-aligned):');
  console.log(`  ALIGNED (|Δ|≤2pp) ......... ${totals.aligned}  (${pct(totals.aligned)}%)`);
  console.log(`  MILD    (2–20pp) .......... ${totals.mild}  (${pct(totals.mild)}%)`);
  console.log(`  CRAZY   (flip/>20/ratio) .. ${totals.crazy}  (${pct(totals.crazy)}%)`);
  console.log(`  crazy funds (distinct) .... ${crazyFundIds.size}`);

  console.log('\nPer-period distribution (aligned / mild / crazy):');
  for (const p of COMPARE_PERIODS) {
    const x = perPeriod[p];
    const t = x.aligned + x.mild + x.crazy;
    const ap = t ? ((x.aligned / t) * 100).toFixed(0) : '0';
    const mp = t ? ((x.mild / t) * 100).toFixed(0) : '0';
    const cp = t ? ((x.crazy / t) * 100).toFixed(0) : '0';
    console.log(
      `  ${p.padEnd(4)} aligned=${String(x.aligned).padStart(4)} (${ap}%)  ` +
      `mild=${String(x.mild).padStart(4)} (${mp}%)  ` +
      `crazy=${String(x.crazy).padStart(4)} (${cp}%)   [n=${t}]`
    );
  }

  console.log(`\nCRAZY comparisons (genuine bad-data candidates) — ${crazy.length} total:`);
  if (crazy.length === 0) {
    console.log('  (none) — when windows are aligned, no genuinely crazy data found.');
  } else {
    console.log('  fund                     period  ours      sec      delta   reason         window');
    const sorted = [...crazy].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    for (const d of sorted) {
      console.log(
        `  ${d.abbr.padEnd(24)} ${d.period.padEnd(5)} ` +
        `${d.ours.toFixed(2).padStart(8)} ${d.sec.toFixed(2).padStart(8)} ` +
        `${d.delta.toFixed(2).padStart(8)}  ${d.reason.padEnd(14)} ${d.startDate}→${d.endDate}`
      );
    }
  }
  console.log('══════════════════════════════════════════════════════════════\n');

  if (jsonPath) {
    const fs = await import('node:fs');
    fs.writeFileSync(jsonPath, JSON.stringify({
      summary: {
        candidates: funds.length, checked, noSecData, noNavHistory, secErrors,
        comparedPairs, totals, perPeriod, crazyFunds: crazyFundIds.size,
      },
      crazy,
      comparisons,
    }, null, 2));
    console.log(`[reconcile] wrote raw report → ${jsonPath}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => { console.error('[reconcile] crashed:', err); process.exit(1); });
