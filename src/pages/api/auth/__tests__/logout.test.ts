import { beforeEach, describe, expect, it, vi } from 'vitest';

const { signOutAdminMock } = vi.hoisted(() => ({
  signOutAdminMock: vi.fn(),
}));

vi.mock('../../../../lib/adminSession', () => ({
  appendSetCookieHeaders: (target: Headers, source: Headers) => {
    const cookie = source.get('set-cookie');
    if (cookie) target.append('Set-Cookie', cookie);
  },
  signOutAdmin: signOutAdminMock,
}));

import { POST } from '../logout';

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signOutAdminMock.mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: { 'Set-Cookie': 'better-auth.session_token=; Max-Age=0; Path=/' },
      })
    );
  });

  it('signs out through Better Auth and clears csrf-token', async () => {
    const res = await POST({
      request: new Request('https://alexle135.de/api/auth/logout', {
        method: 'POST',
        headers: { origin: 'https://alexle135.de' },
      }),
    } as never);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(signOutAdminMock).toHaveBeenCalledWith(expect.any(Request));
    expect(res.headers.get('set-cookie')).toContain('better-auth.session_token=');
    expect(res.headers.get('set-cookie')).toContain('csrf-token=;');
  });
});
