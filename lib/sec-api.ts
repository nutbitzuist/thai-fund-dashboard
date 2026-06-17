// ─────────────────────────────────────────────
// lib/sec-api.ts
// SEC Open API Thailand client
// All calls are server-side only — keys never exposed to browser
// Base host: https://api.sec.or.th
// Auth header: Ocp-Apim-Subscription-Key
// ─────────────────────────────────────────────

import { AppError } from './errors';
import { sleep } from './utils';
import type {
  MetricPeriod,
  SecAmcResponse,
  SecFundFactsheet,
  SecFundPerformance,
  SecNavItem,
  SecPerformanceItem,
} from '@/types';

const SEC_BASE_URL = 'https://api.sec.or.th';
const DEFAULT_TIMEOUT_MS = 15000;
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;
const RATE_LIMIT_DELAY_MS = 300; // ms between requests to avoid 429
const RATE_LIMIT_RETRY_ATTEMPTS = 5; // 429s are transient — retry more than other error types
const MAX_BACKOFF_MS = 30_000; // cap on exponential backoff

// ── Helper: Get API Key ──────────────────────

function getApiKey(type: 'factsheet' | 'nav'): string {
  const key =
    type === 'factsheet'
      ? process.env.SEC_API_KEY
      : process.env.SEC_NAV_API_KEY;

  if (!key) {
    throw new AppError('API_KEY_INVALID', 500, `Missing SEC API key for ${type}`);
  }
  return key;
}

// ── Helper: Parse a Retry-After header (seconds or HTTP-date) → ms ──

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const secs = Number(header);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const when = Date.parse(header);
  if (!Number.isNaN(when)) return Math.max(0, when - Date.now());
  return null;
}

// ── Helper: Fetch with Retry and Timeout ─────

async function secFetch<T>(
  url: string,
  apiKey: string,
  attempt = 1
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        Accept: 'application/json',
      },
      signal: controller.signal,
      // Next.js cache: no-store for sync routes, allow ISR elsewhere
      cache: 'no-store',
    });

    if (res.status === 401 || res.status === 403) {
      throw new AppError('API_KEY_INVALID', 502);
    }

    if (res.status === 429) {
      if (attempt <= RATE_LIMIT_RETRY_ATTEMPTS) {
        // Honor Retry-After when SEC sends it; otherwise exponential backoff with full
        // jitter so concurrent retries spread out instead of re-bursting the API.
        const retryAfterMs = parseRetryAfter(res.headers.get('retry-after'));
        const backoff = Math.min(RETRY_DELAY_MS * 2 ** attempt, MAX_BACKOFF_MS);
        const waitMs = retryAfterMs ?? backoff * (0.5 + Math.random() * 0.5);
        await sleep(waitMs);
        return secFetch<T>(url, apiKey, attempt + 1);
      }
      throw new AppError('SEC_RATE_LIMIT', 429);
    }

    if (res.status === 404) {
      return null as T;
    }

    if (!res.ok) {
      if (attempt <= RETRY_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS * attempt);
        return secFetch<T>(url, apiKey, attempt + 1);
      }
      throw new AppError('SYNC_FAILED', 502, `SEC API returned ${res.status} for ${url}`);
    }

    const text = await res.text();
    if (!text || text === 'null') return null as T;
    return JSON.parse(text) as T;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (attempt <= RETRY_ATTEMPTS) {
      await sleep(RETRY_DELAY_MS * attempt);
      return secFetch<T>(url, apiKey, attempt + 1);
    }
    throw new AppError('SYNC_FAILED', 502, String(err));
  } finally {
    clearTimeout(timer);
  }
}

// ── AMC List ─────────────────────────────────

/**
 * GET /FundFactsheet/fund/amc
 * Returns list of all Asset Management Companies
 */
