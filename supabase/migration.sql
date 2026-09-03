-- ============================================================
-- Wiki v2 Migration
-- Run this in the Supabase SQL Editor (supabase.com → SQL Editor)
-- ============================================================

-- 1. Create categories table
create table if not exists categories (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,
  title      text not null,
  color      text,
  created_at timestamptz default now()
);

-- 2. Seed categories (position controls display order; Sonstiges stays last)
alter table categories
  add column if not exists position int not null default 100;

insert into categories (slug, title, color, position) values
  ('technik',      'Technik',      '#0891b2', 1),
  ('philosophie',  'Philosophie',  '#9333ea', 2),
  ('natur',        'Natur',        '#16a34a', 3),
  ('diy',          'DIY',          '#ea580c', 4),
  ('rezepte',      'Rezepte',      '#d97706', 5),
  ('informatik',   'Informatik',   '#ef4444', 6),
  ('wissenschaft', 'Wissenschaft', '#2563eb', 7),
  ('sonstiges',    'Sonstiges',    '#64748b', 99)
on conflict (slug) do update
  set title = excluded.title, color = excluded.color, position = excluded.position;

-- Remove the earlier placeholder categories (also drops their note links)
delete from categories where slug in ('security', 'development', 'ressourcen');

-- 3. Create note_categories join table
create table if not exists note_categories (
  note_id     uuid references notes(id) on delete cascade,
  category_id uuid references categories(id) on delete cascade,
  primary key (note_id, category_id)
);

-- 4. Enable RLS on new tables
alter table categories enable row level security;
alter table note_categories enable row level security;

-- Everyone can read categories
create policy "categories_public_read" on categories
  for select using (true);

-- Everyone can read note_categories for public notes
create policy "note_categories_public_read" on note_categories
  for select using (
    exists (
      select 1 from notes
      where notes.id = note_id and notes.is_public = true
    )
  );

-- Owner can manage their own note_categories
create policy "note_categories_owner_all" on note_categories
  for all using (
    exists (
      select 1 from notes
      where notes.id = note_id and notes.user_id = auth.uid()
    )
  );

-- 5. updated_at auto-trigger
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists notes_updated_at on notes;
create trigger notes_updated_at
  before update on notes
  for each row execute function update_updated_at_column();

-- 6a. Realtime: without this, postgres_changes subscriptions (sidebar "Zuletzt")
--     connect fine but never receive any events.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'notes'
  ) then
    alter publication supabase_realtime add table notes;
  end if;
end $$;

-- 6b. "Zuletzt"-Verlauf: last_opened_at wird beim Oeffnen der Edit-Seite
--     gesetzt. Der updated_at-Trigger ignoriert reine Oeffnen-Updates,
--     sonst wuerde jedes Oeffnen die "geaendert"-Sortierung verfaelschen.
alter table notes
  add column if not exists last_opened_at timestamptz;

create or replace function update_updated_at_column()
returns trigger as $$
begin
  if (to_jsonb(new) - 'last_opened_at' - 'updated_at')
     is distinct from (to_jsonb(old) - 'last_opened_at' - 'updated_at') then
    new.updated_at = now();
  end if;
  return new;
end;
$$ language plpgsql;

-- 6. Draft/publish split: `published` holds the frozen public snapshot.
--    The live note columns are the working draft; public pages read `published`.
alter table notes
  add column if not exists published jsonb;

-- Backfill: existing public notes get a snapshot from their current columns
update notes
set published = jsonb_build_object(
  'title',       title,
  'emoji',       emoji,
  'description', description,
  'content',     content,
  'slug',        slug
)
where is_public = true and published is null;

-- 7. Profiles: oeffentlich lesbarer Anzeigename pro User. auth.users ist fuer
--    Besucher nicht lesbar, daher wird der display_name aus den Auth-Metadaten
--    per Trigger hierher gespiegelt (Autor-Anzeige bei oeffentlichen Inhalten).
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  updated_at   timestamptz default now()
);

alter table profiles enable row level security;

drop policy if exists "profiles_public_read" on profiles;
create policy "profiles_public_read" on profiles
  for select using (true);

