// scripts/run-daily-sync.ts
// Long-running production data sync entrypoint for GitHub Actions.

import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();
if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/\\n$/, '').trim();

async function main() {
  const { default: prisma } = await import('@/lib/db');
  const { runDailySync } = await import('@/lib/sync');
  const result = await runDailySync();
  console.log(JSON.stringify({
    success: result.errors.length === 0,
    ...result,
    timestamp: new Date().toISOString(),
  }, null, 2));

  await prisma.$disconnect();

  if (result.errors.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('[daily-sync] Failed:', err);
  process.exitCode = 1;
});
