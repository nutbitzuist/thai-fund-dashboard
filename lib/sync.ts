// ─────────────────────────────────────────────
// lib/sync.ts
// Daily sync service — runs via Vercel Cron at 11:30 UTC (18:30 TH)
// Orchestrates: AMC sync → Fund sync → NAV sync → Metric calculation
// ─────────────────────────────────────────────

import prisma from './db';
import { fetchAmcList, fetchFundsByAmc, fetchNavBatch } from './sec-api';
import { calcMetrics, NavDataPoint } from './calculations';
import {
  formatDateISO,
  generateWeekdays,
  getPeriodStartDate,
  getLastWeekday,
  chunkArray,
  sleep,
} from './utils';
import { METRIC_PERIODS } from '@/types';

const BATCH_SIZE = 10; // funds per batch for NAV sync
const INTER_BATCH_DELAY = 2000; // ms between batches
const MAX_HISTORY_DAYS = 365 * 5 + 30; // 5 years + buffer

// ── Sync AMC ─────────────────────────────────

export async function syncAmcs(): Promise<number> {
  const amcs = await fetchAmcList();
  let upserted = 0;

  for (const amc of amcs) {
    if (!amc.unique_id) continue;
    await prisma.amc.upsert({
      where: { uniqueId: amc.unique_id },
      update: {
        nameTh: amc.name_th ?? '',
        nameEn: amc.name_en ?? null,
      },
      create: {
        uniqueId: amc.unique_id,
        nameTh: amc.name_th ?? '',
        nameEn: amc.name_en ?? null,
      },
    });
    upserted++;
  }

  return upserted;
}

// ── Sync Funds ────────────────────────────────

export async function syncFunds(): Promise<number> {
  const amcs = await prisma.amc.findMany();
  let upserted = 0;

  for (const amc of amcs) {
    const funds = await fetchFundsByAmc(amc.uniqueId);
    await sleep(300);

    for (const fund of funds) {
      if (!fund.proj_id) continue;
      await prisma.fund.upsert({
        where: { projId: fund.proj_id },
        update: {
          projAbbrName: fund.proj_abbr_name ?? null,
          nameTh: fund.proj_name_th ?? fund.proj_id,
          nameEn: fund.proj_name_en ?? null,
          fundStatus: fund.fund_status ?? null,
          uniqueId: fund.unique_id ?? amc.uniqueId,
          amcId: amc.id,
          fundType: fund.fund_type ?? null,
          riskLevel: fund.risk_spectrum ?? null,
          dividendPolicy: fund.dividend_policy ?? null,
        },
        create: {
          projId: fund.proj_id,
          projAbbrName: fund.proj_abbr_name ?? null,
          nameTh: fund.proj_name_th ?? fund.proj_id,
          nameEn: fund.proj_name_en ?? null,
          fundStatus: fund.fund_status ?? null,
          uniqueId: fund.unique_id ?? amc.uniqueId,
          amcId: amc.id,
          fundType: fund.fund_type ?? null,
          riskLevel: fund.risk_spectrum ?? null,
          dividendPolicy: fund.dividend_policy ?? null,
        },
      });
      upserted++;
    }
  }

  return upserted;
}

// ── Sync NAV ──────────────────────────────────

export async function syncNavForFund(
  fundId: number,
  projId: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  // Find dates already in DB
  const existingNavs = await prisma.navPrice.findMany({
    where: {
      fundId,
      navDate: { gte: startDate, lte: endDate },
    },
    select: { navDate: true },
  });
  const existingDates = new Set(
    existingNavs.map((n) => formatDateISO(new Date(n.navDate)))
  );

  // Generate weekday dates
  const allDates = generateWeekdays(startDate, endDate);
  const missingDates = allDates
    .map((d) => formatDateISO(d))
    .filter((d) => !existingDates.has(d));

  if (!missingDates.length) return 0;

  let inserted = 0;

  for await (const { date, items } of fetchNavBatch(projId, missingDates)) {
    if (!items.length) continue;

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
            // Default class rule: prefer name ending in "-A" or shortest name
            isDefault: false,
          },
        });

        // Mark default: among all classes for this fund, prefer "-A" suffix
        await markDefaultClass(fundId);
      }

      await prisma.navPrice.upsert({
        where: {
          fundClassId_navDate: {
            fundClassId: fundClass.id,
            navDate: new Date(date),
          },
        },
        update: {
          lastVal: lastVal,
          buyPrice: item.buy_price ? parseFloat(item.buy_price) : null,
          sellPrice: item.sell_price ? parseFloat(item.sell_price) : null,
        },
        create: {
          fundId,
          fundClassId: fundClass.id,
          navDate: new Date(date),
          lastVal: lastVal,
          buyPrice: item.buy_price ? parseFloat(item.buy_price) : null,
          sellPrice: item.sell_price ? parseFloat(item.sell_price) : null,
        },
      });
      inserted++;
    }
  }

  return inserted;
}

/**
 * Default class selection rule (documented):
 * 1. Prefer class with name ending in "-A"
 * 2. Otherwise prefer class whose name matches the fund's proj_abbr_name
 * 3. Otherwise use first alphabetically
 */
