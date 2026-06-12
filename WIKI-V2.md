# Wiki v2 — Persönliches Knowledge Management System

## Vision

Eigenes Notion-ähnliches Wiki, vollständig im Browser bedienbar.
Notizen von überall erstellen, bearbeiten und verwalten — mit Login und privaten/öffentlichen Inhalten.

---

## Tech Stack

| Layer | Technologie |
|---|---|
| Framework | **Next.js 16** (App Router, Turbopack) |
| Editor | **TipTap v3** |
| Auth + DB | **Supabase** (PostgreSQL + Row Level Security) |
| Styling | CSS Variables + JetBrains Mono (kein Tailwind-Utility-First) |
| Hosting | **Vercel** |
| Diagramme | **Mermaid** (geplant) |

---

## Projektstruktur (aktuell)

```
wiki-v2/
├── app/
│   ├── (auth)/login/             -- Login-Seite
│   ├── (dashboard)/              -- Nur eingeloggt
│   │   ├── dashboard/            -- Notizen-Übersicht
│   │   └── notes/
│   │       ├── new/              -- Neue Notiz
│   │       └── [id]/edit/        -- Notiz bearbeiten
│   ├── (public)/
│   │   └── notes/[id]/           -- Öffentliche Notiz-Ansicht (via Slug)
│   ├── layout.tsx
│   └── page.tsx                  -- Homepage
├── components/
│   ├── editor/
│   │   ├── Editor.tsx            -- TipTap-Setup, Workspace-Viewport, Pan/Zoom/Lasso, Element-Palette
│   │   ├── SectionNode.tsx       -- Section-NodeView: Verschieben, Resize, Snap, Ebenen, Auswahl
│   │   ├── RightSidebar.tsx      -- Outline der Blöcke (Klick zentriert Block im Workspace)
│   │   ├── EmojiPicker.tsx       -- Emoji-Auswahl für Notiz-Icons
│   │   └── EditorViewer.tsx      -- Read-only Client-Wrapper
│   └── sidebar/
│       └── Sidebar.tsx
├── lib/
│   ├── supabase/client.ts
│   ├── supabase/server.ts
│   └── types.ts
└── proxy.ts                      -- Auth-Middleware (Next.js 16)
```

---

## Datenbankschema (Supabase)

```sql
notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users NOT NULL,
  title       text NOT NULL DEFAULT 'Untitled',
  content     jsonb,
  slug        text UNIQUE,
  is_public   boolean DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
)
-- Row Level Security aktiv
```

Noch nicht angelegt:
```sql
-- categories (geplant)
-- tags (geplant)
```

---

## Fortschritt

