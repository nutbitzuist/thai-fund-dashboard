// ─────────────────────────────────────────────
// types/index.ts
// Shared TypeScript types for Thai Mutual Fund Dashboard
// ─────────────────────────────────────────────

// ── SEC API Response Types ─────────────────────

export interface SecAmcResponse {
  unique_id: string;
  name_th: string;
  name_en?: string;
}

export interface SecFundFactsheet {
  proj_id: string;
  proj_abbr_name?: string;
  proj_name_th?: string;
  proj_name_en?: string;
  fund_status?: string;
  unique_id?: string;
  fund_type?: string;
  risk_spectrum?: number;
  dividend_policy?: string;
}

export interface SecNavItem {
  nav_date: string;        // "YYYY-MM-DD"
  last_val: string;        // NAV per unit as string
  buy_price?: string;
  sell_price?: string;
  class_abbr_name: string; // fund class identifier
  class_name?: string;
}

export interface SecNavResponse {
  proj_id?: string;
  nav?: SecNavItem[];
  items?: SecNavItem[];
}

// ── Domain Types ────────────────────────────────

export interface AmcDto {
  id: number;
  uniqueId: string;
  nameTh: string;
  nameEn?: string | null;
}

export interface FundSummaryDto {
  id: number;
  projId: string;
  projAbbrName?: string | null;
  nameTh: string;
  nameEn?: string | null;
  fundStatus?: string | null;
  fundType?: string | null;
  riskLevel?: number | null;
  dividendPolicy?: string | null;
  amcId?: number | null;
  amc?: AmcDto | null;
  latestNav?: number | null;
  latestNavDate?: string | null;
  dailyChangePct?: number | null;
  return1Y?: number | null;
  return3Y?: number | null;
  volatility1Y?: number | null;
  maxDrawdown1Y?: number | null;
  sharpe1Y?: number | null;
}

export interface FundDetailDto extends FundSummaryDto {
  fundClasses: FundClassDto[];
  metrics: FundMetricsByPeriod;
}

export interface FundClassDto {
  id: number;
  classAbbrName: string;
  className?: string | null;
  isDefault: boolean;
}

export interface NavPriceDto {
  navDate: string;
  lastVal: number;
  buyPrice?: number | null;
  sellPrice?: number | null;
}

export interface FundMetricDto {
  period: string;
  startDate: string;
  endDate: string;
  returnPct?: number | null;
  annualizedVolatilityPct?: number | null;
  maxDrawdownPct?: number | null;
  sharpeRatio?: number | null;
  navCount?: number | null;
}

export type FundMetricsByPeriod = Partial<Record<MetricPeriod, FundMetricDto>>;

export type MetricPeriod = '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y' | 'MAX';

export const METRIC_PERIODS: MetricPeriod[] = ['1M', '3M', '6M', '1Y', '3Y', '5Y', 'MAX'];

// ── Search & Filter Types ───────────────────────

