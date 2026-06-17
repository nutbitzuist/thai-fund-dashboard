import assert from 'node:assert/strict';
import {
  classifyReturnPair,
  startTargetFor,
  toUtcDate,
} from '../lib/reconciliation';

// ── classifyReturnPair ──────────────────────────────────────────────────────

// ALIGNED: within 2pp
assert.equal(classifyReturnPair(12.0, 11.5).verdict, 'ALIGNED');
assert.equal(classifyReturnPair(12.0, 10.0).verdict, 'ALIGNED'); // exactly 2pp
assert.equal(classifyReturnPair(-5.0, -6.0).verdict, 'ALIGNED');

// MILD: 2–20pp, no sign flip / ratio trip
assert.equal(classifyReturnPair(12.0, 7.0).verdict, 'MILD');   // 5pp
assert.equal(classifyReturnPair(30.0, 19.0).verdict, 'MILD');  // 11pp, ratio 1.58x (ok)

// CRAZY: |Δ| > 20pp
assert.equal(classifyReturnPair(50.0, 10.0).verdict, 'CRAZY');
assert.equal(classifyReturnPair(50.0, 10.0).reason.includes('20'), true);

// CRAZY: sign flip (both non-trivial)
assert.equal(classifyReturnPair(8.0, -8.0).verdict, 'CRAZY');
assert.equal(classifyReturnPair(8.0, -8.0).reason, 'sign-flip');

// CRAZY: ratio outside [0.33x, 3x], same sign, both non-trivial, but |Δ|<20
assert.equal(classifyReturnPair(15.0, 4.0).verdict, 'CRAZY'); // 3.75x, Δ=11pp
assert.equal(classifyReturnPair(15.0, 4.0).reason.includes('ratio'), true);
assert.equal(classifyReturnPair(2.0, 7.0).verdict, 'CRAZY');  // 0.29x, Δ=5pp

// Near-zero noise must NOT trip sign/ratio (both must exceed TRIVIAL_MAGNITUDE=1).
assert.equal(classifyReturnPair(0.5, -0.5).verdict, 'ALIGNED'); // |Δ|=1pp, trivial → not sign-flip
assert.equal(classifyReturnPair(0.2, 0.9).verdict, 'ALIGNED');  // |Δ|=0.7pp

// ── startTargetFor ──────────────────────────────────────────────────────────
const asOf = toUtcDate('2026-04-30');
assert.equal(startTargetFor('YTD', asOf).toISOString().slice(0, 10), '2026-01-01');
assert.equal(startTargetFor('1Y', asOf).toISOString().slice(0, 10), '2025-04-30');
assert.equal(startTargetFor('3M', asOf).toISOString().slice(0, 10), '2026-01-30');

// 3M crossing a year boundary
const janAsOf = toUtcDate('2026-01-31');
assert.equal(startTargetFor('3M', janAsOf).toISOString().slice(0, 10), '2025-10-31');
assert.equal(startTargetFor('YTD', janAsOf).toISOString().slice(0, 10), '2026-01-01');

console.log('reconciliation tests passed');
