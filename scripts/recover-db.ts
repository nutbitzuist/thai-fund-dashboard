/**
 * scripts/recover-db.ts
 *
 * Full automated recovery when the Neon database is deleted or unreachable.
 * Run this whenever the site is showing DB errors.
 *
 * What it does:
 *   1. Tests if the current DB is alive — exits early if fine
 *   2. Creates a new Neon project (requires `neon` CLI logged in)
 *   3. Pushes the Prisma schema
 *   4. Updates DATABASE_URL in Vercel (requires `vercel` CLI logged in)
 *   5. Triggers an initial data sync from the SEC API
 *   6. Redeploys to Vercel so the new URL is live
 *
 * Usage:
 *   npx tsx scripts/recover-db.ts
 *
 * Prerequisites:
 *   - `neon` CLI authenticated (`neon auth`)
 *   - `vercel` CLI authenticated (`vercel login`)
 *   - .env.local present (for SEC API keys and CRON_SECRET)
 *   - NEON_ORG_ID set in environment OR passed as argument:
 *       NEON_ORG_ID=org-xxx npx tsx scripts/recover-db.ts
 */

import { execSync, spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { config as dotenvConfig } from 'dotenv';

const envFile = resolve(process.cwd(), '.env.local');
if (existsSync(envFile)) dotenvConfig({ path: envFile });

const NEON_PROJECT_NAME = 'thai-fund-dashboard';
const VERCEL_ENV_NAME = 'DATABASE_URL';

function run(cmd: string, opts: { silent?: boolean } = {}): string {
  try {
    const out = execSync(cmd, { encoding: 'utf8', stdio: opts.silent ? 'pipe' : ['inherit', 'pipe', 'inherit'] });
    return out.trim();
  } catch (e: unknown) {
    const err = e as { stdout?: string; message?: string };
    throw new Error(err.stdout?.trim() || err.message || String(e));
  }
}

function step(msg: string) {
  console.log(`\n━━━ ${msg} ━━━`);
}

async function isDbAlive(url: string): Promise<boolean> {
  try {
    const { Client } = await import('pg');
    const client = new Client({ connectionString: url, connectionTimeoutMillis: 8000 });
    await client.connect();
    await client.query('SELECT 1');
    await client.end();
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const currentUrl = process.env.DATABASE_URL;

  // ── Step 0: Check if DB is actually down ────────────────────────────────
  step('0. Checking current database');
  if (currentUrl) {
    console.log(`  Testing: ${currentUrl.replace(/:([^@]+)@/, ':***@')}`);
    const alive = await isDbAlive(currentUrl);
    if (alive) {
      console.log('  ✅ Database is reachable — no recovery needed.');
      process.exit(0);
    }
    console.log('  ❌ Database unreachable. Starting recovery...');
  } else {
    console.log('  ⚠️  No DATABASE_URL set. Starting fresh provisioning...');
  }

  // ── Step 1: Detect Neon org ─────────────────────────────────────────────
  step('1. Detecting Neon org');
  let orgId = process.env.NEON_ORG_ID ?? '';
  if (!orgId) {
    try {
      const orgs = JSON.parse(run('neon orgs list --output json', { silent: true }));
      if (!orgs.length) throw new Error('No Neon orgs found — run `neon auth` first');
      orgId = orgs[0].id;
      console.log(`  Using org: ${orgs[0].name} (${orgId})`);
    } catch (e) {
      console.error('  ❌ Could not list Neon orgs:', e);
      console.error('  Run `neon auth` to authenticate the Neon CLI, then retry.');
      process.exit(1);
    }
  }

  // ── Step 2: Create new Neon project ─────────────────────────────────────
  step('2. Creating new Neon project');
  let newDbUrl: string;
  try {
    const result = JSON.parse(
      run(`neon projects create --name "${NEON_PROJECT_NAME}" --org-id ${orgId} --output json`, { silent: true }),
    );
    newDbUrl = result.connection_uris[0].connection_uri;
    console.log(`  ✅ Project created: ${result.project.id}`);
    console.log(`  Host: ${result.connection_uris[0].connection_parameters.host}`);
  } catch (e) {
    console.error('  ❌ Failed to create Neon project:', e);
    process.exit(1);
  }

  // ── Step 3: Push Prisma schema ───────────────────────────────────────────
  step('3. Pushing Prisma schema');
  try {
    process.env.DATABASE_URL = newDbUrl;
    run(`DATABASE_URL="${newDbUrl}" npx prisma db push`);
    console.log('  ✅ Schema deployed');
  } catch (e) {
    console.error('  ❌ Schema push failed:', e);
    process.exit(1);
  }

  // ── Step 4: Update .env.local ────────────────────────────────────────────
  step('4. Updating .env.local');
  try {
    const { writeFileSync, readFileSync } = await import('fs');
    let content = existsSync(envFile) ? readFileSync(envFile, 'utf8') : '';
    if (content.includes('DATABASE_URL=')) {
      content = content.replace(/DATABASE_URL=.*/g, `DATABASE_URL="${newDbUrl}"`);
    } else {
      content += `\nDATABASE_URL="${newDbUrl}"\n`;
    }
    writeFileSync(envFile, content);
    console.log('  ✅ .env.local updated');
  } catch (e) {
    console.error('  ⚠️  Could not update .env.local:', e);
  }

  // ── Step 5: Update Vercel env ────────────────────────────────────────────
  step('5. Updating Vercel production DATABASE_URL');
  try {
    // Remove old, then add new (ignore error if var doesn't exist)
    spawnSync('vercel', ['env', 'rm', VERCEL_ENV_NAME, 'production', '--yes'], { encoding: 'utf8' });
    const add = spawnSync(
      'vercel',
      ['env', 'add', VERCEL_ENV_NAME, 'production'],
      { input: newDbUrl, encoding: 'utf8' },
    );
    if (add.status !== 0) throw new Error(add.stderr);
    console.log('  ✅ Vercel env updated');
  } catch (e) {
    console.error('  ❌ Could not update Vercel env:', e);
    console.error(`  Manually set DATABASE_URL="${newDbUrl}" in Vercel dashboard.`);
  }

  // ── Step 6: Start initial sync ───────────────────────────────────────────
  step('6. Starting initial data sync (runs in background)');
  console.log('  Syncing all funds + 90 days NAV history. This takes ~20 minutes.');
  const sync = spawnSync(
    'npx', ['tsx', 'scripts/initial-sync.ts'],
    {
      encoding: 'utf8',
      env: { ...process.env, DATABASE_URL: newDbUrl },
      stdio: 'inherit',
      timeout: 30 * 60 * 1000, // 30 min max
    },
  );
  if (sync.status !== 0) {
    console.error('  ⚠️  Sync exited with errors — check output above. Continuing...');
  } else {
    console.log('  ✅ Initial sync complete');
  }

  // ── Step 7: Redeploy to Vercel ───────────────────────────────────────────
  step('7. Redeploying to Vercel production');
  try {
    run('vercel deploy --prod');
    console.log('  ✅ Deployed — site is live with new database');
  } catch (e) {
    console.error('  ❌ Deploy failed:', e);
    console.error('  Run `vercel deploy --prod` manually.');
  }

  console.log(`\n✅ Recovery complete!\n   New DB: ${newDbUrl.replace(/:([^@]+)@/, ':***@')}\n`);
}

main().catch((e) => {
  console.error('Recovery failed:', e);
  process.exit(1);
});
