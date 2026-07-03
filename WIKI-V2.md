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
| Media | **Supabase Storage** (Bucket `wiki-media`) |
| Styling | CSS Variables, Dark Mode Toggle; Syne (Headlines), Inter (Body), JetBrains Mono (Code) |
| Hosting | **Vercel** |
| Diagramme | **Mermaid** (geplant) |

---

## Inhaltsmodell

### Inhaltstypen

```text
article
  Klassische Wiki-Seite wie v1.
  Soll als ruhiger Lesemodus erscheinen und keine Canvas-Navigation brauchen.
  Markdown-kompatibel: Artikel koennen als .md importiert und exportiert werden.
  Bloecke entsprechen direkt Markdown-Elementen:
    H2-Headings trennen Sections
    Headings, Paragraphen, Listen, Codeblocks, Blockquotes, Tables, HR, Image, Video
    Toggles werden als <details>/<summary> HTML in MD gespeichert

workspace
  Canvas-basierter Editor wie aktuell in v2.
  Bloecke liegen frei auf einer grossen Arbeitsflaeche.
  Unterstuetzt Toggle-Elemente und Canvas-spezifische Features (Pan, Zoom, Lasso).
  Kein Markdown-Export vorgesehen.
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

Kategorien sind kuratierte Filter fuer oeffentliche Inhalte. Sie existieren als eigene Datensaetze (Tabelle `categories`) mit `position` fuer die Anzeigereihenfolge. Aktuelles Set:

1. Technik
2. Philosophie
3. Natur
4. DIY
5. Rezepte
6. Informatik
7. Wissenschaft
8. Sonstiges (immer zuletzt)

Das fruehere Set (Security, Development, Ressourcen) wurde entfernt.

---

## Projektstruktur

```text
wiki-v2/
  app/
    api/migrate-v1/           v1-HTML → Notiz (nur lokal, nicht in Produktion)
    (auth)/login/             Login-Seite
    (dashboard)/              Nur eingeloggt
      create/                 Typ-Auswahl, dann neuer Artikel oder Workspace
      dashboard/              Private Inhaltsuebersicht
      migrate/                UI fuer v1-Migration
      notes/
        [id]/edit/            Inhalt bearbeiten
    (public)/
      notes/[id]/             Oeffentliche Ansicht per Slug (+ not-found.tsx)
    layout.tsx
    page.tsx                  Homepage "Bibliothek" mit Kategorie- und Typ-Filtern
  components/
    dashboard/
      NewContentButton.tsx    Neuer-Inhalt-Button mit Typ-Auswahl
    editor/
      Editor.tsx              TipTap, Canvas-Viewport, Pan/Zoom/Lasso
      ArticleEditor.tsx       Linearer Block-Editor fuer Artikel (fillHeight, Griff-Popover)
      SectionNode.tsx         Canvas-Bloecke: move, resize, snap, z-layer
      ToggleNode.tsx          Toggle-Element (<details>/<summary>)
      MediaNodes.tsx          Bild/Video-Nodes (Supabase Storage Upload)
      RightSidebar.tsx        Workspace-Outline
      elementPalette.ts       Gemeinsame Element-Palette (Artikel + Canvas)
      editorTransforms.ts     Doc-Transformationen
      EmojiPicker.tsx
      EditorViewer.tsx        Read-only Darstellung
    sidebar/
      Sidebar.tsx             Linke Navigation (letzte Notizen, Neuer-Inhalt-Flyout)
    theme/ThemeToggle.tsx     Dark/Light Toggle
    Logo.tsx                  Wortmarke (theme-adaptiv)
  lib/
    supabase/client.ts
    supabase/server.ts
    supabase/storage.ts       Upload in Bucket wiki-media
    markdownConvert.ts        Markdown-Import/Export fuer Artikel
    v1Parser.ts               v1-HTML → TipTap-Doc
    types.ts
  supabase/
    migration.sql             Schema-Migration (im SQL Editor ausfuehren)
    storage-policies.sql      Storage-Policies fuer wiki-media
  proxy.ts                    Auth-Middleware
```

---

## Datenbankschema

Komplette Migration liegt in `wiki-v2/supabase/migration.sql`. Stand:

```sql
notes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users NOT NULL,
  title        text NOT NULL DEFAULT 'Untitled',
  emoji        text,
  description  text,
  content      jsonb,          -- Arbeitsstand (Draft)
  published    jsonb,          -- eingefrorener oeffentlicher Snapshot
  slug         text UNIQUE,
  is_public    boolean DEFAULT false,
  content_type text NOT NULL DEFAULT 'workspace',  -- 'article' | 'workspace'
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()           -- Auto-Trigger
)

categories (
  id         uuid PRIMARY KEY,
  slug       text UNIQUE NOT NULL,
  title      text NOT NULL,
  color      text,
  position   int NOT NULL DEFAULT 100,  -- Anzeigereihenfolge
  created_at timestamptz
)

note_categories (
  note_id     uuid → notes ON DELETE CASCADE,
  category_id uuid → categories ON DELETE CASCADE,
  PRIMARY KEY (note_id, category_id)
)
```

RLS: Kategorien oeffentlich lesbar; `note_categories` lesbar wenn Notiz public, Owner darf alles.

Draft/Publish-Modell:

```text
content       = Arbeitsstand, Auto-Save schreibt hierhin
published     = Snapshot (title, emoji, description, content, slug)
                wird nur beim expliziten Veroeffentlichen aktualisiert
Oeffentliche Seiten lesen ausschliesslich `published`.
```

Public-Regel (in App validiert):

```text
Wenn is_public = true:
  slug muss gesetzt sein
  mindestens eine Kategorie muss verknuepft sein
