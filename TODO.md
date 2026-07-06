# TODO

## Goal
wiki-v2 als Beta live auf der Subdomain `wiki.simonwied.com` (Vercel). Repo ist
jetzt geflacht — der App-Code ist Repo-Root, altes v1 liegt in `legacy-v1/`.
Landing-Seite in `app/page.tsx` erklaert die neuen Features und hat einen
Button zur Beta (`/bibliothek`). Details siehe [WIKI.md](WIKI.md) Runde 13/14 +
Deploy-Checkliste.

## Steps
- [x] Root-Landing gebaut (jetzt in `app/page.tsx`), Button zu `/bibliothek`.
- [x] Hosting-Entscheidung: Vercel (Hetzner Webhosting S kann kein Node.js).
- [x] Repo geflacht: `wiki-v2/` existiert nicht mehr, App-Code ist Repo-Root, v1 archiviert in `legacy-v1/`.
- [x] Vercel-Projekt angelegt, Repo importiert.
- [x] Env-Vars in Vercel gesetzt (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
- [x] Custom Domain `wiki.simonwied.com` + DNS-CNAME eingetragen — DNS propagiert noch (2026-07-07).
- [x] DNS propagiert, `wiki.simonwied.com` live getestet (Landing → Beta-Button → `/bibliothek` → Login/Register) — funktioniert (2026-07-07).
- [x] `npm install` + `npm run build` lokal am neuen Repo-Root frisch verifiziert.

Alles erledigt — Beta ist live auf `wiki.simonwied.com`.
