import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createContactMessageMock, enforceLimitMock } = vi.hoisted(() => ({
  createContactMessageMock: vi.fn(),
  enforceLimitMock: vi.fn(),
}));

vi.mock('../../../lib/db/repositories', () => ({
  createContactMessage: createContactMessageMock,
}));

vi.mock('../../../lib/rateLimit', () => ({
  enforceLimit: enforceLimitMock,
  getClientIp: vi.fn(() => '127.0.0.1'),
}));

vi.mock('../../../lib/env', () => ({
  optionalEnv: vi.fn((key: string) => (key === 'CONTACT_IP_SALT' ? null : undefined)),
  requirePublicEnv: vi.fn((key: string) => `mock-${key}`),
}));

import { POST } from '../contact';

function makeRequest(
  body: Record<string, unknown>,
  opts: { origin?: string | null; accept?: string; userAgent?: string } = {}
): Request {
  const origin = opts.origin === undefined ? 'https://alexle135.de' : opts.origin;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (origin !== null) headers.origin = origin;
  if (opts.accept) headers.accept = opts.accept;
  if (opts.userAgent) headers['user-agent'] = opts.userAgent;

  return new Request('https://alexle135.de/api/contact', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

const validBody = {
  name: 'Test User',
  email: 'test@example.com',
  message: 'Das ist eine Testnachricht mit mehr als 10 Zeichen.',
};

describe('POST /api/contact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enforceLimitMock.mockReturnValue(null);
    createContactMessageMock.mockResolvedValue(undefined);
  });

  it('rejects missing Origin headers', async () => {
    const res = await POST({ request: makeRequest(validBody, { origin: null }) } as never);

    expect(res.status).toBe(403);
    expect(createContactMessageMock).not.toHaveBeenCalled();
  });

  it('silently accepts honeypot submissions without writing to the database', async () => {
    const res = await POST({
      request: makeRequest({ ...validBody, website: 'https://spam.example' }),
    } as never);

    expect(res.status).toBe(200);
    expect(createContactMessageMock).not.toHaveBeenCalled();
  });

  it('stores valid contact messages through the Postgres repository', async () => {
    const res = await POST({
      request: makeRequest(validBody, { userAgent: 'Vitest' }),
    } as never);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(createContactMessageMock).toHaveBeenCalledWith({
      name: validBody.name,
      email: validBody.email,
      message: validBody.message,
      ip_hash: null,
      user_agent: 'Vitest',
    });
  });

  it('returns 500 when the repository write fails', async () => {
    createContactMessageMock.mockRejectedValue(new Error('db down'));

    const res = await POST({ request: makeRequest(validBody) } as never);

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Nachricht konnte nicht gespeichert werden.' });
  });
});
