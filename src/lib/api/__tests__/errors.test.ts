import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GENERIC_ERROR_MESSAGE,
  handleUnexpectedError,
  jsonResponse,
  validationErrorResponse,
} from '../errors';
import { requestStorage } from '../logger';

describe('jsonResponse', () => {
  it('serializes the body as JSON with the given status', async () => {
    const res = jsonResponse(201, { ok: true });
    expect(res.status).toBe(201);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe('validationErrorResponse', () => {
  it('returns a 400 with the given message and no extra fields', async () => {
    const res = validationErrorResponse('slug ist erforderlich.');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'slug ist erforderlich.' });
  });
});

describe('handleUnexpectedError', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a generic 500 response with a requestId, never the original message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = handleUnexpectedError(new Error('secret db connection string leaked'), {
      route: '/api/admin/posts',
      method: 'POST',
    });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe(GENERIC_ERROR_MESSAGE);
    expect(typeof body.requestId).toBe('string');
    expect(body.requestId).not.toHaveLength(0);
    expect(JSON.stringify(body)).not.toContain('secret db connection string');
  });

  it('logs the original error with the requestId, route and method server-side', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = handleUnexpectedError(new Error('boom'), {
      route: '/api/admin/projects',
      method: 'DELETE',
    });
    const body = await res.json();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(logged.requestId).toBe(body.requestId);
    expect(logged.route).toBe('/api/admin/projects');
    expect(logged.method).toBe('DELETE');
    expect(logged.message).toBe('boom');
  });

  it('handles non-Error throwables without crashing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = handleUnexpectedError('a plain string throw', {
      route: '/api/admin/messages',
      method: 'PATCH',
    });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe(GENERIC_ERROR_MESSAGE);
  });

  it('generates a different requestId for each call', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const context = { route: '/api/admin/posts', method: 'POST' };
    const first = handleUnexpectedError(new Error('a'), context);
    const second = handleUnexpectedError(new Error('b'), context);

    expect(first).not.toBe(second);
  });

  it('reuses the request-context requestId so the error log correlates with the wrapper log', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { loggedRequestId, bodyRequestId } = await requestStorage.run(
      { requestId: 'ctx-req-id' },
      async () => {
        const res = handleUnexpectedError(new Error('boom'), {
          route: '/api/admin/posts',
          method: 'POST',
        });
        const body = await res.json();
        const logged = JSON.parse(errorSpy.mock.calls[0][0] as string);
        return { loggedRequestId: logged.requestId, bodyRequestId: body.requestId };
      }
    );

    // Log-Zeile UND Client-Response tragen die requestId aus dem Kontext.
    expect(loggedRequestId).toBe('ctx-req-id');
    expect(bodyRequestId).toBe('ctx-req-id');
  });

  it('logs pg error details (code, detail, constraint) server-side without leaking them', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const pgError = Object.assign(new Error('insert failed'), {
      code: '23503',
      detail: 'Key (author_id)=(x) is not present in table "user".',
      hint: 'ein hint',
      constraint: 'posts_author_id_fkey',
    });

    const res = handleUnexpectedError(pgError, { route: '/api/admin/posts', method: 'POST' });

    const logged = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(logged.code).toBe('23503');
    expect(logged.detail).toContain('author_id');
    expect(logged.constraint).toBe('posts_author_id_fkey');

    expect(res.status).toBe(500);
    const bodyText = JSON.stringify(await res.json());
    expect(bodyText).not.toContain('23503');
    expect(bodyText).not.toContain('author_id');
    expect(bodyText).not.toContain('posts_author_id_fkey');
  });

  it('maps pg unique violations (23505) to a 409 with a generic conflict message', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const pgError = Object.assign(new Error('duplicate key value violates unique constraint'), {
      code: '23505',
      detail: 'Key (slug)=(test-post) already exists.',
      constraint: 'posts_slug_key',
    });

    const res = handleUnexpectedError(pgError, { route: '/api/admin/posts', method: 'POST' });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('Eintrag existiert bereits.');
    expect(typeof body.requestId).toBe('string');
    const bodyText = JSON.stringify(body);
    expect(bodyText).not.toContain('slug');
    expect(bodyText).not.toContain('test-post');
    expect(bodyText).not.toContain('posts_slug_key');

    // Original bleibt vollständig im Server-Log.
    const logged = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(logged.code).toBe('23505');
    expect(logged.constraint).toBe('posts_slug_key');
  });
});
