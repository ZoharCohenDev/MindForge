-- ══════════════════════════════════════════════════════════════════════════
--  MINDFORGE — Full Reset + Rebuild
--  Paste this entire file into the Supabase SQL Editor and click Run.
--  ⚠️  This DELETES all topics, notes, projects, and resources.
--      Your login / auth account is NOT deleted.
-- ══════════════════════════════════════════════════════════════════════════


-- ── 1. Nuke existing tables (cascade removes indexes, triggers, policies) ──

drop table if exists public.resources  cascade;
drop table if exists public.notes      cascade;
drop table if exists public.projects   cascade;
drop table if exists public.topics     cascade;
drop table if exists public.profiles   cascade;

-- ── 2. Drop helper functions ───────────────────────────────────────────────

drop function if exists public.handle_new_user() cascade;
drop function if exists public.set_updated_at()  cascade;


-- ── 3. Extensions ──────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";


-- ── 4. Profiles ────────────────────────────────────────────────────────────

create table public.profiles (
  id         uuid        primary key references auth.users(id) on delete cascade,
  email      text,
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Back-fill existing users (so your current account gets a profile row)
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;


-- ── 5. Topics ──────────────────────────────────────────────────────────────

create table public.topics (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  parent_id  uuid        null     references public.topics(id) on delete set null,
  title      text        not null,
  summary    text        not null default '',
  status     text        not null check (status in ('not_started','learning','in_progress','done')),
  sort_order integer     not null default 0,
  depth      integer     not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger topics_set_updated_at
  before update on public.topics
  for each row execute function public.set_updated_at();


-- ── 6. Projects ────────────────────────────────────────────────────────────

create table public.projects (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  name        text        not null,
  description text        not null default '',
  status      text        not null check (status in ('not_started','learning','in_progress','done')),
  github_url  text        null,
  colab_url   text        null,
  tech_stack  text[]      not null default '{}',
  created_at  timestamptz not null default timezone('utc', now())
);


-- ── 7. Notes ───────────────────────────────────────────────────────────────

create table public.notes (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  topic_id   uuid        null     references public.topics(id) on delete set null,
  title      text        not null,
  content    text        not null,
  created_at timestamptz not null default timezone('utc', now())
);


-- ── 8. Resources ───────────────────────────────────────────────────────────

create table public.resources (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  title      text        not null,
  type       text        not null,
  url        text        not null,
  created_at timestamptz not null default timezone('utc', now())
);


-- ── 9. Indexes (all tables exist at this point) ────────────────────────────

create index topics_user_parent_idx on public.topics(user_id, parent_id);
create index topics_depth_order_idx on public.topics(depth, sort_order);
create index notes_topic_id_idx     on public.notes(topic_id);
create index notes_user_idx         on public.notes(user_id);
create index projects_user_idx      on public.projects(user_id);
create index resources_user_idx     on public.resources(user_id);


-- ── 10. Row Level Security ─────────────────────────────────────────────────

alter table public.profiles   enable row level security;
alter table public.topics     enable row level security;
alter table public.projects   enable row level security;
alter table public.notes      enable row level security;
alter table public.resources  enable row level security;

-- profiles
create policy "profiles_select" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles_update" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- topics
create policy "topics_select" on public.topics for select to authenticated using (auth.uid() = user_id);
create policy "topics_insert" on public.topics for insert to authenticated with check (auth.uid() = user_id);
create policy "topics_update" on public.topics for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "topics_delete" on public.topics for delete to authenticated using (auth.uid() = user_id);

-- projects
create policy "projects_select" on public.projects for select to authenticated using (auth.uid() = user_id);
create policy "projects_insert" on public.projects for insert to authenticated with check (auth.uid() = user_id);
create policy "projects_update" on public.projects for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "projects_delete" on public.projects for delete to authenticated using (auth.uid() = user_id);

-- notes
create policy "notes_select" on public.notes for select to authenticated using (auth.uid() = user_id);
create policy "notes_insert" on public.notes for insert to authenticated with check (auth.uid() = user_id);
create policy "notes_update" on public.notes for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notes_delete" on public.notes for delete to authenticated using (auth.uid() = user_id);

-- resources
create policy "resources_select" on public.resources for select to authenticated using (auth.uid() = user_id);
create policy "resources_insert" on public.resources for insert to authenticated with check (auth.uid() = user_id);
create policy "resources_update" on public.resources for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "resources_delete" on public.resources for delete to authenticated using (auth.uid() = user_id);


-- ── Done ───────────────────────────────────────────────────────────────────
-- All tables, indexes, triggers, and RLS policies are recreated.
-- Go to the app and click "Seed AI tree" to load all 214 topics.
