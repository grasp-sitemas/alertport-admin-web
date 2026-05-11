/**
 * Centralized credential loader for the e2e suite.
 *
 * Resolution order for every role:
 *   1. process.env (CI sets these directly)
 *   2. .env.test (gitignored secrets for local HML runs)
 *   3. .env.local (developer overrides)
 *
 * The scheduling.spec.ts file used to inline this parsing — pulling it
 * here keeps a single source of truth and removes a copy-paste vector.
 *
 * SUPERVISOR credentials are intentionally absent: backend has no
 * password set for the supervisor role yet. Track via TODO.
 */
import fs from 'node:fs';
import path from 'node:path';

export type Role = 'SUPER_ADMIN_MASTER' | 'ADMIN' | 'SUPERVISOR';

export interface Credentials {
  readonly role: Role;
  readonly email: string;
  readonly password: string;
}

interface RoleEnvKeys {
  readonly email: string;
  readonly password: string;
}

const ROLE_ENV_KEYS: Record<Role, RoleEnvKeys> = {
  SUPER_ADMIN_MASTER: {
    email: 'PLAYWRIGHT_SUPER_ADMIN_EMAIL',
    password: 'PLAYWRIGHT_SUPER_ADMIN_PASSWORD',
  },
  ADMIN: {
    email: 'PLAYWRIGHT_ADMIN_EMAIL',
    password: 'PLAYWRIGHT_ADMIN_PASSWORD',
  },
  // TODO(backend): SUPERVISOR has no password configured in HML.
  // Specs depending on this role should `test.skip` when missing.
  SUPERVISOR: {
    email: 'PLAYWRIGHT_SUPERVISOR_EMAIL',
    password: 'PLAYWRIGHT_SUPERVISOR_PASSWORD',
  },
};

const DEFAULT_BASE_URL = 'https://admin-alertport-hml.vercel.app';
const ENV_FILES = ['.env.test', '.env.local'] as const;

function parseLine(line: string): readonly [string, string] | null {
  const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
  if (!match) return null;
  const value = match[2].replace(/^["']|["']$/g, '');
  return [match[1], value];
}

let cachedFileEnv: Record<string, string> | null = null;

function readEnvFiles(): Record<string, string> {
  if (cachedFileEnv) return cachedFileEnv;
  const cwd = process.cwd();
  const merged: Record<string, string> = {};
  for (const file of ENV_FILES) {
    const fullPath = path.join(cwd, file);
    if (!fs.existsSync(fullPath)) continue;
    const lines = fs.readFileSync(fullPath, 'utf8').split('\n');
    for (const line of lines) {
      const parsed = parseLine(line);
      if (!parsed) continue;
      const [key, value] = parsed;
      // First write wins so .env.test takes precedence over .env.local.
      if (!(key in merged)) merged[key] = value;
    }
  }
  cachedFileEnv = merged;
  return merged;
}

function resolveValue(envKey: string): string | undefined {
  const fromProcess = process.env[envKey];
  if (fromProcess && fromProcess.length > 0) return fromProcess;
  const fileEnv = readEnvFiles();
  return fileEnv[envKey];
}

/** Returns credentials for the given role, or `null` if not configured. */
export function getCredentials(role: Role): Credentials | null {
  const keys = ROLE_ENV_KEYS[role];
  const email = resolveValue(keys.email);
  const password = resolveValue(keys.password);

  // Backwards-compat with legacy PLAYWRIGHT_TEST_EMAIL/PASSWORD pair
  // (used by scheduling.spec.ts). Treat as SUPER_ADMIN_MASTER fallback
  // since the original .env.test pointed to dev@grasp.com.br.
  if ((!email || !password) && role === 'SUPER_ADMIN_MASTER') {
    const legacyEmail = resolveValue('PLAYWRIGHT_TEST_EMAIL');
    const legacyPassword = resolveValue('PLAYWRIGHT_TEST_PASSWORD');
    if (legacyEmail && legacyPassword) {
      return { role, email: legacyEmail, password: legacyPassword };
    }
  }

  if (!email || !password) return null;
  return { role, email, password };
}

/** Resolves the HML base URL, honouring PLAYWRIGHT_BASE_URL when set. */
export function getBaseUrl(): string {
  const override = resolveValue('PLAYWRIGHT_BASE_URL');
  return override && override.length > 0 ? override : DEFAULT_BASE_URL;
}
