/**
 * scripts/reclassify-eq-to-fif.ts
 *
 * One-time script: re-checks all EQ-classified funds and reclassifies them as FIF
 * if their name matches the updated FIF pattern (country/region names).
 *
 * Also processes NULL-type funds so they get the improved classification.
 *
 * Run with:
 *   DATABASE_URL="..." npx tsx scripts/reclassify-eq-to-fif.ts
 */

import { existsSync } from 'fs';
import { resolve } from 'path';
import { config as dotenvConfig } from 'dotenv';

const envFile = resolve(process.cwd(), '.env.local');
if (existsSync(envFile)) dotenvConfig({ path: envFile });

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');

  const { PrismaClient } = await import('@prisma/client');
  const { PrismaPg } = await import('@prisma/adapter-pg');
  const { inferFundType, inferRiskLevel } = await import('../lib/utils');

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 1 });
  const prisma = new PrismaClient({ adapter });

  // ── 1. Reclassify EQ → FIF ────────────────────────────────────────────────
  console.log('\n━━━ Step 1: Re-check EQ funds ━━━');
  const eqFunds = await prisma.fund.findMany({
    where: { fundType: 'EQ' },
    select: { id: true, projAbbrName: true, nameTh: true, nameEn: true, riskLevel: true },
  });
  console.log(`Found ${eqFunds.length} EQ funds`);

  let eqToFif = 0;
  for (const f of eqFunds) {
    const newType = inferFundType(f.nameTh, f.nameEn, null);
    if (newType === 'FIF') {
      const newRisk = inferRiskLevel('FIF', null);
      await prisma.fund.update({
        where: { id: f.id },
        data: {
          fundType: 'FIF',
          ...(f.riskLevel == null && newRisk != null ? { riskLevel: newRisk } : {}),
        },
      });
      eqToFif++;
      if (eqToFif <= 30) {
        console.log(`  ✓ [${f.projAbbrName ?? '?'}] EQ → FIF — ${f.nameTh}`);
      } else if (eqToFif === 31) {
        console.log('  ... (truncated)');
      }
    }
  }
  console.log(`  Total reclassified EQ → FIF: ${eqToFif}`);

  // ── 2. Fill in NULL-type funds ─────────────────────────────────────────────
  console.log('\n━━━ Step 2: Infer types for NULL-type funds ━━━');
  const nullFunds = await prisma.fund.findMany({
    where: { fundType: null },
    select: { id: true, nameTh: true, nameEn: true, riskLevel: true },
  });
  console.log(`Found ${nullFunds.length} NULL-type funds`);

  let nullUpdated = 0;
  const nullCounts: Record<string, number> = {};
  for (const f of nullFunds) {
    const newType = inferFundType(f.nameTh, f.nameEn, null);
    if (!newType) continue;
    nullCounts[newType] = (nullCounts[newType] ?? 0) + 1;
    const newRisk = inferRiskLevel(newType, null);
    await prisma.fund.update({
      where: { id: f.id },
      data: {
        fundType: newType,
        ...(f.riskLevel == null && newRisk != null ? { riskLevel: newRisk } : {}),
      },
    });
    nullUpdated++;
  }
  console.log(`  Updated: ${nullUpdated}, breakdown:`, nullCounts);

  // ── 3. Summary ──────────────────────────────────────────────────────────────
  console.log('\n━━━ Final counts (active funds) ━━━');
  const counts = await prisma.fund.groupBy({
    by: ['fundType'],
    _count: true,
    where: { fundStatus: { in: ['RG', 'SE'] } },
    orderBy: { _count: { fundType: 'desc' } },
  });
  for (const r of counts) {
    console.log(`  ${(r.fundType ?? 'NULL').padEnd(10)} : ${r._count}`);
  }
  const remaining = await prisma.fund.count({
    where: { fundStatus: { in: ['RG', 'SE'] }, fundType: null },
  });
  console.log(`  NULL       : ${remaining}`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
