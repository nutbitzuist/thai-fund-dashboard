// scripts/backfill-navs.ts
// ─────────────────────────────────────────────────────────────────────────────
// Historical NAV backfill — run locally; too slow for Vercel (rate limits).
//
// Usage:
//   npx tsx scripts/backfill-navs.ts [options]
//
// Options:
//   --days=1825       Days of history to fetch for "new" funds (default: 5 years)
//   --top-up-days=400 Days to fill for funds with partial data (default: ~14 mo)
//   --concurrency=5   Parallel fund fetches (default: 5)
//   --delay=200       ms between date requests per fund (default: 200)
//   --new-only        Only process funds with zero NAV data
//   --no-metrics      Skip metric recalculation after backfill
//   --limit=N         Cap total funds processed (useful for testing)
//   --status=RG,SE    Fund statuses to include (default: RG,SE)
//
// Example — safe test run for 10 new funds:
//   npx tsx scripts/backfill-navs.ts --limit=10 --days=365
//
// Full overnight backfill:
//   npx tsx scripts/backfill-navs.ts --days=1825 --concurrency=8
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { config as dotenvConfig } from 'dotenv';

// Auto-load .env.local when running as a script
const envFile = resolve(process.cwd(), '.env.local');
if (existsSync(envFile)) dotenvConfig({ path: envFile });

// ── Inline minimal versions of lib utilities ──
// (avoids Next.js module resolution issues when running outside the app)

function formatDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function generateWeekdays(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const e = new Date(end);
  e.setHours(0, 0, 0, 0);
  while (cur <= e) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) dates.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function getLastWeekday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  return d;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

// ── Parse CLI args ────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (key: string, fallback: string) => {
    const flag = args.find((a) => a.startsWith(`--${key}=`));
    return flag ? flag.split('=')[1] : fallback;
  };
  const has = (key: string) => args.includes(`--${key}`);

  return {
    days:        parseInt(get('days', '1825'), 10),   // 5 years
    topUpDays:   parseInt(get('top-up-days', '400'), 10),
    concurrency: parseInt(get('concurrency', '5'), 10),
    delayMs:     parseInt(get('delay', '200'), 10),
    newOnly:     has('new-only'),
    noMetrics:   has('no-metrics'),
    limit:       parseInt(get('limit', '0'), 10), // 0 = no limit
    statuses:    get('status', 'RG,SE').split(','),
  };
}

// ── SEC NAV API ───────────────────────────────

const SEC_BASE = 'https://api.sec.or.th';
const RETRY = 3;

