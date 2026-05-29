// scripts/backfill-sec-performance.ts
// Fetch asset allocation, benchmark name, and SEC performance stats from SEC API
// Populates: Fund.assetAllocation, Fund.benchmark, Fund.secReturnYtd
//            FundMetric.secReturnPct, secBenchmarkReturnPct, secPeerAvgReturnPct
// Run: source .env.local && DATABASE_URL="$DATABASE_URL" SEC_API_KEY="$SEC_API_KEY" npx tsx scripts/backfill-sec-performance.ts

import { createClient } from '../lib/db';

const SEC_BASE = 'https://api.sec.or.th';
const DELAY_MS = 400;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

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
  } catch { return null; }
}

function parseNum(val: string | null | undefined): number | null {
  if (val == null || val === '' || val === '-') return null;
  const n = parseFloat(String(val));
  return isNaN(n) ? null : n;
}

// Map SEC reference_period strings → our FundMetric period codes
const PERIOD_MAP: Record<string, string> = {
  '3 months': '3M',
  '6 months': '6M',
  '1 year':   '1Y',
  '3 years':  '3Y',
  '5 years':  '5Y',
};

interface AssetItem  { asset_name: string; asset_ratio: string }
interface BenchItem  { benchmark: string; group_seq: number }
interface PerfItem   { performance_type_desc: string; reference_period: string; performance_val: string | null }

async function main() {
  const connStr = process.env.DATABASE_URL;
  if (!connStr) throw new Error('DATABASE_URL not set');
  const apiKey  = process.env.SEC_API_KEY;
  if (!apiKey)  throw new Error('SEC_API_KEY not set');

  const prisma = createClient();

  const funds = await prisma.fund.findMany({
    where: { fundStatus: { in: ['RG', 'SE'] } },
    select: {
      id: true,
      projId: true,
      projAbbrName: true,
      fundClasses: { where: { isDefault: true }, select: { id: true }, take: 1 },
    },
    orderBy: { projId: 'asc' },
  });

  console.log(`Processing ${funds.length} active funds...`);

  let updated = 0, noData = 0, errors = 0;

  for (let i = 0; i < funds.length; i++) {
    const fund = funds[i];
    const defaultClassId = fund.fundClasses[0]?.id;

    try {
      const [assets, benchmarks, perfs] = await Promise.all([
        secGet<AssetItem[]>(`${SEC_BASE}/FundFactsheet/fund/${encodeURIComponent(fund.projId)}/asset`,       apiKey),
        secGet<BenchItem[]>(`${SEC_BASE}/FundFactsheet/fund/${encodeURIComponent(fund.projId)}/benchmark`,   apiKey),
        secGet<PerfItem[]>( `${SEC_BASE}/FundFactsheet/fund/${encodeURIComponent(fund.projId)}/performance`, apiKey),
      ]);

      if (!assets && !benchmarks && !perfs) { noData++; await sleep(DELAY_MS); continue; }

      // ── Fund-level fields ──────────────────────────────────────────────
      const assetAllocation = assets?.length ? assets.map(a => ({
        asset_name: a.asset_name,
        asset_ratio: a.asset_ratio,
      })) : undefined;

      const benchmark = benchmarks?.length
        ? benchmarks
            .sort((a, b) => a.group_seq - b.group_seq)
            .map(b => b.benchmark)
            .join(' · ')
        : undefined;

      // YTD from performance array
      const ytdItem = perfs?.find(
        p => p.performance_type_desc.includes('ผลตอบแทนกองทุนรวม') && p.reference_period === 'year to date'
      );
      const secReturnYtd = ytdItem ? parseNum(ytdItem.performance_val) : undefined;

      await prisma.fund.update({
        where: { id: fund.id },
        data: {
          ...(assetAllocation !== undefined ? { assetAllocation } : {}),
          ...(benchmark       !== undefined ? { benchmark }       : {}),
          ...(secReturnYtd    !== undefined ? { secReturnYtd }    : {}),
        },
      });

      // ── FundMetric-level fields (per period) ──────────────────────────
      if (perfs && defaultClassId) {
        // Group perf items by type
        const byType: Record<string, Record<string, number | null>> = {};
        for (const p of perfs) {
          if (!byType[p.performance_type_desc]) byType[p.performance_type_desc] = {};
          byType[p.performance_type_desc][p.reference_period] = parseNum(p.performance_val);
        }

        const fundReturnByPeriod = Object.entries(byType).find(([k]) => k.includes('ผลตอบแทนกองทุนรวม'))?.[1] ?? {};
        const benchReturnByPeriod = Object.entries(byType).find(([k]) => k.includes('ผลตอบแทนตัวชี้วัด'))?.[1] ?? {};
        const peerAvgByPeriod = Object.entries(byType).find(([k]) => k.includes('ค่าเฉลี่ยในกลุ่มเดียวกัน'))?.[1] ?? {};

        for (const [secPeriod, ourPeriod] of Object.entries(PERIOD_MAP)) {
          const secReturnPct          = fundReturnByPeriod[secPeriod]  ?? null;
          const secBenchmarkReturnPct = benchReturnByPeriod[secPeriod] ?? null;
          const secPeerAvgReturnPct   = peerAvgByPeriod[secPeriod]    ?? null;

          if (secReturnPct === null && secBenchmarkReturnPct === null && secPeerAvgReturnPct === null) continue;

          // Update the most recent FundMetric row for this class + period
          const metric = await prisma.fundMetric.findFirst({
            where: { fundClassId: defaultClassId, period: ourPeriod },
            orderBy: { calculatedAt: 'desc' },
            select: { id: true },
          });

          if (metric) {
            await prisma.fundMetric.update({
              where: { id: metric.id },
              data: { secReturnPct, secBenchmarkReturnPct, secPeerAvgReturnPct },
            });
          }
        }
      }

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
