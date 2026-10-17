import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createProjectMock, deleteProjectMock, updateProjectMock } = vi.hoisted(() => ({
  createProjectMock: vi.fn(),
  deleteProjectMock: vi.fn(),
  updateProjectMock: vi.fn(),
}));

vi.mock('../../../../lib/db/repositories', () => ({
  createProject: createProjectMock,
  deleteProject: deleteProjectMock,
  updateProject: updateProjectMock,
}));

import { DELETE, POST, PUT } from '../projects';

function makeRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

const PROJECT_ID = 'f53fa70a-aeb8-4bf8-ac8c-0ad256176a82';

const validProjectBody = {
  title: 'Projekt',
  slug: 'projekt',
  summary: 'Kurz',
  description: 'Lang',
  status: 'planning',
  demo_url: null,
  repo_url: 'https://github.com/example/project',
  featured: true,
};

describe('/api/admin/projects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    createProjectMock.mockResolvedValue('project-new');
    updateProjectMock.mockResolvedValue(undefined);
    deleteProjectMock.mockResolvedValue(undefined);
  });

  it('creates projects through the Postgres repository', async () => {
    const res = await POST({
      request: makeRequest(
        'POST',
        'https://alex-schneider.dev/api/admin/projects',
        validProjectBody
      ),
    } as never);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, id: 'project-new' });
    expect(createProjectMock).toHaveBeenCalledWith(validProjectBody);
  });

  it('rejects invalid project statuses', async () => {
    const res = await POST({
      request: makeRequest('POST', 'https://alex-schneider.dev/api/admin/projects', {
        ...validProjectBody,
        status: 'invalid',
      }),
    } as never);

    expect(res.status).toBe(400);
    expect(createProjectMock).not.toHaveBeenCalled();
  });

  it('updates projects through the Postgres repository', async () => {
    const res = await PUT({
      request: makeRequest('PUT', 'https://alex-schneider.dev/api/admin/projects', {
        id: PROJECT_ID,
        featured: false,
      }),
    } as never);

    expect(res.status).toBe(200);
    expect(updateProjectMock).toHaveBeenCalledWith(PROJECT_ID, { featured: false });
  });

  it('rejects updates with a malformed id', async () => {
    const res = await PUT({
      request: makeRequest('PUT', 'https://alex-schneider.dev/api/admin/projects', {
        id: 'project-1',
        featured: false,
      }),
    } as never);

    expect(res.status).toBe(400);
    expect(updateProjectMock).not.toHaveBeenCalled();
  });

  it('deletes projects through the Postgres repository', async () => {
    const res = await DELETE({
      request: makeRequest(
        'DELETE',
        `https://alex-schneider.dev/api/admin/projects?id=${PROJECT_ID}`
      ),
    } as never);

    expect(res.status).toBe(200);
    expect(deleteProjectMock).toHaveBeenCalledWith(PROJECT_ID);
  });

  it('returns a generic error with a request id when the repository fails, never the raw exception message', async () => {
    createProjectMock.mockRejectedValue(new Error('db down: connection refused at 10.0.0.5'));

    const res = await POST({
      request: makeRequest(
        'POST',
        'https://alex-schneider.dev/api/admin/projects',
        validProjectBody
      ),
    } as never);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Interner Fehler. Bitte erneut versuchen.');
    expect(typeof body.requestId).toBe('string');
    expect(body.requestId.length).toBeGreaterThan(0);
    expect(JSON.stringify(body)).not.toContain('db down');
    expect(JSON.stringify(body)).not.toContain('10.0.0.5');
  });
});
