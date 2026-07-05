# Wiki v2 - Persoenliches Knowledge Management System

## Vision

Eigenes Wiki fuer private und oeffentliche Inhalte. Nutzer koennen zwei Arten von Inhalten erstellen:

- **Artikel**: sollen sich so nah wie moeglich an Notion anfuehlen — Block-Editor mit Slash-Menue, Drag-Handle, allen gaengigen Block-Typen und interner Verlinkung. Leitfrage bei jedem Artikel-Feature: "Wie macht Notion das?"
- **Workspace Canvas**: das Alleinstellungsmerkmal gegenueber Notion — freie Arbeitsflaechen mit verschiebbaren Bloecken, Pan und Zoom. Bleibt bewusst eigenstaendig.

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
      dashboard/              Arbeitsbereich: Filter, Suche, Loeschen
      migrate/                UI fuer v1-Migration
      notes/
        [id]/edit/            Inhalt bearbeiten ("Neuer Inhalt" legt an und springt direkt hierher; keine /create-Seite mehr)
    (public)/
      notes/[id]/             Oeffentliche Ansicht per Slug (+ not-found.tsx)
    layout.tsx
    page.tsx                  Homepage "Bibliothek" mit Kategorie- und Typ-Filtern
  components/
    dashboard/
      NewContentButton.tsx    Neuer-Inhalt-Button (legt Notiz an, springt in Editor)
      NotesOverview.tsx       Arbeitsbereich-Liste: Typ-Filter, Suche, Loeschen-Menue
    editor/
      Editor.tsx              TipTap, Canvas-Viewport, Pan/Zoom/Lasso
      ArticleEditor.tsx       Linearer Block-Editor fuer Artikel (Notion-Stil: Slash-Menue, volle Breite, kein Panel)
      ArticleToc.tsx          Inhaltsverzeichnis rechts (sticky, H2/H3, Scroll-Tracking)
      SectionNode.tsx         Canvas-Bloecke: move, resize, snap, z-layer; Block-Controls (+/⠿)
      ToggleNode.tsx          Toggle-Element (<details>/<summary>)
      CalloutNode.tsx         Callout-Block (Emoji + Farbe, Picker als Dokument-Overlay)
      MediaNodes.tsx          Bild-Node (Supabase Storage Upload; Video geplant)
      RightSidebar.tsx        Workspace-Outline
      elementPalette.ts       Gemeinsame Element-Palette + Slash-Ranking (filterPalette)
      editorTransforms.ts     Doc-Transformationen
      EmojiPicker.tsx
      EditorViewer.tsx        Read-only Darstellung
    sidebar/
      Sidebar.tsx             Linke Navigation ("Zuletzt" = echter Oeffnen-Verlauf, Neuer-Inhalt-Flyout, Loeschen)
    theme/ThemeToggle.tsx     Dark/Light Toggle
    Logo.tsx                  Wortmarke (theme-adaptiv)
  lib/
    supabase/client.ts
    supabase/server.ts
    supabase/storage.ts       Upload in Bucket wiki-media (WebP-Kompression vor Upload)
    createNote.ts             Notiz anlegen (Default-Inhalte pro Typ)
    markdownConvert.ts        Markdown-Import/Export fuer Artikel (inkl. Task-Listen, Callouts)
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
  updated_at   timestamptz DEFAULT now(),          -- Auto-Trigger (ignoriert reine Oeffnen-Updates)
  last_opened_at timestamptz                       -- Stempel beim Oeffnen/Ansehen, speist "Zuletzt"
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

Storage: Bucket `wiki-media` (public) fuer Bilder, Policies in `supabase/storage-policies.sql` (Upload/Delete nur im eigenen `user_id`-Ordner, keine SELECT-Policy — Public-Bucket liefert ueber die URL, Listing bleibt gesperrt). Bilder werden vor dem Upload clientseitig komprimiert (max 1600px, WebP 85%, Limit 2 MB nach Kompression) — so passen tausende Bilder ins 1-GB-Free-Kontingent statt ~100.

