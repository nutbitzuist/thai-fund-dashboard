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

// ── Period Label ─────────────────────────────

export const PERIOD_LABELS: Record<string, string> = {
  '1M': '1 เดือน',
  '3M': '3 เดือน',
  '6M': '6 เดือน',
  '1Y': '1 ปี',
  '3Y': '3 ปี',
  '5Y': '5 ปี',
  MAX: 'ทั้งหมด',
};
