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
- [ ] Vercel-Projekt anlegen, Repo importieren (Root Directory = Repo-Root, kein Unterordner mehr).
- [ ] Env-Vars in Vercel setzen: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Werte aus `.env.local`).
- [ ] Custom Domain in Vercel: nur Subdomain `wiki.simonwied.com` hinzufuegen.
- [ ] DNS-CNAME beim Domain-Provider: `wiki.simonwied.com` → `cname.vercel-dns.com`.
- [ ] Deploy abwarten, `wiki.simonwied.com` testen (Landing → Beta-Button → `/bibliothek` → Login/Register).
- [ ] `npm install` + `npm run build` lokal am neuen Repo-Root einmal frisch verifizieren (node_modules/.next wurden beim Flatten geloescht).
