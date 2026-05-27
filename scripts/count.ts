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
  
  await prisma.$disconnect();
}
main().catch(console.error);