-- Sync bei Signup und Metadaten-/E-Mail-Aenderung; Fallback: E-Mail-Prefix
-- (Bestandskonten von vor dem Anzeigename-Feld haben keinen display_name)
create or replace function sync_profile_from_auth()
returns trigger as $$
begin
  insert into profiles (id, display_name, updated_at)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1)),
    now()
  )
  on conflict (id) do update
    set display_name = excluded.display_name, updated_at = now();
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_upsert on auth.users;
create trigger on_auth_user_upsert
  after insert or update of raw_user_meta_data, email on auth.users
  for each row execute function sync_profile_from_auth();

-- Backfill bestehender Konten
insert into profiles (id, display_name)
select id, coalesce(nullif(raw_user_meta_data->>'display_name', ''), split_part(email, '@', 1))
from auth.users
on conflict (id) do update set display_name = excluded.display_name;

-- 8. Public-Regel als DB-Constraint absichern (bisher nur App-Validierung):
--     oeffentliche Notizen brauchen Slug + mindestens eine Kategorie.
--     Slug ist ein einfacher CHECK (gleiche Zeile). Die Kategorie-Pflicht
--     braucht einen Trigger (andere Tabelle) und feuert bewusst nur, wenn
--     die is_public-Spalte selbst im UPDATE steckt -- nicht bei jedem
--     Autosave. Grund: die Edit-Seite synct Kategorien per Delete-dann-
--     Insert bei JEDEM Speichern (auch reinen Entwuerfen); wuerde der
--     Trigger auch bei is_public-unabhaengigen Updates pruefen, wuerde er
--     bei jedem Autosave einer bereits oeffentlichen Notiz kurz auf 0
--     Kategorien (zwischen Delete und Insert) anschlagen und den Speicher-
--     vorgang blockieren. "UPDATE OF is_public" feuert nur, wenn diese
--     Spalte tatsaechlich im SET der Query steht -- bei Draft-Autosaves
--     ist sie nicht dabei.
--
--     Restluecke: Wer alle Kategorien einer bereits oeffentlichen Notiz
--     entfernt, OHNE gleichzeitig is_public anzufassen, wird davon nicht
--     abgefangen (dafuer bräuchte es eine eigene Transaktion/RPC statt der
--     drei separaten Client-Requests, die die App aktuell macht). Die App
--     macht das nirgends, aber ein direkter API-Call koennte es theoretisch.

-- Sicherheitsnetz: bestehende Verstoesse vor dem CHECK entschaerfen
update notes set is_public = false where is_public and slug is null;

alter table notes drop constraint if exists notes_public_requires_slug;
alter table notes add constraint notes_public_requires_slug
  check (not is_public or slug is not null);

create or replace function assert_public_note_has_category(p_note_id uuid)
returns void as $$
declare
  cat_count int;
begin
  select count(*) into cat_count from note_categories where note_id = p_note_id;
  if cat_count = 0 then
    raise exception 'Oeffentliche Notizen brauchen mindestens eine Kategorie (note_id=%)', p_note_id;
  end if;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function trg_notes_require_category_on_publish()
returns trigger as $$
begin
  if new.is_public then
    perform assert_public_note_has_category(new.id);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists notes_require_category_on_publish on notes;
create trigger notes_require_category_on_publish
  after insert or update of is_public on notes
  for each row execute function trg_notes_require_category_on_publish();

