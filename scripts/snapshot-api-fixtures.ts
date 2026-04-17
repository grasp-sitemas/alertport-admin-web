/**
 * Snapshot real API responses from HML into `tests/fixtures/api/` so schema
 * contract tests can run offline against live shapes.
 *
 * Usage:
 *   E2E_EMAIL=... E2E_PASSWORD=... API_URL=https://api-hml.shieldgo.com.br \
 *     npx tsx scripts/snapshot-api-fixtures.ts
 *
 * The script is intentionally synchronous and dependency-light — it uses
 * global `fetch` and writes JSON files with a sanitization pass that:
 *   - truncates arrays to 5 items (fixtures stay human-readable)
 *   - redacts email/phone/document fields so we don't leak customer data
 *   - preserves the field SHAPES, which is what schemas actually validate
 *
 * Re-run whenever the API changes (new enum value, renamed field, etc.) and
 * commit the refreshed fixtures. The contract tests read them as-is.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const API_URL = process.env.API_URL ?? 'https://api-hml.shieldgo.com.br';
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
const FIXTURE_DIR = resolve(__dirname, '..', 'tests', 'fixtures', 'api');

if (!EMAIL || !PASSWORD) {
  console.error('Set E2E_EMAIL and E2E_PASSWORD env vars before running.');
  process.exit(1);
}

async function login(): Promise<string> {
  const res = await fetch(`${API_URL}/api/users/system/login/v1/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  const data = await res.json();
  const token: string | undefined = data?.result?.token ?? data?.token;
  if (!token) throw new Error('login response missing token');
  return token;
}

async function get(path: string, token: string): Promise<unknown> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { authorization: token },
  });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json();
}

async function post(path: string, body: unknown, token: string): Promise<unknown> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      authorization: token,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
  return res.json();
}

/**
 * Recursively sanitize a response: truncate arrays, redact email/phone/cpf.
 * Keep enum values, ObjectId strings, and booleans unchanged — those are the
 * bits that schema validators care about.
 */
function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 8) return value;
  if (Array.isArray(value)) {
    return value.slice(0, 5).map((v) => sanitize(v, depth + 1));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === 'token' || k === 'password' || k === 'passwordHash') continue;
      if (k === 'email' && typeof v === 'string') {
        out[k] = 'redacted@example.com';
        continue;
      }
      if ((k === 'primaryPhone' || k === 'secondaryPhone') && typeof v === 'string') {
        out[k] = v ? '11999999999' : v;
        continue;
      }
      if (k === 'document' && typeof v === 'string') {
        out[k] = v ? '00000000000' : v;
        continue;
      }
      out[k] = sanitize(v, depth + 1);
    }
    return out;
  }
  return value;
}

function save(name: string, data: unknown) {
  const file = resolve(FIXTURE_DIR, `${name}.json`);
  writeFileSync(file, JSON.stringify(sanitize(data), null, 2) + '\n');
  console.log(`✓ ${name}.json`);
}

async function main() {
  mkdirSync(FIXTURE_DIR, { recursive: true });
  console.log(`Logging into ${API_URL}`);
  const token = await login();
  console.log('Logged in.');

  // One request per schema/form the contract tests will validate.
  save('me', await get('/api/users/system/companyuser/me/v1', token));
  save(
    'companyuser-search',
    await post(
      '/api/users/system/search/companyuser/v1/',
      { isSortByName: true, page: 1, limit: 5 },
      token,
    ),
  );
  save(
    'customeruser-search',
    await post(
      '/api/users/system/search/customeruser/v1/',
      { isSortByName: true, page: 1, limit: 5 },
      token,
    ),
  );
  save(
    'company-filter',
    await post('/api/company/filter/v1/', { page: 1, limit: 5 }, token),
  );
  save(
    'company-filter-accounts',
    await post('/api/company/filter/v1/', { type: 'ACCOUNT', page: 1, limit: 5 }, token),
  );
  save(
    'company-filter-clients',
    await post('/api/company/filter/v1/', { type: 'CLIENT', page: 1, limit: 5 }, token),
  );
  save(
    'company-filter-sites',
    await post('/api/company/filter/v1/', { type: 'SITE', page: 1, limit: 5 }, token),
  );
  save(
    'equipments-filter',
    await post('/api/company/equipments/filter/v1/', { page: 1, limit: 5 }, token),
  );

  console.log(`\nFixtures written to ${FIXTURE_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
