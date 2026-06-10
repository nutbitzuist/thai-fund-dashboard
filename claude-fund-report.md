# Thai Fund Dashboard — Overnight Audit & Upgrade Report

**Date:** 2026-06-11 05:45 ICT  
**Repo:** `nutbitzuist/thai-fund-dashboard`  
**Local path:** `/Users/nut/Downloads/overnight-code-audits/thai-fund-dashboard`  
**Model note:** Requested Claude Code model alias `fable-5` was rejected with API 404 (`may not exist or no access`). Retried with Claude Code default; run metadata reported `claude-fable-5[1m]` plus `claude-haiku-4-5-20251001` usage.

## Scores

- **Before: 68/100** — strong product surface and good SEC/Railway architecture, but local/CI build was red without `DATABASE_URL`, lint was red, and several data-health routes could crash or trigger misleading recovery behavior on missing configuration.
- **After: 82/100** — lint/tests/build are green locally without secrets, no-DB health behavior is explicit/degraded, cron monitor avoids false recovery side effects, and tests now lock in graceful missing-DB behavior.

## Good found

- Broad Next.js App Router surface: fund screener, rankings, compare, heatmap, movers, insights, tools, AMCs, and watchlist.
- Clear source-of-truth intent: Railway Postgres + Prisma 7 + SEC Open API keys, with Vercel cron schedules documented.
- Existing domain tests for fund health score, production monitor scoring, Bulltiq content, top holdings, and performance display.
- `/api/health` already had NAV freshness semantics and a 4-day stale threshold.
- Sync code has explicit daily/retry/backfill route separation and protected cron routes.

## Bad / risks found

1. **Build blocker:** `npm run build` failed during Next page-data collection when `DATABASE_URL` was absent.
2. **Lint blocker:** `lib/db.ts` used forbidden `require()` import; `app/api/funds/route.ts` had unused `okRisk3Y`.
3. **Silent-failure risk:** importing Prisma/client-dependent modules could throw before route handlers returned honest JSON.
4. **Monitoring false-positive risk:** `/api/monitor` with missing `DATABASE_URL` could treat config absence like a production outage and proceed into alert/recovery flow.
5. **Cron config ambiguity:** missing `CRON_SECRET` now needs to be an explicit 500 config error, not a vague unauthorized/crash path.
6. **Insight/static page fragility:** insight pages and footer freshness queried DB during prerender and failed the whole build in no-secret CI/local environments.
7. **Dependency hygiene:** `npm ci` reports 5 moderate vulnerabilities; not force-fixed because that may be breaking and needs a separate dependency review.
8. **Remaining live-data validation gap:** no production DB/SEC keys were available in this unattended local job, so true NAV freshness/fund counts must still be verified against production env.

## Fixes made

| File | Change |
|---|---|
| `lib/db.ts` | Converted adapter import to ESM; made Prisma lazy so importing DB modules never throws; added build-time-only Prisma stub for `NEXT_PHASE=phase-production-build` without `DATABASE_URL`, while runtime still reports missing DB as an error/degraded route state. |
| `app/api/health/route.ts` | Returns explicit 503 degraded JSON when `DATABASE_URL` is missing. |
| `app/api/monitor/route.ts` | Returns explicit 500 when `CRON_SECRET` is missing; returns 503 `misconfigured: true` for missing DB without triggering alert/recovery side effects. |
| `app/api/sync/retry/route.ts` | Wrapped freshness check + sync path in the route's error handling so DB/config errors become structured responses. |
| `app/api/content/route.ts` | Wrapped DB-backed content generation in shared route error handling instead of letting query failures crash. |
| `app/api/funds/route.ts` | Removed unused variable that broke lint. |
| `app/insights/[slug]/page.tsx` | Added missing-DB handling for insight pages, showing an explicit degraded/no-data UI instead of crashing prerender. |
| `components/layout/footer.tsx` | Footer NAV freshness now degrades honestly when DB env is absent instead of crashing static generation. |
| `tests/no-db-graceful.test.ts` | New smoke/unit coverage for importing DB/routes without `DATABASE_URL`, `/api/health` degraded response, cron secret behavior, and monitor no-DB behavior. |
| `package.json` | Added `tests/no-db-graceful.test.ts` to `npm test`. |

## Verification evidence

Baseline:

- `npm ci` — PASS; reported 5 moderate vulnerabilities.
- `npm run lint` — FAIL (`lib/db.ts` require import error + unused variable warning).
- `npm test` — PASS existing 5 tests.
- `npm run build` — FAIL: `DATABASE_URL is not set` during `/api/health` page-data collection.

After fixes:

- `npm run lint` — PASS.
- `npm test` — PASS: fund-health-score, production-monitor, bulltiq-content, top-holdings, performance-display, and no-db graceful tests.
- `npm run build` — PASS; generated 76 static pages/routes. Only warning: Next.js inferred `/Users/nut/package-lock.json` as workspace root because another lockfile exists above the repo.
- Local smoke with `next start --port 3210`:
  - `/api/health` → HTTP 503 JSON: `{"healthy":false,"status":"degraded","reason":"DATABASE_URL is not set",...}`.
  - `/api/monitor` → HTTP 500 JSON: `{"error":"CRON_SECRET not configured"}`.
  - `/` → HTTP 200 HTML.

## Remaining route to 100/100

1. Run production-env data audit with real `DATABASE_URL`, `SEC_API_KEY`, and `SEC_NAV_API_KEY`: active fund count, NAV max date, stale days, sync log recency, failed-fetch counts, and missing fund metrics.
2. Add CI workflow running `npm ci`, `npm run lint`, `npm test`, and `npm run build` on PRs.
3. Fix the Next.js workspace-root warning by setting `turbopack.root` or removing the unrelated parent `/Users/nut/package-lock.json` from the build environment.
4. Add API-level tests with a disposable Postgres (or mocked Prisma adapter) for `/api/funds`, `/api/rankings`, `/api/search`, `/api/compare`, sync retry/backfill, and stale NAV thresholds.
5. Add UI freshness banner that consumes `/api/health` and clearly tells users when NAV is stale/degraded.
6. Triage `npm audit` moderate vulnerabilities separately; avoid blind `npm audit fix --force` unless breaking changes are reviewed.
7. Verify Vercel cron schedules against desired Thai local delivery and add external monitor/backstop if exact timing matters.

## Deployment

No production deploy was performed. Changes are local and safe to branch/commit/PR.
