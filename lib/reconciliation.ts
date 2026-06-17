// ─────────────────────────────────────────────
// lib/reconciliation.ts
// Pure helpers for window-aligned SEC reconciliation.
//
// Extracted from scripts/reconcile-metrics.ts so the classification + window
// math can be unit-tested without a DB or network. No side effects.
// ─────────────────────────────────────────────

// Periods we recompute & compare against SEC. Each has a well-defined start
// relative to SEC's as_of_date (the month-end the official figure ends at).
export const COMPARE_PERIODS = ['1Y', 'YTD', '3M'] as const;
export type ComparePeriod = (typeof COMPARE_PERIODS)[number];

// ── Classification thresholds ───────────────────────────────────────────────
// These define what counts as "genuine bad data" once windows are aligned.
export const ALIGNED_MAX = 2.0;        // |ours − sec| ≤ 2.0 pp           → ALIGNED
export const MILD_MAX = 10.0;          // 2–10 pp                          → MILD
export const CRAZY_ABS = 20.0;         // |ours − sec| > 20 pp             → CRAZY
export const CRAZY_RATIO_LOW = 0.33;
export const CRAZY_RATIO_HIGH = 3.0;
// sign/ratio checks need both sides above this, else ±0 noise false-flags.
export const TRIVIAL_MAGNITUDE = 1.0;

export type Verdict = 'ALIGNED' | 'MILD' | 'CRAZY';

export interface Classification {
  verdict: Verdict;
  reason: string;
}

/**
 * Classify a single window-aligned (ours, sec) return pair.
 *   ALIGNED : |ours − sec| ≤ 2.0 pp
 *   MILD    : 2–20 pp (NAV-date snapping / share-class differences)
 *   CRAZY   : sign flip, OR |ours − sec| > 20 pp, OR ratio outside [0.33x, 3x]
 */
export function classifyReturnPair(ours: number, sec: number): Classification {
  const absDelta = Math.abs(ours - sec);
  const bothNonTrivial =
    Math.abs(ours) > TRIVIAL_MAGNITUDE && Math.abs(sec) > TRIVIAL_MAGNITUDE;

  // CRAZY checks first (most severe).
  if (bothNonTrivial && Math.sign(ours) !== Math.sign(sec)) {
    return { verdict: 'CRAZY', reason: 'sign-flip' };
  }
  if (absDelta > CRAZY_ABS) {
    return { verdict: 'CRAZY', reason: `|Δ|=${absDelta.toFixed(1)}pp>20` };
  }
  if (bothNonTrivial && Math.sign(ours) === Math.sign(sec)) {
    const ratio = ours / sec;
    if (ratio < CRAZY_RATIO_LOW || ratio > CRAZY_RATIO_HIGH) {
      return { verdict: 'CRAZY', reason: `ratio=${ratio.toFixed(2)}x` };
    }
  }

  if (absDelta <= ALIGNED_MAX) return { verdict: 'ALIGNED', reason: '' };
  // Everything between ALIGNED_MAX and CRAZY_ABS that didn't trip a CRAZY rule is MILD.
  return { verdict: 'MILD', reason: `|Δ|=${absDelta.toFixed(1)}pp` };
}

/** Parse "YYYY-MM-DD" (or full ISO) into a UTC Date at midnight. */
export function toUtcDate(s: string): Date {
  return new Date(s.length <= 10 ? `${s}T00:00:00.000Z` : s);
}

/**
 * Target start date for a period given SEC's as_of end date (all UTC):
 *   1Y  = as_of − 1 year
 *   YTD = Jan 1 of as_of's year
 *   3M  = as_of − 3 months
 */
export function startTargetFor(period: ComparePeriod, asOf: Date): Date {
  const y = asOf.getUTCFullYear();
  const m = asOf.getUTCMonth();
  const d = asOf.getUTCDate();
  if (period === 'YTD') return new Date(Date.UTC(y, 0, 1));
  if (period === '1Y') return new Date(Date.UTC(y - 1, m, d));
  return new Date(Date.UTC(y, m - 3, d)); // 3M
}
