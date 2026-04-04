-- LearnOS starter schema
-- Run this in the Supabase SQL editor.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
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

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid null references public.topics(id) on delete cascade,
  title text not null,
  summary text not null default '',
  status text not null check (status in ('not_started', 'learning', 'in_progress', 'done')),
  sort_order integer not null default 0,
  depth integer not null default 0,
  tree_type text not null default 'ai' check (tree_type in ('ai', 'fullstack')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- NOTE: topics index only — notes index is created after the notes table below
create index if not exists topics_user_parent_idx on public.topics(user_id, parent_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists topics_set_updated_at on public.topics;
create trigger topics_set_updated_at
  before update on public.topics
  for each row execute function public.set_updated_at();

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text not null default '',
  status text not null check (status in ('not_started', 'learning', 'in_progress', 'done')),
  category text not null default 'personal' check (category in ('work', 'study', 'udemy', 'personal')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  github_url text null,
  colab_url text null,
  demo_url text null,
  tech_stack text[] not null default '{}',
  deadline text null,
  lessons_learned text null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid null references public.topics(id) on delete set null,
  title text not null,
  content text not null,
  code_example text null,
  code_blocks jsonb null,
  math_expression text null,
  sub_expressions jsonb null,
  created_at timestamptz not null default timezone('utc', now())
);

-- Index AFTER notes table exists (was incorrectly placed before in the original)
create index if not exists notes_topic_id_idx on public.notes(topic_id);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  type text not null,
  url text not null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles enable row level security;
alter table public.topics enable row level security;
alter table public.projects enable row level security;
alter table public.notes enable row level security;
alter table public.resources enable row level security;

create policy "Users can read own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can manage own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can read own topics"
  on public.topics
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own topics"
  on public.topics
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own topics"
  on public.topics
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own topics"
  on public.topics
  for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can read own projects"
  on public.projects
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own projects"
  on public.projects
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own projects"
  on public.projects
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own projects"
  on public.projects
  for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can read own notes"
  on public.notes
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own notes"
  on public.notes
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own notes"
  on public.notes
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own notes"
  on public.notes
  for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can read own resources"
  on public.resources
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own resources"
  on public.resources
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own resources"
  on public.resources
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own resources"
  on public.resources
  for delete
  to authenticated
  using (auth.uid() = user_id);
