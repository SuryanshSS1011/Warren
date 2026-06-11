-- Warren persistence schema (BUILD_PLAN.md "Persistence model").
-- Paste this into the Supabase SQL Editor, or run via the Supabase CLI.
-- Anonymous-first: a warren is owned either by an authed user (owner_id) or by an
-- anonymous client id stored in a cookie (anon_id). Public warrens are world-readable.

create extension if not exists "pgcrypto";

create table if not exists warren (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid references auth.users (id) on delete set null,
  anon_id     text,                          -- cookie-set id for anonymous authors
  title       text,
  spine       text[] not null default '{}',  -- ordered node ids (the clicked path)
  started_at  timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  is_public   boolean not null default true, -- shared links are public by default
  stats       jsonb  not null default '{}'::jsonb,
  check (owner_id is not null or anon_id is not null)
);

create table if not exists node (
  id              text not null,             -- corpus/wikipedia slug, unique within a warren
  warren_id       uuid not null references warren (id) on delete cascade,
  title           text not null,
  category        text,
  depth           int  not null default 0,
  created_at      timestamptz not null default now(),
  dwell_ms        int  not null default 0,
  primary key (warren_id, id)
);

create table if not exists edge (
  warren_id   uuid not null references warren (id) on delete cascade,
  source      text not null,
  target      text not null,
  bridge      text,
  spine       boolean not null default false,
  primary key (warren_id, source, target),
  -- both endpoints must be real nodes in the same warren (self-validating graph)
  constraint edge_source_node_fk foreign key (warren_id, source)
    references node (warren_id, id) on delete cascade,
  constraint edge_target_node_fk foreign key (warren_id, target)
    references node (warren_id, id) on delete cascade
);

create index if not exists warren_owner_idx  on warren (owner_id);
create index if not exists warren_anon_idx   on warren (anon_id);
create index if not exists warren_public_idx on warren (is_public, created_at desc);

-- ---------- Row Level Security ----------
alter table warren enable row level security;
alter table node   enable row level security;
alter table edge   enable row level security;

-- Read: anyone may read public warrens; owners may read their own.
drop policy if exists warren_read on warren;
create policy warren_read on warren
  for select using (is_public or owner_id = auth.uid());

-- Write: an authed user may insert/update/delete their own rows. Anonymous inserts are
-- handled server-side with the service-role key (which bypasses RLS), so no anon policy
-- is needed here — keep client-side writes locked to the owner.
drop policy if exists warren_write on warren;
create policy warren_write on warren
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- node/edge inherit visibility from their parent warren.
drop policy if exists node_read on node;
create policy node_read on node
  for select using (exists (
    select 1 from warren w where w.id = node.warren_id and (w.is_public or w.owner_id = auth.uid())
  ));

drop policy if exists node_write on node;
create policy node_write on node
  for all using (exists (
    select 1 from warren w where w.id = node.warren_id and w.owner_id = auth.uid()
  )) with check (exists (
    select 1 from warren w where w.id = node.warren_id and w.owner_id = auth.uid()
  ));

drop policy if exists edge_read on edge;
create policy edge_read on edge
  for select using (exists (
    select 1 from warren w where w.id = edge.warren_id and (w.is_public or w.owner_id = auth.uid())
  ));

drop policy if exists edge_write on edge;
create policy edge_write on edge
  for all using (exists (
    select 1 from warren w where w.id = edge.warren_id and w.owner_id = auth.uid()
  )) with check (exists (
    select 1 from warren w where w.id = edge.warren_id and w.owner_id = auth.uid()
  ));
