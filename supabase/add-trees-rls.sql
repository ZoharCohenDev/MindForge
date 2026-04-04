-- Migration: enable Row Level Security on the trees table.
-- Run this in the Supabase SQL editor ONCE, after add-trees-table.sql.
--
-- Without this, any authenticated user can read and modify every other
-- user's trees rows via the PostgREST API. This migration locks that down.

alter table public.trees enable row level security;

create policy "Users can read own trees"
  on public.trees
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own trees"
  on public.trees
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own trees"
  on public.trees
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own trees"
  on public.trees
  for delete
  to authenticated
  using (auth.uid() = user_id);
