// Seed script for the curated schematic library.
//
// Usage:
//   npm run seed:schematics              → seeds DEV (DATABASE_URL)
//   npm run seed:schematics -- --prod    → seeds PROD (PROD_DATABASE_URL)
//   npm run seed:schematics -- --prod --yes  → skip confirmation prompt
//
// This script:
//   1. Resolves which DB to target (dev by default, prod with --prod flag)
//   2. Prints a clear preamble showing host/db/user
//   3. Asks for "yes" confirmation (skip with --yes)
//   4. Deletes ALL existing schematic data (rows + attachments + job links)
//   5. Reads server/seeds/schematics.json
//   6. Inserts every entry as an admin-curated schematic (is_user_uploaded=false)
//
// Re-running the script is destructive — it wipes the table and re-seeds.
// Edit the JSON file to update the canonical list, then re-run.

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import pkg from 'pg';
const { Pool } = pkg;
import { resolveDbTarget } from './lib/dbTarget';

interface SeedEntry {
  name: string;
  ampModel?: string;
  circuitFamily?: string;
  sourceUrl?: string;
  sourceCredit?: string;
  thumbnailUrl?: string;
  fileUrl?: string;
  tags?: string;
  notes?: string;
}

async function seed() {
  const seedFile = path.join(__dirname, 'seeds', 'schematics.json');
  if (!fs.existsSync(seedFile)) {
    console.error(`❌  Seed file not found: ${seedFile}`);
    process.exit(1);
  }

  const entries: SeedEntry[] = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
  if (!Array.isArray(entries)) {
    console.error('❌  Seed file must contain a JSON array');
    process.exit(1);
  }

  console.log(`Loaded ${entries.length} schematic entries from ${seedFile}`);

  // Resolves dev vs prod, prints preamble, prompts for confirmation if destructive.
  const target = await resolveDbTarget({
    destructive: true,
    operation: `Seed schematic library (${entries.length} entries)`,
  });

  const pool = new Pool({ connectionString: target.url });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Clean slate — kill all existing schematic data so the seed file is the
    // canonical source of truth.
    console.log('Deleting existing schematic data...');
    await client.query('DELETE FROM job_schematics');
    await client.query('DELETE FROM schematic_attachments');
    const deleted = await client.query('DELETE FROM schematics');
    console.log(`  Removed ${deleted.rowCount ?? 0} existing schematics`);

    // Insert
    console.log('Inserting curated schematics...');
    let inserted = 0;
    for (const e of entries) {
      if (!e.name) {
        console.warn('  ⚠️  Skipping entry with no name:', e);
        continue;
      }
      await client.query(
        `INSERT INTO schematics
           (name, amp_model, circuit_family, source_url, source_credit,
            thumbnail_url, file_url, is_user_uploaded, tags, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8, $9)`,
        [
          e.name,
          e.ampModel ?? null,
          e.circuitFamily ?? null,
          e.sourceUrl ?? null,
          e.sourceCredit ?? null,
          e.thumbnailUrl ?? null,
          e.fileUrl ?? null,
          e.tags ?? null,
          e.notes ?? null,
        ],
      );
      inserted++;
    }

    await client.query('COMMIT');
    console.log(`✅  Seeded ${inserted} schematics`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌  Seed failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