async function markDefaultClass(fundId: number): Promise<void> {
  const classes = await prisma.fundClass.findMany({
    where: { fundId },
    orderBy: { classAbbrName: 'asc' },
  });

  if (!classes.length) return;

  let defaultClass = classes.find((c) =>
    c.classAbbrName.toUpperCase().endsWith('-A')
  );
  if (!defaultClass) defaultClass = classes[0];

  await prisma.fundClass.updateMany({ where: { fundId }, data: { isDefault: false } });
  await prisma.fundClass.update({
    where: { id: defaultClass.id },
    data: { isDefault: true },
  });
}

// ── Sync NAV Batch ────────────────────────────

export async function syncAllNavs(daysBack = 365): Promise<number> {
  const endDate = getLastWeekday();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - Math.min(daysBack, MAX_HISTORY_DAYS));

  const funds = await prisma.fund.findMany({
    where: { fundStatus: { not: 'LIQ' } },
    select: { id: true, projId: true },
  });

  let total = 0;
  const batches = chunkArray(funds, BATCH_SIZE);

  for (const batch of batches) {
    await Promise.all(
      batch.map((f) => syncNavForFund(f.id, f.projId, startDate, endDate))
    ).then((results) => {
      total += results.reduce((a, b) => a + b, 0);
    });
    await sleep(INTER_BATCH_DELAY);
  }

  return total;
}

// ── Calculate Metrics ─────────────────────────

export async function calculateMetricsForFund(fundId: number): Promise<number> {
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

  const navPoints: NavDataPoint[] = navRecords.map((r) => ({
    date: new Date(r.navDate),
    nav: Number(r.lastVal),
  }));

  const endDate = navPoints[navPoints.length - 1].date;
  let calculated = 0;

  for (const period of METRIC_PERIODS) {
    const startDate = getPeriodStartDate(period, endDate);
    const result = calcMetrics(navPoints, period, startDate, endDate);

    if (result.navCount < 2) continue;

    await prisma.fundMetric.upsert({
      where: {
        fundClassId_period_endDate: {
          fundClassId: defaultClass.id,
          period,
          endDate: result.endDate,
        },
      },
      update: {
        startDate: result.startDate,
        returnPct: result.returnPct,
        annualizedVolatilityPct: result.annualizedVolatilityPct,
        maxDrawdownPct: result.maxDrawdownPct,
        sharpeRatio: result.sharpeRatio,
        navCount: result.navCount,
        calculatedAt: new Date(),
      },
      create: {
        fundId,
        fundClassId: defaultClass.id,
        period,
        startDate: result.startDate,
        endDate: result.endDate,
        returnPct: result.returnPct,
        annualizedVolatilityPct: result.annualizedVolatilityPct,
        maxDrawdownPct: result.maxDrawdownPct,
        sharpeRatio: result.sharpeRatio,
        navCount: result.navCount,
      },
    });
    calculated++;
  }

  return calculated;
}

export async function calculateAllMetrics(): Promise<number> {
  const funds = await prisma.fund.findMany({ select: { id: true } });
  let total = 0;

  const batches = chunkArray(funds, 50);
  for (const batch of batches) {
    const results = await Promise.all(
      batch.map((f) => calculateMetricsForFund(f.id))
    );
    total += results.reduce((a, b) => a + b, 0);
  }

  return total;
}

// ── Full Daily Sync ───────────────────────────

export interface SyncResult {
  amcsSynced: number;
  fundsSynced: number;
  navInserted: number;
  metricsCalculated: number;
  durationMs: number;
  errors: string[];
}

export async function runDailySync(): Promise<SyncResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let amcsSynced = 0;
  let fundsSynced = 0;
  let navInserted = 0;
  let metricsCalculated = 0;

  // Create sync log entry
  const syncLog = await prisma.syncLog.create({
    data: {
      jobType: 'DAILY_SYNC',
      status: 'RUNNING',
      startedAt: new Date(),
    },
  });

  try {
    // Step 1: Sync AMCs
    try {
      amcsSynced = await syncAmcs();
    } catch (e) {
      errors.push(`AMC sync failed: ${String(e)}`);
    }

    // Step 2: Sync Funds
    try {
      fundsSynced = await syncFunds();
    } catch (e) {
      errors.push(`Fund sync failed: ${String(e)}`);
    }

    // Step 3: Sync NAV (last 400 days to avoid excessive API calls)
    try {
      navInserted = await syncAllNavs(400);
    } catch (e) {
      errors.push(`NAV sync failed: ${String(e)}`);
    }

    // Step 4: Calculate Metrics
    try {
      metricsCalculated = await calculateAllMetrics();
    } catch (e) {
      errors.push(`Metric calculation failed: ${String(e)}`);
    }

    const durationMs = Date.now() - startTime;
    const status = errors.length === 0 ? 'SUCCESS' : 'PARTIAL';

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status,
        message: errors.length ? errors.join('; ') : 'OK',
        recordsProcessed: navInserted + metricsCalculated,
        finishedAt: new Date(),
      },
    });

    return { amcsSynced, fundsSynced, navInserted, metricsCalculated, durationMs, errors };
  } catch (e) {
    const durationMs = Date.now() - startTime;
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'FAILED',
        message: String(e),
        finishedAt: new Date(),
      },
    });
    throw e;
  }
}
