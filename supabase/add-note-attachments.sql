-- ─── Note attachments ────────────────────────────────────────────────────────
-- Run this in the Supabase SQL editor for existing databases.

-- 1. Add attachments column to notes
alter table public.notes
  add column if not exists attachments jsonb null;

-- 2. Create storage bucket (public so signed URLs are not needed)
insert into storage.buckets (id, name, public)
values ('note-attachments', 'note-attachments', true)
on conflict (id) do nothing;

-- 3. RLS policies for objects in the bucket
--    Path convention: {user_id}/{uuid}ס.{ext}

create policy "note_attachments_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'note-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "note_attachments_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'note-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "note_attachments_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'note-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
