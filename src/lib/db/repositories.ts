import { getDb, type Queryable } from './client';

export type { Queryable } from './client';

export type ContactMessageInput = {
  name: string;
  email: string;
  message: string;
  ip_hash: string | null;
  user_agent: string | null;
};

export type ContactMessageStatus = 'open' | 'answered' | 'spam' | 'follow_up';

export type PostInput = {
  title?: string;
  slug?: string;
  summary?: string;
  content?: string;
  published?: boolean;
  tags?: string[];
  author_id?: string;
};

export type ProjectInput = {
  title?: string;
  slug?: string;
  summary?: string;
  description?: string;
  status?: string;
  demo_url?: string | null;
  repo_url?: string | null;
  featured?: boolean;
};

export type Row = Record<string, unknown>;

export type ContactMessageRow = {
  id: string;
  name: string;
  email: string;
  message: string;
  handled: boolean;
  status: ContactMessageStatus;
  created_at: string;
  user_agent: string | null;
};

export type AdminPostRow = {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  created_at: string;
};

export type AdminProjectRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
  featured: boolean;
};

export type AdminDashboardStats = {
  postsCount: number;
  projectsCount: number;
  messagesTotal: number;
  messagesOpen: number;
};

const POST_COLUMNS = [
  'title',
  'slug',
  'summary',
  'content',
  'published',
  'tags',
  'author_id',
] as const;
const PROJECT_COLUMNS = [
  'title',
  'slug',
  'summary',
  'description',
  'status',
  'demo_url',
  'repo_url',
  'featured',
] as const;

async function db(client?: Queryable): Promise<Queryable> {
  return client ?? getDb();
}

function valuesFor<T extends Row, K extends readonly (keyof T & string)[]>(
  input: T,
  allowedColumns: K
): { columns: string[]; values: unknown[] } {
  // `!== undefined` statt hasOwnProperty: explizit fehlende Felder bleiben
  // außen vor, aber `null` für nullable Spalten (z. B. demo_url) wird zugelassen.
  // node-postgres würde `undefined` als `null` an NOT-NULL-Spalten senden.
  const columns = allowedColumns.filter((column) => input[column] !== undefined);
  return {
    columns,
    values: columns.map((column) => input[column]),
  };
}

function buildInsert(table: string, columns: string[]): string {
  const names = columns.join(', ');
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
  return `insert into ${table} (${names}) values (${placeholders}) returning id`;
}

function buildUpdate(table: string, columns: string[]): string {
  const assignments = columns.map((column, index) => `${column} = $${index + 1}`).join(', ');
  return `update ${table} set ${assignments} where id = $${columns.length + 1}`;
}

export async function createContactMessage(
  input: ContactMessageInput,
  client?: Queryable
): Promise<void> {
  const database = await db(client);
  await database.query(
    `insert into contact_messages (name, email, message, ip_hash, user_agent)
     values ($1, $2, $3, $4, $5)`,
    [input.name, input.email, input.message, input.ip_hash, input.user_agent]
  );
}

export async function listContactMessages(
  options: { onlyUnhandled?: boolean; status?: ContactMessageStatus } = {},
  client?: Queryable
): Promise<ContactMessageRow[]> {
  const database = await db(client);
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (options.status) {
    values.push(options.status);
    conditions.push(`status = $${values.length}`);
  } else if (options.onlyUnhandled) {
    conditions.push('handled = false');
  }

  const where = conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';
  const result = await database.query<ContactMessageRow>(
    `select * from contact_messages ${where} order by created_at desc limit 200`,
    values
  );
  return result.rows;
}

export async function setContactMessageHandled(
  id: string,
  handled = true,
  client?: Queryable
): Promise<void> {
  const database = await db(client);
  await database.query('update contact_messages set handled = $1, status = $2 where id = $3', [
    handled,
    handled ? 'answered' : 'open',
    id,
  ]);
}

