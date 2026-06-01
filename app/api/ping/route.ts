// app/api/ping/route.ts
// Lightweight DB liveness probe — for external monitors (UptimeRobot, Better Uptime, etc.)
// Point your monitor at GET /api/ping. Returns 200 when DB is reachable, 503 when not.
// Response time is fast (<300 ms) because it only runs SELECT 1, not data queries.
//
// Pinging every 5 minutes also keeps Neon's compute from going fully cold.

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const t0 = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { ok: true, db: 'up', latencyMs: Date.now() - t0 },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, db: 'down', error: String(err), latencyMs: Date.now() - t0 },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
