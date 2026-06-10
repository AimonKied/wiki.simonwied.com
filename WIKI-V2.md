# Wiki v2 — Persönliches Knowledge Management System

## Vision

Eigenes Notion-ähnliches Wiki, vollständig im Browser bedienbar.
Notizen von überall erstellen, bearbeiten und verwalten — mit Login und privaten/öffentlichen Inhalten.

---

## Tech Stack

| Layer | Technologie | Begründung |
|---|---|---|
| Framework | **Next.js 14** (App Router) | Routing, SSR, API Routes in einem |
| Editor | **TipTap** | Notion-ähnlicher Block-Editor, Open Source, erweiterbar |
| Auth + DB | **Supabase** | Login, Datenbank (PostgreSQL), Storage — kostenlos startbar |
| Styling | **Tailwind CSS** + eigene Design Tokens | Schnell, konsistent, bestehende Farben übertragbar |
| Hosting | **Vercel** | Zero-Config Deploy, von überall erreichbar |
| Diagramme | **Mermaid** (TipTap Extension) | Code-basierte Diagramme direkt im Editor |

---

## Core Features

### Authentifizierung
- E-Mail + Passwort Login
- Nur für den Owner (kein öffentliches Registrieren)
- Eingeloggt: Zugriff auf alle Notizen (privat + öffentlich)
- Ausgeloggt: Nur öffentliche Notizen sichtbar

### Editor
- Block-basierter Editor (wie Notion)
- Unterstützte Blocks:
  - Text, Überschriften (H1–H3)
  - Code Blocks mit Syntax Highlighting
  - Tabellen
  - Aufzählungen & nummerierte Listen
  - Mermaid Diagramme
  - Bilder / Medien
  - Divider
- Drag & Drop zum Umsortieren von Blocks
- Slash-Command Menü (`/`) zum Einfügen von Blocks

### Notizen-Verwaltung
- Kategorien / Collections (Security, Development, Rezepte, etc.)
- Privat / Öffentlich Toggle pro Notiz
- Tags für Notizen
- Suche über alle Notizen
- Sidebar-Navigation wie aktuelles Wiki

### Design
- Bestehendes Design (JetBrains Mono, Farbpalette, Grid-Hintergrund) übernehmen
- Dark Mode (bereits vorhanden)
- Responsiv

---

## Datenbankschema (Supabase)

```sql
-- Notizen
notes (
  id          uuid PRIMARY KEY,
  title       text,
  content     jsonb,       -- TipTap JSON
  slug        text UNIQUE,
  is_public   boolean DEFAULT false,
  category    text,
  tags        text[],
  created_at  timestamp,
  updated_at  timestamp,
  user_id     uuid REFERENCES auth.users
)

-- Kategorien
categories (
  id    uuid PRIMARY KEY,
  name  text,
  color text,
  icon  text
)
```

---

## Architektur

```
app/
├── (public)/
│   ├── page.tsx              -- Homepage (öffentliche Notizen)
│   └── notes/[slug]/
│       └── page.tsx          -- Öffentliche Notiz
├── (auth)/
│   └── login/
│       └── page.tsx          -- Login
├── (dashboard)/              -- Nur eingeloggt
│   ├── dashboard/
│   │   └── page.tsx          -- Alle Notizen
│   └── notes/
│       ├── new/page.tsx      -- Neue Notiz erstellen
│       └── [id]/edit/
│           └── page.tsx      -- Notiz bearbeiten
├── api/
│   └── notes/                -- API Routes
components/
├── editor/                   -- TipTap Editor Komponenten
├── sidebar/                  -- Navigation
├── ui/                       -- Buttons, Cards, etc.
lib/
├── supabase/                 -- Supabase Client
└── utils/
```

---

## Entwicklungs-Phasen

### Phase 1 — Grundgerüst
- [ ] Next.js Projekt aufsetzen
- [ ] Supabase Projekt + Datenbankschema
- [ ] Login / Auth Flow
- [ ] Basis-Layout (Sidebar, Navigation) — aus aktuellem Wiki übernehmen

### Phase 2 — Editor
- [ ] TipTap Integration
- [ ] Basis-Blocks (Text, Überschriften, Code, Listen)
- [ ] Notiz speichern / laden
- [ ] Privat / Öffentlich Toggle

### Phase 3 — Features
- [ ] Drag & Drop (Blocks + Sidebar-Reihenfolge)
- [ ] Mermaid Diagramme
- [ ] Tabellen
- [ ] Suche
- [ ] Tags & Kategorien

### Phase 4 — Migration & Polish
- [ ] Bestehende Wiki-Seiten als Notizen migrieren
- [ ] Design verfeinern
- [ ] Mobile Ansicht
- [ ] Deploy auf Vercel

---

## Migration bestehender Inhalte

Die aktuellen HTML-Seiten werden als erste Notizen in die neue Datenbank migriert:

| Aktuelle Seite | Neue Kategorie | Öffentlich |
|---|---|---|
| git-commands.html | Development | ✅ |
| web-hacking.html | Security | ✅ |
| cybertools.html | Security | ✅ |
| awesome-list.html | Ressourcen | ✅ |
| linsen-mit-spaetzle.html | Rezepte | ✅ |
| buttermilk-chicken.html | Rezepte | ✅ |
| croquetas.html | Rezepte | ✅ |
