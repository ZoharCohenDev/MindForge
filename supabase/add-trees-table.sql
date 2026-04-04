-- Migration: introduce a user-owned `trees` table and link topics to it via tree_id.
-- Run this in the Supabase SQL editor ONCE, after `schema.sql`.

-- 1. Create the trees table.
create table if not exists public.trees (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  name        text        not null,
  description text        not null default '',
  slug        text        not null default '',   -- e.g. 'ai', 'fullstack'; used for legacy compatibility
  icon        text        null,                  -- emoji or icon identifier for the UI tab
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now()),
  unique(user_id, slug)
);

create index if not exists trees_user_idx on public.trees(user_id);

drop trigger if exists trees_set_updated_at on public.trees;
create trigger trees_set_updated_at
  before update on public.trees
  for each row execute function public.set_updated_at();

-- 2. Add tree_id to topics (nullable so existing rows are not broken).
alter table public.topics
  add column if not exists tree_id uuid null references public.trees(id) on delete cascade;

create index if not exists topics_tree_id_idx on public.topics(tree_id);

-- 3. Backfill: create a trees row for every distinct (user_id, tree_type) that
--    already exists in topics, then stamp tree_id on those existing topic rows.
--    This ensures existing users lose no progress after the migration.
insert into public.trees (user_id, name, description, slug, icon)
select distinct
  t.user_id,
  case t.tree_type
    when 'ai'        then 'Artificial Intelligence'
    when 'fullstack' then 'Full Stack Development'
    else t.tree_type
  end,
  case t.tree_type
    when 'ai'        then 'Your full AI learning map.'
    when 'fullstack' then 'The complete Full Stack learning tree.'
    else ''
  end,
  t.tree_type,
  case t.tree_type
    when 'ai'        then '🤖'
    when 'fullstack' then '🌐'
    else null
  end
from public.topics t
on conflict (user_id, slug) do nothing;

-- 4. Stamp tree_id on all existing topic rows that still have tree_id = null.
update public.topics tp
set    tree_id = tr.id
from   public.trees tr
where  tr.user_id = tp.user_id
  and  tr.slug    = tp.tree_type
  and  tp.tree_id is null;
