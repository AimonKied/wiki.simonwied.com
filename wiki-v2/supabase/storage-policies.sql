-- ============================================================
-- Wiki v2 Media Storage
-- Run this in the Supabase SQL Editor AFTER creating the bucket:
--   Storage → New Bucket → Name: wiki-media → Public: ON → Create
-- ============================================================

-- Allow authenticated users to upload to their own folder
create policy "wiki_media_upload"
  on storage.objects for insert
  with check (
    bucket_id = 'wiki-media'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to delete their own files
create policy "wiki_media_delete"
  on storage.objects for delete
  using (
    bucket_id = 'wiki-media'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public read (bucket is already public, but explicit policy)
create policy "wiki_media_public_read"
  on storage.objects for select
  using (bucket_id = 'wiki-media');
