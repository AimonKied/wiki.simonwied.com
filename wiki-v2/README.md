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

Known current check noise:

- `components/editor/RightSidebar.tsx` has a React hooks lint error for synchronous `setState` in an effect.
- `components/editor/Editor.tsx` has a TipTap `BubbleMenu` type mismatch around `tippyOptions`.

## Editor Workspace

The note editor uses a large canvas workspace rather than a narrow document column.

- Drag a block handle (`⠿`) to move a section freely; click it to (de)select, `Shift`+click for multi-select.
- Drag on empty workspace area to lasso-select multiple blocks; selected blocks move, resize, delete and copy together.
- Drag block edges or corners to resize in any direction. With a multi-selection every selected block gets the same delta.
- The element palette on the right edge inserts elements: click adds to the selected block, drag & drop adds to any block.
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
  (dashboard)/notes/new/       new note editor
  (dashboard)/notes/[id]/edit/ edit note editor
  (public)/notes/[id]/         public note view
components/editor/
  Editor.tsx                   TipTap setup, workspace viewport, pan/zoom/lasso,
                               element palette, layout migration pass
  SectionNode.tsx              section node view: move/resize/snap, selection store,
                               layers, element drag & drop, clipboard
  RightSidebar.tsx             note outline, click pans block to workspace center
  EmojiPicker.tsx              emoji picker for note icons
components/sidebar/
  Sidebar.tsx                  main navigation
lib/supabase/
  client.ts                    browser Supabase client
  server.ts                    server Supabase client
```
