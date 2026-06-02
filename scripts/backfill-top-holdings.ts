/**
 * scripts/backfill-top-holdings.ts
 *
 * Parses SEC factsheet PDFs to extract top 5 holdings for each fund.
 * Stores result in Fund.topHoldings as [{name, pct}].
 *
 * Requires: pdftotext (Homebrew: brew install poppler)
 *
 * Usage:
 *   source .env.local && DATABASE_URL="$DATABASE_URL" npx tsx scripts/backfill-top-holdings.ts
 *
 * Options:
 *   --limit=N     Only process N funds (for testing)
 *   --force       Re-process funds that already have topHoldings
 */

import { execSync } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { resolve } from 'path';
import { config as dotenvConfig } from 'dotenv';
import { Prisma } from '@prisma/client';
import { createClient } from '../lib/db';

const envFile = resolve(process.cwd(), '.env.local');
if (existsSync(envFile)) dotenvConfig({ path: envFile });

const FACTSHEET_BASE = 'https://secdocumentstorage.blob.core.windows.net/fundfactsheet';
const DELAY_MS = 300;
const TMP_PDF = '/tmp/factsheet-tmp.pdf';

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (key: string, fallback: string) => {
    const f = args.find(a => a.startsWith(`--${key}=`));
    return f ? f.split('=')[1] : fallback;
  };
  return {
    limit: parseInt(get('limit', '0'), 10),
    force: args.includes('--force'),
  };
}

// ── PDF download ──────────────────────────────────────────────────────────────
async function downloadPdf(projId: string): Promise<boolean> {
  const url = `${FACTSHEET_BASE}/${encodeURIComponent(projId)}.pdf`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return false;
    const buf = await res.arrayBuffer();
    writeFileSync(TMP_PDF, Buffer.from(buf));
    return true;
  } catch {
    return false;
  }
}

// ── PDF text extraction ───────────────────────────────────────────────────────
function extractText(): string {
  try {
    return execSync(`pdftotext -layout "${TMP_PDF}" -`, { encoding: 'utf8', timeout: 15000 });
  } catch {
    return '';
  }
}

// ── Holdings parser ───────────────────────────────────────────────────────────
// The SEC factsheet standard template has a right-hand column showing:
//   "ทรัพย์สินที่ลงทุน 5 อันดับแรก"  (top 5 securities)
//   OR
//   "Holding  %NAV"
// followed by rows of:  [lots of spaces] name [spaces] percentage
//
// Strategy: find the section, then extract name+pct pairs from lines with
// significant leading whitespace (right column) and a trailing decimal number.

interface Holding { name: string; pct: number }

// ── "As of" date parser ───────────────────────────────────────────────────────
// Extracts "ข้อมูล ณ วันที่ 30 เมษายน 2569" → "2026-04-30"
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
  const yearAD = parseInt(m[3]) - 543; // Buddhist Era → AD
  return `${yearAD}-${month}-${day}`;
}

function parseHoldings(text: string): Holding[] {
  const lines = text.split('\n');

  // Find the "5 อันดับแรก" section index — look for the securities section
  const sectionIdx = lines.findIndex(l =>
    l.includes('ทรัพย์สินที่ลงทุน 5 อันดับแรก') ||
    l.includes('Holding') && l.includes('%NAV') ||
    l.includes('ทรัพย์สิน') && l.includes('% NAV')
  );
  if (sectionIdx === -1) return [];

  const holdings: Holding[] = [];
  // Scan next 15 lines after the header for holding rows
  const window = lines.slice(sectionIdx, sectionIdx + 20);

  for (const line of window) {
    // A holding row: significant leading whitespace + name + spaces + number
    // Match: optional spaces (≥30 chars) + name + whitespace + decimal number
    const match = line.match(/^\s{30,}(.+?)\s{2,}(\d{1,3}\.\d{1,2})\s*$/);
    if (!match) continue;
    const name = match[1].trim();
    const pct = parseFloat(match[2]);
    // Skip header rows and unreasonable values
    if (name.includes('% NAV') || name.includes('%NAV') || name.includes('ทรัพย์สิน') ||
        name.includes('Holding') || pct <= 0 || pct > 100) continue;
    holdings.push({ name, pct });
    if (holdings.length >= 5) break;
  }

  return holdings;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const { limit, force } = parseArgs();
  const prisma = createClient();

  const where = force
    ? { fundStatus: { in: ['RG', 'SE'] } }
    : { fundStatus: { in: ['RG', 'SE'] }, topHoldings: { equals: Prisma.DbNull } };

  const funds = await prisma.fund.findMany({
    where,
    select: { id: true, projId: true, projAbbrName: true },
    orderBy: { id: 'asc' },
    ...(limit ? { take: limit } : {}),
  });

  console.log(`Processing ${funds.length} funds (force=${force})`);

  let ok = 0, noPdf = 0, noData = 0, errors = 0;

  for (let i = 0; i < funds.length; i++) {
    const fund = funds[i];
    process.stdout.write(`\r  [${i + 1}/${funds.length}] ${fund.projAbbrName ?? fund.projId}`.padEnd(60));

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
      ok++;
    } catch {
      errors++;
    } finally {
      if (existsSync(TMP_PDF)) unlinkSync(TMP_PDF);
    }

    if (i < funds.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\n\nDone: updated=${ok} noPdf=${noPdf} noData=${noData} errors=${errors}`);
  await prisma.$disconnect();
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
