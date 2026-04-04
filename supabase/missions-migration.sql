-- ─── Missions table ────────────────────────────────────────────────────────
-- Run this in the Supabase SQL editor for existing databases.

create table if not exists missions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  project_id  uuid references projects(id)   on delete cascade not null,
  title       text not null,
  status      text not null default 'todo' check (status in ('todo', 'done')),
  created_at  timestamptz default now()
);

-- Row Level Security
alter table missions enable row level security;

create policy "Users manage their own missions"
  on missions
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Index for fast per-project lookups
create index if not exists missions_project_id_idx on missions (project_id);
