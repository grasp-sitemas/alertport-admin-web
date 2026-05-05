#!/usr/bin/env node
/**
 * One-time backfill: insert
 *   export const dynamic = 'force-dynamic';
 *
 * after the leading `'use client';` directive in every
 * `src/app/(app)/**\/page.tsx`. Idempotent — files that already
 * declare the export are left untouched.
 *
 * After running, switch `npm run check:force-dynamic` to `--strict`
 * (or add it to `validate`) so future drift fails CI.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const APP_DIR = join(process.cwd(), 'src', 'app', '(app)');
const HAS_DECL_RE = /export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/;
const USE_CLIENT_RE = /^(['"])use client\1\s*;?\s*$/;

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
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && entry.name === 'page.tsx') yield full;
  }
}

async function main() {
  const inserted = [];
  const skipped = [];
  const noClient = [];

  for await (const file of walk(APP_DIR)) {
    const src = await readFile(file, 'utf8');
    if (HAS_DECL_RE.test(src)) {
      skipped.push(relative(process.cwd(), file));
      continue;
    }
    const lines = src.split('\n');
    const idx = lines.findIndex((ln) => USE_CLIENT_RE.test(ln.trim()));
    if (idx === -1) {
      noClient.push(relative(process.cwd(), file));
      continue;
    }
    // Insert after the directive. Keep one blank separator if the
    // next non-empty content isn't already blank.
    const next = (lines[idx + 1] ?? '').trim();
    const insertion = next === ''
      ? ["export const dynamic = 'force-dynamic';"]
      : ['', "export const dynamic = 'force-dynamic';", ''];
    lines.splice(idx + 1, 0, ...insertion);
    await writeFile(file, lines.join('\n'), 'utf8');
    inserted.push(relative(process.cwd(), file));
  }

  console.log(`[backfill-force-dynamic] inserted in ${inserted.length} file(s)`);
  for (const f of inserted) console.log('  +', f);
  if (skipped.length) console.log(`already had it: ${skipped.length}`);
  if (noClient.length) {
    console.warn(`could not find 'use client' in ${noClient.length} file(s); skipped:`);
    for (const f of noClient) console.warn('  ?', f);
  }
}

main().catch((err) => {
  console.error('[backfill-force-dynamic] failed:', err);
  process.exit(1);
});
