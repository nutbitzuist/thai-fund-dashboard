// app/api/monitor/route.ts
// DB connectivity monitor — called by Vercel cron daily at 08:00 UTC.
//
// On DB failure:
//   1. Sends a Telegram alert
//   2. Triggers the db-recovery GitHub Actions workflow automatically
//
// Required env vars:
//   CRON_SECRET           — guards the endpoint
//   TELEGRAM_BOT_TOKEN    — bot token from @BotFather
//   TELEGRAM_CHAT_ID      — your personal chat ID
//   GITHUB_DISPATCH_TOKEN — GitHub PAT with repo scope (to trigger workflow)
//   GITHUB_REPO           — e.g. nutbitzuist/thai-fund-dashboard

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { appBaseUrl } from '@/lib/utils';
import { assessProductionMonitor, formatMonitorAlert } from '@/lib/production-monitor';
import { assessDataQuality, formatQualityAlert } from '@/lib/data-quality';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GITHUB_REPO = process.env.GITHUB_REPO ?? 'nutbitzuist/thai-fund-dashboard';

async function sendTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
  } catch { /* non-critical */ }
}

async function triggerRecovery(): Promise<boolean> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) return false;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github+json',
        },
        body: JSON.stringify({ event_type: 'db-recovery' }),
      },
    );
    return res.status === 204;
  } catch { return false; }
}

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  const authHeader = req.headers.get('authorization');
  const secret =
    req.headers.get('x-cron-secret') ??
    (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null) ??
    req.nextUrl.searchParams.get('secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Missing DATABASE_URL is a config problem, not an outage — report degraded
  // without firing the Telegram alert or the db-recovery workflow.
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, severity: 'critical', error: 'DATABASE_URL is not set', misconfigured: true },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const t0 = Date.now();
  try {
    // Test 1: raw DB connectivity
    await prisma.$queryRaw`SELECT 1`;

    // Test 2: data freshness, critical counts, and display completeness
    const fiveDaysAgo = new Date(Date.now() - 5 * 86_400_000);
    const [latestNav, activeFunds, totalNavRecords, fundsWithAnyNav, fundsWithRecentNav, fundsWithAnyMetric, fundsWithNoDefaultClass] = await Promise.all([
      prisma.navPrice.findFirst({
        orderBy: { navDate: 'desc' },
        select: { navDate: true },
      }),
      prisma.fund.count({ where: { fundStatus: { in: ['RG', 'SE'] } } }),
      prisma.navPrice.count(),
      prisma.fund.count({ where: { fundStatus: { in: ['RG', 'SE'] }, navPrices: { some: {} } } }),
      prisma.fund.count({ where: { fundStatus: { in: ['RG', 'SE'] }, navPrices: { some: { navDate: { gte: fiveDaysAgo } } } } }),
      prisma.fund.count({ where: { fundStatus: { in: ['RG', 'SE'] }, fundMetrics: { some: {} } } }),
      prisma.fund.count({ where: { fundStatus: { in: ['RG', 'SE'] }, fundClasses: { none: { isDefault: true } } } }),
    ]);
    const [return1YRow] = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(DISTINCT fm."fundId")::int AS count
      FROM fund_metric fm
      JOIN fund_class fc ON fc.id = fm."fundClassId" AND fc."isDefault" = TRUE
      JOIN fund f ON f.id = fm."fundId" AND f."fundStatus" IN ('RG', 'SE')
      WHERE fm.period = '1Y' AND fm."returnPct" IS NOT NULL
    `;
    const daysSince = latestNav
      ? Math.floor((Date.now() - new Date(latestNav.navDate).getTime()) / 86400000)
      : 999;

    // Test 3: public health + sitemap sanity. These catch routing/canonical regressions
    // that DB-only cron checks miss.
    const base = appBaseUrl();
    const [healthRes, sitemapRes] = await Promise.allSettled([
      fetch(`${base}/api/health`, { cache: 'no-store' }),
      fetch(`${base}/sitemap.xml`, { cache: 'no-store' }),
    ]);
    const apiHealthOk = healthRes.status === 'fulfilled' && healthRes.value.ok;
    let sitemapOk = false;
    let sitemapUrlCount = 0;
    if (sitemapRes.status === 'fulfilled' && sitemapRes.value.ok) {
      const xml = await sitemapRes.value.text();
      sitemapOk = xml.includes('<urlset') && xml.includes(`${base}/funds/`) && !xml.includes('thai-fund-dashboard.vercel.app');
      sitemapUrlCount = (xml.match(/<loc>/g) ?? []).length;
    }

    const monitorInput = {
      dbOk: true,
      apiHealthOk,
      sitemapOk,
      daysSinceLastNav: daysSince,
      activeFunds,
      totalNavRecords,
      sitemapUrlCount,
    };
    const assessment = assessProductionMonitor(monitorInput);

    const qualityInput = {
      activeFunds,
      fundsWithAnyNav,
      fundsWithRecentNav,
      fundsWithAnyMetric,
      fundsWithReturn1Y: return1YRow?.count ?? 0,
      fundsWithReturn3M: 0, // not queried here — expensive; the daily sync check covers it
      fundsWithNoDefaultClass,
    };
    const qualityAssessment = assessDataQuality(qualityInput);

    const alerts: Promise<void>[] = [];
    if (assessment.alertNeeded) alerts.push(sendTelegram(formatMonitorAlert(monitorInput, assessment)));
    if (qualityAssessment.alertNeeded) alerts.push(sendTelegram(formatQualityAlert(qualityInput, qualityAssessment)));
    await Promise.all(alerts);

    const worstSeverity = assessment.severity === 'critical' || qualityAssessment.severity === 'critical'
      ? 'critical'
      : assessment.severity === 'warning' || qualityAssessment.severity === 'warning'
        ? 'warning'
        : 'ok';

    return NextResponse.json(
      {
        ok: worstSeverity !== 'critical',
        severity: worstSeverity,
        infrastructure: assessment,
        dataQuality: { ...qualityAssessment, ...qualityInput },
        latencyMs: Date.now() - t0,
        lastNavDate: latestNav?.navDate?.toISOString().split('T')[0] ?? null,
        ...monitorInput,
      },
      { status: worstSeverity === 'critical' ? 503 : 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    // DB is down — alert + auto-recover
    const triggered = await triggerRecovery();
    await sendTelegram(
      `🚨 <b>Thai Fund Dashboard — DATABASE DOWN</b>\n` +
      `DB ไม่ตอบสนอง เวลา ${new Date().toISOString()}\n\n` +
      (triggered
        ? '🤖 Auto-recovery workflow triggered — รอประมาณ 25 นาที'
        : '⚠️ Auto-recovery ไม่ได้ตั้งค่า — รัน <code>npx tsx scripts/recover-db.ts</code>'),
    );
    return NextResponse.json(
      { ok: false, error: String(err), latencyMs: Date.now() - t0, recoveryTriggered: triggered },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
