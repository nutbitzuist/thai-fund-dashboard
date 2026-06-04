import assert from 'node:assert/strict';
import { assessProductionMonitor } from '../lib/production-monitor';

const ok = assessProductionMonitor({
  dbOk: true,
  apiHealthOk: true,
  sitemapOk: true,
  daysSinceLastNav: 2,
  activeFunds: 2325,
  totalNavRecords: 1_032_946,
  sitemapUrlCount: 2300,
});
assert.equal(ok.severity, 'ok');
assert.equal(ok.alertNeeded, false);

const stale = assessProductionMonitor({
  dbOk: true,
  apiHealthOk: true,
  sitemapOk: true,
  daysSinceLastNav: 7,
  activeFunds: 2325,
  totalNavRecords: 1_032_946,
  sitemapUrlCount: 2300,
});
assert.equal(stale.severity, 'warning');
assert.equal(stale.alertNeeded, true);
assert.ok(stale.messages.some((m) => m.includes('NAV')));

const down = assessProductionMonitor({
  dbOk: false,
  apiHealthOk: false,
  sitemapOk: false,
  daysSinceLastNav: 999,
  activeFunds: 0,
  totalNavRecords: 0,
  sitemapUrlCount: 0,
});
assert.equal(down.severity, 'critical');
assert.equal(down.alertNeeded, true);
assert.ok(down.messages.length >= 3);

console.log('production-monitor tests passed');
