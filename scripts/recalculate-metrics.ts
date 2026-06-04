// scripts/recalculate-metrics.ts
// Recalculate derived fund_metric rows from raw nav_price data for active funds.
// Intended for GitHub Actions and manual production repair runs.

import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();
if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/\\n$/, '').trim();

async function main() {
  console.log('[metrics] Loading database client');
  const { default: prisma } = await import('@/lib/db');
  console.log('[metrics] Loading metric engine');
  const { calculateAllMetrics } = await import('@/lib/sync');
  const startedAt = Date.now();

  const activeFunds = await prisma.fund.count({
    where: { fundStatus: { in: ['RG', 'SE'] } },
  });

  console.log(`[metrics] Recalculating metrics for ${activeFunds} active funds`);
  const calculated = await calculateAllMetrics([]);

  const pruned = Number(await prisma.$executeRaw`
    DELETE FROM fund_metric fm
    USING fund_metric newer
    WHERE newer."fundClassId" = fm."fundClassId"
      AND newer.period = fm.period
      AND newer."endDate" > fm."endDate"
  `);

  const [metricRows, latestMetric] = await Promise.all([
    prisma.fundMetric.count(),
    prisma.fundMetric.findFirst({
      orderBy: { endDate: 'desc' },
      select: { endDate: true },
    }),
  ]);

  console.log(JSON.stringify({
    success: true,
    activeFunds,
    calculatedMetricRows: calculated,
    prunedStaleMetricRows: pruned,
    remainingMetricRows: metricRows,
    latestMetricEndDate: latestMetric?.endDate?.toISOString().split('T')[0] ?? null,
    durationMs: Date.now() - startedAt,
  }, null, 2));

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('[metrics] Failed:', err);
  process.exitCode = 1;
});
