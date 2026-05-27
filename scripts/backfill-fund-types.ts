// scripts/backfill-fund-types.ts
// One-time script: infers fund_type and risk_level for all funds that have null values
// Run with: npx tsx scripts/backfill-fund-types.ts
//
// The SEC FundFactsheet API does not return fund_type or risk_spectrum,
// so we infer them from Thai/English fund names.

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { inferFundType, inferRiskLevel } from '../lib/utils';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');

  const adapter = new PrismaPg({ connectionString, max: 1 });
  const prisma = new PrismaClient({ adapter });

  console.log('Fetching funds with null fundType...');
  const funds = await prisma.fund.findMany({
    where: { fundType: null },
    select: {
      id: true,
      projId: true,
      nameTh: true,
      nameEn: true,
      fundType: true,
      riskLevel: true,
    },
  });

  console.log(`Found ${funds.length} funds to update`);

  let updated = 0;
  let skipped = 0;

  for (const fund of funds) {
    // We don't have invest_country_flag in our DB, use null
    const inferredType = inferFundType(fund.nameTh, fund.nameEn, null);
    const inferredRisk = inferRiskLevel(inferredType, null);

    if (!inferredType) {
      skipped++;
      continue;
    }

    await prisma.fund.update({
      where: { id: fund.id },
      data: {
        fundType: fund.fundType ?? inferredType,
        riskLevel: fund.riskLevel ?? inferredRisk,
      },
    });
    updated++;
    if (updated % 100 === 0) {
      console.log(`  Updated ${updated}/${funds.length}...`);
    }
  }

  // Also update funds that have fundType but missing riskLevel
  const missingRisk = await prisma.fund.findMany({
    where: { riskLevel: null, fundType: { not: null } },
    select: { id: true, fundType: true },
  });
  console.log(`\nFound ${missingRisk.length} funds with missing riskLevel`);
  for (const fund of missingRisk) {
    const risk = inferRiskLevel(fund.fundType, null);
    if (risk != null) {
      await prisma.fund.update({
        where: { id: fund.id },
        data: { riskLevel: risk },
      });
    }
  }

  await prisma.$disconnect();
  console.log(`\nDone! Updated: ${updated}, Skipped (no match): ${skipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
