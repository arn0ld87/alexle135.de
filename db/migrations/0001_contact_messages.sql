-- Standalone-PostgreSQL-Schema für Kontaktanfragen.
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

create table if not exists contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (email ~* '^[^@]+@[^@]+\.[^@]+$'),
  message text not null check (char_length(message) between 10 and 5000),
  ip_hash text,
  user_agent text,
  handled boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists contact_messages_created_at_idx
  on contact_messages (created_at desc);
create index if not exists contact_messages_handled_idx
  on contact_messages (handled) where handled = false;
