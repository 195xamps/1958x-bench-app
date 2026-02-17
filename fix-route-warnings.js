#!/usr/bin/env node
/**
 * Fix: Move infrastructure directories out of app/ to src/
 *
 * Problem:
 *   Expo Router treats EVERY file under app/ as a route.
 *   Phase 1/2 placed ~50 non-route files (components, hooks, services, etc.)
 *   inside app/, causing "missing default export" warnings and breaking
 *   auth redirects (Google login crash).
 *
 * Solution:
 *   Move 8 infrastructure directories from app/ to src/:
 *     app/components/  → src/components/
 *     app/contexts/    → src/contexts/
 *     app/data/        → src/data/
 *     app/hooks/       → src/hooks/
 *     app/services/    → src/services/
 *     app/theme/       → src/theme/
 *     app/types/       → src/types/
 *     app/utils/       → src/utils/
 *
 *   Internal cross-references within these dirs are UNCHANGED because
 *   the relative directory structure is preserved (../../theme still
 *   resolves correctly from src/components/shared/ to src/theme/).
 *
 *   Only route file imports are updated:
 *     Files in app/(tabs)/, app/job/, app/schematic/, etc.:
 *       '../services' → '../../src/services'
 *     Files in app/ root:
 *       './contexts'  → '../src/contexts'
 *
 * Also restores Phase 3d refactored files if they were renamed to .bak.
 *
 * Does NOT delete original dirs — they're moved via rename.
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

// ─── Step 1: Move directories ──────────────────────────────────────────────

const INFRA_DIRS = [
  'components',
  'contexts',
  'data',
  'hooks',
  'services',
  'theme',
  'types',
  'utils',
];

const srcDir = path.join(ROOT, 'src');
if (!fs.existsSync(srcDir)) {
  fs.mkdirSync(srcDir);
  console.log('  ✓ Created src/ directory');
}

let moved = 0;
for (const dir of INFRA_DIRS) {
  const from = path.join(ROOT, 'app', dir);
  const to = path.join(ROOT, 'src', dir);
  if (fs.existsSync(from)) {
    if (fs.existsSync(to)) {
      console.log(`  ⚠ src/${dir}/ already exists — skipping move`);
      continue;
    }
    fs.renameSync(from, to);
    console.log(`  ✓ app/${dir}/ → src/${dir}/`);
    moved++;
  } else {
    console.log(`  ⚠ app/${dir}/ not found — skipping`);
  }
}

console.log(`\nMoved ${moved} directories to src/\n`);

// ─── Step 2: Update imports in route files ─────────────────────────────────

/**
 * For files at depth app/(tabs)/, app/job/, app/schematic/, etc.:
 *   '../components'  → '../../src/components'
 *   '../services'    → '../../src/services'
 *   etc.
 *
 * For files at depth app/ root:
 *   './contexts'     → '../src/contexts'
 */

const IMPORT_REWRITES = {
  // Files in subdirectories of app/ (depth = 2 from root)
  // '../X' → '../../src/X' for each infrastructure dir
  sub: INFRA_DIRS.map(dir => ({
    from: new RegExp(`from '\\.\\./${dir}(/|')`, 'g'),
    to: `from '../../src/${dir}$1`,
  })),
  // Files in app/ root (depth = 1 from root)
  // './X' → '../src/X' for each infrastructure dir
  root: INFRA_DIRS.map(dir => ({
    from: new RegExp(`from '\\./${dir}(/|')`, 'g'),
    to: `from '../src/${dir}$1`,
  })),
};

// Route files in subdirectories of app/
const SUB_ROUTE_FILES = [
  'app/(tabs)/_layout.tsx',
  'app/(tabs)/admin.tsx',
  'app/(tabs)/index.tsx',
  'app/(tabs)/jobs.tsx',
  'app/(tabs)/reference.tsx',
  'app/(tabs)/schematics-refactored.tsx',
  'app/(tabs)/troubleshoot.tsx',
  'app/(tabs)/community.tsx',
  'app/article/[id].tsx',
  'app/chat/[id].tsx',
  'app/community-job/[id].tsx',
  'app/job/[id].tsx',
  'app/job/[id]-original.tsx',
  'app/schematic/[id].tsx',
  'app/schematic/[id]-refactored.tsx',
];

// Route files in app/ root
const ROOT_ROUTE_FILES = [
  'app/_layout.tsx',
  'app/login.tsx',
];

let updated = 0;

for (const relPath of SUB_ROUTE_FILES) {
  const fullPath = path.join(ROOT, relPath);
  if (!fs.existsSync(fullPath)) {
    // Check for .bak version (Phase 3d files may have been renamed)
    const bakPath = fullPath + '.bak';
    if (fs.existsSync(bakPath)) {
      fs.renameSync(bakPath, fullPath);
      console.log(`  ✓ Restored ${relPath} from .bak`);
    } else {
      continue;
    }
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  let changed = false;

  for (const rule of IMPORT_REWRITES.sub) {
    const newContent = content.replace(rule.from, rule.to);
    if (newContent !== content) {
      content = newContent;
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`  ✓ Updated imports: ${relPath}`);
    updated++;
  }
}

for (const relPath of ROOT_ROUTE_FILES) {
  const fullPath = path.join(ROOT, relPath);
  if (!fs.existsSync(fullPath)) continue;

  let content = fs.readFileSync(fullPath, 'utf8');
  let changed = false;

  for (const rule of IMPORT_REWRITES.root) {
    const newContent = content.replace(rule.from, rule.to);
    if (newContent !== content) {
      content = newContent;
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`  ✓ Updated imports: ${relPath}`);
    updated++;
  }
}

console.log(`\nUpdated imports in ${updated} route files\n`);

// ─── Step 3: Verify ────────────────────────────────────────────────────────

console.log('Verification:');

// Check no infrastructure dirs remain in app/
let stale = 0;
for (const dir of INFRA_DIRS) {
  const staleDir = path.join(ROOT, 'app', dir);
  if (fs.existsSync(staleDir)) {
    console.log(`  ⚠ app/${dir}/ still exists (may need manual cleanup)`);
    stale++;
  }
}
if (stale === 0) {
  console.log('  ✓ No infrastructure dirs remain in app/');
}

// Check all dirs exist in src/
let missing = 0;
for (const dir of INFRA_DIRS) {
  const srcPath = path.join(ROOT, 'src', dir);
  if (!fs.existsSync(srcPath)) {
    console.log(`  ✗ src/${dir}/ missing!`);
    missing++;
  }
}
if (missing === 0) {
  console.log('  ✓ All infrastructure dirs present in src/');
}

// Quick check that no route files still reference '../components' etc.
let badImports = 0;
for (const relPath of [...SUB_ROUTE_FILES, ...ROOT_ROUTE_FILES]) {
  const fullPath = path.join(ROOT, relPath);
  if (!fs.existsSync(fullPath)) continue;
  const content = fs.readFileSync(fullPath, 'utf8');
  for (const dir of INFRA_DIRS) {
    if (content.includes(`from '../${dir}`) || content.includes(`from './${dir}`)) {
      console.log(`  ⚠ ${relPath} still has old import for ${dir}`);
      badImports++;
    }
  }
}
if (badImports === 0) {
  console.log('  ✓ All route file imports updated correctly');
}

console.log('\n─── Summary ───');
console.log(`  Directories moved:    ${moved}/8`);
console.log(`  Route files updated:  ${updated}`);
console.log(`  Stale dirs in app/:   ${stale}`);
console.log(`  Bad imports remaining:${badImports}`);
console.log('\nNext: run "npx expo start" — the route warnings should be gone');
console.log('and Google auth login should work.\n');
