// ─────────────────────────────────────────────
// lib/db.ts
// Prisma Client singleton — auto-selects adapter by database host:
//
//   • Neon (*.neon.tech)  → @prisma/adapter-neon (HTTP driver)
//     HTTP-based queries skip TCP handshake — saves ~50-100 ms per cold
//     serverless invocation. Only works with Neon's serverless platform.
//
//   • Everything else (Railway, local PG, etc.) → @prisma/adapter-pg (TCP)
//     Standard node-postgres pool; max:1 per invocation to avoid exhausting
//     connection limits.
//
// Production (Vercel) uses a Neon DATABASE_URL → gets the fast HTTP path.
// Local dev uses Railway → gets the TCP path.
// ─────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';

function isNeonUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host.endsWith('.neon.tech') || host.includes('.neon.');
  } catch {
    return false;
  }
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');

  const log: ('error' | 'warn' | 'query')[] =
    process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'];

  if (isNeonUrl(connectionString)) {
    // ── Neon HTTP driver (production) ──────────────────────────────────
    // Each query is a single HTTP/2 request — no TCP handshake overhead.
    // @neondatabase/serverless + @prisma/adapter-neon
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { neon } = require('@neondatabase/serverless');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaNeon } = require('@prisma/adapter-neon');
    const sql = neon(connectionString);
    const adapter = new PrismaNeon(sql);
    return new PrismaClient({ adapter, log });
  }

  // ── Standard pg adapter (local dev / Railway) ───────────────────────
  // max: 1 → each serverless invocation uses exactly 1 connection.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaPg } = require('@prisma/adapter-pg');
  const adapter = new PrismaPg({ connectionString, max: 1 });
  return new PrismaClient({ adapter, log });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// In dev, keep the singleton across hot-reloads to avoid connection leaks.
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
