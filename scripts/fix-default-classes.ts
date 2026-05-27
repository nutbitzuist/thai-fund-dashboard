// scripts/fix-default-classes.ts
// Fix funds that have FundClass records but none is marked isDefault=true.
// Run with: npx tsx scripts/fix-default-classes.ts
//
// Strategy for choosing default class:
// 1. If only one class exists → mark it default
// 2. If "main" class exists → mark it default
// 3. If class ends with "-A" or "-AI" → prefer it
// 4. Otherwise pick the class with the most NAV records (most data)

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');

  const adapter = new PrismaPg({ connectionString, max: 1 });
  const prisma = new PrismaClient({ adapter });

  console.log('Finding funds with no default class...');

  // Get funds that have at least one class but none is isDefault
  const fundsWithNoDefault = await prisma.fund.findMany({
    where: {
      fundClasses: {
        none: { isDefault: true },
        some: {}, // has at least one class
      },
    },
    include: {
      fundClasses: {
        include: {
          _count: { select: { navPrices: true } },
        },
      },
    },
  });

  console.log(`Found ${fundsWithNoDefault.length} funds with no default class`);

  let fixed = 0;
  for (const fund of fundsWithNoDefault) {
    const classes = fund.fundClasses;
    if (!classes.length) continue;

    let defaultClass = classes[0];

    if (classes.length === 1) {
      defaultClass = classes[0];
    } else {
      // Priority: "main" > ends with "-A" > most nav records
      const mainClass = classes.find((c) => c.classAbbrName.toLowerCase() === 'main');
      const aClass = classes.find((c) => /[-_]A(I)?$/i.test(c.classAbbrName));
      const mostData = classes.reduce((best, c) =>
        (c._count.navPrices > best._count.navPrices ? c : best)
      );

      defaultClass = mainClass ?? aClass ?? mostData;
    }

    await prisma.fundClass.update({
      where: { id: defaultClass.id },
      data: { isDefault: true },
    });
    fixed++;
  }

  // Also check funds with zero classes entirely
  const fundsWithNoClasses = await prisma.fund.count({
    where: { fundClasses: { none: {} } },
  });

  await prisma.$disconnect();
  console.log(`Fixed ${fixed} funds`);
  console.log(`Funds with no classes at all: ${fundsWithNoClasses} (needs NAV sync to create classes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
