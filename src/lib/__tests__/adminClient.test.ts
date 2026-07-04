import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminFetch } from '../adminClient';

function setCookie(value: string) {
  document.cookie = value;
}

function clearCookies() {
  document.cookie.split(';').forEach((entry) => {
    const name = entry.split('=')[0]?.trim();
    if (name) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
  });
}

describe('adminFetch', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('location', { href: '' });
    clearCookies();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearCookies();
  });

  it('defaults to GET, sends no CSRF header and returns parsed JSON on success', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ hello: 'world' }), { status: 200 })
    );

    const result = await adminFetch<{ hello: string }>('/api/admin/ping');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [path, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit & { headers: Record<string, string> },
    ];
    expect(path).toBe('/api/admin/ping');
    expect(init.method).toBe('GET');
    expect(init.headers['x-csrf-token']).toBeUndefined();
    expect(result).toEqual({ ok: true, status: 200, data: { hello: 'world' } });
  });

  it('defaults to POST and sets JSON content-type + stringified body when json option is used', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await adminFetch('/api/admin/thing', { json: { name: 'x' } });

    const [, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit & { headers: Record<string, string> },
    ];
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe(JSON.stringify({ name: 'x' }));
  });

  it('echoes the csrf-token cookie as x-csrf-token header for non-GET/HEAD requests', async () => {
    setCookie('csrf-token=tok123');
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));

    await adminFetch('/api/admin/thing', { method: 'POST' });

    const [, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit & { headers: Record<string, string> },
    ];
    expect(init.headers['x-csrf-token']).toBe('tok123');
  });

  it('does not add a CSRF header for GET or HEAD even if the cookie is present', async () => {
    setCookie('csrf-token=tok123');
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));

    await adminFetch('/api/admin/thing', { method: 'HEAD' });

    const [, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit & { headers: Record<string, string> },
    ];
    expect(init.headers['x-csrf-token']).toBeUndefined();
  });

  it('returns a network-error result when fetch throws', async () => {
    fetchMock.mockRejectedValueOnce(new Error('boom'));

    const result = await adminFetch('/api/admin/thing');

    expect(result).toEqual({ ok: false, status: 0, data: null, error: 'Netzwerkfehler.' });
  });

  it('redirects to /admin/login on 401 without exposing the response body', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'nope' }), { status: 401 })
    );

    const result = await adminFetch('/api/admin/thing');

    expect(window.location.href).toBe('/admin/login');
    expect(result).toEqual({ ok: false, status: 401, data: null, error: 'Nicht angemeldet.' });
  });

  it('extracts the error message from a JSON error body on non-2xx (non-401) responses', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Forbidden thing' }), { status: 403 })
    );

    const result = await adminFetch('/api/admin/thing');

    expect(result).toEqual({
      ok: false,
      status: 403,
      data: { error: 'Forbidden thing' },
      error: 'Forbidden thing',
    });
  });

  it('falls back to a generic HTTP status error when the body has no string error field', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ foo: 'bar' }), { status: 500 }));

    const result = await adminFetch('/api/admin/thing');

    expect(result.error).toBe('HTTP 500');
  });

  it('handles non-JSON response bodies gracefully on success', async () => {
    fetchMock.mockResolvedValueOnce(new Response('not json', { status: 200 }));

    const result = await adminFetch('/api/admin/thing');

    expect(result).toEqual({ ok: true, status: 200, data: null });
  });

  it('merges caller-supplied headers with the defaults', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));

    await adminFetch('/api/admin/thing', { headers: { 'X-Custom': 'yes' } });

    const [, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit & { headers: Record<string, string> },
    ];
    expect(init.headers['X-Custom']).toBe('yes');
    expect(init.headers.Accept).toBe('application/json');
  });
});
