import { prisma } from '../lib/db';

async function main() {
  console.log('Testing lib/db connection...');
  const result = await prisma.$queryRawUnsafe<{ db: string }[]>(
    'SELECT current_database()::text as db',
  );
  console.log('✅ Connected to database:', result[0].db);

  const tables = await prisma.$queryRawUnsafe<{ table_name: string }[]>(`
    SELECT table_name::text
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);
  console.log('\n📋 Tables in thai_fund:');
  for (const row of tables) {
    console.log(`  ${row.table_name}`);
  }

  // Check row counts
  const amcCount = await prisma.$queryRawUnsafe<{ n: string }[]>('SELECT COUNT(*)::text as n FROM amc');
  const fundCount = await prisma.$queryRawUnsafe<{ n: string }[]>('SELECT COUNT(*)::text as n FROM fund');
  const navCount = await prisma.$queryRawUnsafe<{ n: string }[]>('SELECT COUNT(*)::text as n FROM nav_price');
  console.log(`\n📊 Row counts:`);
  console.log(`  AMCs:       ${amcCount[0].n}`);
  console.log(`  Funds:      ${fundCount[0].n}`);
  console.log(`  NAV prices: ${navCount[0].n}`);
}

main()
  .catch(e => { console.error('❌', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
