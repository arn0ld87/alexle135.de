// Helper für Admin-API-Requests in der Playwright-E2E-Suite (Issue #296).
//
// Nutzt bewusst KEINEN eigenen Cookie-Header-Bau: Playwrights
// APIRequestContext (der `request`-Fixture) verwaltet Cookies aus
// Set-Cookie-Antworten selbst und sendet sie automatisch bei folgenden
// Requests im selben Context zurück — siehe
// https://playwright.dev/docs/api-testing. Für den CSRF-Header
// (x-csrf-token) muss der Cookie-Wert dennoch ausgelesen werden, weil
// src/middleware.ts einen Double-Submit-Vergleich macht (Cookie- gegen
// Header-Wert) und Header nicht automatisch aus Cookies befüllt werden.
import type { APIRequestContext } from '@playwright/test';
import { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, ORIGIN } from '../fixtures';

/**
 * Meldet den E2E-Admin-Account über den echten Login-Endpunkt an. Der
 * Origin-Header ist erforderlich — src/pages/api/auth/login.ts weist Requests
 * ohne gültigen Origin mit 403 ab (Origin-Check nicht abschwächen).
 */
export async function loginAdminApi(request: APIRequestContext): Promise<void> {
  const response = await request.post('/api/auth/login', {
    headers: { origin: ORIGIN },
    data: { email: E2E_ADMIN_EMAIL, password: E2E_ADMIN_PASSWORD },
  });
  if (!response.ok()) {
    throw new Error(
      `Admin-Login (API) fehlgeschlagen: ${response.status()} ${await response.text()}`
    );
  }
}

/** Liest den csrf-token-Cookie aus dem Request-Context (nach loginAdminApi). */
export async function getCsrfToken(request: APIRequestContext): Promise<string> {
  const state = await request.storageState();
  const csrfCookie = state.cookies.find((cookie) => cookie.name === 'csrf-token');
  if (!csrfCookie) {
    throw new Error('csrf-token-Cookie fehlt — war der Admin-Login erfolgreich?');
  }
  return csrfCookie.value;
}
