// lib/top-holdings.ts
// Normalize SEC factsheet top-holding rows for investor-facing display.

export interface RawHolding {
  name?: string | null;
  pct?: number | string | null;
}

export interface DisplayHolding {
  name: string;
  pct: number;
}

const GENERIC_HOLDING_PATTERNS = [
  /^[-+]?\d+(?:\.\d+)?%?$/,
  /% ?NAV/i,
  /^ทรัพย์สิน/,
  /^ชื่อ/,
  /^ผู้ออก/,
  /^ประเภท/,
  /^Holding/i,
  /^สัดส่วน/,
  /ของพอร์ต/,
  /^(หน่วยลงทุนในประเทศ|หน่วยลงทุนต่างประเทศ|เงินฝาก|ตราสาร|พันธบัตร|หุ้นกู้)$/,
];

const LEADING_INSTRUMENT_PATTERNS: RegExp[] = [
  /^[-+]?\d+(?:\.\d+)?\s*/,
  /^(หุ้นสามัญ|หุ้น\S*|common shares?|ordinary shares?|equity)\s+/i,
  /^(หุ้นบุริมสิทธิ|preferred shares?)\s+/i,
  /^(หน่วยลงทุน|investment units?)\s+/i,
  /^(ใบสำคัญแสดงสิทธิ|warrants?)\s+/i,
  /^(ตราสารหนี้|หุ้นกู้|พันธบัตร|ตั๋วเงินคลัง)\s+/,
  /^(ทรัพย์|หลักทรัพย์)\s+/,
];

export function cleanHoldingName(input: string | null | undefined): string {
  let name = (input ?? '')
    .replace(/\s+/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();

  // Some PDF parses include instrument labels or stray numeric fragments before
  // the company name. Remove only leading descriptors; keep legal names intact.
  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of LEADING_INSTRUMENT_PATTERNS) {
      const next = name.replace(pattern, '').trim();
      if (next !== name) {
        name = next;
        changed = true;
      }
    }
  }

  // Normalize repeated spaces introduced by Thai/English PDF extraction.
  return name.replace(/\s+/g, ' ').trim();
}

export function isDisplayableHoldingName(name: string): boolean {
  if (!name || name.length < 2) return false;
  return !GENERIC_HOLDING_PATTERNS.some((pattern) => pattern.test(name));
}

export function normalizeTopHoldings(raw: unknown, maxRows = 5): DisplayHolding[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const rows: DisplayHolding[] = [];

  for (const item of raw as RawHolding[]) {
    const name = cleanHoldingName(item?.name);
    const pct = typeof item?.pct === 'string' ? Number(item.pct.replace('%', '').trim()) : Number(item?.pct);
    const key = name.toLowerCase();

    if (!isDisplayableHoldingName(name)) continue;
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) continue;
    if (seen.has(key)) continue;

    seen.add(key);
    rows.push({ name, pct });
  }

  return rows.sort((a, b) => b.pct - a.pct).slice(0, maxRows);
}
