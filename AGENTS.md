<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project notes

- This repo is the Next.js + Supabase + TipTap app. Editor/workspace docs live in [README.md](README.md), the feature roadmap in [WIKI.md](WIKI.md).
- Type check with `npx tsc --noEmit` — it must pass with zero errors.
- Commit style: `TYPE(scope): summary` (`FEAT`, `FIX`, `DOCS`, …). Never add `Co-Authored-By` trailers.
