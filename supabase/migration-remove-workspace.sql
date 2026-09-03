-- ============================================================
-- Wiki v2 — Workspace-Canvas entfernen
-- Einmalig im Supabase SQL Editor ausfuehren (nach migration.sql).
-- Danach ist das Wiki reine Artikel-Software: kein content_type mehr,
-- keine Canvas-Notizen.
--
-- ACHTUNG: Schritt 1 loescht Inhalte unwiderruflich. Vorher pruefen:
--   select id, title, updated_at from notes where content_type = 'workspace';
--
-- Bilder im Bucket wiki-media liegen unter user_id/uuid.ext und haengen an
-- keiner note_id — die Objekte geloeschter Canvas-Notizen bleiben als
-- Karteileichen im Bucket zurueck und muessen bei Bedarf von Hand weg.
-- ============================================================

-- 1. Canvas-Notizen loeschen (note_categories und note_share_links haengen
--    per on delete cascade daran und verschwinden mit).
delete from notes
where content_type = 'workspace';

-- 2. Spalte entfernen. Der Check-Constraint faellt mit der Spalte weg.
alter table notes
  drop column if exists content_type;

-- 3. Lesefunktionen ohne content_type neu anlegen. Der Rueckgabetyp aendert
--    sich, deshalb erst droppen — "create or replace" wuerde hier scheitern.
drop function if exists get_public_note(text);
drop function if exists get_shared_note(uuid);
drop function if exists list_public_notes();

create function get_public_note(p_slug text)
returns table (
  note_id uuid,
  user_id uuid,
  published jsonb,
  updated_at timestamptz,
  published_at timestamptz,
  author_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select n.id, n.user_id, n.published, n.updated_at,
         n.published_at, p.display_name
  from notes n
  left join profiles p on p.id = n.user_id
  where n.visibility = 'public'
    and n.is_public = true
    and n.published is not null
    and n.published->>'slug' = p_slug
  limit 1;
$$;

create function get_shared_note(p_token uuid)
returns table (
  note_id uuid,
  user_id uuid,
  published jsonb,
  updated_at timestamptz,
  published_at timestamptz,
  author_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select n.id, n.user_id, n.published, n.updated_at,
         n.published_at, p.display_name
  from note_share_links link
  join notes n on n.id = link.note_id
  left join profiles p on p.id = n.user_id
  where link.token = p_token
    and n.visibility = 'link'
    and n.published is not null
  limit 1;
$$;

create function list_public_notes()
returns table (
  note_id uuid,
  user_id uuid,
  published jsonb,
  updated_at timestamptz,
  published_at timestamptz,
  author_name text,
  categories jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select n.id, n.user_id, n.published, n.updated_at,
         n.published_at, p.display_name,
         coalesce(
           jsonb_agg(
             jsonb_build_object(
               'id', c.id,
               'slug', c.slug,
               'title', c.title,
               'color', c.color,
               'position', c.position,
               'created_at', c.created_at
             ) order by c.position, c.title
           ) filter (where c.id is not null),
           '[]'::jsonb
         )
  from notes n
  left join profiles p on p.id = n.user_id
  left join note_categories nc on nc.note_id = n.id
  left join categories c on c.id = nc.category_id
  where n.visibility = 'public'
    and n.is_public = true
    and n.published is not null
  group by n.id, n.user_id, n.published, n.updated_at,
           n.published_at, p.display_name
  order by n.published_at desc nulls last, n.updated_at desc;
$$;

revoke all on function get_public_note(text) from public;
revoke all on function get_shared_note(uuid) from public;
revoke all on function list_public_notes() from public;

grant execute on function get_public_note(text) to anon, authenticated;
grant execute on function get_shared_note(uuid) to anon, authenticated;
grant execute on function list_public_notes() to anon, authenticated;
