// Shared helper for any script that mutates the database (seed, migrate,
// repair, etc). Resolves which DB to target and prints a clear preamble
// so you can never accidentally hit the wrong environment.
//
// Usage:
//   import { resolveDbTarget } from '../lib/dbTarget';
//   const target = await resolveDbTarget({ destructive: true });
//   const pool = new Pool({ connectionString: target.url });
//
// CLI:
//   npm run seed:schematics              → uses DATABASE_URL (dev by default)
//   npm run seed:schematics -- --prod    → uses PROD_DATABASE_URL
//   npm run seed:schematics -- --yes     → skips the confirmation prompt
//
// Required env:
//   DATABASE_URL          — always set (dev DB on Replit, local pg locally)
//   PROD_DATABASE_URL     — only required if you pass --prod
//
// Behavior:
//   1. Parse --prod / --yes flags from process.argv
//   2. Pick the right URL from env, refuse if --prod and PROD_DATABASE_URL is missing
//   3. Refuse if --prod and PROD_DATABASE_URL host matches DATABASE_URL host
//      (would mean prod isn't actually a separate DB, you're about to nuke dev)
//   4. Print a clear preamble showing host/db/user/env
//   5. If destructive, prompt for "yes" confirmation unless --yes was passed

import readline from 'readline';

export interface DbTarget {
  url: string;
  env: 'dev' | 'prod';
  host: string;
  database: string;
  user: string;
}

interface ResolveOpts {
  /** True if the operation deletes/modifies data and should require confirmation. */
  destructive: boolean;
  /** Human-readable description shown in the preamble + confirmation prompt. */
  operation: string;
}

export async function resolveDbTarget(opts: ResolveOpts): Promise<DbTarget> {
  const args = process.argv.slice(2);
  const wantProd = args.includes('--prod');
  const skipConfirm = args.includes('--yes') || args.includes('-y');

  const devUrl = process.env.DATABASE_URL;
  const prodUrl = process.env.PROD_DATABASE_URL;

  if (!devUrl) {
    fail('DATABASE_URL is not set in the environment');
  }

  let url: string;
  let env: 'dev' | 'prod';

  if (wantProd) {
    if (!prodUrl) {
      fail(
        '--prod was passed but PROD_DATABASE_URL is not set.\n' +
        '   Add PROD_DATABASE_URL to your Replit Secrets (or local .env)\n' +
        '   pointing at the production database connection string.',
      );
    }
    if (sameHost(devUrl!, prodUrl!)) {
      fail(
        'PROD_DATABASE_URL and DATABASE_URL appear to point at the same host.\n' +
        '   This would mean prod is not actually a separate database.\n' +
        '   Refusing to proceed — fix the env vars first.',
      );
    }
    url = prodUrl!;
    env = 'prod';
  } else {
    url = devUrl!;
    env = 'dev';
  }

  const parsed = parseUrl(url);

  // ── Preamble ────────────────────────────────────────────────────────────
  console.log('');
  console.log('━'.repeat(60));
  console.log(`Operation:  ${opts.operation}`);
  console.log(`Target:     ${env.toUpperCase()}`);
  console.log(`Host:       ${parsed.host}`);
  console.log(`Database:   ${parsed.database}`);
  console.log(`User:       ${parsed.user}`);
  if (opts.destructive) {
    console.log('');
    console.log('⚠️  This operation is DESTRUCTIVE.');
  }
  console.log('━'.repeat(60));
  console.log('');

  // ── Confirmation ────────────────────────────────────────────────────────
  if (opts.destructive && !skipConfirm) {
    const confirmed = await prompt(
      env === 'prod'
        ? `Type "yes" to confirm running this against PRODUCTION: `
        : `Type "yes" to confirm: `,
    );
    if (confirmed.trim().toLowerCase() !== 'yes') {
      console.log('Aborted.');
      process.exit(0);
    }
    console.log('');
  }

  return { url, env, ...parsed };
}

function parseUrl(connectionString: string): { host: string; database: string; user: string } {
  try {
    const u = new URL(connectionString);
    return {
      host: u.host,
      database: u.pathname.replace(/^\//, '') || '(default)',
      user: u.username || '(default)',
    };
  } catch {
    return { host: '(unparseable)', database: '(unparseable)', user: '(unparseable)' };
  }
}

function sameHost(a: string, b: string): boolean {
  try {
    return new URL(a).host === new URL(b).host;
  } catch {
    return false;
  }
}

function fail(message: string): never {
  console.error('');
  console.error(`❌  ${message}`);
  console.error('');
  process.exit(1);
}

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}
