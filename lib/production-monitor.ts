// lib/production-monitor.ts
// Pure monitor assessment helpers used by /api/monitor and tests.

export interface ProductionMonitorInput {
  dbOk: boolean;
  apiHealthOk: boolean;
  sitemapOk: boolean;
  daysSinceLastNav: number;
  activeFunds: number;
  totalNavRecords: number;
  sitemapUrlCount: number;
}

export interface ProductionMonitorAssessment {
  severity: 'ok' | 'warning' | 'critical';
  alertNeeded: boolean;
  messages: string[];
}

const MAX_STALE_DAYS = 3;
const MIN_ACTIVE_FUNDS = 2000;
const MIN_NAV_RECORDS = 900_000;
const MIN_SITEMAP_URLS = 2000;

export function assessProductionMonitor(input: ProductionMonitorInput): ProductionMonitorAssessment {
  const critical: string[] = [];
  const warnings: string[] = [];

  if (!input.dbOk) critical.push('Database connectivity failed');
  if (!input.apiHealthOk) critical.push('Public /api/health is not healthy');
  if (!input.sitemapOk) critical.push('Sitemap check failed');

  if (input.daysSinceLastNav > MAX_STALE_DAYS) {
    warnings.push(`NAV ล่าสุดเก่าเกิน ${MAX_STALE_DAYS} วัน (${input.daysSinceLastNav} วัน)`);
  }
  if (input.activeFunds < MIN_ACTIVE_FUNDS) {
    critical.push(`จำนวน active funds ต่ำผิดปกติ (${input.activeFunds})`);
  }
  if (input.totalNavRecords < MIN_NAV_RECORDS) {
    critical.push(`จำนวน NAV records ต่ำผิดปกติ (${input.totalNavRecords})`);
  }
  if (input.sitemapUrlCount < MIN_SITEMAP_URLS) {
    warnings.push(`Sitemap URLs น้อยผิดปกติ (${input.sitemapUrlCount})`);
  }

  if (critical.length > 0) {
    return { severity: 'critical', alertNeeded: true, messages: [...critical, ...warnings] };
  }
  if (warnings.length > 0) {
    return { severity: 'warning', alertNeeded: true, messages: warnings };
  }
  return { severity: 'ok', alertNeeded: false, messages: ['Production checks healthy'] };
}

export function formatMonitorAlert(input: ProductionMonitorInput, assessment: ProductionMonitorAssessment): string {
  const icon = assessment.severity === 'critical' ? '🚨' : assessment.severity === 'warning' ? '⚠️' : '✅';
  return [
    `${icon} <b>Thai Fund Dashboard monitor: ${assessment.severity.toUpperCase()}</b>`,
    ...assessment.messages.map((m) => `• ${m}`),
    '',
    `NAV age: ${input.daysSinceLastNav} วัน`,
    `Active funds: ${input.activeFunds.toLocaleString('en-US')}`,
    `NAV records: ${input.totalNavRecords.toLocaleString('en-US')}`,
    `Sitemap URLs: ${input.sitemapUrlCount.toLocaleString('en-US')}`,
  ].join('\n');
}
