// ─────────────────────────────────────────────
// lib/db.ts
// Prisma client singleton
//
// Production database source of truth:
//   funds.bulltiq.com → Vercel → Railway PostgreSQL
//
// Uses PrismaPg (node-postgres TCP adapter). Do not add serverless-provider
// database adapter branches unless production is actually migrated.
//
// The client is created lazily on first use. Importing this module never
// throws: `next build` collects page data by importing route modules, and a
// missing DATABASE_URL must surface as a runtime 503 from the route's own
// error handling — not as a build failure.
// ─────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

function cleanEnvValue(value?: string): string | undefined {
  if (!value) return value;
  return value.replace(/\\n$/, '').trim();
}

function makePrismaClient() {
  const connectionString = cleanEnvValue(process.env.DATABASE_URL);
  if (!connectionString) {
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return makeBuildTimePrismaStub();
    }
    throw new Error('DATABASE_URL is not set');
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

function makeBuildTimePrismaStub(): PrismaClient {
  const emptyAsync = async () => [];
  const nullAsync = async () => null;
  const zeroAsync = async () => 0;

  return new Proxy({} as PrismaClient, {
    get(_target, prop) {
      if (prop === '$disconnect' || prop === '$connect') return async () => undefined;
      if (prop === '$transaction') return async (queries: unknown) => Array.isArray(queries) ? Promise.all(queries) : null;
      if (prop === '$queryRaw' || prop === '$queryRawUnsafe' || prop === '$executeRaw' || prop === '$executeRawUnsafe') return emptyAsync;
      return new Proxy({}, {
        get(_modelTarget, method) {
          if (method === 'findMany' || method === 'groupBy') return emptyAsync;
          if (method === 'findFirst' || method === 'findUnique') return nullAsync;
          if (method === 'count') return zeroAsync;
          if (method === 'aggregate') return async () => ({ _count: 0 });
          return async () => {
            throw new Error(`DATABASE_URL is not set; Prisma ${String(prop)}.${String(method)} is unavailable outside a build-time fallback`);
          };
        },
      });
    },
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

let cachedClient: PrismaClient | undefined = globalForPrisma.prisma;

function getClient(): PrismaClient {
  if (!cachedClient) {
    cachedClient = makePrismaClient();
    if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = cachedClient;
  }
  return cachedClient;
}

const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    // `await prisma` / serializers probe for `then` — never a real client
    // member, and resolving it here would force a connection just to inspect
    // the object.
    if (prop === 'then') return undefined;
    const client = getClient();
    const value = client[prop as keyof PrismaClient];
    return typeof value === 'function'
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
});

function createClient(): PrismaClient {
  return makePrismaClient();
}

export { createClient, prisma };
export default prisma;
