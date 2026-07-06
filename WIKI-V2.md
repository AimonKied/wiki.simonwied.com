# Wiki fuer Freunde

## Vision

Multi-User-Wiki fuer private und oeffentliche Inhalte — jeder kann sich registrieren und eigene Artikel/Workspaces anlegen. Oeffentliche Inhalte sind per Link teilbar (fuer Freunde gedacht), aber bewusst nicht fuer Suchmaschinen gedacht: `robots.ts` sperrt Crawler komplett, Seiten tragen `noindex`. Nutzer koennen zwei Arten von Inhalten erstellen:

- **Artikel**: sollen sich so nah wie moeglich an Notion anfuehlen — Block-Editor mit Slash-Menue, Drag-Handle, allen gaengigen Block-Typen und interner Verlinkung. Leitfrage bei jedem Artikel-Feature: "Wie macht Notion das?"
- **Workspace Canvas**: das Alleinstellungsmerkmal gegenueber Notion — freie Arbeitsflaechen mit verschiebbaren Bloecken, Pan und Zoom. Bleibt bewusst eigenstaendig.

Beide Inhaltstypen koennen privat bleiben oder oeffentlich veroeffentlicht werden. Oeffentliche Inhalte muessen Kategorien haben, damit sie auf der Homepage gefiltert und unter Kategorien gefunden werden koennen, zum Beispiel `Rezepte`, `Technik` oder `Informatik`.

---

## Tech Stack

| Layer | Technologie |
|---|---|
| Framework | **Next.js 16** (App Router, Turbopack) |
| Editor | **TipTap v3** |
| Auth + DB | **Supabase** (PostgreSQL + Row Level Security) |
| Media | **Supabase Storage** (Bucket `wiki-media`) |
| Styling | CSS Variables, Dark Mode Toggle; Syne (Headlines), Inter (Body), JetBrains Mono (Code) |
| Hosting | Self-Hosted (kein Vercel; Next.js `standalone`-Build o.ae., Details offen) |
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
    (auth)/login/             Login-Seite
    (dashboard)/              Nur eingeloggt
      dashboard/              Arbeitsbereich: Filter, Suche, Loeschen
      notes/
        [id]/edit/            Inhalt bearbeiten ("Neuer Inhalt" legt an und springt direkt hierher; keine /create-Seite mehr)
    (public)/
      notes/[id]/             Oeffentliche Ansicht per Slug (+ not-found.tsx)
    layout.tsx
    page.tsx                  Homepage "Bibliothek" mit Kategorie- und Typ-Filtern
    robots.ts                 Sperrt alle Crawler (Wiki ist fuer Freunde, nicht fuer Google-Suche gedacht)
  components/
    dashboard/
      NewContentButton.tsx    Neuer-Inhalt-Button (legt Notiz an, springt in Editor)
      NotesOverview.tsx       Arbeitsbereich-Liste: Typ-Filter, Suche, Loeschen-/Privat-schalten-Menue
    editor/
      Editor.tsx              TipTap, Canvas-Viewport, Pan/Zoom/Lasso
      ArticleEditor.tsx       Linearer Block-Editor fuer Artikel (Notion-Stil: Slash-Menue, volle Breite, kein Panel)
      NoteHeader.tsx          Gemeinsamer Kopf (Emoji/Titel/Beschreibung/Badges) fuer Edit- UND Public-Ansicht — editable-Flag schaltet Inputs vs. statischen Text
      ArticleToc.tsx          Inhaltsverzeichnis rechts (sticky, H1/H2/H3, Scroll-Tracking); unter 1100px als rechter Off-Canvas-Drawer mit schwebendem Button
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
      Sidebar.tsx             Linke Navigation ("Zuletzt" = echter Oeffnen-Verlauf, Neuer-Inhalt-Flyout, Loeschen, Privat schalten, ab 769px einklappbar)
    theme/ThemeToggle.tsx     Dark/Light Toggle
    InlineScript.tsx          Client Component fuer Anti-Flash-Theme-Script im Root-Layout (Server Components liefen im Browser nie erneut, daher eigene Komponente noetig)
    Logo.tsx                  Wortmarke (theme-adaptiv)
  lib/
    supabase/client.ts
    supabase/server.ts
    supabase/storage.ts       Upload in Bucket wiki-media (WebP-Kompression vor Upload)
    createNote.ts             Notiz anlegen (Default-Inhalte pro Typ)
    markdownConvert.ts        Markdown-Import/Export fuer Artikel (inkl. Task-Listen, Callouts)
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

profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name text NOT NULL,          -- Trigger-Sync aus auth.users bei Signup/Metadaten-/E-Mail-Aenderung
  updated_at   timestamptz DEFAULT now()
)
```

RLS: Kategorien oeffentlich lesbar; `note_categories` lesbar wenn Notiz public, Owner darf alles; `profiles` oeffentlich lesbar (Autor-Anzeige auf oeffentlichen Seiten), da `auth.users` selbst fuer Besucher nicht abfragbar ist.

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
- v1-Migrations-Tooling: `/migrate`-Seite + `api/migrate-v1` + `lib/v1Parser.ts` (nur lokal nutzbar) — 2026-07-06 wieder entfernt, verbleibende v1-Seiten werden manuell uebertragen
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

### Erledigt (Runde 6 — Mobile/Responsive)

- Sidebar wird unter 768px zum Off-Canvas-Drawer: fixe Topbar mit Hamburger + Logo, Backdrop, schliesst bei Navigation/Escape/Backdrop-Klick, Body-Scroll-Lock
- Shell-Styles (`.sidebar-nav`, `.app-main`, `.mobile-topbar`, `.sidebar-backdrop`) von Inline-Styles nach `globals.css` verlagert, damit Media Queries greifen
- Haupt-Layouts (Dashboard, Public, Home) mit mobilem Padding und Platz fuer die Topbar
- Artikel-TOC und Canvas-Outline unter 1100px ausgeblendet (ruetschen sonst per flex-wrap unter den Inhalt)
- Breite Tabellen scrollen horizontal (`.tableWrapper`), Public-Titel skaliert per clamp, Login-/Such-Inputs 16px auf Mobil (verhindert iOS-Auto-Zoom)

### Erledigt (Runde 6b — Autor/Anzeigename)

- `profiles`-Tabelle mit `display_name`, per Trigger aus `auth.users` gespiegelt (Migration Block 9), da `auth.users` fuer Besucher nicht lesbar ist
- Anzeigename statt E-Mail in der Dashboard-Begruessung
- Autor-Byline (Avatar-Initiale + Name + Datum) auf oeffentlichen Notiz-Seiten und Bibliothek-Karten

### Erledigt (Runde 7 — Notion-Share-Parity und Mobile-Politur)

- **Public- und Edit-Ansicht sind jetzt dieselbe Komponente**: neue `NoteHeader`-Komponente (Emoji/Titel/Beschreibung/Badges) mit `editable`-Flag, von Edit- und Public-Seite gleichermassen genutzt — Notion-Style: Betrachter sehen exakt dieselbe Seite, nur ohne Bearbeiten-Rechte. Public-Ansicht bekommt dieselbe Breite, dieselben Badges, RightSidebar-Outline fuer Workspaces und einen "Bearbeiten"-Link fuer den Owner
- "Privat schalten" (Notiz von oeffentlich zurueck auf privat) jetzt auch aus dem ⋯-Menue in Sidebar ("Zuletzt") und Dashboard-Uebersicht moeglich, nicht mehr nur im Edit-Screen; gilt fuer Artikel und Workspaces gleichermassen
- Grid-Hintergrund und 820px-Breitenlimit im readonly-Artikel entfernt (Ueberbleibsel des fruehen Card-Looks) — Artikel-Inhalt ist in Edit und Public jetzt exakt gleich breit
- Artikel-H1 nutzt die Artikelschrift (Inter) statt der globalen Display-Schrift (Syne); H1-Ueberschriften erscheinen jetzt auch im Inhaltsverzeichnis (vorher bewusst ausgeschlossen)
- Klick unterhalb des Artikelinhalts (leere Flaeche) setzt den Cursor auf die naechstgelegene Zeile statt nichts zu tun — wichtig auf leeren/kurzen Seiten, wo die letzte Zeile unsichtbar ist
- Mobile Artikel-Breite: Reste der alten Card-Innenabstaende (24px/18px + `margin-inline`-Hack) entfernt, die den Inhalt auf Mobil enger machten als auf Desktop; linker 44px-Block-Gutter (Platz fuer Hover-only ⠿/+-Controls) ist unter 640px auf 0 gesetzt, symmetrisch zu rechts
- Inhaltsverzeichnis als rechter Off-Canvas-Drawer unter 1100px (schwebender Button, Backdrop, Escape/Auto-Close beim Anspringen einer Ueberschrift) — vorher gab es unter 1100px gar keinen Zugriff aufs TOC
- TOC-Sprungziel wird per `getBoundingClientRect()`/`window.scrollTo()` manuell berechnet (mobiler Header-Offset), nicht mehr per `scroll-margin-top` + `scrollIntoView` — letzteres schoss auf manchen mobilen Browsern ueber die Ueberschrift hinaus
- Theme-Init-Script als eigene Client Component (`InlineScript.tsx`) ausgelagert: als Server Component im Root-Layout loeste der `type`-Ternary (text/javascript vs. text/plain) nie den Client-Zweig aus, React warnte bei jeder Hydration vor einem nie ausgefuehrten Script-Tag
- Theme-Toggle auf der 404-Seite ergaenzt (Rest der Seite nutzte schon Theme-Variablen)

### Erledigt (Runde 8 — Multi-User, Freunde statt Google)

- Klargestellt: Wiki ist Multi-User (offene Registrierung ist Absicht, kein Single-User-Projekt)
- `app/robots.ts` + `robots: { index: false, follow: false }` im Root-Layout: Wiki ist fuer Freunde per Link gedacht, nicht fuer die oeffentliche Google-Suche
- "Wiki v2"-Branding entfernt (Titel, READMEs) — das hier ist jetzt die aktuelle Wiki, nicht mehr "v2 neben v1"
- v1-Migrations-Tooling entfernt (`/migrate`-Seite, `api/migrate-v1`, `lib/v1Parser.ts`) — verbleibende v1-Seiten werden manuell uebertragen
- `public/service-worker.js` entfernt (war nie registriert, totes Leichtgewicht)
- Sidebar auf Desktop/iPad (≥769px) einklappbar: Hamburger-Button neben dem Logo (gleiches Icon wie die Mobil-Topbar), schwebender Button zum Wiederoeffnen, Zustand in localStorage. Default offen — umgekehrt zum Mobil-Drawer, der standardmaessig zu ist

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

Alle 7 v1-Seiten wurden ueber das (mittlerweile wieder entfernte) `/migrate`-Tooling in folgende Kategorien uebertragen:

| v1-Seite | Zieltyp | Kategorie | Oeffentlich |
|---|---|---|---|
| git-commands.html | Artikel | Informatik | Ja |
| web-hacking.html | Artikel | Informatik | Ja |
| cybertools.html | Artikel | Informatik | Ja |
| awesome-list.html | Artikel | Sonstiges | Ja |
| linsen-mit-spaetzle.html | Artikel | Rezepte | Ja |
| buttermilk-chicken.html | Artikel | Rezepte | Ja |
| croquetas.html | Artikel | Rezepte | Ja |

Weitere v1-Seiten werden manuell im Editor nachgebaut statt ueber ein Import-Tool — das Tooling (`/migrate`, `api/migrate-v1`, `lib/v1Parser.ts`) wurde deshalb entfernt.

---

## Offene Punkte

### Migration

- [x] Kategorie-Slugs in `migrate/page.tsx` auf neues Set umstellen (siehe Tabelle oben)
- [x] Migrations-Route setzt `published`-Snapshot fuer oeffentliche Artikel
- [x] v1-Inhalte lokal ueber `/migrate` in die DB migriert (alle 7 Seiten oeffentlich)
- [x] Migrations-Tooling wieder entfernt (2026-07-06) — der Bug mit literalen `<span class="hl-...">`-Tags in Codebloecken ist damit hinfaellig; verbleibende v1-Seiten werden manuell im Editor nachgebaut

### Setup (einmalig im Supabase SQL Editor)

- [x] Block 8a aus `migration.sql` ausgefuehrt (`notes` in Realtime-Publication)
- [x] Block 8b aus `migration.sql` ausgefuehrt (2026-07-05): `last_opened_at` + Trigger-Anpassung
- [x] Bucket `wiki-media` angelegt (public) + `storage-policies.sql` ausgefuehrt (2026-07-05)
- [x] Block 9 aus `migration.sql` ausgefuehrt: `profiles`-Tabelle + Anzeigename-Sync-Trigger

### Deploy

- [x] `npm run build` laeuft fehlerfrei durch (verifiziert 2026-07-06: Compile + TypeScript + statische Seiten OK)
- [x] Offene Selbstregistrierung ist Absicht (Multi-User-Wiki), keine Entscheidung noetig
- [x] `app/robots.ts` + `noindex`-Metadata sperren Suchmaschinen komplett — Wiki ist per Link fuer Freunde gedacht, nicht fuer die Google-Suche
- [x] Oeffentliche Notiz-Seiten (`/notes/[slug]`) haben eigene `<title>`/Description/Open-Graph/Twitter-Metadaten via `generateMetadata` (2026-07-06) — Teilen des Links in Slack/Discord/WhatsApp zeigt jetzt Artikeltitel/-beschreibung statt des generischen "Wiki"-Titels
- [ ] Kein Vercel — Hosting-Plattform/Deploy-Weg noch offen (z. B. eigener Server mit `next build && next start` oder `output: 'standalone'` + Docker/Reverse Proxy)
- [ ] Supabase-Credentials als Env-Vars beim gewaehlten Hosting setzen (nur die beiden `NEXT_PUBLIC_*`-Werte aus `.env.local` — kein Service-Role-Key im Repo, `.env*` ist gitignored)
- [ ] Custom Domain `wiki.simonwied.com` beim gewaehlten Hosting/DNS konfigurieren
- [ ] Public-Regel (`is_public` braucht Slug + Kategorie) nur app-seitig validiert, kein DB-Constraint (siehe Roadmap unten) — bei mehreren Nutzern relevanter als vorher, vor Launch abwaegen

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

- [ ] Canvas-Editor Touch-Bedienung (Pan/Pinch-Zoom/Block-Drag per Touch) — Ansicht ist mobil nutzbar, Bearbeiten braucht Maus
- [ ] Kategorie-Seiten (eigene Route pro Kategorie-Slug)
- [ ] Public-Regel per DB-Trigger/Constraint absichern (aktuell nur App-Validierung)
- [x] Bekannte TS-Fehler gefixt (2026-07-05): `tsc --noEmit` laeuft fehlerfrei (`never`-Narrowing in `SectionNode.tsx`, `ImageOptions` in `MediaNodes.tsx`; der `tippyOptions`-Fehler in `Editor.tsx` war bereits verschwunden)
- [ ] v1-Wiki abloesen: Redirects/Aufraeumen der alten HTML-Seiten

Bewusst ausgelassen: Echtzeit-Kollaboration auf derselben Notiz, Kommentare, granulare Rechteverwaltung, Datenbank-Views, Synced Blocks — jeder Nutzer verwaltet seine eigenen Notizen unabhaengig, es wird nicht gemeinsam an einer Notiz geschrieben.
