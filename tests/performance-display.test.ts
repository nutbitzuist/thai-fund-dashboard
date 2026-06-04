import assert from 'node:assert/strict';
import { shouldShowMetricColumn } from '../lib/performance-display';

const rows = [
  { period: '1M', navCount: 22, secBenchmarkReturnPct: null, secPeerAvgReturnPct: null },
  { period: '1Y', navCount: 240, secBenchmarkReturnPct: null, secPeerAvgReturnPct: null },
];

assert.equal(shouldShowMetricColumn(rows, 'secBenchmarkReturnPct'), false);
assert.equal(shouldShowMetricColumn(rows, 'secPeerAvgReturnPct'), false);
assert.equal(shouldShowMetricColumn([
  ...rows,
  { period: '1Y', navCount: 240, secBenchmarkReturnPct: 12.4, secPeerAvgReturnPct: null },
], 'secBenchmarkReturnPct'), true);
assert.equal(shouldShowMetricColumn([
  ...rows,
  { period: '3Y', navCount: 400, secBenchmarkReturnPct: null, secPeerAvgReturnPct: 5.5 },
], 'secPeerAvgReturnPct'), true);

console.log('performance-display tests passed');
