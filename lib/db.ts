// ─────────────────────────────────────────────
// lib/db.ts
// Prisma Client singleton — auto-selects adapter by environment:
//
//   • Neon URL → @prisma/adapter-neon PrismaNeonHttp (HTTP driver)
//     HTTP-based queries; no TCP handshake needed. Neon's TCP endpoint
//     requires SCRAM-SHA-256-PLUS channel binding which pure-JS pg (v8.x)
//     doesn't support, so we always use HTTP for Neon.
//
//     On Vercel, Node.js fetch works natively.
//     On local macOS/Linux, undici may try IPv6 first causing timeouts;
//     we inject a custom fetch that forces IPv4 via the https module.
//
//   • Everything else (Railway, local non-Neon PG) → @prisma/adapter-pg (TCP)
//     Standard node-postgres pool; works with any standard PostgreSQL.
//     max:1 per invocation to avoid exhausting connection limits.
// ─────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';
import * as https from 'https';

function isNeonUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host.endsWith('.neon.tech') || host.includes('.neon.');
  } catch {
    return false;
  }
}

/**
 * IPv4-forced fetch for environments where undici tries IPv6 first.
 * (e.g. local macOS with a network that cannot reach Neon over IPv6.)
 * On Vercel, the native fetch works fine — we skip this override there.
 */
function makeIpv4Fetch() {
  return function ipv4Fetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const urlStr = typeof input === 'string' ? input : input.toString();
    const parsed = new URL(urlStr);
    const body = (init?.body as string) ?? '';
    const headers = (init?.headers ?? {}) as Record<string, string>;

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: parsed.hostname,
          port: 443,
          path: parsed.pathname + parsed.search,
          method: (init?.method ?? 'GET').toUpperCase(),
          family: 4, // force IPv4 — avoids timeout on IPv6-broken networks
          headers: {
            ...headers,
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (d: Buffer) => chunks.push(d));
          res.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            resolve(
              new Response(text, {
                status: res.statusCode ?? 200,
                headers: res.headers as HeadersInit,
              }),
            );
          });
        },
      );
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  };
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');

  const log: ('error' | 'warn' | 'query')[] =
    process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'];

  if (isNeonUrl(connectionString)) {
    // ── Neon HTTP driver (PrismaNeonHttp) ────────────────────────────────
    // Uses neon.neon() HTTP function — no TCP, no channel binding issues.
    // Must use PrismaNeonHttp (not PrismaNeon which is the WebSocket pool).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { neonConfig } = require('@neondatabase/serverless');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaNeonHttp } = require('@prisma/adapter-neon');

    // On local environments, force IPv4 to avoid undici IPv6 timeouts.
    if (!process.env.VERCEL) {
      neonConfig.fetchFunction = makeIpv4Fetch();
    }

    const adapter = new PrismaNeonHttp(connectionString);
    return new PrismaClient({ adapter, log });
  }

  // ── Standard pg adapter (non-Neon: Railway, local standard PG) ──────
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaPg } = require('@prisma/adapter-pg');
  const adapter = new PrismaPg({ connectionString, max: 1 });
  return new PrismaClient({ adapter, log });
}

/**
 * Create a fresh Prisma client — for scripts that need their own connection
 * instead of the shared singleton. Uses the same adapter logic as the singleton.
 */
export function createClient(): PrismaClient {
  return createPrismaClient();
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// In dev, keep the singleton across hot-reloads to avoid connection leaks.
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
