-- Standalone-PostgreSQL-Schema für Admin-Projekte.
-- Kontext: Issue #132 (eigener Postgres-Container).
-- Leerstart: kein Altdatenbestand übernommen.
--
-- Standalone-Postgres-Anpassungen:
--   * "create extension pgcrypto" entfernt — gen_random_uuid() ist seit
--     PostgreSQL 13 eine native Kernfunktion (siehe PR-Body für Beleg).
--   * Row Level Security + Policies entfernt — es gibt keine externen DB-Rollen
--     (anon/authenticated) in Standalone-Postgres. Zugriffskontrolle läuft
--     stattdessen über die Anwendungsschicht (Better Auth, Issue #131).
--
-- Ausführung: läuft automatisch beim ersten Start des db-Containers über
-- docker-entrypoint-initdb.d (nur bei leerem PGDATA-Volume).

-- Enum-like check for project lifecycle states.
-- Allowed values mirror the STATUSES set in src/pages/api/admin/projects.ts.
create table if not exists projects (
  id          uuid        primary key default gen_random_uuid(),
  slug        text        not null unique check (char_length(slug) between 1 and 200),
  title       text        not null check (char_length(title) between 1 and 300),
  summary     text        not null default '' check (char_length(summary) <= 2000),
  description text        not null default '',
  status      text        not null default 'planning'
                check (status in ('planning', 'in-progress', 'completed', 'archived')),
  demo_url    text,
  repo_url    text,
  featured    boolean     not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists projects_slug_idx
  on projects (slug);
create index if not exists projects_featured_idx
  on projects (featured) where featured = true;
create index if not exists projects_status_idx
  on projects (status);

-- Reuse the set_updated_at() function created in 0002_posts.sql.
-- If this migration runs standalone, create the function here too.
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_set_updated_at on projects;
create trigger projects_set_updated_at
  before update on projects
  for each row execute function set_updated_at();
