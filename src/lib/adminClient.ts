/**
 * Client-side helper for calling /api/admin/* routes.
 * Reads the csrf-token cookie (non-HttpOnly companion) and echoes it
 * back as x-csrf-token header. The server-side middleware verifies the match.
 */

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]!) : null;
}

type FetchOptions = Omit<RequestInit, 'headers'> & {
  headers?: Record<string, string>;
  json?: unknown;
};

export async function adminFetch<T = unknown>(
  path: string,
  options: FetchOptions = {}
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers ?? {}),
  };

  if (options.json !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const method = (options.method ?? (options.json !== undefined ? 'POST' : 'GET')).toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    const csrf = getCookie('csrf-token');
    if (csrf) headers['x-csrf-token'] = csrf;
  }

  let response: Response;
  try {
    response = await fetch(path, {
      ...options,
      method,
      headers,
      body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
    });
  } catch {
    return { ok: false, status: 0, data: null, error: 'Netzwerkfehler.' };
  }

  if (response.status === 401) {
    window.location.href = '/admin/login';
    return { ok: false, status: 401, data: null, error: 'Nicht angemeldet.' };
  }

  let data: T | null = null;
  try {
    data = (await response.json()) as T;
  } catch {
    // non-JSON body
  }

  if (!response.ok) {
    const err =
      data &&
      typeof data === 'object' &&
      'error' in data &&
      typeof (data as { error: unknown }).error === 'string'
        ? (data as { error: string }).error
        : `HTTP ${response.status}`;
    return { ok: false, status: response.status, data, error: err };
  }

  return { ok: true, status: response.status, data };
}
