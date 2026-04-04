-- Run this in the Supabase SQL Editor to add the new project fields

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS category        TEXT DEFAULT 'personal'
    CHECK (category IN ('work', 'study', 'udemy', 'personal')),
  ADD COLUMN IF NOT EXISTS priority        TEXT DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high')),
  ADD COLUMN IF NOT EXISTS demo_url        TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deadline        TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lessons_learned TEXT DEFAULT NULL;
