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
