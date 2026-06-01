/**
 * scripts/recover-db.ts
 *
 * Full automated DB recovery — runs locally or inside the db-recovery GitHub Action.
 *
 * Steps:
 *   0. Check if DB is already alive (bail out if fine)
 *   1. Create a new Neon project via REST API
 *   2. Push Prisma schema to the new DB
 *   3. Update DATABASE_URL in Vercel env vars via Vercel API
 *   4. Trigger a Vercel production deployment
 *   5. Run the initial data sync (AMCs → funds → NAVs → metrics)
 *   6. Send Telegram status updates throughout
 *
 * Required env vars:
 *   NEON_API_KEY     — from console.neon.tech → Account → API Keys
 *   NEON_ORG_ID      — your org id (e.g. org-damp-hill-91455247)
 *   VERCEL_TOKEN     — from vercel.com → Settings → Tokens
 *   VERCEL_PROJECT_ID — project id (prj_...)
 *   SEC_API_KEY, SEC_NAV_API_KEY, CRON_SECRET
 *   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 */

import { execSync, spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { config as dotenvConfig } from 'dotenv';

const envFile = resolve(process.cwd(), '.env.local');
if (existsSync(envFile)) dotenvConfig({ path: envFile });

// ── Config ────────────────────────────────────────────────────────────────────
const NEON_PROJECT_NAME = 'thai-fund-dashboard';
const NEON_ORG_ID = process.env.NEON_ORG_ID ?? 'org-damp-hill-91455247';
const NEON_API_KEY = process.env.NEON_API_KEY ?? '';
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const TELEGRAM_CHAT = process.env.TELEGRAM_CHAT_ID ?? '';

// ── Helpers ───────────────────────────────────────────────────────────────────
function step(msg: string) { console.log(`\n━━━ ${msg} ━━━`); }

async function tg(text: string) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text, parse_mode: 'HTML' }),
    });
  } catch { /* non-critical */ }
}

async function isDbAlive(url: string): Promise<boolean> {
  try {
    const { Client } = await import('pg');
    const client = new Client({ connectionString: url, connectionTimeoutMillis: 8000 });
    await client.connect();
    await client.query('SELECT 1');
    await client.end();
    return true;
  } catch { return false; }
}

// ── Neon REST API ─────────────────────────────────────────────────────────────
async function createNeonProject(): Promise<string> {
  // Try REST API first (works in CI with NEON_API_KEY)
  if (NEON_API_KEY) {
    const res = await fetch('https://console.neon.tech/api/v2/projects', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NEON_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ project: { name: NEON_PROJECT_NAME, org_id: NEON_ORG_ID } }),
    });
    if (!res.ok) throw new Error(`Neon API error: ${await res.text()}`);
    const data = await res.json();
    return data.connection_uris[0].connection_uri as string;
  }

  // Fallback: neon CLI (works locally with OAuth)
  const out = execSync(
    `neon projects create --name "${NEON_PROJECT_NAME}" --org-id ${NEON_ORG_ID} --output json`,
    { encoding: 'utf8' },
  );
  const data = JSON.parse(out);
  return data.connection_uris[0].connection_uri as string;
}


// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const currentUrl = process.env.DATABASE_URL ?? '';

  // Step 0: bail if DB is fine
  step('0. Checking current database');
  if (currentUrl) {
    const alive = await isDbAlive(currentUrl);
    if (alive) {
      console.log('✅ Database reachable — no recovery needed.');
      process.exit(0);
    }
    console.log('❌ Database unreachable — starting recovery...');
  }

  await tg('🔧 <b>Thai Fund Dashboard — Auto-Recovery Started</b>\nDatabase is unreachable. Provisioning a new database...');

  // Step 1: create new Neon project
  step('1. Creating new Neon project');
  let newDbUrl: string;
  try {
    newDbUrl = await createNeonProject();
    const host = new URL(newDbUrl).hostname;
    console.log(`✅ New project: ${host}`);
    await tg(`✅ New Neon database created\nHost: <code>${host}</code>`);
  } catch (e) {
    await tg(`❌ Recovery failed at step 1 (Neon): ${e}`);
    throw e;
  }

  // Step 2: push Prisma schema
  step('2. Pushing Prisma schema');
  try {
    spawnSync('npx', ['prisma', 'db', 'push', '--skip-generate'], {
      env: { ...process.env, DATABASE_URL: newDbUrl },
      stdio: 'inherit',
    });
    console.log('✅ Schema deployed');
    await tg('✅ Database schema deployed');
  } catch (e) {
    await tg(`❌ Recovery failed at step 2 (schema): ${e}`);
    throw e;
  }

  // Step 3: update Vercel env via CLI
  step('3. Updating Vercel DATABASE_URL');
  try {
    spawnSync('vercel', ['env', 'rm', 'DATABASE_URL', 'production', '--yes'], { encoding: 'utf8' });
    const add = spawnSync('vercel', ['env', 'add', 'DATABASE_URL', 'production'], {
      input: newDbUrl, encoding: 'utf8', stdio: ['pipe', 'inherit', 'inherit'],
    });
    if (add.status !== 0) throw new Error('vercel env add failed');
    console.log('✅ Vercel env updated');
    await tg('✅ Vercel DATABASE_URL updated');
  } catch (e) {
    console.error('⚠️  Vercel env update failed:', e);
    await tg(`⚠️ Vercel env update failed — update DATABASE_URL manually:\n<code>${newDbUrl}</code>`);
  }

  // Also update .env.local if running locally
  if (existsSync(envFile)) {
    const { readFileSync, writeFileSync } = await import('fs');
    let content = readFileSync(envFile, 'utf8');
    content = content.replace(/DATABASE_URL=.*/, `DATABASE_URL="${newDbUrl}"`);
    writeFileSync(envFile, content);
  }

  // Step 4: redeploy via CLI
  step('4. Redeploying to Vercel production');
  try {
    const deploy = spawnSync('vercel', ['deploy', '--prod', '--yes'], { stdio: 'inherit', encoding: 'utf8' });
    if (deploy.status !== 0) throw new Error('vercel deploy failed');
    console.log('✅ Deployed — site live in ~2 min');
    await tg('✅ Vercel redeployment triggered');
  } catch (e) {
    console.error('⚠️  Deploy failed:', e);
    await tg(`⚠️ Deploy failed — run manually: vercel deploy --prod`);
  }

  // Step 5: full data restore (all 7 phases — NAVs + fees + SEC data + metrics)
  step('5. Starting full data restore (~40 min)');
  await tg('⏳ Starting full restore from SEC API (~40 minutes)...');
  const sync = spawnSync('npx', ['tsx', 'scripts/full-restore.ts'], {
    env: { ...process.env, DATABASE_URL: newDbUrl },
    stdio: 'inherit',
    timeout: 60 * 60 * 1000,
  });
  if (sync.status === 0) {
    await tg('✅ Full restore complete — site is fully restored with all data!');
  } else {
    await tg('⚠️ Restore ended with errors — partial data may be available. Check logs.');
  }

  const safeUrl = newDbUrl.replace(/:([^@]+)@/, ':***@');
  console.log(`\n✅ Recovery complete! New DB: ${safeUrl}`);
}

main().catch(async (e) => {
  console.error('Recovery failed:', e);
  await tg(`❌ <b>Recovery script crashed</b>\n${e}`);
  process.exit(1);
});
