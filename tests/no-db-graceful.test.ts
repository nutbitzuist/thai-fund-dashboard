// tests/no-db-graceful.test.ts
// Verifies routes degrade honestly when DATABASE_URL / CRON_SECRET are absent:
// importing route modules must not throw, health reports "degraded" with 503,
// and cron routes refuse to run rather than crash. Run via: npx tsx tests/no-db-graceful.test.ts

import assert from 'node:assert/strict';

delete process.env.DATABASE_URL;
delete process.env.CRON_SECRET;

async function main() {
  // Importing the db module (and anything that imports it) must never throw —
  // next build collects page data by importing route modules without env vars.
  const db = await import('../lib/db');
  assert.ok(db.prisma, 'lib/db should export a prisma object without DATABASE_URL set');

  // /api/health → 503 degraded JSON, not a crash
  const { GET: healthGet } = await import('../app/api/health/route');
  const healthRes = await healthGet();
  assert.equal(healthRes.status, 503);
  const healthBody = await healthRes.json();
  assert.equal(healthBody.healthy, false);
  assert.equal(healthBody.status, 'degraded');
  assert.match(healthBody.reason, /DATABASE_URL/);

  const { NextRequest } = await import('next/server');

  // /api/sync/daily without CRON_SECRET → explicit 500 config error
  const { POST: syncDaily } = await import('../app/api/sync/daily/route');
  const dailyRes = await syncDaily(new NextRequest('http://localhost/api/sync/daily', { method: 'POST' }));
  assert.equal(dailyRes.status, 500);
  assert.match((await dailyRes.json()).error, /CRON_SECRET/);

  // /api/sync/backfill without CRON_SECRET → 401, never runs
  const { POST: syncBackfill } = await import('../app/api/sync/backfill/route');
  const backfillRes = await syncBackfill(new NextRequest('http://localhost/api/sync/backfill', { method: 'POST' }));
  assert.equal(backfillRes.status, 401);

  // /api/monitor without CRON_SECRET → explicit 500 config error
  const { GET: monitorGet } = await import('../app/api/monitor/route');
  const monitorRes = await monitorGet(new NextRequest('http://localhost/api/monitor'));
  assert.equal(monitorRes.status, 500);

  // /api/monitor with secret but no DATABASE_URL → 503 misconfigured,
  // and must NOT treat it as an outage (no recovery side effects)
  process.env.CRON_SECRET = 'test-secret';
  const monitorRes2 = await monitorGet(
    new NextRequest('http://localhost/api/monitor', { headers: { 'x-cron-secret': 'test-secret' } })
  );
  assert.equal(monitorRes2.status, 503);
  const monitorBody = await monitorRes2.json();
  assert.equal(monitorBody.misconfigured, true);
  delete process.env.CRON_SECRET;

  console.log('no-db graceful tests passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
