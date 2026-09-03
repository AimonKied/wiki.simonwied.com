# [wiki.simonwied.com](https://wiki.simonwied.com)

A personal, single-author wiki for any topic. Only the configured owner can
create or edit content. Readers can access a frozen published snapshot either
publicly through the library or privately through a revocable secret link.

The app uses Next.js 16 and Supabase. Content is created directly in the
browser without a Git workflow. See [WIKI.md](WIKI.md) for the feature roadmap.

## Repository layout

```
├── app/, components/, lib/, public/, supabase/   # The wiki app (this README covers it below)
└── legacy-v1/        # Archived v1 wiki (plain HTML/JS, no longer served)
```

The old static wiki (v1) has been retired: its homepage, templates and the
pull-request contribution flow are gone. `legacy-v1/pages/` keeps the old
content pages as an archive in case some get rebuilt manually in the new
editor; nothing under `legacy-v1/` is linked from the live site.

## License

This project is maintained by [simonwied](https://github.com/aimonkied).

## Development

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

Fill `.env.local` with the project URL and anon key from Supabase before
starting Next.js. Restart the dev server after changing environment values.

Useful checks:

```bash
npm run lint
npx tsc --noEmit
```

Both checks pass with zero errors and zero warnings.

## Single-author access and publishing

Run block 11 of `supabase/migration.sql` after the earlier schema blocks. It:

- creates the `wiki_owners` allowlist and assigns the oldest existing Supabase
  account as the initial owner;
- replaces legacy multi-user RLS policies with owner-only create/edit/delete
  access;
- adds `private`, `link`, and `public` visibility modes;
- creates one revocable secret link per link-published note;
- exposes frozen snapshots through narrow public RPCs, so live draft columns
  are never readable by visitors.

If block 11 was already installed, also run block 12 once. It prevents owner-id
probing, normalizes public URLs and adds a unique index so one public slug can
never resolve to two notes. If index creation reports an existing duplicate,
make one of the conflicting notes private, then run block 12 again.

Verify the selected owner after migrating:

```sql
select u.id, u.email
from wiki_owners o
join auth.users u on u.id = o.user_id;
```

If the oldest account is not the intended owner, replace that row with the
correct user id. Also disable **Allow new users to sign up** in Supabase under
Authentication → Settings. The app itself has no registration UI and rejects
all authenticated non-owner accounts, while the Supabase setting prevents
unused accounts from being created at the authentication endpoint.

Publishing always freezes the current draft. Switching to `private` or
`public` deletes an existing secret link immediately; regenerating a link also
invalidates the previous URL immediately. Link-only content is served from
`/share/[token]` and is never included in the public library.

## Article Editor

Articles aim for Notion parity: the writing surface is the page (no panel, full
width, the decorative grid is hidden while editing).

- Type `/` on an empty line for the block menu (ranked search); an empty focused
  line shows the hint. Markdown shortcuts work while typing (`#`, `-`, `1.`,
  `[] `, `>`, ` ``` `, `**bold**`).
- Blocks: headings, lists, to-dos (nest with `Tab`), tables, code (highlighted),
  images (upload/URL), video (YouTube/Vimeo embed or a video URL — no file
  upload, the image pipeline compresses to WebP under 2 MB), toggles, callouts
  (click the emoji for emoji/color picker), quotes, dividers.
- Image uploads are compressed client-side before hitting Supabase Storage
  (max 1600px, WebP 85%, 2 MB stored limit; SVG/GIF pass through unchanged).
- Each block row shows `+` (insert below) and `⠿` on hover; the handle menu has
  "Umwandeln in" and "Duplizieren", dragging reorders.
- A sticky table of contents (H1/H2/H3) sits on the right in the editor and
  the public article view; it tracks the scroll position. Below 1100px it
  becomes a right-hand drawer opened via a floating button.
- Public (`/notes/[slug]`) and secret-link (`/share/[token]`) views render through the same
  `NoteHeader` component as the editor (`editable={false}`) — Notion share-link
  parity: viewers see the identical page, just without edit controls.
- "Neuer Artikel" creates the article directly and opens `/notes/[id]/edit`
  with the title focused — there is no separate create page. The caret beside
  it offers templates (recipe, how-to, cheatsheet); on mobile the caret is
  hidden and the button stays a plain `+`.
- Selecting blocks follows Notion: click `⠿` selects and opens the menu,
  `Shift`-click extends a range from the anchor, `Ctrl`/`Cmd`-click toggles a
  single block, and dragging text across block boundaries selects them too.
  `Esc` lifts from text to block level, arrow keys move the selection,
  `Ctrl`/`Cmd`+`A` goes text → all blocks, `Ctrl`/`Cmd`+`D` duplicates.
- Images can be pasted or dropped straight into the article; the upload path is
  the same one the palette uses.
- `Ctrl`/`Cmd`+`K` sets a link on the selected text (Notion parity), so the
  quick search sits on `Ctrl`/`Cmd`+`P` instead — it searches your own notes
  (into the editor) or, for visitors, published ones (into the reading view).
- `[[` opens a picker of your own pages and inserts an internal link. Only
  notes with a slug are linkable, since the public route resolves by slug;
  unpublished ones are marked ENTWURF and start working once published.
- Headings get readable anchor ids; TOC entries are real links and clicking one
  writes the anchor into the address bar, so a section can be shared.
- A cover image can be set per article and travels into the published snapshot.
- Deleting moves an article to `/papierkorb` (soft delete via `deleted_at`).
  Trashed articles go offline immediately and restore unchanged, publication
  included. Favourites are pinned above the "Zuletzt" list in the sidebar.
- Public articles list "Verlinkt von" — which other published articles link
  here, found by scanning the published snapshots' JSON.

## Editor

The editor is a single linear document column (`components/editor/ArticleEditor.tsx`).
Each top-level block is a TipTap `section` node; `SectionNode.tsx` renders it with
the hover controls (`+` insert below, `⠿` handle menu) and handles drag-reorder,
cross-block element moves and the block clipboard on Pointer Events, so mouse and
touch share the same code path.

- Drag the `⠿` handle to reorder blocks; click it for the block menu
  ("Umwandeln in", "Farbe", "Duplizieren", "Loeschen"), `Shift`+click to add the
  block to a multi-selection (delete/duplicate/copy act on the whole selection).
- Elements inside a block can be dragged between blocks, or onto empty space
  below the last block to start a new one.
- `Enter` at the end of a block starts the next block, `Backspace` at the very
  start merges it into the one above.

Notes auto-save 1.5 s after the last change with a status indicator; `Ctrl+S` saves
immediately. Closing the tab while a save is pending shows a browser warning.

## Structure

```text
app/
  (dashboard)/dashboard/       article overview: search, move to trash
  (dashboard)/notes/[id]/edit/ article editor
  (dashboard)/papierkorb/      trash: restore or delete permanently
  (public)/bibliothek/         public library (route remains /bibliothek)
  (public)/notes/[id]/         public note view (published snapshot)
  (public)/share/[token]/      secret-link view (published snapshot)
components/dashboard/
  NewContentButton.tsx         creates an article and jumps into the editor
  NotesOverview.tsx            dashboard list with visibility/search/trash
  TrashOverview.tsx            trash list: restore, delete permanently
components/editor/
  ArticleEditor.tsx            linear Notion-style article editor (slash menu)
  NoteHeader.tsx               shared header (emoji/title/description/badges) for
                               edit and public view; `editable` flag toggles
                               inputs vs. static text
  ArticleToc.tsx               sticky table of contents (editor + public view),
                               right-side drawer below 1100px
  SectionNode.tsx              section node view: drag-reorder, selection store,
                               block controls (+/⠿), clipboard
  ToggleNode.tsx               collapsible toggle block
  CalloutNode.tsx              callout block (emoji + color, document-level picker)
  MediaNodes.tsx               resizable image node (Supabase Storage upload)
  VideoNode.tsx                video block: YouTube/Vimeo embed or video file
  elementPalette.ts            shared block palette + slash-menu ranking
  editorTransforms.ts          line/block transformations shared by both editors
  EmojiPicker.tsx              emoji picker for note icons
components/notes/
  PublishedNoteView.tsx        shared public/link snapshot view + backlinks
components/search/
  QuickSearch.tsx              Ctrl/Cmd+P overlay; mounted in the sidebar, so
                               both layouts get it without wiring it twice
components/sidebar/
  Sidebar.tsx                  main navigation, favourites + live "Zuletzt"
                               list; per-note ⋯ menu (favourite, move to trash,
                               unpublish back to private); hosts QuickSearch;
                               collapsible at ≥769px (localStorage-persisted,
                               default open — mobile drawer default is closed)
components/
  InlineScript.tsx             theme-init script as a Client Component — must
                               not be a Server Component, or the server/client
                               type ternary never diverges and React warns on
                               every hydration, not just soft navigations
lib/
  auth/session.ts              cached owner-session lookup for server routes
  editor/markdown.ts           article Markdown import/export
  notes/templates.ts           article templates as TipTap JSON
  notes/create.ts              insert new note with per-type default content
  notes/owner.ts               owner-only note listing queries
  notes/published.ts           public/link snapshot queries
  notes/types.ts               note, category and snapshot types
  supabase/client.ts           browser Supabase client
  supabase/config.ts           validated public Supabase environment
  supabase/server.ts           server Supabase client
  supabase/storage.ts          wiki-media bucket upload + WebP compression
```

Sidebar "Zuletzt" is a real, account-wide open history: opening a note in the
editor (or viewing your own published page) stamps `last_opened_at`; the list
shows only stamped notes, newest first, and stays hidden until something was
opened. Requires blocks 8a (realtime) and 8b (`last_opened_at` + trigger) of
`supabase/migration.sql`. The `updated_at` trigger ignores pure open-stamps so
viewing never reorders the dashboard's "changed" sorting. Edits broadcast
client events, saves trigger a refetch, cross-tab updates come from realtime.
