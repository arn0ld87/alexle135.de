import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isAuthorizedAdmin, parseAdminAllowlist } from '../adminAuth';

describe('parseAdminAllowlist', () => {
  it('returns empty list for undefined or empty input', () => {
    expect(parseAdminAllowlist(undefined)).toEqual([]);
    expect(parseAdminAllowlist('')).toEqual([]);
  });

  it('splits, trims, lowercases and drops empty entries', () => {
    expect(parseAdminAllowlist(' Admin@Example.com , ,b@c.de,')).toEqual([
      'admin@example.com',
      'b@c.de',
    ]);
  });
});

describe('isAuthorizedAdmin', () => {
  it('denies authenticated users without role or allowlist match (fail closed)', () => {
    expect(isAuthorizedAdmin({ email: 'user@example.com', app_metadata: {} }, [])).toBe(false);
  });

  it('allows app_metadata.role === admin', () => {
    expect(
      isAuthorizedAdmin({ email: 'user@example.com', app_metadata: { role: 'admin' } }, [])
    ).toBe(true);
  });

  it('allows Better Auth role === admin', () => {
    expect(isAuthorizedAdmin({ email: 'user@example.com', role: 'admin' }, [])).toBe(true);
  });

  it('rejects non-admin roles', () => {
    expect(
      isAuthorizedAdmin({ email: 'user@example.com', app_metadata: { role: 'editor' } }, [])
    ).toBe(false);
  });

  it('allows allowlisted e-mail case-insensitively', () => {
    expect(
      isAuthorizedAdmin({ email: 'Admin@Example.com', app_metadata: {} }, ['admin@example.com'])
    ).toBe(true);
  });

  it('denies users without e-mail', () => {
    expect(isAuthorizedAdmin({ email: undefined, app_metadata: {} }, ['admin@example.com'])).toBe(
      false
    );
  });
});

describe('getAdminAllowlist', () => {
  // ADMIN_EMAILS wird beim Modul-Load einmalig geparst und gecacht (Zeile 34
  // in adminAuth.ts). Um verschiedene Env-Zustände zu testen, muss das Modul
  // pro Testfall frisch geladen werden — sonst wirkt der Cache aus einem
  // vorherigen Test nach.
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('normalisiert ADMIN_EMAILS (Groß-/Kleinschreibung, Whitespace) beim Modul-Load', async () => {
    vi.stubEnv('ADMIN_EMAILS', ' Admin@Example.com , ,B@C.de ,');
    const { getAdminAllowlist } = await import('../adminAuth');
    expect(getAdminAllowlist()).toEqual(['admin@example.com', 'b@c.de']);
  });

  it('liefert ein leeres Array, wenn ADMIN_EMAILS nicht gesetzt ist', async () => {
    vi.stubEnv('ADMIN_EMAILS', undefined);
    const { getAdminAllowlist } = await import('../adminAuth');
    expect(getAdminAllowlist()).toEqual([]);
  });

  it('cached das Ergebnis — wiederholte Aufrufe liefern dieselbe Referenz', async () => {
    vi.stubEnv('ADMIN_EMAILS', 'admin@example.com');
    const { getAdminAllowlist } = await import('../adminAuth');
    const first = getAdminAllowlist();
    const second = getAdminAllowlist();
    expect(second).toBe(first);
  });
});
