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

- Drag a block handle to move a section freely on the workspace.
- Drag selected block edges or corners to resize in any direction.
- Drag on empty workspace area to lasso-select multiple blocks.
- Hold `Space` and drag with the left mouse button to pan the workspace.
- Use `Ctrl`/`Cmd` + mouse wheel, or the zoom buttons, to zoom in and out.
- Blocks snap to matching edges of nearby blocks and show alignment guides.

Section positions and dimensions are stored on TipTap section nodes as `x`, `y`, `w`, and `h` attributes.

## Structure

```text
app/
  (dashboard)/notes/new/       new note editor
  (dashboard)/notes/[id]/edit/ edit note editor
  (public)/notes/[id]/         public note view
components/editor/
  Editor.tsx                   TipTap setup, workspace viewport, pan/zoom/lasso
  SectionNode.tsx              section node view, block move/resize/snap
  RightSidebar.tsx             note outline
components/sidebar/
  Sidebar.tsx                  main navigation
lib/supabase/
  client.ts                    browser Supabase client
  server.ts                    server Supabase client
```