export interface FundSearchParams {
  q?: string;
  amcId?: number;
  fundType?: string;
  riskLevel?: number;
  dividendPolicy?: string;
  fundStatus?: string;
  sortBy?: FundSortKey;
  sortDir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export type FundSortKey =
  | 'return1Y'
  | 'return3Y'
  | 'volatility'
  | 'maxDrawdown'
  | 'sharpe'
  | 'latestNav'
  | 'nameTh'
  | 'riskLevel';

// ── Chart Data Types ────────────────────────────

export interface ChartDataPoint {
  date: string;
  value: number;
}

export interface NormalizedChartPoint {
  date: string;
  [fundCode: string]: number | string;
}

export interface DrawdownPoint {
  date: string;
  drawdown: number;
}

// ── Compare Types ───────────────────────────────

export interface CompareEntry {
  projId: string;
  color: string;
  fund?: FundSummaryDto;
  navData?: NavPriceDto[];
  metrics?: FundMetricDto[];
}

// ── Rankings Types ──────────────────────────────

export type RankingMetric =
  | 'return1Y'
  | 'return3Y'
  | 'return6M'
  | 'volatility1Y'
  | 'maxDrawdown1Y'
  | 'sharpe1Y';

export type RankingSortDir = 'asc' | 'desc';

export interface RankingPreset {
  id: string;
  label: string;
  metric: RankingMetric;
  sort: RankingSortDir;
  description: string;
}

export const RANKING_PRESETS: RankingPreset[] = [
  {
    id: 'return1Y_high',
    label: 'ผลตอบแทน 1 ปีสูงสุด',
    metric: 'return1Y',
    sort: 'desc',
    description: 'กองทุนที่มีผลตอบแทนย้อนหลัง 1 ปีสูงที่สุด',
  },
  {
    id: 'volatility_low',
    label: 'ความผันผวนต่ำ',
    metric: 'volatility1Y',
    sort: 'asc',
    description: 'กองทุนที่มีความผันผวนของผลตอบแทนต่ำที่สุดใน 1 ปี',
  },
  {
    id: 'drawdown_low',
    label: 'Drawdown ต่ำ',
    metric: 'maxDrawdown1Y',
    sort: 'desc',
    description: 'กองทุนที่มี Max Drawdown ต่ำที่สุด (ลดลงน้อยที่สุดจากจุดสูงสุด)',
  },
  {
    id: 'sharpe_high',
    label: 'Sharpe Ratio สูง',
    metric: 'sharpe1Y',
    sort: 'desc',
    description: 'กองทุนที่ให้ผลตอบแทนเมื่อเทียบกับความเสี่ยงดีที่สุด',
  },
];

// ── Error Types ─────────────────────────────────

export type AppErrorCode =
  | 'FUND_NOT_FOUND'
  | 'NAV_NOT_FOUND'
  | 'API_KEY_INVALID'
  | 'SEC_RATE_LIMIT'
  | 'DATABASE_ERROR'
  | 'SYNC_FAILED'
  | 'VALIDATION_ERROR';

export interface AppError {
  code: AppErrorCode;
  message: string;
  messageTh: string;
}

export const APP_ERRORS: Record<AppErrorCode, AppError> = {
  FUND_NOT_FOUND: {
    code: 'FUND_NOT_FOUND',
    message: 'Fund not found',
    messageTh: 'ไม่พบกองทุนนี้ กรุณาตรวจสอบรหัสหรือชื่อกองทุน',
  },
  NAV_NOT_FOUND: {
    code: 'NAV_NOT_FOUND',
    message: 'NAV data not found',
    messageTh: 'ยังไม่มีข้อมูล NAV ในช่วงเวลาที่เลือก',
  },
  API_KEY_INVALID: {
    code: 'API_KEY_INVALID',
    message: 'Invalid API key',
    messageTh: 'API key ไม่ถูกต้อง กรุณาตรวจสอบการตั้งค่า',
  },
  SEC_RATE_LIMIT: {
    code: 'SEC_RATE_LIMIT',
    message: 'SEC API rate limit exceeded',
    messageTh: 'ระบบกำลังดึงข้อมูลจำนวนมาก กรุณาลองใหม่ภายหลัง',
  },
  DATABASE_ERROR: {
    code: 'DATABASE_ERROR',
    message: 'Database error',
    messageTh: 'ระบบฐานข้อมูลขัดข้อง กรุณาลองใหม่อีกครั้ง',
  },
  SYNC_FAILED: {
    code: 'SYNC_FAILED',
    message: 'Sync failed',
    messageTh: 'อัปเดตข้อมูลไม่สำเร็จ ระบบจะลองใหม่ในการอัปเดตรอบถัดไป',
  },
  VALIDATION_ERROR: {
    code: 'VALIDATION_ERROR',
    message: 'Validation error',
    messageTh: 'ข้อมูลที่ส่งมาไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง',
  },
};

// ── Risk Level Labels ───────────────────────────

export const RISK_LEVEL_LABELS: Record<number, string> = {
  1: 'เสี่ยงต่ำมาก',
  2: 'เสี่ยงต่ำ',
  3: 'เสี่ยงปานกลางค่อนข้างต่ำ',
  4: 'เสี่ยงปานกลางค่อนข้างสูง',
  5: 'เสี่ยงสูง',
  6: 'เสี่ยงสูงมาก',
  7: 'เสี่ยงสูงมาก',
  8: 'เสี่ยงสูงมากพิเศษ',
};

export const RISK_LEVEL_COLORS: Record<number, string> = {
  1: '#16A34A',
  2: '#22C55E',
  3: '#84CC16',
  4: '#F59E0B',
  5: '#F97316',
  6: '#EF4444',
  7: '#DC2626',
  8: '#991B1B',
};

// ── Fund Type Labels ────────────────────────────

export const FUND_TYPE_LABELS: Record<string, string> = {
  EQUITY: 'หุ้น',
  FIXED_INCOME: 'ตราสารหนี้',
  MIXED: 'ผสม',
  MONEY_MARKET: 'ตลาดเงิน',
  PROPERTY: 'อสังหาริมทรัพย์',
  COMMODITY: 'สินค้าโภคภัณฑ์',
  ALTERNATIVE: 'ทางเลือก',
  FOREIGN: 'ต่างประเทศ',
};

// ── Dividend Policy Labels ──────────────────────

export const DIVIDEND_POLICY_LABELS: Record<string, string> = {
  PAID: 'จ่ายเงินปันผล',
  ACCUMULATE: 'สะสมมูลค่า',
};

// ── Fund Status Labels ──────────────────────────

export const FUND_STATUS_LABELS: Record<string, string> = {
  RDY: 'เปิดขาย',
  LIQ: 'อยู่ระหว่างชำระบัญชี',
  SUS: 'ระงับการขาย',
};

// ── Compare Colors ──────────────────────────────

export const COMPARE_COLORS = [
  '#1D4ED8', // blue
  '#D97706', // amber
  '#059669', // emerald
  '#7C3AED', // violet
  '#DC2626', // red
];

// ── Metric Tooltips ─────────────────────────────

export const METRIC_TOOLTIPS: Record<string, { label: string; description: string }> = {
  nav: {
    label: 'มูลค่าหน่วยลงทุน (NAV)',
    description:
      'มูลค่าทรัพย์สินสุทธิต่อหน่วย คำนวณจากมูลค่าทรัพย์สินทั้งหมดของกองทุนหักด้วยหนี้สินแล้วหารด้วยจำนวนหน่วยลงทุนทั้งหมด',
  },
  return: {
    label: 'ผลตอบแทน',
    description:
      'ผลตอบแทนย้อนหลังในช่วงเวลาที่เลือก คำนวณจากการเปลี่ยนแปลงของ NAV ตั้งแต่ต้นงวดถึงปัจจุบัน',
  },
  volatility: {
    label: 'ความผันผวน (Volatility)',
    description:
      'ความผันผวนของผลตอบแทนรายวันคำนวณเป็นรายปี ยิ่งสูงหมายความว่ากองทุนมีการขึ้นลงมาก ความเสี่ยงสูงกว่า',
  },
  maxDrawdown: {
    label: 'Max Drawdown',
    description:
      'การลดลงมากที่สุดของ NAV จากจุดสูงสุดในช่วงเวลาที่เลือก แสดงให้เห็นว่าหากซื้อที่จุดสูงสุดแล้วขายที่จุดต่ำสุดจะขาดทุนเท่าใด',
  },
  sharpe: {
    label: 'Sharpe Ratio',
    description:
      'วัดผลตอบแทนส่วนเกินเมื่อเทียบกับความเสี่ยงที่รับ ยิ่งสูงยิ่งดี แต่ไม่ใช่คำแนะนำการลงทุน ใช้เปรียบเทียบกองทุนประเภทเดียวกัน',
  },
  normalized: {
    label: 'กราฟ Normalized',
    description:
      'ปรับให้ทุกกองทุนเริ่มต้นที่ 100 เพื่อให้เปรียบเทียบการเติบโตสัมพัทธ์กันได้ง่ายขึ้น',
  },
};
