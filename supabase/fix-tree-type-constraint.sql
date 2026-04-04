-- Migration: remove the CHECK constraint on topics.tree_type.
--
-- Background:
--   The original schema defined tree_type as:
--     check (tree_type in ('ai', 'fullstack'))
--   This worked when only two hard-coded trees existed.
--   After the add-trees-table migration, tree_id became the real FK.
--   tree_type is now a legacy column kept for backward compatibility only
--   and must accept any text value so AI-generated trees with arbitrary
--   slugs can be inserted without violating the constraint.
--
-- Run this ONCE in the Supabase SQL editor after schema.sql and add-trees-table.sql.

alter table public.topics
  drop constraint if exists topics_tree_type_check;
