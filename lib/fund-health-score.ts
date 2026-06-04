// lib/fund-health-score.ts
// Bulltiq Fund Health Score — simple, transparent scoring for investor-facing summaries.
// The score is educational only; it is not investment advice.

export interface FundHealthScoreInput {
  return1Y: number | null | undefined;
  volatility1Y: number | null | undefined;
  maxDrawdown1Y: number | null | undefined;
  sharpe1Y: number | null | undefined;
  navCount1Y: number | null | undefined;
  riskLevel: number | null | undefined;
  totalExpenseRatio?: number | null | undefined;
  fundAgeYears?: number | null | undefined;
}

export interface FundHealthScoreResult {
  score: number;
  grade: 'ดีมาก' | 'ดี' | 'พอใช้' | 'ควรระวัง' | 'ข้อมูลยังไม่พอ';
  label: string;
  components: {
    return: number;
    risk: number;
    consistency: number;
    cost: number;
    dataQuality: number;
  };
  strengths: string[];
  warnings: string[];
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Math.round(value);
}

function normalizePositive(value: number | null | undefined, low: number, high: number, fallback = 45): number {
  if (value == null || Number.isNaN(value)) return fallback;
  return clamp(((value - low) / (high - low)) * 100);
}

function normalizeLowerBetter(value: number | null | undefined, good: number, bad: number, fallback = 50): number {
  if (value == null || Number.isNaN(value)) return fallback;
  return clamp(100 - ((value - good) / (bad - good)) * 100);
}

function normalizeDrawdown(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return 50;
  const drawdownMagnitude = Math.abs(value);
  return normalizeLowerBetter(drawdownMagnitude, 3, 35, 50);
}

function gradeFor(score: number, dataQuality: number): FundHealthScoreResult['grade'] {
  if (dataQuality < 35) return 'ข้อมูลยังไม่พอ';
  if (score >= 80) return 'ดีมาก';
  if (score >= 65) return 'ดี';
  if (score >= 45) return 'พอใช้';
  return 'ควรระวัง';
}

export function calculateFundHealthScore(input: FundHealthScoreInput): FundHealthScoreResult {
  const returnComponent = normalizePositive(input.return1Y, -15, 20, 45);
  const volatilityComponent = normalizeLowerBetter(input.volatility1Y, 5, 35, 50);
  const drawdownComponent = normalizeDrawdown(input.maxDrawdown1Y);
  const riskLevelComponent = input.riskLevel == null ? 55 : normalizeLowerBetter(input.riskLevel, 1, 8, 55);
  const riskComponent = round((volatilityComponent * 0.45) + (drawdownComponent * 0.4) + (riskLevelComponent * 0.15));
  const consistencyComponent = normalizePositive(input.sharpe1Y, -0.5, 1.25, 45);
  const costComponent = normalizeLowerBetter(input.totalExpenseRatio, 0.2, 2.5, input.totalExpenseRatio == null ? 65 : 50);

  const navCount = input.navCount1Y ?? 0;
  const navCoverage = clamp((navCount / 230) * 100);
  const ageComponent = input.fundAgeYears == null ? 65 : clamp((input.fundAgeYears / 3) * 100);
  const dataQualityComponent = round((navCoverage * 0.75) + (ageComponent * 0.25));

  const weighted =
    returnComponent * 0.3 +
    riskComponent * 0.25 +
    consistencyComponent * 0.2 +
    costComponent * 0.1 +
    dataQualityComponent * 0.15;

  const score = round(clamp(weighted));
  const grade = gradeFor(score, dataQualityComponent);
  const strengths: string[] = [];
  const warnings: string[] = [];

  if ((input.return1Y ?? 0) >= 10) strengths.push('ผลตอบแทน 1 ปีเด่น');
  if ((input.sharpe1Y ?? 0) >= 0.8) strengths.push('ผลตอบแทนต่อความเสี่ยงดี');
  if (Math.abs(input.maxDrawdown1Y ?? -100) <= 8) strengths.push('Drawdown ค่อนข้างจำกัด');
  if (input.totalExpenseRatio != null && input.totalExpenseRatio <= 1) strengths.push('ค่าใช้จ่ายรวมค่อนข้างต่ำ');

  if (input.return1Y != null && input.return1Y < 0) warnings.push('ผลตอบแทน 1 ปียังขาดทุน');
  if (input.volatility1Y != null && input.volatility1Y > 25) warnings.push('ความผันผวนสูง');
  if (input.maxDrawdown1Y != null && input.maxDrawdown1Y < -25) warnings.push('เคยย่อตัวแรงในช่วง 1 ปี');
  if (dataQualityComponent < 60) warnings.push('ข้อมูลย้อนหลังยังไม่มากพอ ควรอ่านผลลัพธ์ด้วยความระมัดระวัง');
  if (input.totalExpenseRatio != null && input.totalExpenseRatio > 2) warnings.push('ค่าใช้จ่ายรวมสูงกว่าที่ควรตรวจสอบเพิ่ม');

  return {
    score,
    grade,
    label: `Bulltiq Fund Health Score ${score}/100 — ${grade}`,
    components: {
      return: round(returnComponent),
      risk: riskComponent,
      consistency: round(consistencyComponent),
      cost: round(costComponent),
      dataQuality: dataQualityComponent,
    },
    strengths,
    warnings,
  };
}

export function explainFundHealthScore(result: FundHealthScoreResult): string {
  const strengthText = result.strengths.length ? ` จุดเด่น: ${result.strengths.join(', ')}.` : '';
  const warningText = result.warnings.length ? ` ข้อควรระวัง: ${result.warnings.join(', ')}.` : '';
  return `คะแนนสุขภาพกองทุน ${result.score}/100 (${result.grade}) ประเมินจากผลตอบแทน ความเสี่ยง ความสม่ำเสมอ ค่าใช้จ่าย และคุณภาพข้อมูลย้อนหลัง.${strengthText}${warningText} ข้อมูลนี้ใช้เพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน`;
}
