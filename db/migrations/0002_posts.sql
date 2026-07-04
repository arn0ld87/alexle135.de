-- Standalone-PostgreSQL-Schema für Admin-Blogposts.
-- Kontext: Issue #132 (eigener Postgres-Container).
-- Leerstart: kein Altdatenbestand übernommen.
--
-- Standalone-Postgres-Anpassungen:
--   * "create extension pgcrypto" entfernt — gen_random_uuid() ist seit
--     PostgreSQL 13 eine native Kernfunktion (siehe PR-Body für Beleg).
--   * Row Level Security + Policies entfernt — es gibt keine externen DB-Rollen
--     (anon/authenticated) in Standalone-Postgres. Zugriffskontrolle läuft
--     stattdessen über die Anwendungsschicht (Better Auth, Issue #131).
--   * author_id: FK auf "auth.users" entfernt. Diese Tabelle existiert in
--     Standalone-Postgres nicht (auth.users war Supabase-intern). Die Spalte
--     bleibt als nullable uuid OHNE Fremdschlüssel erhalten, damit bestehende
--     Reads/Writes (src/pages/api/admin/posts.ts) nicht brechen. Sobald Better
--     Auth (#131) eine eigene users-Tabelle liefert, folgt die FK in einer
--     eigenen Migration (separater Cutover-PR).
--
-- Ausführung: läuft automatisch beim ersten Start des db-Containers über
-- docker-entrypoint-initdb.d (nur bei leerem PGDATA-Volume).

create table if not exists posts (
  id            uuid        primary key default gen_random_uuid(),
  slug          text        not null unique check (char_length(slug) between 1 and 200),
  title         text        not null check (char_length(title) between 1 and 300),
  summary       text        not null default '' check (char_length(summary) <= 2000),
  content       text        not null default '',
  hero_image    text        not null default '',
  published     boolean     not null default false,
  published_at  timestamptz,
  tags          text[]      not null default '{}',
  -- Kein FK: auth.users existiert nur in Supabase. Verknüpfung folgt mit
  -- Better Auth (#131) in einer separaten Migration.
  author_id     uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists posts_slug_idx
  on posts (slug);
create index if not exists posts_published_at_idx
  on posts (published_at desc) where published = true;
create index if not exists posts_author_id_idx
  on posts (author_id);

-- Auto-update updated_at on row change.
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists posts_set_updated_at on posts;
create trigger posts_set_updated_at
  before update on posts
  for each row execute function set_updated_at();
