-- Learn pillar (Phase 4): spaced-repetition flashcards. Owner-scoped like warrens (account
-- owner_id OR anonymous anon_id). Each card stores its FSRS scheduling state so review can
-- reschedule it. All reads/writes go through the service-role client (RLS is a backstop).

create table if not exists card (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid references auth.users (id) on delete cascade,
  anon_id    text,
  -- source article (Wikipedia title) the card was generated from, for the "what you know" map
  article    text not null,
  front      text not null,
  back       text not null,
  -- FSRS scheduling state (see ts-fsrs Card). due drives "what's due now".
  due            timestamptz not null default now(),
  stability      double precision not null default 0,
  difficulty     double precision not null default 0,
  elapsed_days   integer not null default 0,
  scheduled_days integer not null default 0,
  reps           integer not null default 0,
  lapses         integer not null default 0,
  learning_steps integer not null default 0,
  -- FSRS State enum: 0 New, 1 Learning, 2 Review, 3 Relearning
  state          integer not null default 0,
  last_review    timestamptz,
  created_at     timestamptz not null default now(),
  check (owner_id is not null or anon_id is not null)
);

create index if not exists card_owner_due_idx on card (owner_id, due);
create index if not exists card_anon_due_idx  on card (anon_id, due);
create index if not exists card_article_idx   on card (article);

alter table card enable row level security;

-- Owners may read their own cards via the publishable key; writes are service-role only.
drop policy if exists card_read on card;
create policy card_read on card
  for select using (owner_id = auth.uid());
