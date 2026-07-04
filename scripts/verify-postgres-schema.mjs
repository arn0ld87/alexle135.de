import pg from 'pg';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL fehlt. PostgreSQL-Schema kann nicht geprüft werden.');
}

const expectedTables = [
  'contact_messages',
  'posts',
  'projects',
  'rate_limit_hits',
  'schema_migrations',
];
const expectedTriggers = ['posts_set_updated_at', 'projects_set_updated_at'];

const pool = new Pool({ connectionString, max: 1 });

try {
  const tables = await pool.query(
    `select tablename
     from pg_tables
     where schemaname = 'public' and tablename = any($1::text[])`,
    [expectedTables]
  );
  const actualTables = new Set(tables.rows.map((row) => row.tablename));
  const missingTables = expectedTables.filter((table) => !actualTables.has(table));
  if (missingTables.length > 0) {
    throw new Error(`Fehlende Tabellen: ${missingTables.join(', ')}`);
  }

  const triggers = await pool.query(
    `select tgname
     from pg_trigger
     where not tgisinternal and tgname = any($1::text[])`,
    [expectedTriggers]
  );
  const actualTriggers = new Set(triggers.rows.map((row) => row.tgname));
  const missingTriggers = expectedTriggers.filter((trigger) => !actualTriggers.has(trigger));
  if (missingTriggers.length > 0) {
    throw new Error(`Fehlende Trigger: ${missingTriggers.join(', ')}`);
  }

  const migrations = await pool.query('select count(*)::text as count from schema_migrations');
  if (Number(migrations.rows[0]?.count ?? 0) < 3) {
    throw new Error('Nicht alle Basismigrationen wurden registriert.');
  }

  console.log('PostgreSQL schema verification passed.');
} finally {
  await pool.end();
}
