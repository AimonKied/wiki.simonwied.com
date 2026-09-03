-- ============================================================
-- Wiki v2 — Phase 3: Papierkorb, Favoriten, Cover-Bild
-- Einmalig im Supabase SQL Editor ausfuehren (nach migration.sql).
--
-- Alle drei Features brauchen nur je eine Spalte, deshalb eine gemeinsame
-- Migration. Nichts hier loescht Daten.
-- ============================================================

-- 1. Neue Spalten.
--    deleted_at   gesetzt = liegt im Papierkorb (Soft-Delete)
--    is_favorite  angeheftet in der Sidebar
--    cover_url    Kopfbild des Artikels (oeffentliche URL aus wiki-media)
alter table notes
  add column if not exists deleted_at  timestamptz,
  add column if not exists is_favorite boolean not null default false,
  add column if not exists cover_url   text;

-- 2. Die haeufigste Abfrage ist "meine nicht geloeschten Notizen, neueste
--    zuerst". Ein partieller Index laesst die Papierkorb-Zeilen dabei aussen
--    vor, statt sie jedes Mal mitzulesen.
create index if not exists notes_owner_active
  on notes (user_id, updated_at desc)
  where deleted_at is null;

-- 3. Der Slug-Index darf Papierkorb-Zeilen nicht mitzaehlen, sonst blockiert
--    eine weggeworfene Notiz ihren Slug fuer alle Zeit. Das Praedikat aendert
--    sich, deshalb neu anlegen statt "if not exists".
drop index if exists notes_public_snapshot_slug_unique;
create unique index notes_public_snapshot_slug_unique
  on notes ((lower(published->>'slug')))
  where visibility = 'public'
    and is_public = true
    and published is not null
    and deleted_at is null;

-- 4. Lesefunktionen ueberspringen den Papierkorb: eine weggeworfene Notiz ist
--    sofort offline, ein Wiederherstellen bringt sie unveraendert zurueck.
--    Der Rueckgabetyp bleibt gleich, "create or replace" genuegt.
create or replace function get_public_note(p_slug text)
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
    and n.deleted_at is null
    and n.published->>'slug' = p_slug
  limit 1;
$$;

create or replace function get_shared_note(p_token uuid)
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
    and n.deleted_at is null
  limit 1;
$$;

create or replace function list_public_notes()
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
    and n.deleted_at is null
  group by n.id, n.user_id, n.published, n.updated_at,
           n.published_at, p.display_name
  order by n.published_at desc nulls last, n.updated_at desc;
$$;
