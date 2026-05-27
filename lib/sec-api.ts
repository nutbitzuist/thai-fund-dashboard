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
  SecAmcResponse,
  SecFundFactsheet,
  SecNavItem,
} from '@/types';

const SEC_BASE_URL = 'https://api.sec.or.th';
const DEFAULT_TIMEOUT_MS = 15000;
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;
const RATE_LIMIT_DELAY_MS = 300; // ms between requests to avoid 429

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
      if (attempt <= RETRY_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS * attempt * 2);
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

export { RATE_LIMIT_DELAY_MS };
