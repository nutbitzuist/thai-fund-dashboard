// ─────────────────────────────────────────────
// lib/total-return.ts
// Total-return reconciliation for dividend/distributing funds.
//
// THE PROBLEM
// -----------
// We compute a PRICE return from raw NAV: (NAV_end − NAV_start) / NAV_start.
// For funds that PAY OUT distributions (dividend policy = "Y"), the paid-out
// cash leaves the NAV, so a pure NAV price return UNDERSTATES performance — it
// silently drops every distribution. SEC's official figure is a TOTAL return
// (price appreciation + distributions reinvested), so for these funds our number
// reads too low and can even flip sign (e.g. KFFIN-D 1Y price=+2.25% vs SEC +19%).
//
// THE FIX
// -------
// SEC does NOT expose per-payment distribution data — the FundFactsheet
// `/dividend` endpoint returns `dividend_policy` but an EMPTY `dividend_details`
// array for the flagged funds, and the daily NAV payload carries no distribution
// field. So we cannot reconstruct total return ourselves. Instead we adopt SEC's
// OFFICIAL total return as the displayed value, but ONLY for distributing funds
// and ONLY for periods where SEC actually provides a figure. Non-distributing
// (accumulating) funds are NEVER touched — their NAV price return already equals
// total return, so the ~78% of funds that reconcile stay byte-for-byte unchanged.
//
// This module is pure (no DB / network) so the decision logic is unit-testable.
// ─────────────────────────────────────────────

export interface ResolveDisplayReturnInput {
  /** Our NAV-derived price return % for the period (may be null if uncomputable). */
  pricePct: number | null;
  /** SEC's official TOTAL return % for the period (null when SEC has no figure). */
  secTotalReturnPct: number | null;
  /** True when the fund distributes (SEC dividend_policy === 'Y'). */
  isDividendFund: boolean;
}

export interface ResolveDisplayReturnResult {
  /** The value to store/display in fund_metric.returnPct. */
  returnPct: number | null;
  /** 'price' = our NAV price return; 'sec-total' = SEC official total return. */
  source: 'price' | 'sec-total';
}

/**
 * Decide which return to display for a fund/period.
 *
 *   • Accumulating fund (isDividendFund=false): always our price return. No change.
 *   • Distributing fund WITH a SEC total return for this period: use SEC total
 *     return (adds back the distributions our NAV price return dropped).
 *   • Distributing fund WITHOUT a SEC figure for this period (e.g. 1M / MAX,
 *     which SEC doesn't publish): fall back to our price return — better an
 *     understated number than none.
 */
export function resolveDisplayReturn(
  input: ResolveDisplayReturnInput
): ResolveDisplayReturnResult {
  const { pricePct, secTotalReturnPct, isDividendFund } = input;

  if (isDividendFund && secTotalReturnPct != null && Number.isFinite(secTotalReturnPct)) {
    return { returnPct: secTotalReturnPct, source: 'sec-total' };
  }

  return { returnPct: pricePct, source: 'price' };
}
