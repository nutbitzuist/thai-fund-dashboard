// ─────────────────────────────────────────────
// lib/db.ts
// Prisma Client singleton (Prisma 7 + pg adapter)
//
// Serverless note: Vercel spins up a fresh JS runtime per invocation.
// Each runtime creates its own Prisma instance. Setting max=1 prevents
// exhausting Railway's connection limit across concurrent invocations.
// ─────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');

  // max: 1 → each serverless invocation uses exactly 1 connection.
  // Without this, the default pg pool is 10 per invocation, which
  // quickly exhausts Railway's connection limit under any load.
  const adapter = new PrismaPg({ connectionString, max: 1 });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// In dev, keep the singleton across hot-reloads to avoid connection leaks.
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