export async function setContactMessageStatus(
  id: string,
  status: ContactMessageStatus,
  client?: Queryable
): Promise<void> {
  const database = await db(client);
  await database.query('update contact_messages set status = $1, handled = $2 where id = $3', [
    status,
    status !== 'open',
    id,
  ]);
}

export async function deleteContactMessage(id: string, client?: Queryable): Promise<void> {
  const database = await db(client);
  await database.query('delete from contact_messages where id = $1', [id]);
}

export async function createPost(input: PostInput, client?: Queryable): Promise<string> {
  const database = await db(client);
  const { columns, values } = valuesFor(input, POST_COLUMNS);
  const result = await database.query<{ id: string }>(buildInsert('posts', columns), values);
  const id = result.rows[0]?.id;
  if (!id) throw new Error('Post konnte nicht erstellt werden.');
  return id;
}

export async function updatePost(id: string, input: PostInput, client?: Queryable): Promise<void> {
  const database = await db(client);
  const { columns, values } = valuesFor(input, POST_COLUMNS);
  if (columns.length === 0) return;
  await database.query(buildUpdate('posts', columns), [...values, id]);
}

export async function deletePost(id: string, client?: Queryable): Promise<void> {
  const database = await db(client);
  await database.query('delete from posts where id = $1', [id]);
}

export async function listPosts(client?: Queryable): Promise<AdminPostRow[]> {
  const database = await db(client);
  const result = await database.query<AdminPostRow>(
    'select id, title, slug, published, created_at from posts order by created_at desc'
  );
  return result.rows;
}

export async function getPost(id: string, client?: Queryable): Promise<Row | null> {
  const database = await db(client);
  const result = await database.query('select * from posts where id = $1 limit 1', [id]);
  return result.rows[0] ?? null;
}

export async function createProject(input: ProjectInput, client?: Queryable): Promise<string> {
  const database = await db(client);
  const { columns, values } = valuesFor(input, PROJECT_COLUMNS);
  const result = await database.query<{ id: string }>(buildInsert('projects', columns), values);
  const id = result.rows[0]?.id;
  if (!id) throw new Error('Projekt konnte nicht erstellt werden.');
  return id;
}

export async function updateProject(
  id: string,
  input: ProjectInput,
  client?: Queryable
): Promise<void> {
  const database = await db(client);
  const { columns, values } = valuesFor(input, PROJECT_COLUMNS);
  if (columns.length === 0) return;
  await database.query(buildUpdate('projects', columns), [...values, id]);
}

export async function deleteProject(id: string, client?: Queryable): Promise<void> {
  const database = await db(client);
  await database.query('delete from projects where id = $1', [id]);
}

export async function listProjects(client?: Queryable): Promise<AdminProjectRow[]> {
  const database = await db(client);
  const result = await database.query<AdminProjectRow>(
    'select id, title, slug, status, featured from projects order by created_at desc'
  );
  return result.rows;
}

export async function getProject(id: string, client?: Queryable): Promise<Row | null> {
  const database = await db(client);
  const result = await database.query('select * from projects where id = $1 limit 1', [id]);
  return result.rows[0] ?? null;
}

export async function getAdminDashboardStats(client?: Queryable): Promise<AdminDashboardStats> {
  const database = await db(client);
  const result = await database.query<{ key: string; count: string | number }>(`
    select 'posts' as key, count(*) as count from posts
    union all
    select 'projects' as key, count(*) as count from projects
    union all
    select 'messages_total' as key, count(*) as count from contact_messages
    union all
    select 'messages_open' as key, count(*) as count from contact_messages where status = 'open'
  `);
  const counts = new Map(result.rows.map((row) => [row.key, Number(row.count)]));
  return {
    postsCount: counts.get('posts') ?? 0,
    projectsCount: counts.get('projects') ?? 0,
    messagesTotal: counts.get('messages_total') ?? 0,
    messagesOpen: counts.get('messages_open') ?? 0,
  };
}
