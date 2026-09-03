-- ============================================================
-- Wiki v2 — Autorenanzeige entfernen
-- Einmalig im Supabase SQL Editor ausfuehren (nach migration.sql).
--
-- profiles existierte nur, um den Anzeigenamen oeffentlich lesbar zu machen
-- (auth.users ist fuer Besucher gesperrt), damit unter oeffentlichen Artikeln
-- "Von {Name}" stehen kann. Bei genau einem Autor steht dort auf jeder Seite
-- dieselbe Zeile -- die Anzeige und mit ihr die ganze Tabelle faellt weg.
--
-- Es gehen keine Inhalte verloren: profiles war eine reine Spiegelung aus
-- auth.users und laesst sich daraus jederzeit wieder herstellen.
-- ============================================================

-- 1. Trigger und Spiegelfunktion zuerst, sonst schreibt der Trigger beim
--    naechsten Login in eine Tabelle, die es nicht mehr gibt.
drop trigger if exists on_auth_user_upsert on auth.users;
drop function if exists sync_profile_from_auth();

-- 2. Lesefunktionen ohne author_name. Der Rueckgabetyp aendert sich, deshalb
--    erst droppen -- "create or replace" wuerde hier scheitern.
drop function if exists get_public_note(text);
drop function if exists get_shared_note(uuid);
drop function if exists list_public_notes();

create function get_public_note(p_slug text)
returns table (
  note_id uuid,
  user_id uuid,
  published jsonb,
  updated_at timestamptz,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select n.id, n.user_id, n.published, n.updated_at, n.published_at
  from notes n
  where n.visibility = 'public'
    and n.is_public = true
    and n.published is not null
    and n.deleted_at is null
    and n.published->>'slug' = p_slug
  limit 1;
$$;

create function get_shared_note(p_token uuid)
returns table (
  note_id uuid,
  user_id uuid,
  published jsonb,
  updated_at timestamptz,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select n.id, n.user_id, n.published, n.updated_at, n.published_at
  from note_share_links link
  join notes n on n.id = link.note_id
  where link.token = p_token
    and n.visibility = 'link'
    and n.published is not null
    and n.deleted_at is null
  limit 1;
$$;

create function list_public_notes()
returns table (
  note_id uuid,
  user_id uuid,
  published jsonb,
  updated_at timestamptz,
  published_at timestamptz,
  categories jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select n.id, n.user_id, n.published, n.updated_at, n.published_at,
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
  left join note_categories nc on nc.note_id = n.id
  left join categories c on c.id = nc.category_id
  where n.visibility = 'public'
    and n.is_public = true
    and n.published is not null
    and n.deleted_at is null
  group by n.id, n.user_id, n.published, n.updated_at, n.published_at
  order by n.published_at desc nulls last, n.updated_at desc;
$$;

revoke all on function get_public_note(text) from public;
revoke all on function get_shared_note(uuid) from public;
revoke all on function list_public_notes() from public;

grant execute on function get_public_note(text) to anon, authenticated;
grant execute on function get_shared_note(uuid) to anon, authenticated;
grant execute on function list_public_notes() to anon, authenticated;

-- 3. Erst jetzt die Tabelle: bis hierher haben die alten Funktionen noch
--    darauf gezeigt.
drop table if exists profiles;
