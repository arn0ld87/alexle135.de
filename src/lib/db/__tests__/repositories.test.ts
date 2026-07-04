import { describe, expect, it, vi } from 'vitest';

import {
  createContactMessage,
  createPost,
  createProject,
  deleteContactMessage,
  deletePost,
  deleteProject,
  getAdminDashboardStats,
  getPost,
  getProject,
  listPosts,
  listProjects,
  listContactMessages,
  setContactMessageHandled,
  setContactMessageStatus,
  updatePost,
  updateProject,
  type Queryable,
} from '../repositories';

function makeDb(
  rows: Record<string, unknown>[] = []
): Queryable & { query: ReturnType<typeof vi.fn> } {
  return {
    query: vi.fn().mockResolvedValue({ rows }),
  };
}

describe('db repositories', () => {
  it('inserts contact messages with audit metadata', async () => {
    const db = makeDb();

    await createContactMessage(
      {
        name: 'Alex',
        email: 'alex@example.com',
        message: 'Hallo aus dem Kontaktformular',
        ip_hash: 'hash-1',
        user_agent: 'Vitest',
      },
      db
    );

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('insert into contact_messages'), [
      'Alex',
      'alex@example.com',
      'Hallo aus dem Kontaktformular',
      'hash-1',
      'Vitest',
    ]);
  });

  it('lists unhandled contact messages with the handled filter', async () => {
    const db = makeDb([{ id: 'msg-1', handled: false }]);

    const rows = await listContactMessages({ onlyUnhandled: true }, db);

    expect(rows).toEqual([{ id: 'msg-1', handled: false }]);
    expect(db.query.mock.calls[0][0]).toContain('where handled = false');
    expect(db.query.mock.calls[0][0]).toContain('order by created_at desc');
  });

  it('lists contact messages by workflow status', async () => {
    const db = makeDb([{ id: 'msg-1', status: 'follow_up' }]);

    const rows = await listContactMessages({ status: 'follow_up' }, db);

    expect(rows).toEqual([{ id: 'msg-1', status: 'follow_up' }]);
    expect(db.query.mock.calls[0][0]).toContain('where status = $1');
    expect(db.query.mock.calls[0][1]).toEqual(['follow_up']);
  });

  it('updates and deletes contact messages by id', async () => {
    const db = makeDb();

    await setContactMessageHandled('msg-1', false, db);
    await deleteContactMessage('msg-1', db);

    expect(db.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('update contact_messages'),
      [false, 'open', 'msg-1']
    );
    expect(db.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('delete from contact_messages'),
      ['msg-1']
    );
  });

  it('updates contact message workflow status and handled flag', async () => {
    const db = makeDb();

    await setContactMessageStatus('msg-1', 'spam', db);

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('update contact_messages'), [
      'spam',
      true,
      'msg-1',
    ]);
  });

  it('creates posts and returns the inserted id', async () => {
    const db = makeDb([{ id: 'post-1' }]);

    const id = await createPost(
      {
        title: 'Post',
        slug: 'post',
        summary: 'Kurz',
        content: '# Inhalt',
        published: false,
        tags: ['db'],
        author_id: 'admin-user-1',
      },
      db
    );

    expect(id).toBe('post-1');
    expect(db.query.mock.calls[0][0]).toContain('insert into posts');
    expect(db.query.mock.calls[0][0]).toContain('returning id');
    expect(db.query.mock.calls[0][1]).toEqual([
      'Post',
      'post',
      'Kurz',
      '# Inhalt',
      false,
      ['db'],
      'admin-user-1',
    ]);
  });

  it('updates and deletes posts by id', async () => {
    const db = makeDb();

    await updatePost('post-1', { title: 'Neu', published: true }, db);
    await deletePost('post-1', db);

    expect(db.query.mock.calls[0][0]).toContain('update posts');
    expect(db.query.mock.calls[0][0]).toContain('title = $1');
    expect(db.query.mock.calls[0][0]).toContain('published = $2');
    expect(db.query.mock.calls[0][1]).toEqual(['Neu', true, 'post-1']);
    expect(db.query).toHaveBeenNthCalledWith(2, expect.stringContaining('delete from posts'), [
      'post-1',
    ]);
  });

  it('creates projects and returns the inserted id', async () => {
    const db = makeDb([{ id: 'project-1' }]);

    const id = await createProject(
      {
        title: 'Projekt',
        slug: 'projekt',
        summary: 'Kurz',
        description: 'Lang',
        status: 'planning',
        demo_url: null,
        repo_url: 'https://github.com/example/project',
        featured: true,
      },
      db
    );

    expect(id).toBe('project-1');
    expect(db.query.mock.calls[0][0]).toContain('insert into projects');
    expect(db.query.mock.calls[0][0]).toContain('returning id');
  });

  it('updates and deletes projects by id', async () => {
    const db = makeDb();

    await updateProject('project-1', { status: 'completed', featured: false }, db);
    await deleteProject('project-1', db);

    expect(db.query.mock.calls[0][0]).toContain('update projects');
    expect(db.query.mock.calls[0][1]).toEqual(['completed', false, 'project-1']);
    expect(db.query).toHaveBeenNthCalledWith(2, expect.stringContaining('delete from projects'), [
      'project-1',
    ]);
  });

  it('returns dashboard stats from aggregate queries', async () => {
    const db = makeDb([
      { key: 'posts', count: '2' },
      { key: 'projects', count: '3' },
      { key: 'messages_total', count: '5' },
      { key: 'messages_open', count: '1' },
    ]);

    const stats = await getAdminDashboardStats(db);

    expect(stats).toEqual({
      postsCount: 2,
      projectsCount: 3,
      messagesTotal: 5,
      messagesOpen: 1,
    });
    expect(db.query.mock.calls[0][0]).toContain('from posts');
    expect(db.query.mock.calls[0][0]).toContain("from contact_messages where status = 'open'");
  });

  it('excludes undefined payload fields but keeps explicit nulls (Gemini #132)', async () => {
    const db = makeDb([{ id: 'project-1' }]);

    await createProject(
      {
        title: 'Projekt',
        slug: 'projekt',
        summary: undefined,
        description: undefined,
        status: 'planning',
        demo_url: null,
        repo_url: 'https://github.com/example/project',
        featured: true,
      },
      db
    );

    expect(db.query.mock.calls[0][1]).toEqual([
      'Projekt',
      'projekt',
      'planning',
      null,
      'https://github.com/example/project',
      true,
    ]);
  });

  it('lists and fetches posts for admin pages', async () => {
    const db = makeDb([{ id: 'post-1', title: 'Post' }]);

    expect(await listPosts(db)).toEqual([{ id: 'post-1', title: 'Post' }]);
    expect(await getPost('post-1', db)).toEqual({ id: 'post-1', title: 'Post' });

    expect(db.query).toHaveBeenNthCalledWith(
      1,
      'select id, title, slug, published, created_at from posts order by created_at desc'
    );
    expect(db.query).toHaveBeenNthCalledWith(2, 'select * from posts where id = $1 limit 1', [
      'post-1',
    ]);
  });

  it('lists and fetches projects for admin pages', async () => {
    const db = makeDb([{ id: 'project-1', title: 'Projekt' }]);

    expect(await listProjects(db)).toEqual([{ id: 'project-1', title: 'Projekt' }]);
    expect(await getProject('project-1', db)).toEqual({ id: 'project-1', title: 'Projekt' });

    expect(db.query).toHaveBeenNthCalledWith(
      1,
      'select id, title, slug, status, featured from projects order by created_at desc'
    );
    expect(db.query).toHaveBeenNthCalledWith(2, 'select * from projects where id = $1 limit 1', [
      'project-1',
    ]);
  });
});
