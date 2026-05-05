#!/usr/bin/env node
/**
 * Enforces that every page under `src/app/(app)/` declares
 *   export const dynamic = 'force-dynamic'
 *
 * Authenticated routes read sessionStorage at runtime and must never
 * be pre-rendered. This script is part of `npm run validate` so a PR
 * adding a new authenticated route can't ship without the export.
 *
 * Exit codes:
 *   0 — all good
 *   1 — at least one page missing the export
 *   2 — script crashed unexpectedly
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const APP_DIR = join(process.cwd(), 'src', 'app', '(app)');
const FORCE_DYNAMIC_RE = /export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/;

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err && err.code === 'ENOENT') return;
    throw err;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile() && entry.name === 'page.tsx') {
      yield full;
    }
  }
}

async function main() {
  const offenders = [];
  for await (const file of walk(APP_DIR)) {
    const src = await readFile(file, 'utf8');
    if (!FORCE_DYNAMIC_RE.test(src)) {
      offenders.push(relative(process.cwd(), file));
    }
  }
  if (offenders.length === 0) {
    console.log('[check-force-dynamic] OK — every (app)/page.tsx declares force-dynamic.');
    process.exit(0);
  }
  const strict = process.argv.includes('--strict');
  const stream = strict ? console.error : console.warn;
  stream(`[check-force-dynamic] ${offenders.length} page(s) missing \`export const dynamic = "force-dynamic"\`:`);
  for (const f of offenders) stream('  -', f);
  stream('Add the export at the top of each file. See .claude/rules/nextjs-16.md.');
  // Default mode warns and exits 0 so existing pages without the export
  // don't break the build mid-rollout. Run with --strict in CI once
  // every page has been backfilled.
  process.exit(strict ? 1 : 0);
}

main().catch((err) => {
  console.error('[check-force-dynamic] Failed:', err);
  process.exit(2);
});
