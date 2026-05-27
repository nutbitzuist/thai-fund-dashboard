// scripts/backfill-regis-dates.ts
// One-time: populate Fund.regisDate from SEC Factsheet API
// Run: source .env.local && DATABASE_URL="$DATABASE_URL" SEC_API_KEY="$SEC_API_KEY" npx tsx scripts/backfill-regis-dates.ts

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const SEC_BASE = 'https://api.sec.or.th';

async function fetchAmcs(apiKey: string) {
  const res = await fetch(`${SEC_BASE}/FundFactsheet/fund/amc`, {
    headers: { 'Ocp-Apim-Subscription-Key': apiKey },
  });
  return res.json() as Promise<Array<{ unique_id: string; name_th: string }>>;
}

async function fetchFundsByAmc(uniqueId: string, apiKey: string) {
  const res = await fetch(`${SEC_BASE}/FundFactsheet/fund/amc/${encodeURIComponent(uniqueId)}`, {
    headers: { 'Ocp-Apim-Subscription-Key': apiKey },
  });
  if (!res.ok) return [];
  return res.json() as Promise<Array<{ proj_id: string; regis_date?: string }>>;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const connStr = process.env.DATABASE_URL;
  if (!connStr) throw new Error('DATABASE_URL not set');
  const apiKey = process.env.SEC_API_KEY;
  if (!apiKey) throw new Error('SEC_API_KEY not set');

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: connStr, max: 1 }) });

  console.log('Fetching AMCs...');
  const amcs = await fetchAmcs(apiKey);
  console.log(`Found ${amcs.length} AMCs`);

  let updated = 0;
  let skipped = 0;

  for (const amc of amcs) {
    const funds = await fetchFundsByAmc(amc.unique_id, apiKey);
    await sleep(300);

    for (const fund of funds) {
      if (!fund.proj_id || !fund.regis_date || fund.regis_date === '-') { skipped++; continue; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fund.regis_date)) { skipped++; continue; }
      const regisDate = new Date(fund.regis_date);
      await prisma.fund.updateMany({
        where: { projId: fund.proj_id, regisDate: null },
        data: { regisDate },
      });
      updated++;
    }

    process.stdout.write(`\r  AMC ${amcs.indexOf(amc) + 1}/${amcs.length} | updated: ${updated}`);
  }

  process.stdout.write('\n');
  console.log(`Done! Updated: ${updated}, Skipped (no date): ${skipped}`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
