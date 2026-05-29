// scripts/backfill-fees.ts
// Fetch fee data + investment policy from SEC API for all active funds
// Run: source .env.local && DATABASE_URL="$DATABASE_URL" SEC_API_KEY="$SEC_API_KEY" npx tsx scripts/backfill-fees.ts

import { createClient } from '../lib/db';

const SEC_BASE = 'https://api.sec.or.th';
const DELAY_MS = 350; // stay under SEC rate limit

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

interface FeeItem {
  fee_type_desc: string;
  rate: string | null;
  actual_value: string | null;
}

interface PolicyItem {
  investment_policy_desc?: string | null;
}

async function secGet<T>(url: string, apiKey: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { 'Ocp-Apim-Subscription-Key': apiKey, Accept: 'application/json' },
    });
    if (res.status === 404 || res.status === 204) return null;
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text === 'null') return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function parseNum(val: string | null | undefined): number | null {
  if (val == null || val === '' || val === '-') return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function decodePolicy(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // SEC sometimes returns base64, sometimes plain Thai text
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf-8');
    // Sanity check: decoded should contain Thai chars
    if (/[฀-๿]/.test(decoded)) return decoded.trim();
  } catch { /* fall through */ }
  // Already plain text
  if (/[฀-๿]/.test(raw)) return raw.trim();
  return null;
}

function parseFees(items: FeeItem[]) {
  const find = (keyword: string) => items.find(i => i.fee_type_desc.includes(keyword));

  const frontend = find('Front-end');
  const backend  = find('Back-end');
  const mgmt     = find('ค่าธรรมเนียมการจัดการ');
  const ter      = find('รวมทั้งหมด');

  // Use actual_value (currently charged), fall back to rate (ceiling) only if actual_value missing
  const pick = (item: FeeItem | undefined) =>
    item ? (parseNum(item.actual_value) ?? parseNum(item.rate)) : null;

  return {
    frontEndFee:       pick(frontend),
    backEndFee:        pick(backend),
    managementFee:     pick(mgmt),
    totalExpenseRatio: pick(ter),
  };
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

  let updated = 0;
  let noData  = 0;
  let errors  = 0;

  for (let i = 0; i < funds.length; i++) {
    const fund = funds[i];

    try {
      const [feeItems, policy] = await Promise.all([
        secGet<FeeItem[]>(`${SEC_BASE}/FundFactsheet/fund/${encodeURIComponent(fund.projId)}/fee`, apiKey),
        secGet<PolicyItem>(`${SEC_BASE}/FundFactsheet/fund/${encodeURIComponent(fund.projId)}/policy`, apiKey),
      ]);

      if (!feeItems && !policy) {
        noData++;
        if ((i + 1) % 100 === 0) process.stdout.write('.');
        await sleep(DELAY_MS);
        continue;
      }

      const fees = feeItems ? parseFees(feeItems) : {};
      const investmentPolicy = decodePolicy(policy?.investment_policy_desc);

      await prisma.fund.update({
        where: { id: fund.id },
        data: {
          ...fees,
          ...(investmentPolicy != null ? { investmentPolicy } : {}),
        },
      });

      updated++;
    } catch (err) {
      errors++;
      console.error(`\nError on ${fund.projAbbrName ?? fund.projId}: ${err}`);
    }

    if ((i + 1) % 50 === 0) {
      console.log(`[${i + 1}/${funds.length}] updated=${updated} noData=${noData} errors=${errors}`);
    }

    await sleep(DELAY_MS);
  }

  console.log(`\nDone. updated=${updated} noData=${noData} errors=${errors}`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
