// scripts/backfill-dividend-policy.ts
// Populate Fund.dividendPolicy from the SEC /dividend endpoint.
// The endpoint returns per-class dividend_policy ('Y'/'N').
// We set the fund-level field based on the default class's policy.
// Run: source .env.local && npx tsx scripts/backfill-dividend-policy.ts

import { createClient } from '../lib/db';

const SEC_BASE = 'https://api.sec.or.th';
const DELAY_MS = 250;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

interface DividendClass {
  class_abbr_name: string;
  dividend_policy: 'Y' | 'N' | string;
  dividend_details: unknown[];
}

async function fetchDividendPolicy(projId: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${SEC_BASE}/FundFactsheet/fund/${encodeURIComponent(projId)}/dividend`,
      { headers: { 'Ocp-Apim-Subscription-Key': apiKey, Accept: 'application/json' } }
    );
    if (res.status === 204 || res.status === 404) return null;
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text === 'null') return null;
    const data: DividendClass | DividendClass[] = JSON.parse(text);
    const classes: DividendClass[] = Array.isArray(data) ? data : [data];
    if (!classes.length) return null;
    // Primary class determines fund-level policy
    // Prefer the class matching default (ends with -A for accumulation, -D for dividend)
    // If any class pays dividends, mark as PAID
    const anyDividend = classes.some(c => c.dividend_policy === 'Y');
    return anyDividend ? 'PAID' : 'ACCUMULATE';
  } catch {
    return null;
  }
}

async function main() {
  const connStr = process.env.DATABASE_URL;
  if (!connStr) throw new Error('DATABASE_URL not set');
  const apiKey = process.env.SEC_API_KEY;
  if (!apiKey) throw new Error('SEC_API_KEY not set');

  const prisma = createClient();

  const funds = await prisma.fund.findMany({
    where: { fundStatus: { in: ['RG', 'SE'] } },
    select: { id: true, projId: true, projAbbrName: true },
    orderBy: { projId: 'asc' },
  });

  console.log(`Processing ${funds.length} active funds...`);

  let paid = 0, accumulate = 0, noData = 0, errors = 0;

  for (let i = 0; i < funds.length; i++) {
    const fund = funds[i];
    try {
      const policy = await fetchDividendPolicy(fund.projId, apiKey);
      if (policy) {
        await prisma.fund.update({ where: { id: fund.id }, data: { dividendPolicy: policy } });
        if (policy === 'PAID') paid++; else accumulate++;
      } else {
        noData++;
      }
    } catch (err) {
      errors++;
      console.error(`\nError on ${fund.projAbbrName}: ${err}`);
    }

    if ((i + 1) % 100 === 0 || i === funds.length - 1) {
      console.log(`[${i + 1}/${funds.length}] PAID=${paid} ACCUMULATE=${accumulate} noData=${noData} errors=${errors}`);
    }

    await sleep(DELAY_MS);
  }

  console.log(`\nDone. PAID=${paid} ACCUMULATE=${accumulate} noData=${noData} errors=${errors}`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
