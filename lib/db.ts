// ─────────────────────────────────────────────
// lib/db.ts
// Prisma Client singleton — auto-selects adapter by environment:
//
//   • Vercel + Neon URL → PrismaNeonHttp (HTTP driver)
//     Each query = one HTTP request. No persistent connection.
//     Works perfectly for stateless serverless reads/writes.
//     NOTE: PrismaNeonHttp does NOT support transactions; all write
//     operations in lib/sync.ts use $executeRaw (INSERT ON CONFLICT)
//     to avoid Prisma's implicit transaction wrapping.
//
//   • Local + Neon URL → PrismaNeon (WebSocket Pool)
//     WebSocket connects via Neon's serverless proxy — avoids the
//     SCRAM-SHA-256-PLUS channel binding issue that blocks plain TCP.
//     Supports full transactions, needed for scripts/backfill.
//     DNS is set to ipv4first to avoid IPv6 timeout on some networks.
//
//   • Non-Neon (Railway, local standard PG) → PrismaPg (TCP)
//     Standard node-postgres pool; works with any PostgreSQL.
// ─────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';
import * as dns from 'dns';

function isNeonUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host.endsWith('.neon.tech') || host.includes('.neon.');
  } catch {
    return false;
  }
}

function cleanEnvValue(value: string | undefined): string | undefined {
  return value?.trim().replace(/^['"]|['"]$/g, '').replace(/\\n/g, '').replace(/\\r/g, '');
}

function createPrismaClient() {
  const connectionString = cleanEnvValue(process.env.DATABASE_URL);
  if (!connectionString) throw new Error('DATABASE_URL is not set');

  const log: ('error' | 'warn' | 'query')[] =
    process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'];

  if (isNeonUrl(connectionString)) {
    if (process.env.VERCEL) {
      // ── Vercel: Neon HTTP driver ──────────────────────────────────────
      // Single HTTP request per query — no TCP handshake overhead.
      // All writes use $executeRaw (INSERT ON CONFLICT) to avoid Prisma's
      // implicit transaction wrapping which HTTP mode doesn't support.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PrismaNeonHttp } = require('@prisma/adapter-neon');
      const adapter = new PrismaNeonHttp(connectionString);
      return new PrismaClient({ adapter, log });
    } else {
      // ── Local/scripts: Neon WebSocket Pool ───────────────────────────
      // Connects via Neon's serverless proxy over WebSocket (port 443).
      // No SCRAM channel binding required (unlike direct TCP to port 5432).
      // Full transaction support — required for backfill scripts.
      // Force IPv4 DNS to avoid timeout on networks where IPv6 doesn't reach Neon.
      // @neondatabase/serverless doesn't auto-detect Node.js 22's native WebSocket
      // — must set webSocketConstructor explicitly before creating the Pool.
      dns.setDefaultResultOrder('ipv4first');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const neonServerless = require('@neondatabase/serverless');
      neonServerless.neonConfig.webSocketConstructor = globalThis.WebSocket;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PrismaNeon } = require('@prisma/adapter-neon');
      const adapter = new PrismaNeon({ connectionString });
      return new PrismaClient({ adapter, log });
    }
  }

  // ── Standard pg adapter (non-Neon: Railway, local standard PG) ──────
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaPg } = require('@prisma/adapter-pg');
  // max: 5 — allows parallel queries within a single serverless invocation.
  // Each Vercel function instance is isolated, so 5 per-instance is safe.
  const adapter = new PrismaPg({ connectionString, max: 5 });
  return new PrismaClient({ adapter, log });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

/**
 * Create a fresh Prisma client — for scripts that need their own connection
 * instead of the shared singleton. Uses the same adapter logic as the singleton.
 */
export function createClient(): PrismaClient {
  return createPrismaClient();
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// In dev, keep the singleton across hot-reloads to avoid connection leaks.
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