Realtime: `notes` muss in der `supabase_realtime`-Publication sein (Block 8a in `migration.sql`), sonst liefert `postgres_changes` keine Events und die "Zuletzt"-Liste ist nur im eigenen Tab live.

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

### Erledigt (Runde 4 — Notion-Kurs)

- To-do-Listen mit Checkboxen (TaskList/TaskItem, verschachtelbar per Tab, MD-Roundtrip `- [ ]`)
- Callout-Block: Emoji + 6 Farben, Picker als Dokument-Overlay (ueberlebt Section-Remounts), MD als `> 💡 …`
- Inhaltsverzeichnis rechts (Artikel-Editor + oeffentliche Ansicht): sticky beim Scrollen, H2/H3, Aktiv-Tracking, Klick springt zur Sektion
- Notion-Schreibflaeche: kein Panel mehr, volle Breite, Karo-Grid beim Schreiben ausgeblendet, Seite scrollt (kein interner Scrollbereich)
- Werkzeug-Palette rechts im Artikel entfernt — Slash-Menue, +-Button und "Umwandeln in" decken alles ab
- Slash-Hinweis auf leerer Zeile repariert (includeChildren fehlte — Placeholder hatte nie gerendert)
- Slash-Suche mit Notion-Ranking (exakter Treffer zuerst; "/hr" traf vorher "Ueberschrift")
- Eine gemeinsame Element-Palette fuer beide Editoren (Canvas hatte veraltete Kopie ohne To-do/Callout)
- /create entfernt: "Neuer Inhalt" legt direkt an und springt in den Editor; Autofokus auf leerem Titel; Entwuerfe ohne Titel speicherbar
- Sidebar "Zuletzt" live: Realtime-Publication (Block 8a), Save-Events, Titel aendert sich beim Tippen (Notion-Muster: Client-State broadcastet, DB folgt asynchron), aktive Notiz sofort an Position 1, Schloss-Icon bei privat
- Arbeitsbereich: Loeschen mit Bestaetigung, Typ-Filter, Suche mit Autofokus (Enter oeffnet ersten Treffer), Artikel/Workspaces nebeneinander, Statistik-Karten entfernt
- Echte Umlaute in allen sichtbaren UI-Strings
- Alle 27 Editor-Werkzeuge automatisiert im Browser getestet (Slash, Markdown-Kuerzel, BubbleMenu, Duplizieren, Bild-Upload)

### Erledigt (Runde 5 — Storage und Zuletzt-Verlauf)

- Clientseitige Bildkompression vor Upload (Canvas-Resize max 1600px, WebP 85%; SVG/GIF ausgenommen); Eingangslimit 25 MB, gespeichert max 2 MB
- Storage-Policies idempotent (`drop policy if exists`) und oeffentliche SELECT/Listing-Policy entfernt (Supabase-Sicherheitswarnung behoben)
- "Zuletzt" in der Sidebar = echter, account-weiter Oeffnen-Verlauf ueber `last_opened_at` statt Auffuellen nach `updated_at`; ohne geoeffnete Notizen bleibt der Abschnitt unsichtbar
- Stempel beim Oeffnen im Editor und beim Ansehen der eigenen oeffentlichen Seite (nur Owner); `updated_at`-Trigger ignoriert reine Oeffnen-Updates
- Migration 8b in `migration.sql` (Spalte + Trigger-Anpassung), am 2026-07-05 in Supabase ausgefuehrt

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
- [x] v1-Inhalte lokal ueber `/migrate` in die DB migriert (alle 7 Seiten oeffentlich)
- [ ] **Migrations-Bug**: Codebloecke enthalten literale `<span class="hl-...">`-Tags aus dem v1-Syntax-Highlighting — `v1Parser.ts` muss die Spans strippen, danach betroffene Artikel neu migrieren

