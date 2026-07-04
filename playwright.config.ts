import { defineConfig, devices } from '@playwright/test';

// Browserbasierte E2E-Tests (P1.11 / Issue #296). Getrennt von Vitest:
// Vitest sammelt nur src/**- und scripts/**-Specs ein (siehe vitest.config.ts),
// Playwright sammelt ausschließlich e2e/** — beide Runner kollidieren nicht.
//
// HOST/PORT sind bewusst "localhost:4321": src/pages/api/contact.ts,
// src/pages/api/auth/login.ts und src/pages/api/auth/logout.ts prüfen den
// Origin-Header strikt gegen eine Allowlist, die genau diesen Wert enthält
// (neben den Produktions-Domains). "127.0.0.1" wäre NICHT in der Allowlist
// und jeder state-changing Request würde mit 403 abgewiesen.
const HOST = process.env.E2E_HOST ?? 'localhost';
const PORT = process.env.E2E_PORT ? Number(process.env.E2E_PORT) : 4321;
const BASE_URL = process.env.E2E_BASE_URL ?? `http://${HOST}:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  // Ein einzelner Node-Prozess + eine gemeinsame Wegwerf-Postgres bedienen
  // die gesamte Suite. Mehrere Worker würden sich das Contact-Rate-Limit
  // (max. 3 Requests / 10 Minuten pro IP, siehe src/lib/rateLimit.ts) und
  // die Admin-Seed-/Testdaten teilen und sich gegenseitig verfälschen —
  // deshalb bewusst ein Worker, sequenzielle Ausführung in Datei-Reihenfolge
  // (01-…, 02-… Präfixe erzwingen eine deterministische Reihenfolge).
  workers: 1,
  forbidOnly: !!process.env.CI,
  // retries: 0, NICHT nur "CI-typisch höher": e2e/01-contact.spec.ts nutzt
  // das Contact-Rate-Limit (max=3) exakt aus. Ein Retry würde einen vierten
  // Request auslösen und mit 429 fehlschlagen — siehe Kommentar dort.
  retries: 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github'], ['list']] : 'list',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: BASE_URL,
    // retain-on-failure statt on-first-retry: retries ist bewusst 0 (siehe
    // oben, Contact-Rate-Limit), d. h. ein erster Retry findet NIE statt —
    // on-first-retry würde daher nie einen Trace erzeugen und einen roten
    // E2E-Lauf undebugbar machen (Gemini-Review PR #297). retain-on-failure
    // schreibt bei JEDEM fehlgeschlagenen Test einen Trace, unabhängig von
    // retries. Screenshot/Video werden aus demselben Grund bei Fehler
    // behalten. Alle drei werden im CI-Job "E2E" als Artefakt hochgeladen.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Erwartet einen bereits gebauten Server (`pnpm build`). CI und der
  // dokumentierte lokale Smoke-Test führen den Build als eigenen Schritt vor
  // `pnpm test:e2e` aus, damit ein Playwright-Testlauf nicht bei jedem Start
  // implizit neu baut.
  webServer: {
    command: 'pnpm start',
    url: `${BASE_URL}/healthz`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      HOST,
      PORT: String(PORT),
    },
  },
});
