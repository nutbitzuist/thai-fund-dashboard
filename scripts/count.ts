import prisma from '../lib/db';
async function main() {
  // Check fund types
  const types = await prisma.fund.groupBy({ by: ['fundType'], _count: true, where: { fundStatus: { in: ['RG','SE'] } }, orderBy: { _count: { fundType: 'desc' } }, take: 10 });
  console.log('Fund types (active):', JSON.stringify(types));
  
  // Top 5 by 1Y return
  const top1Y = await prisma.fundMetric.findMany({
    where: { period: '1Y', returnPct: { not: null }, fundClass: { isDefault: true }, fund: { fundStatus: { in: ['RG','SE'] } } },
    orderBy: { returnPct: 'desc' },
    take: 5,
    include: { fund: { select: { projAbbrName: true, nameTh: true, amc: { select: { nameTh: true } } } } }
  });
  console.log('\nTop 5 - 1Y Return:');
  for (const m of top1Y) console.log(` ${m.fund.projAbbrName} ${Number(m.returnPct).toFixed(2)}%`);
  
  // Top 5 by 3M return
  const top3M = await prisma.fundMetric.findMany({
    where: { period: '3M', returnPct: { not: null }, fundClass: { isDefault: true }, fund: { fundStatus: { in: ['RG','SE'] } } },
    orderBy: { returnPct: 'desc' },
    take: 5,
    include: { fund: { select: { projAbbrName: true, nameTh: true } } }
  });
  console.log('\nTop 5 - 3M Return:');
  for (const m of top3M) console.log(` ${m.fund.projAbbrName} ${Number(m.returnPct).toFixed(2)}%`);
  
  // Row counts
  const [totalFunds, totalClasses, totalNavs, totalMetrics] = await Promise.all([
    prisma.fund.count(),
    prisma.fundClass.count(),
    prisma.navPrice.count(),
    prisma.fundMetric.count(),
  ]);
  console.log('\n=== Row Counts ===');
  console.log(`funds=${totalFunds.toLocaleString()} classes=${totalClasses.toLocaleString()} nav_prices=${totalNavs.toLocaleString()} metrics=${totalMetrics.toLocaleString()}`);

  // Table + DB sizes
  const sizes = await prisma.$queryRaw`
    SELECT relname::text, pg_size_pretty(pg_total_relation_size(relid)) AS size, n_live_tup AS rows
    FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC
  ` as Array<{relname:string, size:string, rows:bigint}>;
  console.log('\n=== Table Sizes ===');
  for (const r of sizes) console.log(`  ${r.relname.padEnd(20)} ${r.size.padEnd(12)} ~${Number(r.rows).toLocaleString()} rows`);

  const [db] = await prisma.$queryRaw`SELECT pg_size_pretty(pg_database_size(current_database())) AS size` as Array<{size:string}>;
  console.log('\nTotal DB size:', db.size);

  await prisma.$disconnect();
}
main().catch(console.error);
