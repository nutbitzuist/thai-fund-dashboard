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
  inferFundType,
  inferRiskLevel,
} from './utils';
import { METRIC_PERIODS } from '@/types';

const BATCH_SIZE = 10; // funds per batch for NAV sync
const INTER_BATCH_DELAY = 2000; // ms between batches

// ── Sync AMC ─────────────────────────────────

export async function syncAmcs(): Promise<number> {
  const amcs = await fetchAmcList();
  let upserted = 0;

  for (const amc of amcs) {
    if (!amc.unique_id) continue;
    // Use raw SQL for deterministic upserts and adapter compatibility
    await prisma.$executeRaw`
      INSERT INTO amc ("uniqueId", "nameTh", "nameEn", "createdAt", "updatedAt")
      VALUES (${amc.unique_id}, ${amc.name_th ?? ''}, ${amc.name_en ?? null}, NOW(), NOW())
      ON CONFLICT ("uniqueId") DO UPDATE SET
        "nameTh"    = EXCLUDED."nameTh",
        "nameEn"    = EXCLUDED."nameEn",
        "updatedAt" = NOW()
    `;
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

      // SEC FundFactsheet API does not return fund_type or risk_spectrum.
      // We infer them from the fund name as a best-effort classification.
      const nameTh = fund.proj_name_th ?? fund.proj_id;
      const nameEn = fund.proj_name_en ?? null;
      const investFlag = fund.invest_country_flag ?? null;
      const inferredType = fund.fund_type ?? inferFundType(nameTh, nameEn, investFlag);
      const inferredRisk = fund.risk_spectrum ?? inferRiskLevel(inferredType, investFlag);

      // Parse inception date — SEC returns "YYYY-MM-DD" or "-" for unknown
      const regisDateRaw = fund.regis_date;
      const regisDate =
        regisDateRaw && regisDateRaw !== '-' && /^\d{4}-\d{2}-\d{2}$/.test(regisDateRaw)
          ? new Date(regisDateRaw)
          : null;

      // Use raw SQL for deterministic upserts and adapter compatibility
      await prisma.$executeRaw`
        INSERT INTO fund ("projId", "projAbbrName", "nameTh", "nameEn", "fundStatus",
                          "uniqueId", "amcId", "fundType", "riskLevel", "dividendPolicy",
                          "regisDate", "createdAt", "updatedAt")
        VALUES (
          ${fund.proj_id}, ${fund.proj_abbr_name ?? null}, ${nameTh}, ${nameEn},
          ${fund.fund_status ?? null}, ${fund.unique_id ?? amc.uniqueId}, ${amc.id},
          ${inferredType ?? null}, ${inferredRisk ?? null}, ${fund.dividend_policy ?? null},
          ${regisDate}, NOW(), NOW()
        )
        ON CONFLICT ("projId") DO UPDATE SET
          "projAbbrName"  = EXCLUDED."projAbbrName",
          "nameTh"        = EXCLUDED."nameTh",
          "nameEn"        = EXCLUDED."nameEn",
          "fundStatus"    = EXCLUDED."fundStatus",
          "uniqueId"      = EXCLUDED."uniqueId",
          "amcId"         = EXCLUDED."amcId",
          "fundType"      = EXCLUDED."fundType",
          "riskLevel"     = EXCLUDED."riskLevel",
          "dividendPolicy" = EXCLUDED."dividendPolicy",
          "regisDate"     = COALESCE(EXCLUDED."regisDate", fund."regisDate"),
          "updatedAt"     = NOW()
      `;
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

      const netAsset =
        item.net_asset != null && item.net_asset > 0 ? item.net_asset : null;

      // Use raw SQL for deterministic upserts and adapter compatibility
      const buyPrice = item.buy_price ? parseFloat(item.buy_price) : null;
      const sellPrice = item.sell_price ? parseFloat(item.sell_price) : null;
      await prisma.$executeRaw`
        INSERT INTO nav_price ("fundId", "fundClassId", "navDate", "lastVal",
                               "buyPrice", "sellPrice", "netAsset", "createdAt", "updatedAt")
        VALUES (${fundId}, ${fundClass.id}, ${new Date(date)}, ${lastVal},
                ${buyPrice}, ${sellPrice}, ${netAsset}, NOW(), NOW())
        ON CONFLICT ("fundClassId", "navDate") DO UPDATE SET
          "lastVal"   = EXCLUDED."lastVal",
          "buyPrice"  = EXCLUDED."buyPrice",
          "sellPrice" = EXCLUDED."sellPrice",
          "netAsset"  = COALESCE(EXCLUDED."netAsset", nav_price."netAsset"),
          "updatedAt" = NOW()
      `;
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

/**
 * Daily incremental NAV sync — designed to fit within Vercel's timeout.
 *
 * Strategy:
 * - Funds that ALREADY have NAV data: fetch last `recentDays` days only
 *   (most dates exist, so this is very fast — typically 0-1 missing days per fund)
 * - Funds with NO NAV data yet: fetch last `newFundDays` days to bootstrap them
 *   (limited batch size to avoid timeout)
 *
 * For historical backfill run scripts/backfill-navs.ts locally.
 */
export async function syncAllNavs(
  recentDays = 7,
  newFundDays = 30,
  maxNewFunds = 50 // cap new-fund bootstrap per cron run to stay within timeout
): Promise<{ inserted: number; updatedFundIds: number[] }> {
  const endDate = getLastWeekday();

  // Auto-extend lookback window if the DB has fallen behind (e.g. after an outage).
  // Caps at 30 days to avoid blowing the Vercel function timeout.
  const lastNavRecord = await prisma.navPrice.findFirst({
    orderBy: { navDate: 'desc' },
    select: { navDate: true },
  });
  if (lastNavRecord) {
    const daysBehind = Math.floor(
      (endDate.getTime() - new Date(lastNavRecord.navDate).getTime()) / 86400000
    );
    if (daysBehind > recentDays) {
      recentDays = Math.min(daysBehind + 2, 30);
    }
  }

  const recentStart = new Date(endDate);
  recentStart.setDate(recentStart.getDate() - recentDays);

  const newFundStart = new Date(endDate);
  newFundStart.setDate(newFundStart.getDate() - newFundDays);

  // Separate active funds into those with existing data vs new
  const [fundsWithData, fundsWithoutData] = await Promise.all([
    prisma.fund.findMany({
      where: { fundStatus: { in: ['RG', 'SE'] }, fundClasses: { some: {} } },
      select: { id: true, projId: true },
    }),
    prisma.fund.findMany({
      where: { fundStatus: { in: ['RG', 'SE'] }, fundClasses: { none: {} } },
      select: { id: true, projId: true },
      take: maxNewFunds, // limit new fund bootstrapping per run
    }),
  ]);

  // Active-fund guard (we expect ~2,300 active RG/SE funds with classes). If the active set
  // collapses, SEC's fundStatus codes likely changed and our 'RG'/'SE' filter now matches
  // almost nothing — fail loudly instead of silently syncing zero funds.
  if (fundsWithData.length < 1000) {
    throw new Error(
      `Active-fund guard: only ${fundsWithData.length} active funds with classes (expected ~2,300). ` +
      `SEC fundStatus codes may have changed — refusing to sync nothing.`
    );
  }

  let inserted = 0;
  const updatedFundIds: number[] = [];

  // Catch-up throttle: when the lookback window is large (the DB fell behind), each fund needs
  // many missing dates, so the default concurrency bursts SEC and trips its rate limit. Shrink
  // the batch size and lengthen the inter-batch pause so a big catch-up degrades to "slow but
  // reliable" instead of failing. Normal daily runs (small window) are unaffected.
  const isCatchUp = recentDays > 10;
  const batchSize = isCatchUp ? 4 : BATCH_SIZE;
  const interBatchDelay = isCatchUp ? 5000 : INTER_BATCH_DELAY;
  if (isCatchUp) {
    console.warn(
      `[sync] Catch-up mode (recentDays=${recentDays}): throttling to batchSize=${batchSize}, interBatchDelay=${interBatchDelay}ms`
    );
  }

  // Sync recent NAV for funds that already have data (fast path)
  const existingBatches = chunkArray(fundsWithData, batchSize);
  for (const batch of existingBatches) {
    const results = await Promise.all(
      batch.map((f) => syncNavForFund(f.id, f.projId, recentStart, endDate))
    );
    results.forEach((count, i) => {
      inserted += count;
      if (count > 0) updatedFundIds.push(batch[i].id);
    });
    await sleep(interBatchDelay);
  }

  // Bootstrap new funds with a short window
  const newBatches = chunkArray(fundsWithoutData, batchSize);
  for (const batch of newBatches) {
    const results = await Promise.all(
      batch.map((f) => syncNavForFund(f.id, f.projId, newFundStart, endDate))
    );
    results.forEach((count, i) => {
      inserted += count;
      if (count > 0) updatedFundIds.push(batch[i].id);
    });
    await sleep(interBatchDelay);
  }

  return { inserted, updatedFundIds };
}

export async function backfillNavHistory(
  targetDays = 730,
  daysPerFund = 30,
  maxFunds = 5
): Promise<{ inserted: number; fundsProcessed: number; updatedFundIds: number[] }> {
  const endDate = getLastWeekday();
  const targetStart = new Date(endDate);
  targetStart.setDate(targetStart.getDate() - targetDays);

  const funds = await prisma.fund.findMany({
    where: { fundStatus: { in: ['RG', 'SE'] }, fundClasses: { some: {} } },
    select: {
      id: true,
      projId: true,
      navPrices: {
        orderBy: { navDate: 'asc' },
        take: 1,
        select: { navDate: true },
      },
    },
  });

  const candidates = funds
    .map((fund) => ({
      id: fund.id,
      projId: fund.projId,
      earliestNavDate: fund.navPrices[0]?.navDate ? new Date(fund.navPrices[0].navDate) : null,
    }))
    .filter((fund) => fund.earliestNavDate == null || fund.earliestNavDate > targetStart)
    .sort((a, b) => {
      const aTime = a.earliestNavDate?.getTime() ?? Number.POSITIVE_INFINITY;
      const bTime = b.earliestNavDate?.getTime() ?? Number.POSITIVE_INFINITY;
      return bTime - aTime;
    })
    .slice(0, maxFunds);

  let inserted = 0;
  const updatedFundIds: number[] = [];

  for (const fund of candidates) {
    const backfillEnd = fund.earliestNavDate
      ? new Date(fund.earliestNavDate.getTime() - 86400000)
      : endDate;
    const backfillStart = new Date(backfillEnd);
    backfillStart.setDate(backfillStart.getDate() - daysPerFund);
    if (backfillStart < targetStart) backfillStart.setTime(targetStart.getTime());
    if (backfillStart > backfillEnd) continue;

    const count = await syncNavForFund(fund.id, fund.projId, backfillStart, backfillEnd);
    inserted += count;
    if (count > 0) updatedFundIds.push(fund.id);
    await sleep(INTER_BATCH_DELAY);
  }

  return { inserted, fundsProcessed: candidates.length, updatedFundIds };
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

    // Use raw SQL for deterministic upserts and adapter compatibility
    await prisma.$executeRaw`
      INSERT INTO fund_metric ("fundId", "fundClassId", period, "startDate", "endDate",
                               "returnPct", "annualizedVolatilityPct", "maxDrawdownPct",
                               "sharpeRatio", "navCount", "calculatedAt")
      VALUES (
        ${fundId}, ${defaultClass.id}, ${period},
        ${result.startDate}, ${result.endDate},
        ${result.returnPct}, ${result.annualizedVolatilityPct},
        ${result.maxDrawdownPct}, ${result.sharpeRatio},
        ${result.navCount}, NOW()
      )
      ON CONFLICT ("fundClassId", period, "endDate") DO UPDATE SET
        "startDate"               = EXCLUDED."startDate",
        "returnPct"               = EXCLUDED."returnPct",
        "annualizedVolatilityPct" = EXCLUDED."annualizedVolatilityPct",
        "maxDrawdownPct"          = EXCLUDED."maxDrawdownPct",
        "sharpeRatio"             = EXCLUDED."sharpeRatio",
        "navCount"                = EXCLUDED."navCount",
        "calculatedAt"            = NOW()
    `;
    calculated++;
  }

  return calculated;
}

/**
 * Recalculate metrics for a specific set of fund IDs (e.g. those updated in the
 * current sync run). Pass an empty array to recalculate all active funds.
 */
export async function calculateAllMetrics(fundIds?: number[]): Promise<number> {
  let ids: number[];

  if (fundIds && fundIds.length > 0) {
    // Targeted: only recalculate funds that got new NAV data this run
    ids = fundIds;
  } else {
    // Full recalc: scope to active funds only (never touch liquidated funds)
    const funds = await prisma.fund.findMany({
      where: { fundStatus: { in: ['RG', 'SE'] } },
      select: { id: true },
    });
    ids = funds.map((f) => f.id);
  }

  let total = 0;
  const batches = chunkArray(ids, 50);
  for (const batch of batches) {
    const results = await Promise.all(batch.map((id) => calculateMetricsForFund(id)));
    total += results.reduce((a, b) => a + b, 0);
  }

  return total;
}

/**
 * Active funds whose metrics are stale or missing — the default class's latest NAV is newer
 * than its latest computed metric (or it has none yet). Lets auto-repair recalc only what is
 * actually broken instead of all ~2,300 active funds (the main driver of the ~1.8h runtime).
 */
export async function getFundIdsNeedingMetrics(): Promise<number[]> {
  const rows = await prisma.$queryRaw<{ id: number }[]>`
    SELECT f.id
    FROM fund f
    JOIN fund_class fc ON fc."fundId" = f.id AND fc."isDefault" = true
    LEFT JOIN LATERAL (
      SELECT max("navDate") AS d FROM nav_price WHERE "fundClassId" = fc.id
    ) nav ON true
    LEFT JOIN LATERAL (
      SELECT max("endDate") AS d FROM fund_metric WHERE "fundClassId" = fc.id
    ) met ON true
    WHERE f."fundStatus" IN ('RG', 'SE')
      AND nav.d IS NOT NULL
      AND (met.d IS NULL OR nav.d > met.d)
  `;
  return rows.map((r) => r.id);
}

// ── Full Daily Sync ───────────────────────────

export interface SyncResult {
  amcsSynced: number;
  fundsSynced: number;
  navInserted: number;
  metricsCalculated: number;
  durationMs: number;
  errors: string[];
  lastNavDate: string | null;
}

// ── Webhook Alert ────────────────────────────

async function sendSyncAlert(subject: string, body: string): Promise<void> {
  const webhookUrl = process.env.SYNC_ALERT_WEBHOOK_URL;
  if (!webhookUrl) return; // alerting is opt-in; no-op if not configured

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🚨 Thai Fund Dashboard — ${subject}\n${body}`,
        // Discord format (works for Slack too)
        embeds: undefined,
      }),
    });
  } catch {
    // Non-critical — don't let alerting break the sync
    console.error('[sync] Failed to send webhook alert');
  }
}

export async function runDailySync(): Promise<SyncResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let amcsSynced = 0;
  let fundsSynced = 0;
  let navInserted = 0;
  let metricsCalculated = 0;

  // Clean up stale RUNNING logs from previous timed-out runs
  await prisma.syncLog.updateMany({
    where: {
      status: 'RUNNING',
      startedAt: { lt: new Date(Date.now() - 10 * 60 * 1000) }, // older than 10 min
    },
    data: {
      status: 'FAILED',
      message: 'Timed out (Vercel function limit — no finish recorded)',
      finishedAt: new Date(),
    },
  }).catch(() => {}); // non-critical; ignore errors

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

    // Step 3: Incremental NAV sync
    // - Existing funds: last 7 days only (fast path — most already in DB)
    // - New funds (no classes yet): last 30 days × up to 50 funds per run
    // Historical backfill: run scripts/backfill-navs.ts locally
    let updatedFundIds: number[] = [];
    try {
      const navResult = await syncAllNavs(7, 30, 50);
      navInserted = navResult.inserted;
      updatedFundIds = navResult.updatedFundIds;
    } catch (e) {
      errors.push(`NAV sync failed: ${String(e)}`);
    }

    // Step 4: Calculate Metrics — only for funds that received new NAV data.
    // This avoids iterating all 14k+ funds (including liquidated) every run.
    try {
      metricsCalculated = await calculateAllMetrics(updatedFundIds);
    } catch (e) {
      errors.push(`Metric calculation failed: ${String(e)}`);
    }

    const durationMs = Date.now() - startTime;
    const syncStatus = errors.length === 0 ? 'SUCCESS' : 'PARTIAL';

    // Capture the latest NAV date now (after all inserts) for reporting
    const latestNavRecord = await prisma.navPrice.findFirst({
      orderBy: { navDate: 'desc' },
      select: { navDate: true },
    });
    const lastNavDate = latestNavRecord
      ? new Date(latestNavRecord.navDate).toISOString().split('T')[0]
      : null;

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: syncStatus,
        message: errors.length ? errors.join('; ') : 'OK',
        recordsProcessed: navInserted + metricsCalculated,
        finishedAt: new Date(),
      },
    });

    // Send alert on partial failure
    if (errors.length > 0) {
      await sendSyncAlert(
        `Partial sync failure (${errors.length} error${errors.length > 1 ? 's' : ''})`,
        [
          `Status: ${syncStatus}`,
          `Duration: ${(durationMs / 1000).toFixed(1)}s`,
          `AMCs: ${amcsSynced} | Funds: ${fundsSynced} | NAV: ${navInserted} | Metrics: ${metricsCalculated}`,
          `Last NAV date: ${lastNavDate ?? 'unknown'}`,
          `Errors:\n${errors.map((e) => `• ${e}`).join('\n')}`,
        ].join('\n')
      );
    }

    return { amcsSynced, fundsSynced, navInserted, metricsCalculated, durationMs, errors, lastNavDate };
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

    // Alert on complete failure
    await sendSyncAlert(
      'Daily sync FAILED',
      [
        `Error: ${String(e)}`,
        `Duration: ${(durationMs / 1000).toFixed(1)}s`,
        'Check Vercel runtime logs for details.',
      ].join('\n')
    );

    throw e;
  }
}
