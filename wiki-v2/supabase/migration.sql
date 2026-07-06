-- ============================================================
-- Wiki v2 Migration
-- Run this in the Supabase SQL Editor (supabase.com → SQL Editor)
-- ============================================================

-- 1. Add content_type column to notes
alter table notes
  add column if not exists content_type text not null default 'workspace'
    check (content_type in ('article', 'workspace'));

-- 2. Backfill existing notes from content JSON
update notes
set content_type = 'article'
where (content->'attrs'->>'wikiMode') = 'article';

-- 3. Create categories table
create table if not exists categories (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,
  title      text not null,
  color      text,
  created_at timestamptz default now()
);

-- 4. Seed categories (position controls display order; Sonstiges stays last)
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

-- 5. Create note_categories join table
create table if not exists note_categories (
  note_id     uuid references notes(id) on delete cascade,
  category_id uuid references categories(id) on delete cascade,
  primary key (note_id, category_id)
);

-- 6. Enable RLS on new tables
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

-- 7. updated_at auto-trigger
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

-- 8a. Realtime: without this, postgres_changes subscriptions (sidebar "Zuletzt")
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

-- 8b. "Zuletzt"-Verlauf: last_opened_at wird beim Oeffnen der Edit-Seite
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

-- 8. Draft/publish split: `published` holds the frozen public snapshot.
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

-- 9. Profiles: oeffentlich lesbarer Anzeigename pro User. auth.users ist fuer
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
