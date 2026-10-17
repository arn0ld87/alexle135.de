// Single source of truth für die Origin-Allowlist schreibender Endpunkte.
//
// Hintergrund: Die Liste war bisher pro Route kopiert (contact, ai-tutor,
// analyze, auth/login, auth/logout). Neue Konsumenten importieren hier, damit
// eine Domain-Erweiterung nicht an fünf Stellen nachgezogen werden muss. Die
// Migration der bestehenden Kopien ist bewusst nicht Teil dieses Fixes
// (Audit-Befund F-12, eigener PR).

import { optionalEnv } from './env';

// Deckt sich mit den trustedOrigins in src/lib/auth.ts, damit der Catch-all
// keine Origin ablehnt, die Better Auth selbst akzeptieren würde.
const configuredAuthOrigin = optionalEnv('BETTER_AUTH_URL');

export const ALLOWED_ORIGINS = new Set([
  'https://alexle135.de',
  'https://www.alexle135.de',
  'https://alex-schneider.dev',
  'https://www.alex-schneider.dev',
  'http://localhost:4321',
  // Staging-/Preview-Deployments setzen BETTER_AUTH_URL auf ihren eigenen Host.
  ...(configuredAuthOrigin ? [configuredAuthOrigin] : []),
]);

/**
 * Prüft einen Origin-Header gegen die Allowlist.
 *
 * `null`/fehlender Header gilt als NICHT erlaubt — Aufrufer, die einen
 * fehlenden Origin bewusst durchlassen wollen (z. B. logout), müssen das
 * explizit selbst entscheiden.
 */
export function isAllowedOrigin(origin: string | null): boolean {
  return origin !== null && ALLOWED_ORIGINS.has(origin);
}
