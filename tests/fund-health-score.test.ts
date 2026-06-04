import assert from 'node:assert/strict';
import {
  calculateFundHealthScore,
  explainFundHealthScore,
  type FundHealthScoreInput,
} from '../lib/fund-health-score';

function score(input: Partial<FundHealthScoreInput>) {
  return calculateFundHealthScore({
    return1Y: 8,
    volatility1Y: 12,
    maxDrawdown1Y: -8,
    sharpe1Y: 0.55,
    navCount1Y: 245,
    riskLevel: 5,
    totalExpenseRatio: 1.2,
    fundAgeYears: 5,
    ...input,
  });
}

const strong = score({ return1Y: 18, volatility1Y: 8, maxDrawdown1Y: -4, sharpe1Y: 1.25, navCount1Y: 260, totalExpenseRatio: 0.6, fundAgeYears: 8 });
assert.equal(strong.grade, 'ดีมาก');
assert.ok(strong.score >= 80, `expected strong fund >=80, got ${strong.score}`);
assert.ok(strong.components.return >= 80);
assert.ok(strong.components.risk >= 80);

const weak = score({ return1Y: -12, volatility1Y: 35, maxDrawdown1Y: -45, sharpe1Y: -0.7, navCount1Y: 260, totalExpenseRatio: 2.5, fundAgeYears: 2 });
assert.equal(weak.grade, 'ควรระวัง');
assert.ok(weak.score < 45, `expected weak fund <45, got ${weak.score}`);
assert.ok(weak.warnings.some((w) => w.includes('ขาดทุน')));

const insufficient = score({ return1Y: null, volatility1Y: null, maxDrawdown1Y: null, sharpe1Y: null, navCount1Y: 40, fundAgeYears: 0.3 });
assert.equal(insufficient.grade, 'ข้อมูลยังไม่พอ');
assert.ok(insufficient.score < 50);
assert.ok(insufficient.warnings.some((w) => w.includes('ข้อมูลย้อนหลัง')));

const explanation = explainFundHealthScore(strong);
assert.match(explanation, /คะแนนสุขภาพกองทุน/);
assert.match(explanation, /ไม่ใช่คำแนะนำการลงทุน/);

console.log('fund-health-score tests passed');
