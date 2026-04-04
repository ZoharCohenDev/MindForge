-- Run this after the original schema.sql if you already created the DB.
alter table public.topics add column if not exists sort_order integer not null default 0;
alter table public.topics add column if not exists depth integer not null default 0;
alter table public.topics add column if not exists updated_at timestamptz not null default timezone('utc', now());
alter table public.topics add column if not exists tree_type text not null default 'ai' check (tree_type in ('ai', 'fullstack'));

-- Fix parent_id FK to cascade-delete children when a parent is deleted
alter table public.topics drop constraint if exists topics_parent_id_fkey;
alter table public.topics add constraint topics_parent_id_fkey
  foreign key (parent_id) references public.topics(id) on delete cascade;

-- Notes: add rich-content columns
alter table public.notes add column if not exists code_example text null;
alter table public.notes add column if not exists code_blocks jsonb null;
alter table public.notes add column if not exists math_expression text null;
alter table public.notes add column if not exists sub_expressions jsonb null;

-- Projects: add missing columns
alter table public.projects add column if not exists category text not null default 'personal' check (category in ('work', 'study', 'udemy', 'personal'));
alter table public.projects add column if not exists priority text not null default 'medium' check (priority in ('low', 'medium', 'high'));
alter table public.projects add column if not exists demo_url text null;
alter table public.projects add column if not exists deadline text null;
alter table public.projects add column if not exists lessons_learned text null;

create index if not exists topics_user_parent_idx on public.topics(user_id, parent_id);
create index if not exists notes_topic_id_idx on public.notes(topic_id);

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
