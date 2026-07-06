# Wiki

Next.js 16 app for the browser-based wiki (multi-user: anyone can register and
create articles/workspaces; visibility per note is private or public).

## Development

```bash
npm run dev
```

Open `http://localhost:3000`.

Useful checks:

```bash
npm run lint
npx tsc --noEmit
```

`npx tsc --noEmit` passes with zero errors. `npm run lint` has a handful of
known pre-existing `react-hooks` findings (sync setState in effects) that are
tolerated noise.

## Article Editor

Articles aim for Notion parity: the writing surface is the page (no panel, full
width, the decorative grid is hidden while editing).

- Type `/` on an empty line for the block menu (ranked search); an empty focused
  line shows the hint. Markdown shortcuts work while typing (`#`, `-`, `1.`,
  `[] `, `>`, ` ``` `, `**bold**`).
- Blocks: headings, lists, to-dos (nest with `Tab`), tables, code (highlighted),
  images (upload/URL), toggles, callouts (click the emoji for emoji/color
  picker), quotes, dividers.
- Image uploads are compressed client-side before hitting Supabase Storage
  (max 1600px, WebP 85%, 2 MB stored limit; SVG/GIF pass through unchanged).
- Each block row shows `+` (insert below) and `⠿` on hover; the handle menu has
  "Umwandeln in" and "Duplizieren", dragging reorders.
- A sticky table of contents (H1/H2/H3) sits on the right in the editor and
  the public article view; it tracks the scroll position. Below 1100px it
  becomes a right-hand off-canvas drawer opened via a floating button.
- The public note view (`/notes/[slug]`) renders through the same
  `NoteHeader` component as the editor (`editable={false}`) — Notion share-link
  parity: viewers see the identical page, just without edit controls.
- "Neuer Inhalt" creates the note directly and opens `/notes/[id]/edit` with
  the title focused — there is no separate create page.

## Editor Workspace

The note editor uses a large canvas workspace rather than a narrow document column.

- Drag a block handle (`⠿`) to move a section freely; click it to (de)select, `Shift`+click for multi-select.
- Drag on empty workspace area to lasso-select multiple blocks; selected blocks move, resize, delete and copy together.
- Drag block edges or corners to resize in any direction. With a multi-selection every selected block gets the same delta.
- The element palette on the right edge (canvas only) inserts elements: click adds to the selected block, drag & drop adds to any block.
- Every block has a layer (`z`); the `⤒`/`⤓` buttons bring it to front or send it to back. Layer 0 is the floor — sending back pushes the others up instead of going negative (negative z would paint behind the editor surface and become unreachable).
- "Auto" resets a block to content-sized width/height; new blocks are content-sized by default (max 960px).
- Hold `Space` and drag with the left mouse button to pan; `Ctrl`/`Cmd` + mouse wheel or the zoom buttons zoom.
- Blocks snap to matching edges of nearby blocks and show alignment guides (single-block move/resize only).
- Clicking an entry in the right outline sidebar pans the block animated to the workspace center.

Section geometry is stored on TipTap section nodes as `x`, `y`, `w`, `h` and `z` attributes.
Sections without stored positions render in normal flow once; right after the first
paint a layout pass measures their real heights and migrates them to canvas
coordinates (outside the undo history).

Notes auto-save 1.5 s after the last change with a status indicator; `Ctrl+S` saves
immediately. Closing the tab while a save is pending shows a browser warning.

## Structure

```text
app/
  (dashboard)/dashboard/       workspace overview: filter, search, delete
  (dashboard)/notes/[id]/edit/ note editor (articles + canvas)
  (public)/notes/[id]/         public note view (published snapshot)
components/dashboard/
  NewContentButton.tsx         creates a note and jumps into the editor
  NotesOverview.tsx            dashboard list with filter/search/delete/unpublish
components/editor/
  Editor.tsx                   TipTap setup, workspace viewport, pan/zoom/lasso,
                               element palette, layout migration pass
  ArticleEditor.tsx            linear Notion-style article editor (slash menu)
  NoteHeader.tsx               shared header (emoji/title/description/badges) for
                               edit and public view; `editable` flag toggles
                               inputs vs. static text
  ArticleToc.tsx               sticky table of contents (editor + public view),
                               right-side drawer below 1100px
  SectionNode.tsx              section node view: move/resize/snap, selection store,
                               layers, block controls (+/⠿), clipboard
  ToggleNode.tsx               collapsible toggle block
  CalloutNode.tsx              callout block (emoji + color, document-level picker)
  MediaNodes.tsx               resizable image node (Supabase Storage upload)
  elementPalette.ts            shared block palette + slash-menu ranking
  editorTransforms.ts          line/block transformations shared by both editors
  RightSidebar.tsx             canvas outline, click pans block to workspace center
  EmojiPicker.tsx              emoji picker for note icons
components/sidebar/
  Sidebar.tsx                  main navigation, live "Zuletzt" list; per-note
                               ⋯ menu (delete, unpublish back to private);
                               collapsible at ≥769px (localStorage-persisted,
                               default open — mobile drawer default is closed)
components/
  InlineScript.tsx             theme-init script as a Client Component — must
                               not be a Server Component, or the server/client
                               type ternary never diverges and React warns on
                               every hydration, not just soft navigations
lib/
  createNote.ts                insert new note with per-type default content
  markdownConvert.ts           article Markdown import/export
  supabase/client.ts           browser Supabase client
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
