import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  deleteContactMessageMock,
  listContactMessagesMock,
  setContactMessageHandledMock,
  setContactMessageStatusMock,
} = vi.hoisted(() => ({
  deleteContactMessageMock: vi.fn(),
  listContactMessagesMock: vi.fn(),
  setContactMessageHandledMock: vi.fn(),
  setContactMessageStatusMock: vi.fn(),
}));

vi.mock('../../../../lib/db/repositories', () => ({
  deleteContactMessage: deleteContactMessageMock,
  listContactMessages: listContactMessagesMock,
  setContactMessageHandled: setContactMessageHandledMock,
  setContactMessageStatus: setContactMessageStatusMock,
}));

import { DELETE, GET, PATCH } from '../messages';

function makeRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

const MESSAGE_ID = 'cfff28ce-982b-4f05-bc1d-10d86c64e800';

describe('/api/admin/messages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    listContactMessagesMock.mockResolvedValue([{ id: MESSAGE_ID, handled: false }]);
    setContactMessageHandledMock.mockResolvedValue(undefined);
    setContactMessageStatusMock.mockResolvedValue(undefined);
    deleteContactMessageMock.mockResolvedValue(undefined);
  });

  it('lists messages through the Postgres repository', async () => {
    const res = await GET({
      request: makeRequest('GET', 'https://alex-schneider.dev/api/admin/messages?unhandled=1'),
    } as never);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [{ id: MESSAGE_ID, handled: false }] });
    expect(listContactMessagesMock).toHaveBeenCalledWith({
      onlyUnhandled: true,
      status: undefined,
    });
  });

  it('filters messages by workflow status', async () => {
    const res = await GET({
      request: makeRequest('GET', 'https://alex-schneider.dev/api/admin/messages?status=follow_up'),
    } as never);

    expect(res.status).toBe(200);
    expect(listContactMessagesMock).toHaveBeenCalledWith({
      onlyUnhandled: false,
      status: 'follow_up',
    });
  });

  it('returns a generic error with a request id when listing messages fails, never the raw exception message', async () => {
    listContactMessagesMock.mockRejectedValue(new Error('db down: connection refused at 10.0.0.5'));

    const res = await GET({
      request: makeRequest('GET', 'https://alex-schneider.dev/api/admin/messages'),
    } as never);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Interner Fehler. Bitte erneut versuchen.');
    expect(typeof body.requestId).toBe('string');
    expect(body.requestId.length).toBeGreaterThan(0);
    expect(JSON.stringify(body)).not.toContain('db down');
    expect(JSON.stringify(body)).not.toContain('10.0.0.5');
  });

  it('updates handled state through the Postgres repository', async () => {
    const res = await PATCH({
      request: makeRequest('PATCH', 'https://alex-schneider.dev/api/admin/messages', {
        id: MESSAGE_ID,
        handled: false,
      }),
    } as never);

    expect(res.status).toBe(200);
    expect(setContactMessageHandledMock).toHaveBeenCalledWith(MESSAGE_ID, false);
  });

  it('defaults handled to true', async () => {
    await PATCH({
      request: makeRequest('PATCH', 'https://alex-schneider.dev/api/admin/messages', {
        id: MESSAGE_ID,
      }),
    } as never);

    expect(setContactMessageHandledMock).toHaveBeenCalledWith(MESSAGE_ID, true);
  });

  it('updates workflow status through the Postgres repository', async () => {
    const res = await PATCH({
      request: makeRequest('PATCH', 'https://alex-schneider.dev/api/admin/messages', {
        id: MESSAGE_ID,
        status: 'spam',
      }),
    } as never);

    expect(res.status).toBe(200);
    expect(setContactMessageStatusMock).toHaveBeenCalledWith(MESSAGE_ID, 'spam');
  });

  it('rejects invalid workflow status', async () => {
    const res = await PATCH({
      request: makeRequest('PATCH', 'https://alex-schneider.dev/api/admin/messages', {
        id: MESSAGE_ID,
        status: 'done-ish',
      }),
    } as never);

    expect(res.status).toBe(400);
    expect(setContactMessageStatusMock).not.toHaveBeenCalled();
  });

  it('requires an id for updates', async () => {
    const res = await PATCH({
      request: makeRequest('PATCH', 'https://alex-schneider.dev/api/admin/messages', {
        handled: true,
      }),
    } as never);

    expect(res.status).toBe(400);
    expect(setContactMessageHandledMock).not.toHaveBeenCalled();
  });

  it('rejects updates with a malformed id', async () => {
    const res = await PATCH({
      request: makeRequest('PATCH', 'https://alex-schneider.dev/api/admin/messages', {
        id: 'msg-1',
        handled: true,
      }),
    } as never);

    expect(res.status).toBe(400);
    expect(setContactMessageHandledMock).not.toHaveBeenCalled();
  });

  it('deletes messages through the Postgres repository', async () => {
    const res = await DELETE({
      request: makeRequest(
        'DELETE',
        `https://alex-schneider.dev/api/admin/messages?id=${MESSAGE_ID}`
      ),
    } as never);

    expect(res.status).toBe(200);
    expect(deleteContactMessageMock).toHaveBeenCalledWith(MESSAGE_ID);
  });
});
