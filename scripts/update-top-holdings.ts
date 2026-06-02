/**
 * scripts/update-top-holdings.ts
 *
 * Smart monthly holdings updater — only re-fetches PDFs for funds where
 * the SEC API reports newer data than what we have stored.
 *
 * How it works:
 *   1. For each fund, fetch last_upd_date from SEC /asset endpoint
 *   2. Compare with Fund.topHoldingsUpdatedAt in our DB
 *   3. Only download + parse the factsheet PDF if SEC data is newer
 *   4. Send Telegram summary when done
 *
 * Schedule: run on the 26th of each month (SEC updates ~25th after month-end)
 *
 * Usage:
 *   source .env.local && DATABASE_URL="$DATABASE_URL" SEC_API_KEY="$SEC_API_KEY" \
 *   npx tsx scripts/update-top-holdings.ts
 */

import { execSync } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { resolve } from 'path';
import { config as dotenvConfig } from 'dotenv';
import { Prisma } from '@prisma/client';
import { createClient } from '../lib/db';

const envFile = resolve(process.cwd(), '.env.local');
if (existsSync(envFile)) dotenvConfig({ path: envFile });

const SEC_BASE       = 'https://api.sec.or.th';
const FACTSHEET_BASE = 'https://secdocumentstorage.blob.core.windows.net/fundfactsheet';
const DELAY_MS       = 400;
const TMP_PDF        = '/tmp/factsheet-update-tmp.pdf';
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const TELEGRAM_CHAT  = process.env.TELEGRAM_CHAT_ID ?? '';
const SEC_API_KEY    = process.env.SEC_API_KEY ?? '';

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function tg(text: string) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text, parse_mode: 'HTML' }),
    });
  } catch { /* non-critical */ }
}

// ── SEC API: get last_upd_date for a fund's asset data ────────────────────────
async function getSecLastUpdated(projId: string): Promise<Date | null> {
  try {
    const res = await fetch(`${SEC_BASE}/FundFactsheet/fund/${encodeURIComponent(projId)}/asset`, {
      headers: { 'Ocp-Apim-Subscription-Key': SEC_API_KEY },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || !data[0]?.last_upd_date) return null;
    return new Date(data[0].last_upd_date);
  } catch { return null; }
}

// ── PDF download + parse (same logic as backfill-top-holdings) ─────────────────
async function downloadPdf(projId: string): Promise<boolean> {
  try {
    const res = await fetch(`${FACTSHEET_BASE}/${encodeURIComponent(projId)}.pdf`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return false;
    writeFileSync(TMP_PDF, Buffer.from(await res.arrayBuffer()));
    return true;
  } catch { return false; }
}

function extractText(): string {
  try { return execSync(`pdftotext -layout "${TMP_PDF}" -`, { encoding: 'utf8', timeout: 15000 }); }
  catch { return ''; }
}

const THAI_MONTHS: Record<string, string> = {
  'มกราคม': '01', 'กุมภาพันธ์': '02', 'มีนาคม': '03', 'เมษายน': '04',
  'พฤษภาคม': '05', 'มิถุนายน': '06', 'กรกฎาคม': '07', 'สิงหาคม': '08',
  'กันยายน': '09', 'ตุลาคม': '10', 'พฤศจิกายน': '11', 'ธันวาคม': '12',
};

function parseAsOfDate(text: string): string | null {
  const m = text.match(/ข้อมูล\s*ณ\s*วันที่\s*(\d{1,2})\s*([฀-๿]+)\s*(\d{4})/);
  if (!m) return null;
  const day = m[1].padStart(2, '0');
  const month = THAI_MONTHS[m[2]];
  if (!month) return null;
  return `${parseInt(m[3]) - 543}-${month}-${day}`;
}

function parseHoldings(text: string): Array<{name: string; pct: number}> {
  const lines = text.split('\n');
  const sectionIdx = lines.findIndex(l =>
    l.includes('ทรัพย์สินที่ลงทุน 5 อันดับแรก') ||
    (l.includes('Holding') && l.includes('%NAV')) ||
    (l.includes('ทรัพย์สิน') && l.includes('% NAV'))
  );
  if (sectionIdx === -1) return [];

  const holdings: Array<{name: string; pct: number}> = [];
  for (const line of lines.slice(sectionIdx, sectionIdx + 20)) {
    const match = line.match(/^\s{30,}(.+?)\s{2,}(\d{1,3}\.\d{1,2})\s*$/);
    if (!match) continue;
    const name = match[1].trim();
    const pct = parseFloat(match[2]);
    if (name.includes('% NAV') || name.includes('%NAV') || name.includes('ทรัพย์สิน') ||
        name.includes('Holding') || pct <= 0 || pct > 100) continue;
    holdings.push({ name, pct });
    if (holdings.length >= 5) break;
  }
  return holdings;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const prisma = createClient();
  const startTime = Date.now();

  await tg('🔄 <b>Top Holdings Monthly Update Started</b>\nChecking which funds have new SEC data...');

  // Get all active funds with their current holdings update time
  const funds = await prisma.fund.findMany({
    where: { fundStatus: { in: ['RG', 'SE'] } },
    select: { id: true, projId: true, projAbbrName: true, topHoldingsUpdatedAt: true },
    orderBy: { id: 'asc' },
  });

  console.log(`Checking ${funds.length} funds for SEC updates...`);

  let checked = 0, updated = 0, skipped = 0, noPdf = 0, noData = 0;

  for (let i = 0; i < funds.length; i++) {
    const fund = funds[i];
    checked++;
    process.stdout.write(`\r  [${i + 1}/${funds.length}] ${(fund.projAbbrName ?? fund.projId).padEnd(20)} updated=${updated} skipped=${skipped}`);

    // Check if SEC has newer data
    const secUpdated = await getSecLastUpdated(fund.projId);
    const ourUpdated = fund.topHoldingsUpdatedAt;

    // Skip if our data is newer than or equal to SEC's
    if (secUpdated && ourUpdated && ourUpdated >= secUpdated) {
      skipped++;
      await sleep(100); // brief delay even when skipping
      continue;
    }

    // SEC has newer data (or we have no data) — re-fetch PDF
    try {
      const downloaded = await downloadPdf(fund.projId);
      if (!downloaded) { noPdf++; continue; }

      const text = extractText();
      if (!text) { noPdf++; continue; }

      const holdings = parseHoldings(text);
      if (!holdings.length) { noData++; continue; }

      const asOf = parseAsOfDate(text);
      await prisma.fund.update({
        where: { id: fund.id },
        data: {
          topHoldings: holdings as unknown as Prisma.InputJsonValue,
          topHoldingsAsOf: asOf,
          topHoldingsUpdatedAt: new Date(),
        },
      });
      updated++;
    } catch { noData++; }
    finally { if (existsSync(TMP_PDF)) unlinkSync(TMP_PDF); }

    await sleep(DELAY_MS);
  }

  const mins = Math.round((Date.now() - startTime) / 60000);
  const summary =
    `✅ <b>Top Holdings Update Complete</b> (${mins} min)\n\n` +
    `Checked: ${checked}\nUpdated: ${updated}\nSkipped (unchanged): ${skipped}\nNo PDF: ${noPdf}\nNo data in PDF: ${noData}`;

  console.log(`\n\n${summary.replace(/<[^>]+>/g, '')}`);
  await tg(summary);
  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async e => {
  console.error(e);
  await tg(`❌ Holdings update failed: ${e.message}`);
  process.exit(1);
});
