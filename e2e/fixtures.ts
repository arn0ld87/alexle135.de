// Gemeinsame Fixtures für die Playwright-E2E-Suite (Issue #296).
//
// ORIGIN muss exakt mit der Origin-Allowlist in src/pages/api/contact.ts,
// src/pages/api/auth/login.ts und src/pages/api/auth/logout.ts übereinstimmen
// (dort u. a. 'http://localhost:4321') UND mit playwright.config.ts (HOST/PORT)
// — sonst weisen die echten Origin-Checks jeden state-changing Request mit
// 403 ab (das ist gewollt, siehe AGENTS.md: Origin-Check nicht abschwächen).
export const ORIGIN = 'http://localhost:4321';

// Fester E2E-Admin-Account, den e2e/global-setup.ts über das echte
// scripts/seed-admin.mjs gegen die Wegwerf-Postgres anlegt (idempotent,
// analog zu src/tests/integration/fixtures.ts). Kein echtes Credential.
export const E2E_ADMIN_EMAIL = 'e2e-admin@alexle135.test';
export const E2E_ADMIN_PASSWORD = 'E2E-Playwright-Test-Passw0rd-1!';

// Fester Name für die im Kontaktformular-Erfolgsfall (e2e/01-contact.spec.ts)
// erzeugte Nachricht. e2e/03-admin-csrf.spec.ts sucht diesen Namen in der
// Admin-Inbox, um eine echte Message-ID für den CSRF-Test zu bekommen, statt
// selbst einen weiteren /api/contact-Request abzusetzen (der würde das
// Contact-Rate-Limit, max=3 pro 10 Minuten, überziehen — siehe Kommentare in
// 01-contact.spec.ts und playwright.config.ts). Jeder CI-Lauf startet mit
// einer frischen Wegwerf-Postgres, ein statischer Name kollidiert daher nicht.
export const CONTACT_SUCCESS_NAME = 'E2E Contact Success Fixture';
