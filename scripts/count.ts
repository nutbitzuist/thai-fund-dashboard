import prisma from '../lib/db';
async function main() {
  const [amcs, funds, active, navs, metrics] = await Promise.all([
    prisma.amc.count(),
    prisma.fund.count(),
    prisma.fund.count({ where: { fundStatus: { not: 'LIQ' } } }),
    prisma.navPrice.count(),
    prisma.fundMetric.count(),
  ]);
  console.log(JSON.stringify({ amcs, funds, active_funds: active, navs, metrics }, null, 2));
  await prisma.$disconnect();
}
main().catch(console.error);
