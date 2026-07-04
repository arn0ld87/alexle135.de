import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: [
      'src/**/*.{test,spec}.{js,jsx,ts,tsx}',
      // scripts/run-postgres-migrations.mjs (#274): Lock-/Fehlerpfade des
      // Migrationsskripts sind hier ohne echte Postgres testbar.
      'scripts/**/*.{test,spec}.mjs',
    ],
    // src/tests/integration/** braucht eine echte Wegwerf-PostgreSQL und läuft
    // separat über `pnpm test:integration` (vitest.integration.config.ts) —
    // nicht Teil des mock-basierten Unit-Test-Laufs.
    // e2e/** (Issue #296) sind Playwright-Specs (playwright.config.ts sammelt
    // NUR e2e/**) — durch `include` oben (nur src/**, scripts/**) würde
    // Vitest sie ohnehin nie aufsammeln; der Exclude-Eintrag ist zusätzliche
    // Verteidigungslinie, falls `include` künftig verbreitert wird.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.astro/**',
      '**/.worktrees/**',
      'src/tests/integration/**',
      'e2e/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // Vitest v4 kennt kein `coverage.all` mehr. Ohne explizites `include`
      // würden nur von Tests importierte Dateien erfasst — ungetestete neue
      // Logikdateien (0 %) umgingen so das Gate. `include` zwingt alle
      // relevanten Quelldateien unter src/ in den Report (Gemini-Review
      // PR #281). Dadurch sinkt die gemessene Gesamt-Coverage deutlich, weil
      // viele UI-/Terminal-Module noch ungetestet sind — bewusst so, damit
      // das Gate echte Lücken fängt. Details siehe PR-Body.
      include: ['src/**/*.{ts,tsx,js,jsx}'],
      // Excludes halten nicht-instrumentierbaren bzw. nicht-testrelevanten
      // Code aus dem `include` heraus, damit das Gate nicht durch reine
      // Typ-/Konfig-/Markup-/Daten-Dateien verwässert wird. Echte Logik- und
      // Security-Module werden NICHT ausgeschlossen.
      exclude: [
        'node_modules/**',
        'dist/**',
        '.astro/**',
        '.worktrees/**',
        '**/*.d.ts',
        '**/*.astro',
        '**/__tests__/**',
        '**/*.{test,spec}.{js,jsx,ts,tsx}',
        'src/test/**',
        'src/tests/integration/**',
        // Reine Daten-/Konstanten-Dateien (Missionsdefinitionen, Zertifikate)
        // enthalten keine Logik — analog zu content.config.ts kein Testziel.
        'src/data/**',
        // Build-/CI-Tooling, nicht Teil des ausgelieferten Runtime-Codes.
        'scripts/**',
        '*.config.{js,cjs,mjs,ts}',
        'vitest.config.ts',
        'vitest.integration.config.ts',
        'astro.config.mjs',
        'eslint.config.js',
        'prettier.config.cjs',
      ],
      // Globale Mindestschwellen. WICHTIG: Mit `include` (oben) wird die
      // gesamte src/-Logik gemessen, nicht nur von Tests importierte Dateien.
      // Issue-Ziele 70/60/70/70 erreicht (#287): Nach den Tests für
      // MockLinuxSystem/MockWindowsSystem/Terminal/BaseMissionTerminal/og
      // liegen die realen Ist-Werte zum Stand 2026-07-04 bei stmts 77.81 /
      // branch 70.06 / funcs 71.35 / lines 78.07 — stabil über den Gates.
      // Die globalen Schwellen stehen jetzt auf den Issue-Zielen und blockieren
      // jede Regression darunter.
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,

        // Security-kritische Module bekommen strengere Schwellen, jeweils
        // knapp unter der Ist-Coverage (Stand 2026-07-04), damit das Gate ab
        // sofort Regressionen blockiert, ohne den Build rot zu machen.
        'src/middleware.ts': {
          statements: 85,
          branches: 85,
          functions: 95,
          lines: 85,
        },
        'src/lib/rateLimit.ts': {
          statements: 95,
          branches: 85,
          functions: 95,
          lines: 95,
        },
        'src/lib/adminAuth.ts': {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
        },
        // #287 Schritt 2: Session-/CSRF-nahe Security-Module, Ist-Coverage
        // 2026-07-04 jeweils 100/100/100/100 (siehe PR-Body).
        'src/lib/adminSession.ts': {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
        },
        'src/lib/adminClient.ts': {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
        },
        'src/pages/api/admin/**': {
          statements: 85,
          branches: 80,
          functions: 95,
          lines: 90,
        },
        'src/pages/api/analyze.ts': {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
        },
        'src/lib/api/**': {
          statements: 95,
          branches: 85,
          functions: 95,
          lines: 95,
        },
        'src/lib/validation/**': {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      'astro:middleware': resolve(__dirname, './src/test/mocks/astro-middleware.ts'),
      'astro:content': resolve(__dirname, './src/test/mocks/astro-content.ts'),
    },
  },
});
