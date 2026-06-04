// lib/performance-display.ts
// Helpers for deciding whether optional performance comparison columns are useful.

export type OptionalPerformanceColumn = 'secBenchmarkReturnPct' | 'secPeerAvgReturnPct';

export interface PerformanceDisplayMetricRow {
  period?: string | null;
  navCount?: number | null;
  secBenchmarkReturnPct?: unknown;
  secPeerAvgReturnPct?: unknown;
}

export function shouldShowMetricColumn(
  rows: PerformanceDisplayMetricRow[],
  column: OptionalPerformanceColumn,
): boolean {
  return rows.some((row) => {
    const value = row[column];
    const numeric = typeof value === 'string' ? Number(value) : Number(value ?? NaN);
    return Number.isFinite(numeric);
  });
}
