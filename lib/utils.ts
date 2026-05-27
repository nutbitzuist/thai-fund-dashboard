// ─────────────────────────────────────────────
// lib/utils.ts
// Shared utility functions
// ─────────────────────────────────────────────

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// ── Tailwind Class Utility ───────────────────

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Date Utilities ───────────────────────────

/**
 * Format a Date or ISO string to Thai locale date string
 */
export function formatDateTh(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  });
}

/**
 * Format date to YYYY-MM-DD for API calls
 */
export function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Generate all weekday dates between start and end (inclusive)
 * Excludes Saturday (6) and Sunday (0)
 */
export function generateWeekdays(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);

  while (current <= endDate) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) {
      dates.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

/**
 * Get start date for a given metric period from an end date
 */
export function getPeriodStartDate(period: string, endDate: Date): Date {
  const start = new Date(endDate);
  switch (period) {
    case '1M':
      start.setMonth(start.getMonth() - 1);
      break;
    case '3M':
      start.setMonth(start.getMonth() - 3);
      break;
    case '6M':
      start.setMonth(start.getMonth() - 6);
      break;
    case '1Y':
      start.setFullYear(start.getFullYear() - 1);
      break;
    case '3Y':
      start.setFullYear(start.getFullYear() - 3);
      break;
    case '5Y':
      start.setFullYear(start.getFullYear() - 5);
      break;
    case 'YTD':
      // Year-to-date: January 1 of the current year
      start.setMonth(0, 1);
      break;
    default:
      start.setFullYear(start.getFullYear() - 10);
  }
  return start;
}

/**
 * Get the most recent weekday (used to determine latest NAV date)
 */
export function getLastWeekday(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  if (day === 0) d.setDate(d.getDate() - 2); // Sunday → Friday
  if (day === 6) d.setDate(d.getDate() - 1); // Saturday → Friday
  return d;
}

// ── Number Formatting ────────────────────────

/**
 * Format AUM (Assets Under Management) in Thai baht with suffix
 * e.g. 902100527 → "฿902.1 ล้าน" | 15000000000 → "฿15.0 พันล้าน"
 */
export function formatAUM(value: number | null | undefined): string {
  if (value == null || isNaN(value) || value <= 0) return '-';
  if (value >= 1_000_000_000) {
    return `฿${(value / 1_000_000_000).toLocaleString('th-TH', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} พันล้าน`;
  }
  if (value >= 1_000_000) {
    return `฿${(value / 1_000_000).toLocaleString('th-TH', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ล้าน`;
  }
  return `฿${value.toLocaleString('th-TH', { maximumFractionDigits: 0 })}`;
}

/**
 * Format number with commas and decimal places
 */
export function formatNumber(value: number | null | undefined, decimals = 2): string {
  if (value == null || isNaN(value)) return '-';
  return value.toLocaleString('th-TH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format percentage
 */
export function formatPct(value: number | null | undefined, decimals = 2): string {
  if (value == null || isNaN(value)) return '-';
  const formatted = Math.abs(value).toLocaleString('th-TH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${value >= 0 ? '+' : '-'}${formatted}%`;
}

/**
 * Format NAV value (4 decimal places)
 */
export function formatNav(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '-';
  return value.toLocaleString('th-TH', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

/**
 * Determine if a value is positive, negative, or neutral
 */
export function getValueSign(value: number | null | undefined): 'positive' | 'negative' | 'neutral' {
  if (value == null || isNaN(value)) return 'neutral';
  if (value > 0) return 'positive';
  if (value < 0) return 'negative';
  return 'neutral';
}

/**
 * Get Tailwind color class for positive/negative/neutral values
 */
export function getReturnColorClass(value: number | null | undefined): string {
  const sign = getValueSign(value);
  if (sign === 'positive') return 'text-green-600';
  if (sign === 'negative') return 'text-red-600';
  return 'text-gray-500';
}

// ── Array Utilities ──────────────────────────

/**
 * Split array into chunks of given size
 */
export function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Sleep for given milliseconds (for rate limiting)
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── String Utilities ─────────────────────────

/**
 * Truncate string to max length with ellipsis
 */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}

/**
 * Normalize search query: lowercase, trim, remove special characters
 */
export function normalizeSearchQuery(q: string): string {
  return q.trim().toLowerCase().replace(/[^\w\sก-๙]/g, '');
}

// ── Fund URL helper ──────────────────────────
// SEO-friendly URLs use projAbbrName (e.g. /funds/K-OIL)
// Falls back to projId for funds without an abbreviated name

export function fundUrl(fund: { projAbbrName: string | null; projId: string }): string {
  return `/funds/${encodeURIComponent(fund.projAbbrName ?? fund.projId)}`;
}

// ── Period Label ─────────────────────────────

export const PERIOD_LABELS: Record<string, string> = {
  '1M': '1 เดือน',
  '3M': '3 เดือน',
  '6M': '6 เดือน',
  '1Y': '1 ปี',
  '3Y': '3 ปี',
  '5Y': '5 ปี',
  YTD: 'ปีนี้ (YTD)',
  MAX: 'ทั้งหมด',
};

// ── Minimum NAV data points required per period ──

export const PERIOD_MIN_NAV_COUNT: Record<string, number> = {
  '1M': 18,
  '3M': 55,
  '6M': 110,
  YTD: 18,
  '1Y': 230,
  '3Y': 700,
  '5Y': 1150,
};

/**
 * Returns true if there are enough NAV data points to make the period meaningful
 */
export function hasSufficientData(period: string, navCount: number | null | undefined): boolean {
  if (navCount == null) return false;
  const min = PERIOD_MIN_NAV_COUNT[period];
  if (!min) return true; // unknown period → allow
  return navCount >= min;
}

// ── Fund Type Inference ───────────────────────
// The SEC FundFactsheet API does NOT return fund_type or risk_spectrum.
// We infer fund_type from Thai/English fund names using common naming conventions.
// invest_country_flag: "1" = may invest abroad, "3" = domestic only

export type InferredFundType = 'EQ' | 'FI' | 'MM' | 'BA' | 'RE' | 'CM' | 'FIF' | 'SSF' | 'RMF' | 'AI';

const FUND_TYPE_PATTERNS: Array<{ pattern: RegExp; type: InferredFundType }> = [
  // Special tax-privileged types first (most specific)
  { pattern: /\bSSF\b|Super\s+Saving|\bsupersaving\b/i, type: 'SSF' },
  { pattern: /\bRMF\b|Retirement\s+Mutual|เพื่อการเลี้ยงชีพ/i, type: 'RMF' },
  // Real estate / REITs
  { pattern: /REIT|Property|Real\s+Estate|อสังหาริมทรัพย์|กองทรัสต์/i, type: 'RE' },
  // Commodities
  { pattern: /Gold|ทองคำ|Commodity|น้ำมัน|Oil|Silver|เงิน/i, type: 'CM' },
  // Alternative / Infrastructure
  { pattern: /Infrastructure|โครงสร้างพื้นฐาน|Alternative|ทางเลือก/i, type: 'AI' },
  // Money market
  { pattern: /Money\s+Market|ตลาดเงิน|Treasury|พันธบัตร\s*ระยะสั้น/i, type: 'MM' },
  // Fixed income (bonds)
  { pattern: /Fixed\s+Income|ตราสารหนี้|Bond|หุ้นกู้|Income\s+Fund/i, type: 'FI' },
  // Balanced
  { pattern: /Balanced|ผสม|Mixed|Asset\s+Alloc/i, type: 'BA' },
  // Foreign investment (FIF)
  { pattern: /Foreign|Global|International|World|ต่างประเทศ|FIF\b/i, type: 'FIF' },
  // Equity (catch-all after specifics)
  { pattern: /Equity|หุ้น|Stock|Dividend|ปันผล|Growth|Value\s+Fund/i, type: 'EQ' },
];

export function inferFundType(
  nameTh: string,
  nameEn: string | null | undefined,
  investCountryFlag: string | null | undefined
): InferredFundType | null {
  const combined = `${nameTh} ${nameEn ?? ''}`;
  for (const { pattern, type } of FUND_TYPE_PATTERNS) {
    if (pattern.test(combined)) return type;
  }
  // Fallback: if fund invests abroad and no other match, classify as FIF
  if (investCountryFlag === '1') return 'FIF';
  return null;
}

/**
 * Infer a rough risk level (1-8) from fund type and investment country
 * This is an approximation — actual risk spectrum requires SEC-provided data
 */
export function inferRiskLevel(
  fundType: InferredFundType | string | null | undefined,
  investCountryFlag: string | null | undefined
): number | null {
  const isAbroad = investCountryFlag === '1';
  switch (fundType) {
    case 'MM': return 1;
    case 'FI': return isAbroad ? 4 : 3;
    case 'BA': return isAbroad ? 6 : 5;
    case 'RE': return isAbroad ? 7 : 6;
    case 'CM': return isAbroad ? 7 : 6;
    case 'AI': return isAbroad ? 7 : 6;
    case 'EQ': return isAbroad ? 7 : 6;
    case 'FIF': return 7;
    case 'SSF': return 6; // typically equity-based
    case 'RMF': return 5; // can vary; 5 is a reasonable default
    default: return null;
  }
}
