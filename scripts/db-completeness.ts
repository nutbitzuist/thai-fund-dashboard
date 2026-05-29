import { Prisma } from '@prisma/client';
import prisma from '../lib/db';
async function main() {
  const total = await prisma.fund.count({ where: { fundStatus: { in: ['RG','SE'] } } });

  const [withNav, withMetrics, withFees, withPolicy, withAsset, withBenchmark, withSecReturn, withFundType] = await Promise.all([
    // Has at least one NAV price
    prisma.fund.count({ where: { fundStatus: { in: ['RG','SE'] }, navPrices: { some: {} } } }),
    // Has at least one fund metric
    prisma.fund.count({ where: { fundStatus: { in: ['RG','SE'] }, fundMetrics: { some: {} } } }),
    // Has TER fee data
    prisma.fund.count({ where: { fundStatus: { in: ['RG','SE'] }, totalExpenseRatio: { not: null } } }),
    // Has investment policy text
    prisma.fund.count({ where: { fundStatus: { in: ['RG','SE'] }, investmentPolicy: { not: null } } }),
    // Has asset allocation
    prisma.fund.count({ where: { fundStatus: { in: ['RG','SE'] }, assetAllocation: { not: Prisma.DbNull } } }),
    // Has benchmark
    prisma.fund.count({ where: { fundStatus: { in: ['RG','SE'] }, benchmark: { not: null } } }),
    // Has SEC return YTD
    prisma.fund.count({ where: { fundStatus: { in: ['RG','SE'] }, secReturnYtd: { not: null } } }),
    // Has fund type classified
    prisma.fund.count({ where: { fundStatus: { in: ['RG','SE'] }, fundType: { not: null } } }),
  ]);

  const pct = (n: number) => `${n}/${total} (${((n/total)*100).toFixed(1)}%)`;

  console.log(`\n=== Active Fund Coverage (${total} active funds) ===`);
  console.log(`Fund type classified : ${pct(withFundType)}`);
  console.log(`Has NAV data         : ${pct(withNav)}`);
  console.log(`Has metrics (returns): ${pct(withMetrics)}`);
  console.log(`Has fee data (TER)   : ${pct(withFees)}`);
  console.log(`Has investment policy: ${pct(withPolicy)}`);
  console.log(`Has asset allocation : ${pct(withAsset)}`);
  console.log(`Has benchmark        : ${pct(withBenchmark)}`);
  console.log(`Has SEC return YTD   : ${pct(withSecReturn)}`);

  // Funds still missing NAV
  const noNav = total - withNav;
  console.log(`\nFunds without NAV    : ${noNav} (bootstrapped ~50/day by cron)`);

  // Metrics with SEC performance data
  const metricsTotal = await prisma.fundMetric.count({ where: { period: '1Y' } });
  const metricsWithSec = await prisma.fundMetric.count({ where: { period: '1Y', secReturnPct: { not: null } } });
  console.log(`\n1Y metrics with SEC return: ${metricsWithSec}/${metricsTotal} (${((metricsWithSec/metricsTotal)*100).toFixed(1)}%)`);

  await prisma.$disconnect();
}
main().catch(console.error);
