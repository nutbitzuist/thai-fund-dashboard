// ─────────────────────────────────────────────
// lib/db.ts
// Prisma client singleton
//
// Production database source of truth:
//   funds.bulltiq.com → Vercel → Railway PostgreSQL
//
// Uses PrismaPg (node-postgres TCP adapter). Do not add serverless-provider
// database adapter branches unless production is actually migrated.
// ─────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

function cleanEnvValue(value?: string): string | undefined {
  if (!value) return value;
  return value.replace(/\\n$/, '').trim();
}

function makePrismaClient() {
  const connectionString = cleanEnvValue(process.env.DATABASE_URL);
  if (!connectionString) throw new Error('DATABASE_URL is not set');

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const prisma = globalForPrisma.prisma ?? makePrismaClient();

function createClient(): PrismaClient {
  return makePrismaClient();
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export { createClient, prisma };
export default prisma;