-- 9. Single-author wiki + draft/link/public publishing.
--
-- The first existing Supabase account becomes the owner. This is the safe
-- default for this personal wiki's existing installation. Before running this
-- block on a project that already has several accounts, verify the result with:
--   select id, email, created_at from auth.users order by created_at;
-- If necessary, replace the row in wiki_owners with Simon's user id afterwards.
create table if not exists wiki_owners (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists wiki_owners_single_row
  on wiki_owners ((true));

alter table wiki_owners enable row level security;

insert into wiki_owners (user_id)
select id
from auth.users
where not exists (select 1 from wiki_owners)
order by created_at asc
limit 1
on conflict (user_id) do nothing;

create or replace function is_wiki_owner(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user_id is not null
    and exists (select 1 from wiki_owners where user_id = p_user_id);
$$;

revoke all on function is_wiki_owner(uuid) from public;
grant execute on function is_wiki_owner(uuid) to anon, authenticated;

alter table notes
  add column if not exists visibility text not null default 'private',
  add column if not exists published_at timestamptz;

update notes
set visibility = case when is_public then 'public' else 'private' end;

alter table notes drop constraint if exists notes_visibility_check;
alter table notes add constraint notes_visibility_check
  check (visibility in ('private', 'link', 'public'));

update notes
set published_at = coalesce(updated_at, created_at, now())
where published is not null and published_at is null;

-- Keep the legacy is_public column in sync while the app and existing queries
-- migrate to the more expressive visibility column.
create or replace function sync_note_visibility()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    if new.is_public then
      new.visibility := 'public';
    else
      new.is_public := new.visibility = 'public';
    end if;
  elsif new.visibility is distinct from old.visibility then
    new.is_public := new.visibility = 'public';
  elsif new.is_public is distinct from old.is_public then
    new.visibility := case when new.is_public then 'public' else 'private' end;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists notes_sync_visibility on notes;
create trigger notes_sync_visibility
  before insert or update of visibility, is_public on notes
  for each row execute function sync_note_visibility();

create table if not exists note_share_links (
  note_id    uuid primary key references notes(id) on delete cascade,
  token      uuid unique not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table note_share_links enable row level security;
alter table notes enable row level security;
alter table note_categories enable row level security;
alter table profiles enable row level security;

-- Remove legacy permissive policies. PostgreSQL combines permissive policies
-- with OR, so leaving an old multi-user policy behind would defeat owner-only
-- access even if stricter policies were added next to it.
do $$
declare policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('notes', 'note_categories', 'profiles', 'note_share_links')
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  end loop;
end $$;

create policy "notes_owner_select" on notes
  for select using (is_wiki_owner() and user_id = auth.uid());
create policy "notes_owner_insert" on notes
  for insert with check (is_wiki_owner() and user_id = auth.uid());
create policy "notes_owner_update" on notes
  for update using (is_wiki_owner() and user_id = auth.uid())
  with check (is_wiki_owner() and user_id = auth.uid());
create policy "notes_owner_delete" on notes
  for delete using (is_wiki_owner() and user_id = auth.uid());

create policy "note_categories_owner_all" on note_categories
  for all using (
    is_wiki_owner()
    and exists (
      select 1 from notes
      where notes.id = note_id and notes.user_id = auth.uid()
    )
  )
  with check (
    is_wiki_owner()
    and exists (
      select 1 from notes
      where notes.id = note_id and notes.user_id = auth.uid()
    )
  );

create policy "profiles_owner_read" on profiles
  for select using (is_wiki_owner() and id = auth.uid());

create policy "note_share_links_owner_all" on note_share_links
  for all using (
    is_wiki_owner()
    and exists (
      select 1 from notes
      where notes.id = note_id and notes.user_id = auth.uid()
    )
  )
  with check (
    is_wiki_owner()
    and exists (
      select 1 from notes
      where notes.id = note_id and notes.user_id = auth.uid()
    )
  );

-- Any content owned by old public sign-ups is taken offline. No data is
-- deleted; after confirming the owner id it can still be migrated manually.
update notes
set visibility = 'private', is_public = false
where not exists (
  select 1 from wiki_owners where wiki_owners.user_id = notes.user_id
);

-- Atomic publishing keeps categories, frozen snapshot, visibility and secret
-- link consistent. Link visibility deliberately does not require a category,
-- because link-only content never appears in the public library.
create or replace function publish_note(
  p_note_id uuid,
  p_visibility text,
  p_snapshot jsonb,
  p_slug text,
  p_category_ids uuid[] default '{}'::uuid[],
  p_rotate_link boolean default false
)
returns table (result_visibility text, share_token uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  result_token uuid;
begin
  if p_visibility not in ('link', 'public') then
    raise exception 'Ungueltige Sichtbarkeit';
  end if;

  if not is_wiki_owner() or not exists (
    select 1 from notes where id = p_note_id and user_id = auth.uid()
  ) then
    raise exception 'Nicht berechtigt';
  end if;

  if nullif(trim(p_snapshot->>'title'), '') is null then
    raise exception 'Zum Veroeffentlichen ist ein Titel erforderlich';
  end if;

  if p_visibility = 'public' then
    if nullif(trim(p_slug), '') is null then
      raise exception 'Oeffentliche Inhalte brauchen eine URL';
    end if;
    if coalesce(array_length(p_category_ids, 1), 0) = 0 then
      raise exception 'Oeffentliche Inhalte brauchen mindestens eine Kategorie';
    end if;
  end if;

  delete from note_categories where note_id = p_note_id;
  insert into note_categories (note_id, category_id)
  select p_note_id, category_id
  from unnest(coalesce(p_category_ids, '{}'::uuid[])) as category_id;

  update notes
  set title = p_snapshot->>'title',
      emoji = nullif(p_snapshot->>'emoji', ''),
      description = nullif(p_snapshot->>'description', ''),
      content = p_snapshot->'content',
      slug = nullif(trim(p_slug), ''),
      published = p_snapshot,
      visibility = p_visibility,
      is_public = p_visibility = 'public',
      published_at = now()
  where id = p_note_id;

  if p_visibility = 'link' then
    insert into note_share_links (note_id)
    values (p_note_id)
    on conflict (note_id) do update
      set token = case
            when p_rotate_link then gen_random_uuid()
            else note_share_links.token
          end,
          updated_at = now()
    returning token into result_token;
  else
    delete from note_share_links where note_id = p_note_id;
  end if;

  return query select p_visibility, result_token;
end;
$$;

create or replace function set_note_private(p_note_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_wiki_owner() or not exists (
    select 1 from notes where id = p_note_id and user_id = auth.uid()
  ) then
    raise exception 'Nicht berechtigt';
  end if;

  update notes
  set visibility = 'private', is_public = false
  where id = p_note_id;
  delete from note_share_links where note_id = p_note_id;
end;
$$;

create or replace function rotate_note_share_link(p_note_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  result_token uuid;
begin
  if not is_wiki_owner() or not exists (
    select 1 from notes
    where id = p_note_id and user_id = auth.uid() and visibility = 'link'
  ) then
    raise exception 'Nicht berechtigt oder nicht per Link freigegeben';
  end if;

  insert into note_share_links (note_id)
  values (p_note_id)
  on conflict (note_id) do update
    set token = gen_random_uuid(), updated_at = now()
  returning token into result_token;

  return result_token;
end;
$$;

-- Public readers and secret-link readers receive only the frozen snapshot.
-- The live draft columns never pass through either function.
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
  group by n.id, n.user_id, n.published, n.updated_at,
           n.published_at, p.display_name
  order by n.published_at desc nulls last, n.updated_at desc;
$$;

revoke all on function publish_note(uuid, text, jsonb, text, uuid[], boolean) from public;
revoke all on function set_note_private(uuid) from public;
revoke all on function rotate_note_share_link(uuid) from public;
revoke all on function get_public_note(text) from public;
revoke all on function get_shared_note(uuid) from public;
revoke all on function list_public_notes() from public;

grant execute on function publish_note(uuid, text, jsonb, text, uuid[], boolean) to authenticated;
grant execute on function set_note_private(uuid) to authenticated;
grant execute on function rotate_note_share_link(uuid) to authenticated;
grant execute on function get_public_note(text) to anon, authenticated;
grant execute on function get_shared_note(uuid) to anon, authenticated;
grant execute on function list_public_notes() to anon, authenticated;

-- 10. Security and URL hardening (safe to run after an existing block 9).
-- Do not let callers probe arbitrary user ids through the owner helper.
create or replace function is_wiki_owner(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user_id is not null
    and p_user_id = auth.uid()
    and exists (select 1 from wiki_owners where user_id = p_user_id);
$$;

revoke all on function is_wiki_owner(uuid) from public, anon;
grant execute on function is_wiki_owner(uuid) to authenticated;

-- Public URLs are normalized at the publication boundary. Draft autosaves do
-- not touch the frozen snapshot, even when the draft slug is edited later.
create or replace function normalize_public_snapshot_slug()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  normalized_slug text;
begin
  if new.visibility = 'public' or new.is_public then
    normalized_slug := lower(trim(coalesce(new.published->>'slug', new.slug)));
    if normalized_slug is null
       or normalized_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
      raise exception 'Oeffentliche Inhalte brauchen eine gueltige URL';
    end if;

    new.slug := normalized_slug;
    new.published := jsonb_set(
      coalesce(new.published, '{}'::jsonb),
      '{slug}',
      to_jsonb(normalized_slug),
      true
    );
  end if;
  return new;
end;
$$;

drop trigger if exists notes_normalize_public_slug on notes;
create trigger notes_normalize_public_slug
  before insert or update of visibility, is_public, published on notes
  for each row execute function normalize_public_snapshot_slug();

-- `get_public_note` must always resolve to exactly one note. The index also
-- closes the race between two simultaneous publish requests using one slug.
create unique index if not exists notes_public_snapshot_slug_unique
  on notes ((lower(published->>'slug')))
  where visibility = 'public'
    and is_public = true
    and published is not null;
