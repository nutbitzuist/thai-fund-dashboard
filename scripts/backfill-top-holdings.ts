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
import { normalizeTopHoldings } from '../lib/top-holdings';
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
function extractText(layout = true): string {
  const flag = layout ? '-layout' : '';
  try {
    return execSync(`pdftotext ${flag} "${TMP_PDF}" -`, { encoding: 'utf8', timeout: 15000 });
  } catch {
    return '';
  }
}

// ── Holdings parser ───────────────────────────────────────────────────────────
// SEC factsheets use several different layouts:
//  A. Single-column: name + pct on same indented line (most common)
//  B. Two-column: left=asset types, right=holdings; pct on its own line below name
//  C. Bond/money-market: "การจัดสรรการลงทุนในผู้ออกตราสาร 5 อันดับแรก" header
//  D. Fund-of-funds: "5 อันดับแรกของกองทุนหลัก" header
//
// Strategy: try -layout pass first (handles A well). For each line:
//   Case 1 — name+pct on same line (layout A)
//   Case 2 — pct on its own right-column line; grab name from preceding line (layout B)
// If that yields < 2 valid entries, try a second pass without -layout (handles C/D).

interface Holding { name: string; pct: number }

const SECTION_HEADERS = [
  'ทรัพย์สินที่ลงทุน 5 อันดับแรก',
  '5 อันดับแรกของกองทุนหลัก',
  'การจัดสรรการลงทุนในผู้ออกตราสาร 5 อันดับแรก',
];

const BAD_NAME_PATTERNS = [
  /^[-+]?\d+(?:\.\d+)?%?$/,          // bare number / percentage accidentally parsed as name
  /^[\s]*$/,                        // blank
  /% ?NAV/i,
  /^ทรัพย์สิน/, /^ชื่อ/, /^ผู้ออก/, /^ประเภท/,
  /^Holding/i,
  /ของพอร์ต/,                       // column header in fund-of-funds PDFs
  /^สัดส่วน/,                       // "สัดส่วน %" column header
  /^(หน่วยลงทุนในประเทศ|เงินฝาก|ตราสาร|พันธบัตร)$/,
];

function isValidName(name: string): boolean {
  if (!name || name.trim().length < 2) return false;
  return !BAD_NAME_PATTERNS.some(p => p.test(name.trim()));
}

// ── "As of" date parser ───────────────────────────────────────────────────────
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
  const yearAD = parseInt(m[3]) - 543;
  return `${yearAD}-${month}-${day}`;
}

// Pass 1: -layout text (preserves column positions)
function parseWithLayout(text: string): Holding[] {
  const lines = text.split('\n');
  const sectionIdx = lines.findIndex(l => SECTION_HEADERS.some(h => l.includes(h)) ||
    (l.includes('Holding') && l.includes('%NAV')) ||
    (l.includes('ทรัพย์สิน') && l.includes('% NAV'))
  );
  if (sectionIdx === -1) return [];

  const window = lines.slice(sectionIdx, sectionIdx + 30);
  const holdings: Holding[] = [];
  const usedPcts = new Set<number>();

  for (let i = 0; i < window.length; i++) {
    const line = window[i];

    // Case 1: name + pct on same line
    const m1 = line.match(/^\s{30,}(.+?)\s{2,}(\d{1,3}\.\d{1,2})\s*$/);
    if (m1) {
      const name = m1[1].trim();
      const pct = parseFloat(m1[2]);
      if (isValidName(name) && pct > 0 && pct <= 100 && !usedPcts.has(pct)) {
        holdings.push({ name, pct });
        usedPcts.add(pct);
        continue;
      }
    }

    // Case 2: pct alone on right-column line (50+ leading spaces, nothing else)
    const m2 = line.match(/^\s{50,}(\d{1,3}\.\d{1,2})\s*$/);
    if (m2) {
      const pct = parseFloat(m2[1]);
      if (pct > 0 && pct <= 100 && !usedPcts.has(pct)) {
        // Name is on the nearest preceding right-column line
        for (let j = i - 1; j >= Math.max(0, i - 4); j--) {
          const prev = window[j];
          const nm = prev.match(/^\s{30,}([^\d%].+?)\s*$/);
          if (nm) {
            const name = nm[1].trim();
            if (isValidName(name)) {
              holdings.push({ name, pct });
              usedPcts.add(pct);
              break;
            }
          }
        }
      }
      continue;
    }
  }

  return holdings;
}

// Pass 2: no -layout (line-by-line, pct on its own line directly after name)
function parseNoLayout(text: string): Holding[] {
  const lines = text.split('\n').map(l => l.trim());
  const sectionIdx = lines.findIndex(l => SECTION_HEADERS.some(h => l.includes(h)));
  if (sectionIdx === -1) return [];

  const SKIP = [/^% ?NAV$/i, /^ชื่อ/, /^ผู้ออก/, /^ประเภท/, /^\(ข้อมูล/,
                /^หน่วยลงทุน/, /^เงินฝาก/, /^ตราสาร/, /^พันธบัตร/];

  const holdings: Holding[] = [];
  const window = lines.slice(sectionIdx + 1, sectionIdx + 50);
  let nameAccum: string[] = [];

  for (const line of window) {
    if (!line) { nameAccum = []; continue; }

    const pctOnly = line.match(/^(\d{1,3}\.\d{1,2})$/);
    if (pctOnly) {
      const pct = parseFloat(pctOnly[1]);
      if (pct > 0 && pct <= 100 && nameAccum.length > 0) {
        const name = nameAccum.join(' ').replace(/\s+/g, ' ').trim();
        if (isValidName(name)) holdings.push({ name, pct });
      }
      nameAccum = [];
      continue;
    }

    if (SKIP.some(p => p.test(line))) { nameAccum = []; continue; }
    if (/^\d+\.?\d*$/.test(line)) { nameAccum = []; continue; } // asset-type % from left col
    nameAccum.push(line);
  }

  return holdings;
}

function parseHoldings(layoutText: string, noLayoutText: string): Holding[] {
  const h1 = parseWithLayout(layoutText);
  const h2 = parseNoLayout(noLayoutText);
  // Always prefer whichever pass found more holdings
  const holdings = h2.length > h1.length ? h2 : h1;
  return normalizeTopHoldings(holdings, 5);
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

      const layoutText = extractText(true);
      const noLayoutText = extractText(false);
      if (!layoutText && !noLayoutText) { noPdf++; continue; }

      const holdings = parseHoldings(layoutText, noLayoutText);
      if (!holdings.length) { noData++; continue; }

      const asOf = parseAsOfDate(layoutText || noLayoutText);
      await prisma.fund.update({
        where: { id: fund.id },
        data: {
          topHoldings: holdings as unknown as Prisma.InputJsonValue,
          topHoldingsAsOf: asOf,
          topHoldingsUpdatedAt: new Date(),
        },
      });
      ok++;
    } catch (e) {
      errors++;
      if (errors <= 3) console.error('\n  error:', e);
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