```

Storage: Bucket `wiki-media` (public) fuer Bilder/Videos, Policies in `supabase/storage-policies.sql` (Upload/Delete nur im eigenen `user_id`-Ordner).

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

### Erledigt (Runde 2)

- Supabase-Migration SQL erstellt (`supabase/migration.sql`): `content_type`, `categories`, `note_categories`, `updated_at`-Trigger, RLS-Policies
- `content_type` beim Erstellen neuer Notizen in DB gespeichert
- `content_type` im Edit-Screen aus DB geladen (kein Heuristik-Hack mehr)
- Kategorie-Auswahl im Edit-Screen (Pills, Mehrfachauswahl)
- Kategorie-Pflicht bei oeffentlichen Inhalten (Validierung vor dem Speichern)
- Slug wird automatisch aus dem Titel vorgeschlagen; manuelle Bearbeitung moglich
- Homepage laedt oeffentliche Inhalte aus der DB (mit Kategorien via Join)
- Kategorie- und Typfilter auf der Homepage funktionieren mit echten Daten
- Sidebar zeigt die letzten 30 Notizen des eingeloggten Nutzers dynamisch
- 404-Seite fuer nicht existierende oeffentliche Notizen (`not-found.tsx`)
- Oeffentliche Notiz-Ansicht und Dashboard nutzen `content_type` aus DB direkt
- Artikel-Editor hat dasselbe Text-Format-BubbleMenu wie der Canvas-Editor (Schriftart, -groesse, Farbe, Hintergrundfarbe, B/I/U/S/Code, H1/H2/H3/Tx)

### Erledigt (Runde 3)

- Draft/Published-Trennung: Auto-Save als Entwurf, explizites Veroeffentlichen friert Snapshot ein, oeffentliche Seiten lesen nur den Snapshot
- Veroeffentlichen-Modal (Fullscreen-Overlay mit Portal + Blur)
- Neue Notizen werden explizit privat angelegt
- `/create` ohne Typ zeigt Auswahl (Artikel/Workspace) statt Default
- Neuer-Inhalt-Button im Dashboard und als Sidebar-Flyout
- Dark Mode + ThemeToggle
- Typografie: Syne (Headlines), Inter (Body), JetBrains Mono nur fuer Code
- Logo-Wortmarke in der Sidebar (theme-adaptiv)
- Homepage heisst "Bibliothek"; Kategorie-Pills gruen bei aktiv, Typ-Filter abwaehlbar
- Neues Kategorien-Set (Technik…Sonstiges) mit `position`-Sortierung
- Lock-Icon fuer private Notizen im Dashboard
- Artikel-Editor: lineare Section-Bloecke, gemeinsame Element-Palette mit Canvas, Notion-artiges Griff-Popover, Platzhaltertext, fillHeight-Modus (Editor fuellt Viewport, interne Scroll-Flaeche)
- Markdown-Import/Export fuer Artikel (`lib/markdownConvert.ts`)
- Bild/Video-Upload in Supabase Storage (`wiki-media`, MediaNodes)
- Toggle-Element (`ToggleNode`)
- v1-Migrations-Tooling: `/migrate`-Seite + `api/migrate-v1` + `lib/v1Parser.ts` (nur lokal nutzbar)
- Hydration-Mismatch in Sidebar behoben

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

Tooling ist fertig (`/migrate`-Seite, nur lokal). Zielkategorien auf das neue Set gemappt:

| Aktuelle Seite | Zieltyp | Kategorie (neu) | Oeffentlich |
|---|---|---|---|
| git-commands.html | Artikel | Informatik | Ja |
| web-hacking.html | Artikel | Informatik | Ja |
| cybertools.html | Artikel | Informatik | Ja |
| awesome-list.html | Artikel | Sonstiges | Ja |
| linsen-mit-spaetzle.html | Artikel | Rezepte | Ja |
| buttermilk-chicken.html | Artikel | Rezepte | Ja |
| croquetas.html | Artikel | Rezepte | Ja |

Kategorie-Slugs in `migrate/page.tsx` sind auf das neue Set umgestellt. Die Migrations-Route setzt bei oeffentlichen Artikeln direkt den `published`-Snapshot, damit sie sofort unter `/notes/[slug]` sichtbar sind.

---

## Offene Punkte

### Migration

- [x] Kategorie-Slugs in `migrate/page.tsx` auf neues Set umstellen (siehe Tabelle oben)
- [x] Migrations-Route setzt `published`-Snapshot fuer oeffentliche Artikel
- [ ] v1-Inhalte lokal ueber `/migrate` in die DB migrieren und Ergebnis pruefen

### Deploy

- [ ] Vercel Projekt anlegen und mit GitHub verknuepfen
- [ ] Supabase-Credentials als Vercel Environment Variables setzen
- [ ] Custom Domain `wiki-v2.simonwied.com` in Vercel konfigurieren

### Danach / Nice-to-have

- [ ] Mermaid-Diagramme (geplant laut Tech Stack)
- [ ] Kategorie-Seiten (eigene Route pro Kategorie-Slug)
- [ ] Public-Regel per DB-Trigger/Constraint absichern (aktuell nur App-Validierung)
- [ ] Bekannte TS-Fehler fixen (10 gesamt, alle pre-existing): `tippyOptions` am Table-BubbleMenu in `Editor.tsx`, `never`-Typen in `SectionNode.tsx`, `ImageOptions` in `MediaNodes.tsx`
- [ ] v1-Wiki abloesen: Redirects/Aufraeumen der alten HTML-Seiten nach erfolgreicher Migration
