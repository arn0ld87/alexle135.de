// Playwright globalSetup für die E2E-Suite (Issue #296).
//
// Läuft einmal vor der gesamten Suite und baut den Datenbank-Zustand über die
// ECHTEN Produktions-Scripts auf (keine Neuimplementierung der
// Migrations-/Seed-Logik) — identisch zum Ansatz in
// src/tests/integration/global-setup.ts:
//   1. scripts/run-postgres-migrations.mjs — versionierte SQL-Migrationen.
//   2. scripts/seed-admin.mjs — idempotentes Admin-Seed (stdin, wie in Prod).
//
// Voraussetzung: DATABASE_URL und BETTER_AUTH_SECRET zeigen bereits auf eine
// Wegwerf-PostgreSQL (lokal per Docker gestartet oder CI-Service-Container).
// Dieses Script startet KEINE Datenbank — das übernimmt die aufrufende
// Umgebung (siehe CI-Job "E2E" in .github/workflows/ci.yml).

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD } from './fixtures';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `${key} fehlt. Die Playwright-E2E-Suite braucht eine laufende Wegwerf-PostgreSQL: ` +
        'DATABASE_URL und BETTER_AUTH_SECRET vor "pnpm test:e2e" exportieren ' +
        '(siehe AGENTS.md / CI-Job "E2E" in .github/workflows/ci.yml).'
    );
  }
  return value;
}

export default async function globalSetup(): Promise<void> {
  requireEnv('DATABASE_URL');
  requireEnv('BETTER_AUTH_SECRET');

  execFileSync('node', ['scripts/run-postgres-migrations.mjs'], {
    cwd: rootDir,
    env: process.env,
    stdio: 'inherit',
  });

  execFileSync('node', ['scripts/seed-admin.mjs'], {
    cwd: rootDir,
    env: process.env,
    stdio: ['pipe', 'inherit', 'inherit'],
    input: `${E2E_ADMIN_EMAIL}\n${E2E_ADMIN_PASSWORD}\n`,
  });
}