async function fetchDailyNav(
  projId: string,
  date: string,
  apiKey: string,
  attempt = 1
): Promise<Array<{
  nav_date: string;
  last_val: string;
  buy_price?: string;
  sell_price?: string;
  net_asset?: number;
  class_abbr_name: string;
  class_name?: string;
}>> {
  const url = `${SEC_BASE}/FundDailyInfo/${encodeURIComponent(projId)}/dailynav/${date}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      headers: { 'Ocp-Apim-Subscription-Key': apiKey, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (res.status === 404) return [];
    if (res.status === 429) {
      if (attempt <= RETRY) {
        await sleep(2000 * attempt);
        return fetchDailyNav(projId, date, apiKey, attempt + 1);
      }
      return [];
    }
    if (!res.ok) {
      if (attempt <= RETRY) {
        await sleep(1000 * attempt);
        return fetchDailyNav(projId, date, apiKey, attempt + 1);
      }
      return [];
    }
    const text = await res.text();
    if (!text || text === 'null') return [];
    const data = JSON.parse(text);
    const items: unknown[] = Array.isArray(data) ? data : ((data as Record<string, unknown>)?.nav as unknown[] ?? []);
    return items.map((raw: unknown) => {
      const r = raw as Record<string, unknown>;
      return {
        nav_date: (r.nav_date as string) ?? (r.navDate as string) ?? date,
        last_val: String(r.last_val ?? r.lastVal ?? r.nav ?? '0'),
        buy_price: r.buy_price != null ? String(r.buy_price) : r.buyPrice != null ? String(r.buyPrice) : undefined,
        sell_price: r.sell_price != null ? String(r.sell_price) : r.sellPrice != null ? String(r.sellPrice) : undefined,
        net_asset: r.net_asset != null ? Number(r.net_asset) : r.netAsset != null ? Number(r.netAsset) : undefined,
        class_abbr_name: (r.class_abbr_name as string) ?? (r.classAbbrName as string) ?? projId,
        class_name: (r.class_name as string) ?? (r.className as string) ?? undefined,
      };
    });
  } catch {
    if (attempt <= RETRY) {
      await sleep(1000 * attempt);
      return fetchDailyNav(projId, date, apiKey, attempt + 1);
    }
    return [];
  } finally {
    clearTimeout(timer);
  }
}

// ── Mark default fund class ───────────────────

async function markDefaultClass(prisma: PrismaClient, fundId: number): Promise<void> {
  const classes = await prisma.fundClass.findMany({
    where: { fundId },
    orderBy: { classAbbrName: 'asc' },
  });
  if (!classes.length) return;
  let def = classes.find((c) => c.classAbbrName.toUpperCase().endsWith('-A'));
  if (!def) def = classes[0];
  await prisma.fundClass.updateMany({ where: { fundId }, data: { isDefault: false } });
  await prisma.fundClass.update({ where: { id: def.id }, data: { isDefault: true } });
}

// ── Sync NAV for one fund ─────────────────────

async function syncFundNavs(
  prisma: PrismaClient,
  fundId: number,
  projId: string,
  startDate: Date,
  endDate: Date,
  apiKey: string,
  delayMs: number
): Promise<number> {
  // Find already-existing dates in this window
  const existing = await prisma.navPrice.findMany({
    where: { fundId, navDate: { gte: startDate, lte: endDate } },
    select: { navDate: true },
  });
  const existingDates = new Set(existing.map((n) => formatDateISO(new Date(n.navDate))));

  const allDates = generateWeekdays(startDate, endDate);
  const missing = allDates.map((d) => formatDateISO(d)).filter((d) => !existingDates.has(d));

  if (!missing.length) return 0;

  let inserted = 0;

  for (const date of missing) {
    const items = await fetchDailyNav(projId, date, apiKey);

    for (const item of items) {
      const lastVal = parseFloat(item.last_val);
      if (isNaN(lastVal) || lastVal <= 0) continue;

      // Upsert fund class
      let fundClass = await prisma.fundClass.findFirst({
        where: { fundId, classAbbrName: item.class_abbr_name },
      });

      if (!fundClass) {
        fundClass = await prisma.fundClass.create({
          data: {
            fundId,
            classAbbrName: item.class_abbr_name,
            className: item.class_name ?? null,
            isDefault: false,
          },
        });
        await markDefaultClass(prisma, fundId);
      }

      const netAsset = item.net_asset != null && item.net_asset > 0 ? item.net_asset : null;
      const buyPrice = item.buy_price ? parseFloat(item.buy_price) : null;
      const sellPrice = item.sell_price ? parseFloat(item.sell_price) : null;
      // Use raw SQL — PrismaNeonHttp doesn't support the transactions upsert uses internally
      await prisma.$executeRaw`
        INSERT INTO nav_price (fund_id, fund_class_id, nav_date, last_val,
                               buy_price, sell_price, net_asset, created_at, updated_at)
        VALUES (${fundId}, ${fundClass.id}, ${new Date(date)}, ${lastVal},
                ${buyPrice}, ${sellPrice}, ${netAsset}, NOW(), NOW())
        ON CONFLICT (fund_class_id, nav_date) DO UPDATE SET
          last_val   = EXCLUDED.last_val,
          buy_price  = EXCLUDED.buy_price,
          sell_price = EXCLUDED.sell_price,
          net_asset  = COALESCE(EXCLUDED.net_asset, nav_price.net_asset),
          updated_at = NOW()
      `;
      inserted++;
    }

    if (delayMs > 0) await sleep(delayMs);
  }

  return inserted;
}

// ── Calculate metrics for one fund ───────────

type MetricPeriod = '1M' | '3M' | '6M' | 'YTD' | '1Y' | '3Y' | '5Y';
const METRIC_PERIODS: MetricPeriod[] = ['1M', '3M', '6M', 'YTD', '1Y', '3Y', '5Y'];

function getPeriodStart(period: MetricPeriod, from: Date): Date {
  const d = new Date(from);
  switch (period) {
    case '1M': d.setMonth(d.getMonth() - 1); return d;
    case '3M': d.setMonth(d.getMonth() - 3); return d;
    case '6M': d.setMonth(d.getMonth() - 6); return d;
    case 'YTD': return new Date(d.getFullYear(), 0, 1);
    case '1Y': d.setFullYear(d.getFullYear() - 1); return d;
    case '3Y': d.setFullYear(d.getFullYear() - 3); return d;
    case '5Y': d.setFullYear(d.getFullYear() - 5); return d;
  }
}

function calcReturn(navs: { date: Date; nav: number }[], start: Date, end: Date) {
  const window = navs.filter((n) => n.date >= start && n.date <= end);
  if (window.length < 2) return null;
  const first = window[0].nav;
  const last = window[window.length - 1].nav;
  if (first <= 0) return null;
  return ((last - first) / first) * 100;
}

function calcVolatility(navs: { date: Date; nav: number }[], start: Date, end: Date) {
  const window = navs.filter((n) => n.date >= start && n.date <= end);
  if (window.length < 5) return null;
  const returns = [];
  for (let i = 1; i < window.length; i++) {
    const prev = window[i - 1].nav;
    const cur = window[i].nav;
    if (prev > 0) returns.push(Math.log(cur / prev));
  }
  if (returns.length < 4) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

function calcMaxDrawdown(navs: { date: Date; nav: number }[], start: Date, end: Date) {
  const window = navs.filter((n) => n.date >= start && n.date <= end);
  if (window.length < 2) return null;
  let peak = window[0].nav;
  let maxDD = 0;
  for (const p of window) {
    if (p.nav > peak) peak = p.nav;
    const dd = (p.nav - peak) / peak;
    if (dd < maxDD) maxDD = dd;
  }
  return maxDD * 100;
}

async function calcMetricsForFund(prisma: PrismaClient, fundId: number): Promise<number> {
  const defaultClass = await prisma.fundClass.findFirst({
    where: { fundId, isDefault: true },
  });
  if (!defaultClass) return 0;

  const navRecords = await prisma.navPrice.findMany({
    where: { fundClassId: defaultClass.id },
    orderBy: { navDate: 'asc' },
    select: { navDate: true, lastVal: true },
  });
  if (navRecords.length < 5) return 0;

  const navPoints = navRecords.map((r) => ({ date: new Date(r.navDate), nav: Number(r.lastVal) }));
  const endDate = navPoints[navPoints.length - 1].date;
  let calculated = 0;

  for (const period of METRIC_PERIODS) {
    const startDate = getPeriodStart(period, endDate);
    const ret = calcReturn(navPoints, startDate, endDate);
    if (ret === null) continue;

    const vol = calcVolatility(navPoints, startDate, endDate);
    const dd = calcMaxDrawdown(navPoints, startDate, endDate);
    const riskFreeRate = 1.5; // ~Thai 1yr govt bond %
    const sharpe = vol && vol > 0 ? (ret - riskFreeRate) / vol : null;
    const navCount = navPoints.filter((n) => n.date >= startDate && n.date <= endDate).length;

    // Use raw SQL — PrismaNeonHttp doesn't support the transactions upsert uses internally
    await prisma.$executeRaw`
      INSERT INTO fund_metric (fund_id, fund_class_id, period, start_date, end_date,
                               return_pct, annualized_volatility_pct, max_drawdown_pct,
                               sharpe_ratio, nav_count, calculated_at)
      VALUES (
        ${fundId}, ${defaultClass.id}, ${period},
        ${startDate}, ${endDate},
        ${ret}, ${vol}, ${dd}, ${sharpe}, ${navCount}, NOW()
      )
      ON CONFLICT (fund_class_id, period, end_date) DO UPDATE SET
        start_date                = EXCLUDED.start_date,
        return_pct                = EXCLUDED.return_pct,
        annualized_volatility_pct = EXCLUDED.annualized_volatility_pct,
        max_drawdown_pct          = EXCLUDED.max_drawdown_pct,
        sharpe_ratio              = EXCLUDED.sharpe_ratio,
        nav_count                 = EXCLUDED.nav_count,
        calculated_at             = NOW()
    `;
    calculated++;
  }
  return calculated;
}

// ── Progress display ──────────────────────────

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function eta(done: number, total: number, elapsedMs: number): string {
  if (done === 0) return '—';
  const msPerFund = elapsedMs / done;
  const remaining = (total - done) * msPerFund;
  return formatDuration(remaining);
}

// ── Main ──────────────────────────────────────

async function main() {
  const opts = parseArgs();

  const connStr = process.env.DATABASE_URL;
  if (!connStr) throw new Error('DATABASE_URL is not set. Run: source .env.local && DATABASE_URL="$DATABASE_URL" SEC_NAV_API_KEY="$SEC_NAV_API_KEY" npx tsx scripts/backfill-navs.ts');

  const navApiKey = process.env.SEC_NAV_API_KEY;
  if (!navApiKey) throw new Error('SEC_NAV_API_KEY is not set. Run: source .env.local && DATABASE_URL="$DATABASE_URL" SEC_NAV_API_KEY="$SEC_NAV_API_KEY" npx tsx scripts/backfill-navs.ts');

  // Neon URLs: use WebSocket Pool (PrismaNeon) — supports full transactions.
  // PrismaNeonHttp (HTTP) does NOT support transactions which Prisma uses internally.
  // WebSocket avoids the SCRAM-SHA-256-PLUS channel binding issue that blocks TCP.
  // Force IPv4 DNS so the WebSocket connection doesn't time out on IPv6-broken networks.
  const isNeon = (() => {
    try { const h = new URL(connStr).hostname; return h.endsWith('.neon.tech') || h.includes('.neon.'); }
    catch { return false; }
  })();

  let prisma: PrismaClient;
  if (isNeon) {
    // Prefer IPv4 — prevents WebSocket/DNS timeout on networks where IPv6 can't reach Neon
    const { setDefaultResultOrder } = await import('dns');
    setDefaultResultOrder('ipv4first');

    // @neondatabase/serverless doesn't auto-detect Node.js 22's native WebSocket
    // — must set webSocketConstructor explicitly before creating the Pool.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { neonConfig } = require('@neondatabase/serverless');
    neonConfig.webSocketConstructor = globalThis.WebSocket;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaNeon } = require('@prisma/adapter-neon');
    const adapter = new PrismaNeon({ connectionString: connStr });
    prisma = new PrismaClient({ adapter } as never);
  } else {
    const adapter = new PrismaPg({ connectionString: connStr, max: 3 });
    prisma = new PrismaClient({ adapter } as never);
  }

  const endDate = getLastWeekday();
  const newFundStart = new Date(endDate);
  newFundStart.setDate(newFundStart.getDate() - opts.days);
  const topUpStart = new Date(endDate);
  topUpStart.setDate(topUpStart.getDate() - opts.topUpDays);

  console.log('\n📊 Thai Fund NAV Backfill');
  console.log(`   History window  : ${opts.days} days for new funds, ${opts.topUpDays} days for top-ups`);
  console.log(`   Concurrency     : ${opts.concurrency} parallel funds`);
  console.log(`   Delay per date  : ${opts.delayMs}ms`);
  console.log(`   Fund statuses   : ${opts.statuses.join(', ')}`);
  console.log(`   End date        : ${formatDateISO(endDate)}\n`);

  // ── Query funds ─────────────────────────────

  const [newFunds, partialFunds] = await Promise.all([
    // Funds with NO nav data at all
    prisma.fund.findMany({
      where: { fundStatus: { in: opts.statuses }, fundClasses: { none: {} } },
      select: { id: true, projId: true, projAbbrName: true },
      orderBy: { projAbbrName: 'asc' },
    }),
    // Funds with some data but potentially incomplete for 1Y metrics
    opts.newOnly ? Promise.resolve([]) : prisma.fund.findMany({
      where: {
        fundStatus: { in: opts.statuses },
        fundClasses: { some: {} },
        // Only funds whose earliest NAV is within the top-up window
        navPrices: { some: { navDate: { gte: topUpStart } } },
      },
      select: { id: true, projId: true, projAbbrName: true },
      orderBy: { projAbbrName: 'asc' },
    }),
  ]);

  let fundsToProcess = [
    ...newFunds.map((f) => ({ ...f, isNew: true })),
    ...partialFunds.map((f) => ({ ...f, isNew: false })),
  ];

  if (opts.limit > 0) fundsToProcess = fundsToProcess.slice(0, opts.limit);

  const totalNew = newFunds.length;
  const totalPartial = partialFunds.length;
  const total = fundsToProcess.length;

  console.log(`   New funds (no NAV)    : ${totalNew}`);
  console.log(`   Partial funds (top-up): ${totalPartial}`);
  console.log(`   Total to process      : ${total}${opts.limit > 0 ? ` (capped at ${opts.limit})` : ''}\n`);

  if (total === 0) {
    console.log('✅ Nothing to backfill — all funds have NAV data.');
    await prisma.$disconnect();
    return;
  }

  // ── Batch processing ─────────────────────────

  const startTime = Date.now();
  let done = 0;
  let totalNavInserted = 0;
  let errors = 0;

  const batches = chunkArray(fundsToProcess, opts.concurrency);

  for (const batch of batches) {
    const results = await Promise.allSettled(
      batch.map(async (fund) => {
        const start = fund.isNew ? newFundStart : topUpStart;
        const inserted = await syncFundNavs(prisma, fund.id, fund.projId, start, endDate, navApiKey, opts.delayMs);
        return { projId: fund.projId, projAbbrName: fund.projAbbrName, inserted };
      })
    );

    for (const result of results) {
      done++;
      if (result.status === 'fulfilled') {
        totalNavInserted += result.value.inserted;
        const slug = result.value.projAbbrName ?? result.value.projId;
        process.stdout.write(
          `\r[${done}/${total}] ${slug.padEnd(20)} +${result.value.inserted} NAV  | total: ${totalNavInserted} | ETA: ${eta(done, total, Date.now() - startTime)}   `
        );
      } else {
        errors++;
        console.error(`\n  ❌ Error: ${result.reason}`);
      }
    }
  }

  process.stdout.write('\n\n');
  console.log(`✅ NAV backfill complete in ${formatDuration(Date.now() - startTime)}`);
  console.log(`   Inserted: ${totalNavInserted} NAV records`);
  console.log(`   Errors  : ${errors}`);

  // ── Recalculate metrics ─────────────────────

  if (!opts.noMetrics) {
    console.log('\n📐 Recalculating metrics for updated funds...');
    const updatedIds = fundsToProcess.map((f) => f.id);
    let metricsDone = 0;
    let metricsTotal = 0;
    const metricBatches = chunkArray(updatedIds, 50);

    for (const batch of metricBatches) {
      const counts = await Promise.all(batch.map((id) => calcMetricsForFund(prisma, id)));
      metricsTotal += counts.reduce((a, b) => a + b, 0);
      metricsDone += batch.length;
      process.stdout.write(`\r   Funds processed: ${metricsDone}/${updatedIds.length} | Metrics written: ${metricsTotal}   `);
    }

    process.stdout.write('\n');
    console.log(`✅ Metrics recalculation done — ${metricsTotal} metric records written.`);
  }

  await prisma.$disconnect();
  console.log('\n🎉 All done!\n');
}

main().catch((e) => {
  console.error('\n💥 Fatal error:', e);
  process.exit(1);
});
