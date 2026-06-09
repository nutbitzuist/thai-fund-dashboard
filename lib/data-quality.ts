// lib/data-quality.ts
// Data completeness and accuracy thresholds for the fund browser.
// Parallel to lib/production-monitor.ts which covers infrastructure health.

export interface DataQualityInput {
  activeFunds: number;
  fundsWithAnyNav: number;
  fundsWithRecentNav: number;   // NAV updated within last 5 calendar days
  fundsWithAnyMetric: number;
  fundsWithReturn1Y: number;    // non-null returnPct in latest 1Y metric row
  fundsWithReturn3M: number;    // non-null returnPct in latest 3M metric row
  fundsWithNoDefaultClass: number;
}

export interface DataQualityAssessment {
  severity: 'ok' | 'warning' | 'critical';
  alertNeeded: boolean;
  messages: string[];
  autoRepairNeeded: boolean;
}

// These thresholds are calibrated against the live dataset (2327 active funds,
// June 2026). Weekly/monthly funds (FIF, FI) lower the 1Y coverage ceiling.
export const QUALITY_THRESHOLDS = {
  // % of active funds that should appear in the 1Y return sort
  return1YCritical: 0.60,
  return1YWarning: 0.75,

  // % of active funds that should have any NAV data
  navAnyCritical: 0.92,
  navAnyWarning: 0.96,

  // % of active funds with NAV from the last 5 calendar days
  navRecentWarning: 0.80,

  // % of active funds that have at least one metric row
  metricAnyCritical: 0.85,
  metricAnyWarning: 0.90,

  // Active funds with no default fund class — bootstrapping backlog
  noDefaultClassMax: 60,
};

export function assessDataQuality(input: DataQualityInput): DataQualityAssessment {
  if (input.activeFunds === 0) {
    return { severity: 'critical', alertNeeded: true, autoRepairNeeded: false, messages: ['No active funds found in DB'] };
  }

  const r1Y = input.fundsWithReturn1Y / input.activeFunds;
  const navAny = input.fundsWithAnyNav / input.activeFunds;
  const navRecent = input.fundsWithRecentNav / input.activeFunds;
  const metricAny = input.fundsWithAnyMetric / input.activeFunds;

  const criticals: string[] = [];
  const warnings: string[] = [];

  // Return coverage
  if (r1Y < QUALITY_THRESHOLDS.return1YCritical) {
    criticals.push(`return1Y coverage ${pct(r1Y)} — ต่ำกว่า threshold ${pct(QUALITY_THRESHOLDS.return1YCritical)} (${input.fundsWithReturn1Y}/${input.activeFunds} funds)`);
  } else if (r1Y < QUALITY_THRESHOLDS.return1YWarning) {
    warnings.push(`return1Y coverage ${pct(r1Y)} — ต่ำกว่า ${pct(QUALITY_THRESHOLDS.return1YWarning)} (${input.fundsWithReturn1Y}/${input.activeFunds} funds)`);
  }

  // NAV any coverage
  if (navAny < QUALITY_THRESHOLDS.navAnyCritical) {
    criticals.push(`NAV coverage ${pct(navAny)} — ${input.activeFunds - input.fundsWithAnyNav} funds ยังไม่มีข้อมูล NAV`);
  } else if (navAny < QUALITY_THRESHOLDS.navAnyWarning) {
    warnings.push(`NAV coverage ${pct(navAny)} — ${input.activeFunds - input.fundsWithAnyNav} funds ยังไม่มีข้อมูล NAV`);
  }

  // NAV recency (separate from "any nav" — catches stale data)
  if (navRecent < QUALITY_THRESHOLDS.navRecentWarning) {
    warnings.push(`Recent NAV coverage ${pct(navRecent)} — ${input.fundsWithAnyNav - input.fundsWithRecentNav} funds NAV ไม่อัปเดต 5 วัน`);
  }

  // Metric coverage
  if (metricAny < QUALITY_THRESHOLDS.metricAnyCritical) {
    criticals.push(`Metric coverage ${pct(metricAny)} — ${input.activeFunds - input.fundsWithAnyMetric} funds ไม่มี metric`);
  } else if (metricAny < QUALITY_THRESHOLDS.metricAnyWarning) {
    warnings.push(`Metric coverage ${pct(metricAny)} — ${input.activeFunds - input.fundsWithAnyMetric} funds ไม่มี metric`);
  }

  // No default class
  if (input.fundsWithNoDefaultClass > QUALITY_THRESHOLDS.noDefaultClassMax) {
    warnings.push(`${input.fundsWithNoDefaultClass} funds ไม่มี default class (ปกติ < ${QUALITY_THRESHOLDS.noDefaultClassMax})`);
  }

  const autoRepairNeeded =
    r1Y < QUALITY_THRESHOLDS.return1YCritical ||
    metricAny < QUALITY_THRESHOLDS.metricAnyCritical;

  if (criticals.length > 0) {
    return { severity: 'critical', alertNeeded: true, autoRepairNeeded, messages: [...criticals, ...warnings] };
  }
  if (warnings.length > 0) {
    return { severity: 'warning', alertNeeded: true, autoRepairNeeded, messages: warnings };
  }
  return {
    severity: 'ok',
    alertNeeded: false,
    autoRepairNeeded: false,
    messages: [
      `Data quality OK — return1Y: ${pct(r1Y)}, NAV: ${pct(navAny)}, metrics: ${pct(metricAny)}`,
    ],
  };
}

export function formatQualityAlert(
  input: DataQualityInput,
  assessment: DataQualityAssessment,
): string {
  const icon = assessment.severity === 'critical' ? '🚨' : assessment.severity === 'warning' ? '⚠️' : '✅';
  const r1Y = input.fundsWithReturn1Y / input.activeFunds;
  const navAny = input.fundsWithAnyNav / input.activeFunds;
  const metricAny = input.fundsWithAnyMetric / input.activeFunds;
  return [
    `${icon} <b>Thai Fund Dashboard — Data Quality ${assessment.severity.toUpperCase()}</b>`,
    ...assessment.messages.map((m) => `• ${m}`),
    '',
    `return1Y: ${input.fundsWithReturn1Y}/${input.activeFunds} (${pct(r1Y)})`,
    `NAV coverage: ${input.fundsWithAnyNav}/${input.activeFunds} (${pct(navAny)})`,
    `Metric coverage: ${input.fundsWithAnyMetric}/${input.activeFunds} (${pct(metricAny)})`,
    assessment.autoRepairNeeded ? '\n🔧 Auto-repair triggered' : '',
  ].filter((l) => l !== '').join('\n');
}

function pct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}
