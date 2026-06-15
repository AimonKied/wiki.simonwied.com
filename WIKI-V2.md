# Wiki v2 - Persoenliches Knowledge Management System

## Vision

Eigenes Wiki fuer private und oeffentliche Inhalte. Nutzer koennen zwei Arten von Inhalten erstellen:

- **Artikel**: klassische, lineare Seiten wie in Wiki v1, optimiert fuer Lesen, Rezepte, Guides und Referenzen.
- **Workspace Canvas**: freie Arbeitsflaechen wie der aktuelle v2-Editor mit verschiebbaren Bloecken, Pan und Zoom.

Beide Inhaltstypen koennen privat bleiben oder oeffentlich veroeffentlicht werden. Oeffentliche Inhalte muessen Kategorien haben, damit sie auf der Homepage gefiltert und unter Kategorien gefunden werden koennen, zum Beispiel `Rezepte`, `Security` oder `Development`.

---

## Tech Stack

| Layer | Technologie |
|---|---|
| Framework | **Next.js 16** (App Router, Turbopack) |
| Editor | **TipTap v3** |
| Auth + DB | **Supabase** (PostgreSQL + Row Level Security) |
| Styling | CSS Variables + JetBrains Mono |
| Hosting | **Vercel** |
| Diagramme | **Mermaid** (geplant) |

---

## Inhaltsmodell

### Inhaltstypen

```text
article
  Klassische Wiki-Seite wie v1.
  Soll als ruhiger Lesemodus erscheinen und keine Canvas-Navigation brauchen.

workspace
  Canvas-basierter Editor wie aktuell in v2.
  Bloecke liegen frei auf einer grossen Arbeitsflaeche.
```

### Sichtbarkeit

```text
private
  Nur der eingeloggte Besitzer sieht und bearbeitet den Inhalt.

public
  Jeder kann den Inhalt unter /notes/[slug] lesen.
  Public setzt voraus: slug + mindestens eine Kategorie.
```

### Kategorien

Kategorien sind kuratierte Filter fuer oeffentliche Inhalte. Startkategorien:

- Rezepte
- Security
- Development
- Ressourcen

Kategorien sollen nicht nur Freitext sein, sondern als eigene Datensaetze existieren, damit Filter, Slugs und spaetere Kategorie-Seiten stabil bleiben.

---

## Projektstruktur

```text
wiki-v2/
  app/
    (auth)/login/             Login-Seite
    (dashboard)/              Nur eingeloggt
      create/                 Neuer Artikel oder Workspace
      dashboard/              Private Inhaltsuebersicht
      notes/
        [id]/edit/            Inhalt bearbeiten
    (public)/
      notes/[id]/             Oeffentliche Ansicht per Slug
    layout.tsx
    page.tsx                  Homepage mit Discovery und Kategorie-Filtern
  components/
    editor/
      Editor.tsx              TipTap, Canvas-Viewport, Pan/Zoom/Lasso
      SectionNode.tsx         Canvas-Bloecke: move, resize, snap, z-layer
      RightSidebar.tsx        Workspace-Outline
      EmojiPicker.tsx
      EditorViewer.tsx        Read-only Darstellung
    sidebar/
      Sidebar.tsx             Linke Navigation
  lib/
    supabase/client.ts
    supabase/server.ts
    types.ts
  proxy.ts                    Auth-Middleware
```

---

## Datenbankschema

Aktuell vorhanden:

```sql
notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users NOT NULL,
  title       text NOT NULL DEFAULT 'Untitled',
  emoji       text,
  description text,
  content     jsonb,
  slug        text UNIQUE,
  is_public   boolean DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
)
```

Geplante Erweiterung:

```sql
alter table notes
  add column content_type text not null default 'workspace'
    check (content_type in ('article', 'workspace'));

create table categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  title       text not null,
  color       text,
  created_at  timestamptz default now()
);

create table note_categories (
  note_id     uuid references notes(id) on delete cascade,
  category_id uuid references categories(id) on delete cascade,
  primary key (note_id, category_id)
);
```

Public-Regel:

```text
Wenn is_public = true:
  slug muss gesetzt sein
  mindestens eine Kategorie muss verknuepft sein
```

Diese Regel kann entweder in der App validiert oder spaeter mit Trigger/Constraint abgesichert werden.

---

## Fortschritt

### Erledigt

- Next.js 16 Projekt aufgesetzt
- Supabase SSR Client (Browser + Server)
- Auth Middleware schuetzt Dashboard und Edit-Routen
- Login-Seite
- Dashboard-Layout
- Sidebar-Komponente
- Homepage auf Artikel/Workspace + Kategorien/Discovery ausgerichtet
- TipTap v3 Editor
- Canvas-Workspace fuer Notizen
- Verschiebbare und skalierbare Section-Bloecke
- Lasso-Auswahl
- Panning und Zoom
- Snap-Linien
- Neue Notiz erstellen
- Notiz laden, bearbeiten und loeschen
- Oeffentlich/Privat Toggle
- Slug-Feld fuer oeffentliche Notizen
- Oeffentliche Ansicht unter `/notes/[slug]`
- Auto-Save mit Statusanzeige
- Workspace oeffnet beim Laden zentriert auf vorhandene Inhalte
- `npm run dev` ist durch `cross-env` Windows-kompatibel

### Als Naechstes

- [ ] Supabase-Migration fuer `content_type`, `categories`, `note_categories`
- [ ] New-Note-Flow: Auswahl zwischen Artikel und Workspace speichern
- [ ] Artikel-Editor/Artikel-Layout wie v1 ohne Canvas-Chrome
- [ ] Kategorie-Pflicht bei oeffentlichen Inhalten
- [ ] Kategorie-Auswahl im Edit-Screen
- [ ] Homepage aus echten oeffentlichen DB-Inhalten laden statt statischer Platzhalter
- [ ] Kategorie-Seiten oder Query-Filter fuer echte Daten
- [ ] Sidebar zeigt echte private und oeffentliche Inhalte dynamisch
- [ ] Slug aus Titel vorschlagen
- [ ] `updated_at` Trigger in Supabase
- [ ] 404-Seite fuer nicht existierende Notizen

---

## UX-Regeln

- Private Inhalte erscheinen im Dashboard.
- Oeffentliche Inhalte erscheinen auf der Homepage und in Kategorie-Filtern.
- Artikel sollen beim Lesen wie klassische Wiki-Seiten wirken.
- Workspaces sollen ihre Canvas-Natur behalten: Pan, Zoom, Outline, frei platzierte Bloecke.
- Beim Veroeffentlichen muss klar sichtbar sein, ob ein Inhalt privat oder oeffentlich ist.
- Kategorie-Auswahl soll beim Veroeffentlichen verpflichtend sein, aber bei privaten Inhalten optional bleiben.

---

## Migration bestehender Inhalte

| Aktuelle Seite | Zieltyp | Kategorie | Oeffentlich |
|---|---|---|---|
| git-commands.html | Artikel | Development | Ja |
| web-hacking.html | Artikel | Security | Ja |
| cybertools.html | Artikel | Security | Ja |
| awesome-list.html | Artikel | Ressourcen | Ja |
| linsen-mit-spaetzle.html | Artikel | Rezepte | Ja |
| buttermilk-chicken.html | Artikel | Rezepte | Ja |
| croquetas.html | Artikel | Rezepte | Ja |

---

## Deploy

- [ ] Vercel Projekt anlegen und mit GitHub verknuepfen
- [ ] Supabase-Credentials als Vercel Environment Variables setzen
- [ ] Custom Domain `wiki-v2.simonwied.com` in Vercel konfigurieren
