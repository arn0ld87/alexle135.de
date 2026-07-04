import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createPostMock, deletePostMock, updatePostMock } = vi.hoisted(() => ({
  createPostMock: vi.fn(),
  deletePostMock: vi.fn(),
  updatePostMock: vi.fn(),
}));

vi.mock('../../../../lib/db/repositories', () => ({
  createPost: createPostMock,
  deletePost: deletePostMock,
  updatePost: updatePostMock,
}));

import { DELETE, POST, PUT } from '../posts';

function makeRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

const locals = { user: { id: 'admin-user-1' } };

const POST_ID = '66af4f34-b7f1-41d7-83d1-21fecb9c52e9';

const validPostBody = {
  title: 'Test Post',
  slug: 'test-post',
  summary: 'Eine kurze Zusammenfassung',
  content: '# Inhalt',
  published: false,
  tags: ['vitest', 'integration'],
};

describe('/api/admin/posts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    createPostMock.mockResolvedValue('post-new');
    updatePostMock.mockResolvedValue(undefined);
    deletePostMock.mockResolvedValue(undefined);
  });

  it('creates posts through the Postgres repository', async () => {
    const res = await POST({
      request: makeRequest('POST', 'https://alexle135.de/api/admin/posts', validPostBody),
      locals,
    } as never);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, id: 'post-new' });
    expect(createPostMock).toHaveBeenCalledWith({ ...validPostBody, author_id: 'admin-user-1' });
  });

  it('requires title and slug for posts', async () => {
    const res = await POST({
      request: makeRequest('POST', 'https://alexle135.de/api/admin/posts', {
        slug: 'missing-title',
      }),
      locals,
    } as never);

    expect(res.status).toBe(400);
    expect(createPostMock).not.toHaveBeenCalled();
  });

  it('updates posts through the Postgres repository', async () => {
    const res = await PUT({
      request: makeRequest('PUT', 'https://alexle135.de/api/admin/posts', {
        id: POST_ID,
        title: 'Updated',
      }),
      locals,
    } as never);

    expect(res.status).toBe(200);
    expect(updatePostMock).toHaveBeenCalledWith(POST_ID, { title: 'Updated' });
  });

  it('rejects updates with a malformed id', async () => {
    const res = await PUT({
      request: makeRequest('PUT', 'https://alexle135.de/api/admin/posts', {
        id: 'post-1',
        title: 'Updated',
      }),
      locals,
    } as never);

    expect(res.status).toBe(400);
    expect(updatePostMock).not.toHaveBeenCalled();
  });

  it('deletes posts through the Postgres repository', async () => {
    const res = await DELETE({
      request: makeRequest('DELETE', `https://alexle135.de/api/admin/posts?id=${POST_ID}`),
      locals,
    } as never);

    expect(res.status).toBe(200);
    expect(deletePostMock).toHaveBeenCalledWith(POST_ID);
  });

  it('returns a generic error with a request id when the repository fails, never the raw exception message', async () => {
    createPostMock.mockRejectedValue(new Error('db down: connection refused at 10.0.0.5'));

    const res = await POST({
      request: makeRequest('POST', 'https://alexle135.de/api/admin/posts', validPostBody),
      locals,
    } as never);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Interner Fehler. Bitte erneut versuchen.');
    expect(typeof body.requestId).toBe('string');
    expect(body.requestId.length).toBeGreaterThan(0);
    expect(JSON.stringify(body)).not.toContain('db down');
    expect(JSON.stringify(body)).not.toContain('10.0.0.5');
  });

  it('maps a pg unique violation to a 409 conflict without leaking constraint details', async () => {
    createPostMock.mockRejectedValue(
      Object.assign(new Error('duplicate key value violates unique constraint'), {
        code: '23505',
        detail: 'Key (slug)=(test-post) already exists.',
        constraint: 'posts_slug_key',
      })
    );

    const res = await POST({
      request: makeRequest('POST', 'https://alexle135.de/api/admin/posts', validPostBody),
      locals,
    } as never);

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('Eintrag existiert bereits.');
    expect(JSON.stringify(body)).not.toContain('posts_slug_key');
  });

  it('rejects post creation without an authenticated admin user', async () => {
    const res = await POST({
      request: makeRequest('POST', 'https://alexle135.de/api/admin/posts', validPostBody),
      locals: {},
    } as never);

    expect(res.status).toBe(401);
    expect(createPostMock).not.toHaveBeenCalled();
  });
});
