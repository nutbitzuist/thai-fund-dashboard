// ─────────────────────────────────────────────
// lib/calculations.ts
// Financial metric calculation engine
// All inputs are arrays of { date, nav } sorted ascending
// ─────────────────────────────────────────────

import { PERIOD_MIN_NAV_COUNT } from '@/lib/utils';

const DEFAULT_RISK_FREE_RATE = parseFloat(
  process.env.RISK_FREE_RATE ?? '0.015'
); // 1.5% default

export interface NavDataPoint {
  date: Date;
  nav: number;
}

// ── Period Return ────────────────────────────

/**
 * Period return = (NAV_end - NAV_start) / NAV_start * 100
 */
export function calcPeriodReturn(navStart: number, navEnd: number): number {
  if (navStart <= 0) return 0;
  return ((navEnd - navStart) / navStart) * 100;
}

// ── Daily Returns ────────────────────────────

/**
 * Daily return_t = NAV_t / NAV_{t-1} - 1
 * Returns array of daily log-like returns
 */
export function calcDailyReturns(navPoints: NavDataPoint[]): number[] {
  if (navPoints.length < 2) return [];
  const returns: number[] = [];
  for (let i = 1; i < navPoints.length; i++) {
    const prev = navPoints[i - 1].nav;
    const curr = navPoints[i].nav;
    if (prev > 0) {
      returns.push(curr / prev - 1);
    }
  }
  return returns;
}

// ── Annualized Volatility ────────────────────

/**
 * Annualized volatility = std_dev(daily_returns) * sqrt(252) * 100
 * Returns percentage
 */
export function calcAnnualizedVolatility(dailyReturns: number[]): number | null {
  if (dailyReturns.length < 2) return null;
  const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const variance =
    dailyReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) /
    (dailyReturns.length - 1);
  const stdDev = Math.sqrt(variance);
  return stdDev * Math.sqrt(252) * 100;
}

// ── Max Drawdown ─────────────────────────────

/**
 * Max drawdown = min of (NAV_t - running_peak) / running_peak * 100
 * Returns a negative percentage (e.g., -15.23 means 15.23% drawdown)
 */
export function calcMaxDrawdown(navPoints: NavDataPoint[]): number | null {
  if (navPoints.length < 2) return null;
  let peak = navPoints[0].nav;
  let maxDD = 0;
  for (const point of navPoints) {
    if (point.nav > peak) peak = point.nav;
    const dd = ((point.nav - peak) / peak) * 100;
    if (dd < maxDD) maxDD = dd;
  }
  return maxDD;
}

/**
 * Returns drawdown series for charting
 */
export function calcDrawdownSeries(
  navPoints: NavDataPoint[]
): Array<{ date: Date; drawdown: number }> {
  if (!navPoints.length) return [];
  let peak = navPoints[0].nav;
  return navPoints.map((point) => {
    if (point.nav > peak) peak = point.nav;
    const drawdown = peak > 0 ? ((point.nav - peak) / peak) * 100 : 0;
    return { date: point.date, drawdown };
  });
}

// ── Sharpe Ratio ─────────────────────────────

/**
 * Sharpe ratio = (return_1Y / 100 - riskFreeRate) / (annualizedVolatility / 100)
 * riskFreeRate is a decimal (0.015 = 1.5%)
 */
export function calcSharpeRatio(
  return1YPct: number,
  annualizedVolatilityPct: number,
  riskFreeRate = DEFAULT_RISK_FREE_RATE
): number | null {
  if (annualizedVolatilityPct <= 0) return null;
  return (return1YPct / 100 - riskFreeRate) / (annualizedVolatilityPct / 100);
}

// ── Normalized NAV ───────────────────────────

/**
 * Normalized NAV = NAV_t / NAV_first * 100
 * Starting value is always 100
 */
export function calcNormalizedNav(navPoints: NavDataPoint[]): NavDataPoint[] {
  if (!navPoints.length) return [];
  const base = navPoints[0].nav;
  if (base <= 0) return navPoints;
  return navPoints.map((p) => ({
    date: p.date,
    nav: (p.nav / base) * 100,
  }));
}

// ── Full Metric Calculation ──────────────────

export interface MetricResult {
  period: string;
  startDate: Date;
  endDate: Date;
  returnPct: number | null;
  annualizedVolatilityPct: number | null;
  maxDrawdownPct: number | null;
  sharpeRatio: number | null;
  navCount: number;
}

/**
 * Calculate all metrics for a given NAV series and period
 */
export function calcMetrics(
  navPoints: NavDataPoint[],
  period: string,
  startDate: Date,
  endDate: Date
): MetricResult {
  const sorted = [...navPoints].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );

  const inRange = sorted.filter(
    (p) => p.date >= startDate && p.date <= endDate
  );

  // Need at least 2 points for any calculation
  if (inRange.length < 2) {
    return {
      period,
      startDate,
      endDate,
      returnPct: null,
      annualizedVolatilityPct: null,
      maxDrawdownPct: null,
      sharpeRatio: null,
      navCount: inRange.length,
    };
  }

  const navStart = inRange[0].nav;
  const navEnd = inRange[inRange.length - 1].nav;
  const returnPct = calcPeriodReturn(navStart, navEnd);

  // Risk metrics (volatility, drawdown, Sharpe) need dense data for statistical
  // stability. Weekly/monthly funds have returnPct but null risk metrics.
  const minRiskCount = PERIOD_MIN_NAV_COUNT[period] ?? 2;
  const hasRiskData = inRange.length >= minRiskCount;
  const dailyReturns = hasRiskData ? calcDailyReturns(inRange) : [];
  const annualizedVolatilityPct = hasRiskData ? calcAnnualizedVolatility(dailyReturns) : null;
  const maxDrawdownPct = hasRiskData ? calcMaxDrawdown(inRange) : null;
  const sharpeRatio =
    hasRiskData && annualizedVolatilityPct != null
      ? calcSharpeRatio(returnPct, annualizedVolatilityPct)
      : null;

  return {
    period,
    startDate: inRange[0].date,
    endDate: inRange[inRange.length - 1].date,
    returnPct,
    annualizedVolatilityPct,
    maxDrawdownPct,
    sharpeRatio,
    navCount: inRange.length,
  };
}