### Setup (einmalig im Supabase SQL Editor)

- [ ] Block 8a aus `migration.sql` ausfuehren (`notes` in Realtime-Publication) — sonst ist "Zuletzt" nur im eigenen Tab live
- [x] Block 8b aus `migration.sql` ausgefuehrt (2026-07-05): `last_opened_at` + Trigger-Anpassung
- [x] Bucket `wiki-media` angelegt (public) + `storage-policies.sql` ausgefuehrt (2026-07-05)

### Deploy

- [ ] Vercel Projekt anlegen und mit GitHub verknuepfen
- [ ] Supabase-Credentials als Vercel Environment Variables setzen
- [ ] Custom Domain `wiki-v2.simonwied.com` in Vercel konfigurieren

---

## Roadmap: Artikel → Notion-Paritaet

Ziel: Artikel-Editor und -Ansicht fuehlen sich wie Notion an. Der Canvas-Workspace bleibt separat und eigenstaendig.

Schon auf Notion-Niveau: cleane Schreibflaeche ohne Panel, Slash-Menue mit Ranking, Drag-Handle (⠿) mit "Umwandeln in"/"Duplizieren", To-dos, Callouts, Toggles, Tabellen, Codebloecke mit Highlighting, resizable Bilder, Text-Formatierung (BubbleMenu), Links (StarterKit), Platzhalter-Hinweis auf leerer Zeile, Emoji-Icon pro Seite, Markdown-Import/Export, stickes Inhaltsverzeichnis, Live-Sidebar, Dark Mode.

### Phase 1 — fehlende Kern-Bloecke (fertige TipTap-Extensions, je klein)

- [x] To-do-Liste / Checkboxen (`@tiptap/extension-list`: TaskList + TaskItem)
- [x] Callout-Block (farbige Hinweisbox mit Emoji, eigener Node)
- [ ] Video-Block (MediaNodes hat bisher nur Bilder; Upload-Pfad existiert schon)

### Phase 2 — Verlinkung und Finden (Wiki-Kern)

- [ ] Schnellsuche (Cmd+K) ueber eigene Notizen + oeffentliche Inhalte
- [ ] Interne Links: `@`- oder `[[`-Trigger im Editor verlinkt auf andere Notizen
- [ ] Anker-Links auf Ueberschriften (TOC-Eintraege und oeffentliche URLs teilbar machen)

### Phase 3 — Seiten-Features

- [ ] Cover-Bild pro Artikel (wie Notion-Header)
- [ ] Templates (z. B. Rezept-Vorlage bei "Neuer Artikel")
- [ ] Papierkorb: Soft-Delete mit Wiederherstellen statt endgueltigem Loeschen
- [ ] Favoriten/Pinnen in der Sidebar

### Phase 4 — Layout und Extras

- [ ] Spalten-Layout (Bloecke nebeneinander)
- [ ] Embeds/Bookmark-Karten (Link-Preview)
- [ ] Backlinks ("Verlinkt von" unter dem Artikel)
- [ ] Mathe-Formeln (KaTeX)
- [ ] Mermaid-Diagramme
- [ ] Versionen/Seiten-Historie (ueber den `published`-Snapshot hinaus)

### Unabhaengig davon (App-Ebene)

- [ ] Kategorie-Seiten (eigene Route pro Kategorie-Slug)
- [ ] Public-Regel per DB-Trigger/Constraint absichern (aktuell nur App-Validierung)
- [ ] Bekannte TS-Fehler fixen (10 gesamt, alle pre-existing): `tippyOptions` am Table-BubbleMenu in `Editor.tsx`, `never`-Typen in `SectionNode.tsx`, `ImageOptions` in `MediaNodes.tsx`
- [ ] v1-Wiki abloesen: Redirects/Aufraeumen der alten HTML-Seiten

Bewusst ausgelassen (Single-User): Kollaboration, Kommentare, Rechteverwaltung, Datenbank-Views, Synced Blocks.
