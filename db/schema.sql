create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  password_hash text,
  created_at timestamptz default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  payload_json jsonb not null,
  deleted_at timestamptz null
);
create index if not exists idx_sessions_user_updated on sessions (user_id, updated_at desc);

create table if not exists usage_ledger (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  action text not null,
  created_at timestamptz default now()
);
create index if not exists idx_usage_ledger_user_created on usage_ledger (user_id, created_at desc);
