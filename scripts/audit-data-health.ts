// scripts/audit-data-health.ts
// Production data-health audit for raw NAV coverage and derived metric coverage.

import dotenv from 'dotenv';
import { PERIOD_MIN_NAV_COUNT } from '@/lib/utils';

dotenv.config({ path: '.env.local' });
dotenv.config();
if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/\\n$/, '').trim();

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

async function main() {
  const { default: prisma } = await import('@/lib/db');
  const [counts] = await prisma.$queryRaw<Array<{
    amcs: number;
    funds_total: number;
    funds_active_dashboard: number;
    fund_classes: number;
    default_classes: number;
    nav_records: number;
    metric_records: number;
  }>>`
    SELECT
      (SELECT COUNT(*)::int FROM amc) AS amcs,
      (SELECT COUNT(*)::int FROM fund) AS funds_total,
      (SELECT COUNT(*)::int FROM fund WHERE "fundStatus" IN ('RG','SE')) AS funds_active_dashboard,
      (SELECT COUNT(*)::int FROM fund_class) AS fund_classes,
      (SELECT COUNT(*)::int FROM fund_class WHERE "isDefault") AS default_classes,
      (SELECT COUNT(*)::int FROM nav_price) AS nav_records,
      (SELECT COUNT(*)::int FROM fund_metric) AS metric_records
  `;

  const [navGlobal] = await prisma.$queryRaw<Array<{
    first_nav_date: Date | null;
    last_nav_date: Date | null;
    calendar_days_span: number | null;
    years_span: number | null;
  }>>`
    SELECT MIN("navDate") AS first_nav_date,
           MAX("navDate") AS last_nav_date,
           (MAX("navDate") - MIN("navDate"))::int + 1 AS calendar_days_span,
           ROUND((((MAX("navDate") - MIN("navDate"))::numeric + 1) / 365.25), 2)::float AS years_span
    FROM nav_price
  `;

  const [defaultCoverage] = await prisma.$queryRaw<Array<Record<string, number | Date | null>>>`
    WITH per AS (
      SELECT f.id,
             MIN(n."navDate") AS first_nav,
             MAX(n."navDate") AS last_nav,
             COUNT(n.*)::int AS nav_count
      FROM fund f
      JOIN fund_class fc ON fc."fundId" = f.id AND fc."isDefault" = TRUE
      LEFT JOIN nav_price n ON n."fundClassId" = fc.id
      WHERE f."fundStatus" IN ('RG','SE')
      GROUP BY f.id
    )
    SELECT
      COUNT(*)::int AS active_default_classes,
      COUNT(*) FILTER (WHERE nav_count > 0)::int AS with_any_nav,
      COUNT(*) FILTER (WHERE nav_count >= ${PERIOD_MIN_NAV_COUNT['1M']})::int AS enough_1m,
      COUNT(*) FILTER (WHERE nav_count >= ${PERIOD_MIN_NAV_COUNT['3M']})::int AS enough_3m,
      COUNT(*) FILTER (WHERE nav_count >= ${PERIOD_MIN_NAV_COUNT['6M']})::int AS enough_6m,
      COUNT(*) FILTER (WHERE nav_count >= ${PERIOD_MIN_NAV_COUNT['1Y']})::int AS enough_1y,
      COUNT(*) FILTER (WHERE nav_count >= ${PERIOD_MIN_NAV_COUNT['3Y']})::int AS enough_3y,
      COUNT(*) FILTER (WHERE nav_count >= ${PERIOD_MIN_NAV_COUNT['5Y']})::int AS enough_5y,
      MIN(first_nav) AS earliest_default_nav,
      MAX(last_nav) AS latest_default_nav,
      ROUND(AVG(nav_count), 1)::float AS avg_nav_points_per_default_class,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY nav_count)::int AS median_nav_points
    FROM per
  `;

  const metricCoverage = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    WITH latest AS (
      SELECT DISTINCT ON (fm."fundClassId", fm.period)
        fm."fundClassId", fm.period, fm."returnPct", fm."endDate", fm."navCount"
      FROM fund_metric fm
      JOIN fund_class fc ON fc.id = fm."fundClassId" AND fc."isDefault" = TRUE
      JOIN fund f ON f.id = fm."fundId" AND f."fundStatus" IN ('RG','SE')
      WHERE fm."returnPct" IS NOT NULL
      ORDER BY fm."fundClassId", fm.period, fm."endDate" DESC
    )
    SELECT period,
           COUNT(*)::int AS latest_metric_rows,
           MAX("endDate") AS latest_end,
           MIN("navCount")::int AS min_nav_count,
           MAX("navCount")::int AS max_nav_count,
           ROUND(AVG("navCount"), 1)::float AS avg_nav_count
    FROM latest
    GROUP BY period
    ORDER BY CASE period WHEN '1M' THEN 1 WHEN '3M' THEN 2 WHEN '6M' THEN 3 WHEN 'YTD' THEN 4 WHEN '1Y' THEN 5 WHEN '3Y' THEN 6 WHEN '5Y' THEN 7 WHEN 'MAX' THEN 8 ELSE 9 END
  `;

  const latestNavDate = navGlobal.last_nav_date ? new Date(navGlobal.last_nav_date) : null;
  const daysSinceLastNav = latestNavDate
    ? Math.floor((Date.now() - latestNavDate.getTime()) / 86_400_000)
    : 999;

  const report = {
    healthy: daysSinceLastNav <= 4,
    daysSinceLastNav,
    counts,
    navGlobal,
    defaultCoverage,
    metricCoverage,
    checkedAt: new Date().toISOString(),
  };

  console.log(JSON.stringify(report, null, 2));

  if (hasFlag('--fail-on-stale') && !report.healthy) {
    process.exitCode = 1;
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('[audit] Failed:', err);
  process.exitCode = 1;
});
