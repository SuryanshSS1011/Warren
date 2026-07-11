-- Account profiles: tier/entitlement + billing linkage (Phase 2). One row per auth user.
-- Tier enforcement is server-side; this table is the source of truth the entitlement layer
-- reads. Reads/writes go through the service-role client (like warren rows), so RLS is a
-- backstop, not the primary gate.

create table if not exists profile (
  id            uuid primary key references auth.users (id) on delete cascade,
  -- 'free' | 'pro' | 'researcher'. Effective tier also considers an active trial (below).
  tier          text not null default 'free',
  -- Reverse trial: full Pro until trial_ends_at, then effective tier falls back to `tier`.
  trial_ends_at timestamptz,
  -- LemonSqueezy linkage (nullable until they subscribe).
  ls_customer_id     text,
  ls_subscription_id text,
  -- Subscription lifecycle from LS webhooks: active | on_trial | past_due | cancelled | expired | null
  ls_status     text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists profile_ls_sub_idx on profile (ls_subscription_id);

alter table profile enable row level security;

-- A user may read only their own profile via the publishable key. Writes are server-side
-- (service role) only — no client write policy, so tier can't be self-granted.
drop policy if exists profile_read on profile;
create policy profile_read on profile
  for select using (id = auth.uid());
