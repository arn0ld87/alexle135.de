// Vitest globalSetup für die Admin-Login-Integrationstests (#236).
//
// Läuft einmal vor der gesamten Integrations-Suite in einem eigenen Prozess und
// baut den Zustand über die ECHTEN Produktions-Scripts auf (keine Neuimplementierung
// der Migrations-/Seed-Logik):
//   1. scripts/run-postgres-migrations.mjs — versionierte SQL-Migrationen.
//   2. scripts/seed-admin.mjs — idempotentes Admin-Seed (stdin, wie in Prod).
//
// Voraussetzung: DATABASE_URL und BETTER_AUTH_SECRET zeigen bereits auf eine
// Wegwerf-PostgreSQL (lokal per Docker gestartet oder CI-Service-Container).
// Dieses Script startet KEINE Datenbank — das übernimmt die aufrufende Umgebung
// (siehe README-Hinweis in docs/code-quality/TEST-STRATEGY.md bzw. CI-Job
// "test-integration" in .github/workflows/ci.yml).

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INTEGRATION_ADMIN_EMAIL, INTEGRATION_ADMIN_PASSWORD } from './fixtures';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `${key} fehlt. Die Admin-Login-Integrationstests brauchen eine laufende ` +
        'Wegwerf-PostgreSQL: DATABASE_URL und BETTER_AUTH_SECRET vor "pnpm test:integration" ' +
        'exportieren (siehe AGENTS.md / CI-Job "test-integration").'
    );
  }
  return value;
}

export default async function setup(): Promise<void> {
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
    input: `${INTEGRATION_ADMIN_EMAIL}\n${INTEGRATION_ADMIN_PASSWORD}\n`,
  });
}
