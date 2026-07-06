-- ============================================================
-- Wiki v2 Media Storage
-- Run this in the Supabase SQL Editor AFTER creating the bucket:
--   Storage → New Bucket → Name: wiki-media → Public: ON → Create
-- ============================================================

drop policy if exists "wiki_media_upload" on storage.objects;
drop policy if exists "wiki_media_delete" on storage.objects;
drop policy if exists "wiki_media_public_read" on storage.objects;

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

-- Keine SELECT-Policy: Public-Bucket liefert Dateien ueber die oeffentliche URL aus.
-- Eine breite SELECT-Policy wuerde Clients erlauben, alle Dateien zu listen.
