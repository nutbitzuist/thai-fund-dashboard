/**
 * scripts/seed-neon.ts
 * Seed the Neon database with AMCs and Funds from the SEC API.
 * Run this first, then run backfill-navs.ts for NAV history.
 *
 * Usage: npx tsx scripts/seed-neon.ts
 * (reads .env.local automatically)
 */

import { existsSync } from 'fs';
import { resolve } from 'path';
import { config as dotenvConfig } from 'dotenv';

// Load .env.local
const envFile = resolve(process.cwd(), '.env.local');
if (existsSync(envFile)) dotenvConfig({ path: envFile });

async function main() {
  const missing = ['DATABASE_URL', 'SEC_API_KEY', 'SEC_NAV_API_KEY'].filter(k => !process.env[k]);
  if (missing.length) { console.error('❌ Missing env vars:', missing.join(', ')); process.exit(1); }

  const { syncAmcs, syncFunds } = await import('../lib/sync');
  const { default: prisma } = await import('../lib/db');

  const t0 = Date.now();
  const elapsed = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';

  // ── Phase 1: AMCs ────────────────────────────────────────────────────────
  console.log('\n━━━ Phase 1: Sync AMCs ━━━');
  const amcCount = await syncAmcs();
  console.log(`✅  ${amcCount} AMCs synced  (${elapsed()})`);

  // ── Phase 2: Funds ───────────────────────────────────────────────────────
  console.log('\n━━━ Phase 2: Sync Funds ━━━');
  const fundCount = await syncFunds();
  console.log(`✅  ${fundCount} funds synced  (${elapsed()})`);

  // ── Summary ─────────────────────────────────────────────────────────────
  const [amc, fund] = await Promise.all([prisma.amc.count(), prisma.fund.count()]);
  console.log(`\n🎉  Seed complete in ${elapsed()}`);
  console.log(`   AMCs:  ${amc}`);
  console.log(`   Funds: ${fund}`);
  console.log('\nNext step: run the 2-year NAV backfill:');
  console.log('  npx tsx scripts/backfill-navs.ts --days=730 --new-only --concurrency=8\n');

  await prisma.$disconnect();
}

main().catch(e => { console.error('\n💥 Fatal error:', e); process.exit(1); });
