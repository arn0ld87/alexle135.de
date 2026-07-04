import { optionalEnv } from './env';

type AdminCandidate = {
  email?: string | null;
  role?: string | null;
  app_metadata?: {
    role?: string;
  } | null;
};

export function parseAdminAllowlist(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Fail-closed admin check (#135): authenticated ≠ authorized.
 * Access requires either role === 'admin' (Better Auth), legacy
 * app_metadata.role === 'admin' during rollback, or an e-mail on the
 * ADMIN_EMAILS allowlist.
 */
export function isAuthorizedAdmin(user: AdminCandidate, allowlist: string[]): boolean {
  if (user.role === 'admin') return true;
  if (user.app_metadata?.role === 'admin') return true;
  const email = user.email?.toLowerCase();
  return Boolean(email && allowlist.includes(email));
}

// ADMIN_EMAILS doesn't change at runtime — parse once at module load instead
// of on every request.
const cachedAllowlist = parseAdminAllowlist(optionalEnv('ADMIN_EMAILS'));

export function getAdminAllowlist(): string[] {
  return cachedAllowlist;
}
