-- Better Auth core schema for Issue #131.
-- Based on Better Auth v1.6 core schema: user, session, account, verification.
-- Role is server-owned via auth config (`input: false`) and used by admin middleware.

create table if not exists "user" (
  id              text        primary key,
  name            text        not null,
  email           text        not null unique,
  email_verified  boolean     not null default false,
  image           text,
  role            text        not null default 'user'
                    check (role in ('user', 'admin')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists session (
  id          text        primary key,
  user_id     text        not null references "user"(id) on delete cascade,
  token       text        not null unique,
  expires_at  timestamptz not null,
  ip_address  text,
  user_agent  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists session_user_id_idx on session (user_id);

create table if not exists account (
  id                        text        primary key,
  user_id                   text        not null references "user"(id) on delete cascade,
  account_id                text        not null,
  provider_id               text        not null,
  access_token              text,
  refresh_token             text,
  access_token_expires_at   timestamptz,
  refresh_token_expires_at  timestamptz,
  scope                     text,
  id_token                  text,
  password                  text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists account_user_id_idx on account (user_id);
create unique index if not exists account_provider_account_idx
  on account (provider_id, account_id);

create table if not exists verification (
  id          text        primary key,
  identifier  text        not null,
  value       text        not null,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists verification_identifier_idx on verification (identifier);
