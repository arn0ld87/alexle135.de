import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

// Separate Vitest-Config für Integrationstests (#236): läuft gegen eine echte
// Wegwerf-PostgreSQL statt gemockter rateLimit-/adminSession-Module. Bewusst
// getrennt von vitest.config.ts, damit `pnpm test:run` (Unit-Tests) weiterhin
// ohne Datenbank läuft — siehe `pnpm test:integration`.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/tests/integration/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.astro/**', '**/.worktrees/**'],
    globalSetup: ['./src/tests/integration/global-setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      'astro:middleware': resolve(__dirname, './src/test/mocks/astro-middleware.ts'),
      'astro:content': resolve(__dirname, './src/test/mocks/astro-content.ts'),
    },
  },
});