export async function fetchAmcList(): Promise<SecAmcResponse[]> {
  const apiKey = getApiKey('factsheet');
  const url = `${SEC_BASE_URL}/FundFactsheet/fund/amc`;
  const data = await secFetch<SecAmcResponse[] | null>(url, apiKey);
  return data ?? [];
}

// ── Fund List by AMC ─────────────────────────

/**
 * GET /FundFactsheet/fund/amc/{unique_id}
 * Returns all funds for a given AMC
 * Mapping note: response field names may vary; we normalise them here.
 */
export async function fetchFundsByAmc(uniqueId: string): Promise<SecFundFactsheet[]> {
  const apiKey = getApiKey('factsheet');
  const url = `${SEC_BASE_URL}/FundFactsheet/fund/amc/${encodeURIComponent(uniqueId)}`;
  const data = await secFetch<unknown[] | null>(url, apiKey);
  if (!data) return [];

  // Normalise raw SEC response → SecFundFactsheet
  // Field names documented as of 2025; add defensive fallbacks for unknown fields
  return data.map((raw: unknown) => {
    const r = raw as Record<string, unknown>;
    return {
      proj_id:
        (r.proj_id as string) ??
        (r.projId as string) ??
        '',
      proj_abbr_name:
        (r.proj_abbr_name as string) ??
        (r.projAbbrName as string) ??
        undefined,
      proj_name_th:
        (r.proj_name_th as string) ??
        (r.projNameTh as string) ??
        (r.name_th as string) ??
        '',
      proj_name_en:
        (r.proj_name_en as string) ??
        (r.projNameEn as string) ??
        (r.name_en as string) ??
        undefined,
      fund_status:
        (r.fund_status as string) ??
        (r.fundStatus as string) ??
        undefined,
      unique_id:
        (r.unique_id as string) ??
        (r.uniqueId as string) ??
        undefined,
      fund_type:
        (r.fund_type as string) ??
        (r.fundType as string) ??
        undefined,
      risk_spectrum:
        (r.risk_spectrum as number) ??
        (r.riskSpectrum as number) ??
        undefined,
      dividend_policy:
        (r.dividend_policy as string) ??
        (r.dividendPolicy as string) ??
        undefined,
      regis_date:
        (r.regis_date as string) ??
        (r.regisDate as string) ??
        undefined,
      invest_country_flag:
        (r.invest_country_flag as string) ??
        (r.investCountryFlag as string) ??
        undefined,
    } satisfies SecFundFactsheet;
  });
}

// ── Daily NAV ────────────────────────────────

/**
 * GET /FundDailyInfo/{proj_id}/dailynav/{YYYY-MM-DD}
 * Returns NAV data for a specific fund on a specific date.
 * Note: Returns an array of classes for that date.
 * Rate limit: add RATE_LIMIT_DELAY_MS between successive calls externally.
 */
export async function fetchDailyNav(
  projId: string,
  dateStr: string // "YYYY-MM-DD"
): Promise<SecNavItem[]> {
  const apiKey = getApiKey('nav');
  const url = `${SEC_BASE_URL}/FundDailyInfo/${encodeURIComponent(projId)}/dailynav/${dateStr}`;
  const data = await secFetch<unknown>(url, apiKey);
  if (!data) return [];

  // API may return array directly or wrapped object
  const items: unknown[] = Array.isArray(data) ? data : (data as Record<string, unknown>)?.nav as unknown[] ?? [];

  return items.map((raw: unknown) => {
    const r = raw as Record<string, unknown>;
    return {
      nav_date:
        (r.nav_date as string) ??
        (r.navDate as string) ??
        dateStr,
      last_val:
        String(r.last_val ?? r.lastVal ?? r.nav ?? '0'),
      buy_price:
        r.buy_price != null ? String(r.buy_price) :
        r.buyPrice != null ? String(r.buyPrice) : undefined,
      sell_price:
        r.sell_price != null ? String(r.sell_price) :
        r.sellPrice != null ? String(r.sellPrice) : undefined,
      net_asset:
        r.net_asset != null ? Number(r.net_asset) :
        r.netAsset != null ? Number(r.netAsset) : undefined,
      class_abbr_name:
        (r.class_abbr_name as string) ??
        (r.classAbbrName as string) ??
        projId,
      class_name:
        (r.class_name as string) ??
        (r.className as string) ??
        undefined,
    } satisfies SecNavItem;
  });
}

