# Wiki v2

Next.js 16 app for the browser-based personal wiki.

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

Known current check noise (10 pre-existing type errors):

- `components/editor/Editor.tsx`: TipTap `BubbleMenu` type mismatch around `tippyOptions`.
- `components/editor/SectionNode.tsx`: `never`-typed positions in a selection helper.
- `components/editor/MediaNodes.tsx`: `ImageOptions` signature mismatch.

## Article Editor

Articles aim for Notion parity: the writing surface is the page (no panel, full
width, the decorative grid is hidden while editing).

- Type `/` on an empty line for the block menu (ranked search); an empty focused
  line shows the hint. Markdown shortcuts work while typing (`#`, `-`, `1.`,
  `[] `, `>`, ` ``` `, `**bold**`).
- Blocks: headings, lists, to-dos (nest with `Tab`), tables, code (highlighted),
  images (upload/URL), toggles, callouts (click the emoji for emoji/color
  picker), quotes, dividers.
- Each block row shows `+` (insert below) and `⠿` on hover; the handle menu has
  "Umwandeln in" and "Duplizieren", dragging reorders.
- A sticky table of contents (H2/H3) sits on the right in the editor and the
  public article view; it tracks the scroll position.
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
  (dashboard)/migrate/         one-off v1 HTML import (local only)
  (public)/notes/[id]/         public note view (published snapshot)
components/dashboard/
  NewContentButton.tsx         creates a note and jumps into the editor
  NotesOverview.tsx            dashboard list with filter/search/delete
components/editor/
  Editor.tsx                   TipTap setup, workspace viewport, pan/zoom/lasso,
                               element palette, layout migration pass
  ArticleEditor.tsx            linear Notion-style article editor (slash menu)
  ArticleToc.tsx               sticky table of contents (editor + public view)
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
  Sidebar.tsx                  main navigation, live "Zuletzt" list
lib/
  createNote.ts                insert new note with per-type default content
  markdownConvert.ts           article Markdown import/export
  v1Parser.ts                  v1 HTML → TipTap doc
  supabase/client.ts           browser Supabase client
  supabase/server.ts           server Supabase client
  supabase/storage.ts          wiki-media bucket upload
```

Sidebar "Zuletzt" is live: edits broadcast client events, saves trigger a refetch,
and cross-tab updates come from Supabase realtime (requires block 8a of
`supabase/migration.sql` to be run once).
