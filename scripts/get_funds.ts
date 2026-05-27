import prisma from '../lib/db';
async function main() {
  const types = await prisma.fund.groupBy({ by: ['fundType'], _count: true, orderBy: { _count: { fundType: 'desc' } }, take: 8, where: { fundStatus: 'RG' } });
  console.log('Fund types:', JSON.stringify(types));
  const funds = await prisma.fund.findMany({ 
    where: { fundStatus: 'RG' }, 
    take: 10, orderBy: { projAbbrName: 'asc' },
    select: { projId: true, projAbbrName: true, fundType: true }
  });
  console.log(JSON.stringify(funds, null, 2));
  await prisma.$disconnect();
}
main().catch(console.error);