/**
 * Batch fetch NAV for multiple dates with rate limiting.
 * Yields results per date as they arrive.
 */
export async function* fetchNavBatch(
  projId: string,
  dates: string[],
  delayMs = RATE_LIMIT_DELAY_MS
): AsyncGenerator<{ date: string; items: SecNavItem[] }> {
  for (const date of dates) {
    const items = await fetchDailyNav(projId, date);
    yield { date, items };
    if (delayMs > 0) await sleep(delayMs);
  }
}

// ── Official Performance ─────────────────────

// SEC reference_period → our FundMetric period codes. 10-year and inception are skipped.
const PERFORMANCE_PERIOD_MAP: Record<string, MetricPeriod> = {
  '3 months': '3M',
  '6 months': '6M',
  'year to date': 'YTD',
  '1 year': '1Y',
  '3 years': '3Y',
  '5 years': '5Y',
};

// performance_type_desc markers (Thai). We only need the FUND figures (not benchmark/peer).
const FUND_RETURN_DESC = 'ผลตอบแทนกองทุนรวม';      // fund return
const FUND_VOLATILITY_DESC = 'ความผันผวนของกองทุนรวม'; // fund volatility

function parsePerformanceVal(val: string | null | undefined): number | null {
  if (val == null) return null;
  const s = String(val).trim();
  if (s === '' || s === '-' || s === 'N/A') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * GET /FundFactsheet/fund/{proj_id}/performance
 * Returns SEC's OFFICIAL performance figures. We extract, for the 'main' class only,
 * the fund return (ผลตอบแทนกองทุนรวม) and fund volatility (ความผันผวนของกองทุนรวม)
 * per reference_period, mapped to our period codes (3M/6M/YTD/1Y/3Y/5Y). 10y/inception skipped.
 * Returns null when SEC has no performance data for the fund (404 / empty array).
 */
export async function fetchFundPerformance(
  projId: string
): Promise<SecFundPerformance | null> {
  const apiKey = getApiKey('factsheet');
  const url = `${SEC_BASE_URL}/FundFactsheet/fund/${encodeURIComponent(projId)}/performance`;
  const data = await secFetch<SecPerformanceItem[] | null>(url, apiKey);
  if (!data || !Array.isArray(data) || data.length === 0) return null;

  const returnByPeriod: Partial<Record<MetricPeriod, number>> = {};
  const volatilityByPeriod: Partial<Record<MetricPeriod, number>> = {};
  let asOfDate: string | null = null;

  for (const row of data) {
    // Only the 'main' share class. SEC uses 'main' for the primary class abbr.
    if ((row.class_abbr_name ?? 'main') !== 'main') continue;

    const periodCode = PERFORMANCE_PERIOD_MAP[(row.reference_period ?? '').trim()];
    if (!periodCode) continue; // skips 10 years / inception date and anything unexpected

    const desc = row.performance_type_desc ?? '';
    const val = parsePerformanceVal(row.performance_val);
    if (val === null) continue;

    if (desc.includes(FUND_RETURN_DESC)) {
      returnByPeriod[periodCode] = val;
      if (!asOfDate && row.as_of_date) asOfDate = row.as_of_date;
    } else if (desc.includes(FUND_VOLATILITY_DESC)) {
      volatilityByPeriod[periodCode] = val;
      if (!asOfDate && row.as_of_date) asOfDate = row.as_of_date;
    }
  }

  return { asOfDate, returnByPeriod, volatilityByPeriod };
}

export { RATE_LIMIT_DELAY_MS };