### ✅ Phase 1 — Grundgerüst
- Next.js 16 Projekt aufgesetzt
- Supabase SSR Client (Browser + Server)
- Auth Middleware (proxy.ts) — schützt /dashboard und /notes/*/edit
- Login-Seite (E-Mail + Passwort)
- Dashboard-Layout mit Session-Guard
- Sidebar-Komponente mit Nav-Sektionen
- Homepage mit Kategorie-Karten
- Design-System (CSS Variables, JetBrains Mono, Grid-Hintergrund)

### ✅ Phase 2 — Editor
- TipTap v3 Editor mit Toolbar (Bold, Italic, Underline, Strike, H1–H3, Listen, Code, Blockquote)
- Syntax Highlighting via lowlight
- Tabellen-Support
- Canvas-Workspace fuer Notizen:
  - grosse Arbeitsflaeche mit verschiebbaren und skalierbaren Section-Bloecken
  - Lasso-Auswahl fuer mehrere Bloecke auf der Workspace-Flaeche
  - Panning mit Space + linker Maustaste
  - Zoom per Ctrl/Cmd + Mausrad sowie Zoom-Buttons
  - Snap-Linien beim Ausrichten an anderen Bloecken
- Neue Notiz erstellen + in Supabase speichern
- Notiz laden und bearbeiten
- Strg+S zum Speichern

### ✅ Phase 3 — Basis-Features
- Öffentlich/Privat Toggle pro Notiz
- Slug-Feld für öffentliche Notizen
- Öffentliche Notiz-Ansicht unter `/notes/[slug]`
- Notiz löschen

### ✅ Phase 4 — Canvas-Editor Ausbau
- Element-Palette am Workspace-Rand (Klick fügt in markierten Block ein, Drag & Drop auf beliebigen Block)
- Mehrfachauswahl: gemeinsames Verschieben, Resizen, Löschen, Kopieren (Lasso oder Shift+Klick)
- Ebenen pro Block (`z`-Attribut) mit „In den Vordergrund / In den Hintergrund" (Ebene 0 ist der Boden)
- Auto-Größe-Button; neue Blöcke passen sich dem Inhalt an (fit-content, max. 960px)
- Layout-Migration alter Notizen: Blöcke werden nach dem ersten Render mit echten Höhen auf die Canvas übertragen (kein Überlappen, nicht im Undo-Verlauf)
- Sidebar-Outline: Klick zentriert den Block animiert im Workspace
- Auto-Save: 1,5 s Debounce, Statusanzeige (Gespeichert / fehlgeschlagen), Warnung beim Tab-Schließen, Strg+S speichert sofort
- Copy/Cut/Paste für Blöcke und Elemente, globales Undo/Redo, Delete/Backspace entfernt Auswahl

---

## Offen — vor dem Go-Live

### Funktional (muss)
- [ ] Sidebar zeigt echte Notizen aus der DB (dynamisch, nicht hardcoded)
- [ ] Kategorien / Collections für Notizen (Security, Development, Rezepte, …)
- [ ] Notiz-Titel bei Erstellung als Slug vorschlagen (auto-generieren)
- [ ] `updated_at` Trigger in Supabase (automatisch bei UPDATE setzen)
- [x] Fehlerbehandlung beim Speichern (Status „Speichern fehlgeschlagen", Auto-Save mit Debounce)
- [ ] 404-Seite für nicht existierende Notizen

### Editor (muss)
- [ ] Slash-Command Menü (`/heading`, `/code`, `/table`, …)
- [ ] Mermaid Diagramme
- [x] Bilder per URL einfügen
- [ ] Bild-Upload via Supabase Storage
- [x] Drag & Drop Blocks als Canvas-Blöcke
- [x] Resize für Blocks in alle Richtungen (auch Mehrfachauswahl)
- [x] Workspace Pan/Zoom
- [x] Auto-Save

### Design / UX (muss)
- [ ] Mobile-Ansicht (Sidebar ausblendbar)
- [ ] Ladeanimation / Skeleton beim Laden von Notizen
- [ ] Öffentliche Notizen-Ansicht: schöneres Layout (kein Editor-Chrome)
- [ ] Dashboard: Suche über Notizen
- [ ] Hover-Effekte auf Dashboard-Notiz-Karten

### Sicherheit (muss vor Go-Live)
- [ ] Supabase User nur manuell über Dashboard anlegen (kein öffentliches Signup)
- [ ] RLS Policies testen (kann ein fremder User meine Notizen lesen/schreiben?)
- [ ] `.env.local` niemals committen (bereits in .gitignore)

### Migration (kann warten)
- [ ] Bestehende HTML-Seiten als Notizen migrieren
- [ ] Wiki v1 (wiki.simonwied.com) auf Wiki v2 umleiten

### Deploy
- [ ] Vercel Projekt anlegen und mit GitHub verknüpfen
- [ ] Supabase-Credentials als Vercel Environment Variables setzen
- [ ] Custom Domain `wiki-v2.simonwied.com` in Vercel konfigurieren

---

## Migration bestehender Inhalte (später)

| Aktuelle Seite | Kategorie | Öffentlich |
|---|---|---|
| git-commands.html | Development | ✅ |
| web-hacking.html | Security | ✅ |
| cybertools.html | Security | ✅ |
| awesome-list.html | Ressourcen | ✅ |
| linsen-mit-spaetzle.html | Rezepte | ✅ |
| buttermilk-chicken.html | Rezepte | ✅ |
| croquetas.html | Rezepte | ✅ |
