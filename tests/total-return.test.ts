import assert from 'node:assert/strict';
import { resolveDisplayReturn } from '../lib/total-return';

// ── Accumulating funds: NEVER overridden ────────────────────────────────────
// Non-distributing funds keep their NAV price return even when a SEC figure
// exists. This is what guarantees the ~78% of correct funds don't regress.
{
  const r = resolveDisplayReturn({ pricePct: 12.3, secTotalReturnPct: 14.0, isDividendFund: false });
  assert.equal(r.source, 'price');
  assert.equal(r.returnPct, 12.3);
}
{
  // Even with no SEC figure, accumulating funds just use price return.
  const r = resolveDisplayReturn({ pricePct: -4.2, secTotalReturnPct: null, isDividendFund: false });
  assert.equal(r.source, 'price');
  assert.equal(r.returnPct, -4.2);
}

// ── Distributing funds WITH a SEC total return: adopt SEC ────────────────────
// The core fix: price return understated the distributing fund; SEC total
// return adds the distributions back. KFFIN-D 1Y: price +2.25 → SEC +19.02.
{
  const r = resolveDisplayReturn({ pricePct: 2.25, secTotalReturnPct: 19.02, isDividendFund: true });
  assert.equal(r.source, 'sec-total');
  assert.equal(r.returnPct, 19.02);
}
{
  // Sign-flip case (KFFIN-D YTD: price −10.02 → SEC +5.86).
  const r = resolveDisplayReturn({ pricePct: -10.02, secTotalReturnPct: 5.86, isDividendFund: true });
  assert.equal(r.source, 'sec-total');
  assert.equal(r.returnPct, 5.86);
}

// ── Distributing funds WITHOUT a SEC figure: fall back to price ──────────────
// SEC doesn't publish 1M / MAX; better an understated number than none.
{
  const r = resolveDisplayReturn({ pricePct: 1.1, secTotalReturnPct: null, isDividendFund: true });
  assert.equal(r.source, 'price');
  assert.equal(r.returnPct, 1.1);
}
{
  // Non-finite SEC value is ignored.
  const r = resolveDisplayReturn({ pricePct: 3.0, secTotalReturnPct: NaN, isDividendFund: true });
  assert.equal(r.source, 'price');
  assert.equal(r.returnPct, 3.0);
}

// ── Edge: SEC total return of 0 is a valid figure and must be adopted ────────
{
  const r = resolveDisplayReturn({ pricePct: -2.4, secTotalReturnPct: 0, isDividendFund: true });
  assert.equal(r.source, 'sec-total');
  assert.equal(r.returnPct, 0);
}

console.log('total-return.test.ts: all assertions passed');
