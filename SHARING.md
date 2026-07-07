# Feature-Plan: Notizen mit einzelnen Personen teilen

Ziel: Notion-artiges Teilen. Der Owner einer privaten Notiz kann einzelnen anderen
Nutzer:innen gezielt Lese- oder Lese+Schreib-Zugriff geben, ohne die Notiz komplett
oeffentlich zu machen (`is_public` bleibt davon unberuehrt — das ist ein separater,
bestehender Mechanismus fuer "jeder mit dem Link").

Zwei Wege, beide **sofort wirksam** (kein Annehmen-Schritt — genau wie bei Notion:
Seiten-Freigabe per E-Mail ist dort ebenfalls instant, nur die Workspace-Mitgliedschaft
braucht ein explizites Annehmen, nicht das einzelne Teilen):

1. **E-Mail eingeben** → sofort Zugriff, taucht direkt im Arbeitsbereich der Person auf.
2. **Link verschicken** → wer draufklickt, bekommt sofort die beim Erstellen des Links
   eingestellte Rolle.

Status: Plan, noch nicht umgesetzt.

---

## Datenmodell

Neue Tabelle `note_shares` (Migration Block 11 in `supabase/migration.sql`):

```sql
create table if not exists note_shares (
  note_id     uuid references notes(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,
  role        text not null check (role in ('viewer', 'editor')),
  invited_by  uuid references auth.users(id),
  created_at  timestamptz default now(),
  primary key (note_id, user_id)
);

alter table note_shares enable row level security;

-- Owner der Notiz darf Freigaben verwalten (anlegen, Rolle aendern, entfernen)
create policy "note_shares_owner_all" on note_shares
  for all using (
    exists (select 1 from notes where notes.id = note_id and notes.user_id = auth.uid())
  );

-- Wer selbst Zugriff auf eine Notiz hat, sieht ALLE Freigaben dieser Notiz --
-- nicht nur die eigene Zeile. Noetig, damit Mitbearbeiter (nicht nur der Owner)
-- sehen koennen, wer sonst noch Zugriff hat (wie Notions Share-Dialog fuer
-- alle mit Zugriff, nicht nur fuer den Owner). Schliesst "nur meine eigene Zeile"
-- automatisch mit ein (die eigene Zeile erfuellt die exists-Bedingung trivial).
create policy "note_shares_collaborators_read" on note_shares
  for select using (
    exists (
      select 1 from note_shares my_share
      where my_share.note_id = note_shares.note_id and my_share.user_id = auth.uid()
    )
  );

-- Eine geteilte Notiz "verlassen": eigene Zeile loeschen
create policy "note_shares_self_delete" on note_shares
  for delete using (user_id = auth.uid());
```

`notes`-Policies erweitern (SELECT und UPDATE), zusaetzlich zur bestehenden
Owner-Regel und der `is_public`-Regel:

```sql
-- SELECT: + wer eine Freigabe hat (egal welche Rolle)
exists (
  select 1 from note_shares
  where note_shares.note_id = notes.id and note_shares.user_id = auth.uid()
)

-- UPDATE: + wer eine editor-Freigabe hat
exists (
  select 1 from note_shares
  where note_shares.note_id = notes.id and note_shares.user_id = auth.uid()
    and note_shares.role = 'editor'
)
```

**Wichtig:** Die aktuellen `notes`-RLS-Policies stehen nicht in `supabase/migration.sql`
(die Tabelle wurde urspruenglich direkt im Supabase-Dashboard angelegt). Vor der
Umsetzung im SQL-Editor nachschauen und die bestehenden Policies dokumentieren/exportieren,
damit die Erweiterung sauber ergaenzt statt versehentlich ersetzt wird.

`note_categories` und `published` bleiben bewusst Owner-only — Freigegebene (auch
Editoren) duerfen den Inhalt bearbeiten, aber nicht veroeffentlichen, Kategorien
aendern oder die Notiz loeschen. Kein Re-Share durch Editoren (nur der Owner selbst
verwaltet `note_shares`) — vermeidet Rechte-Eskalation ohne Zusatzaufwand.

---

## Zugriff vergeben: E-Mail direkt oder Link

Zwei Wege, wie der Owner Zugriff vergibt — beide landen am Ende als Zeile in
`note_shares`:

1. **E-Mail direkt eingeben** — fuer Personen, die schon ein Konto haben.
2. **Freigabe-Link verschicken** — fuer alle anderen Faelle (auch wenn die Person
   noch kein Konto hat, oder man ihre exakte Mail-Adresse gerade nicht parat hat).
   Der Owner verschickt den Link selbst (WhatsApp, Mail, egal) — die App verschickt
   keine Mails.

### 1. Direkt per E-Mail (sofortiger Zugriff)

`auth.users` ist fuer normale Clients nicht abfragbar (kein Client-seitiges
`select ... where email = ...`) und `profiles` speichert bewusst keine E-Mail
(Privatsphaere). Die Aufloesung E-Mail → `user_id` braucht deshalb eine
`security definer`-RPC, die serverseitig zusaetzlich prueft, dass der Aufrufer
wirklich der Owner der Notiz ist:

```sql
create or replace function grant_note_access_by_email(
  p_note_id uuid,
  p_email   text,
  p_role    text
)
returns text  -- 'granted' | 'not_found' | 'forbidden'
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
begin
  if not exists (select 1 from notes where id = p_note_id and user_id = auth.uid()) then
    return 'forbidden';
  end if;

  select id into target_user_id from auth.users where lower(email) = lower(p_email);
  if target_user_id is null then
    return 'not_found';
  end if;

  insert into note_shares (note_id, user_id, role, invited_by)
  values (p_note_id, target_user_id, p_role, auth.uid())
  on conflict (note_id, user_id) do update set role = excluded.role;

  return 'granted';
end;
$$;
```

Client ruft `supabase.rpc('grant_note_access_by_email', { p_note_id, p_email, p_role })`
auf. Bei `'not_found'` zeigt die UI: *"Keine Person mit dieser E-Mail registriert —
schick stattdessen den Freigabe-Link."*

### 2. Freigabe-Link (fuer alle anderen Faelle)

Neue Tabelle fuer Einladungs-Tokens:

```sql
create table if not exists note_share_links (
  token      text primary key default encode(gen_random_bytes(24), 'base64url'),
  note_id    uuid references notes(id) on delete cascade,
  role       text not null check (role in ('viewer', 'editor')),
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  revoked_at timestamptz
);

alter table note_share_links enable row level security;

-- Owner verwaltet Links seiner eigenen Notizen (anlegen, ansehen, widerrufen)
create policy "note_share_links_owner_all" on note_share_links
  for all using (
    exists (select 1 from notes where notes.id = note_id and notes.user_id = auth.uid())
  );
```

Der Token selbst ist kein RLS-Objekt, das ein Fremder direkt lesen koennte — die
Einloesung laeuft ausschliesslich ueber eine zweite `security definer`-RPC, die
serverseitig prueft, ob der Token gueltig ist:

```sql
create or replace function redeem_note_share_link(p_token text)
returns table (note_id uuid, role text) -- leer = ungueltig/widerrufen
language plpgsql
security definer
set search_path = public
as $$
declare
  link record;
begin
  select * into link from note_share_links
  where token = p_token and revoked_at is null;

  if link is null then
    return;
  end if;

  insert into note_shares (note_id, user_id, role, invited_by)
  values (link.note_id, auth.uid(), link.role, link.created_by)
  on conflict (note_id, user_id) do update set role = excluded.role;

  return query select link.note_id, link.role;
end;
$$;
```

**Route `/notes/[id]/join?token=...`** (neue Seite): ruft `redeem_note_share_link`
auf und leitet danach auf `/notes/[id]/edit` weiter. Ist niemand eingeloggt, muss
der Flow zuerst durch Login/Registrierung und danach zur `join`-URL zurueckkehren
— das gibt es in der App aktuell noch nicht (`proxy.ts` schickt nicht eingeloggte
Zugriffe auf `/notes/*/edit` hart zu `/login`, ohne die urspruenglich angeforderte
URL zu merken). Notwendige Kleinigkeit vorab:

- `proxy.ts`: Redirect zu `/login` bekommt `?next=<pfad>` (analog zum schon
  bestehenden `?next=`-Parameter beim E-Mail-Bestaetigungs-Callback in
  `register/page.tsx`).
- `login`/`register`-Seiten: nach erfolgreichem Login/Signup zu `next` statt
  hart zu `/dashboard` weiterleiten, falls der Parameter gesetzt ist.

**Widerrufen/Neu erzeugen**: Owner kann einen Link jederzeit widerrufen
(`revoked_at = now()`); ein neuer Share-Button erzeugt einfach eine neue Zeile
mit neuem Token. Kein Ablaufdatum in v1 (kann spaeter als `expires_at`-Spalte
nachgeruestet werden, falls gewuenscht).

---

## Sichtbarkeit: wer hat Zugriff, wer hat zuletzt geaendert

Wie bei Notion soll nicht nur der Owner sehen koennen, wer sonst noch Zugriff
auf eine Notiz hat, und wer sie zuletzt geaendert hat — jede Person mit Zugriff
(Betrachter wie Bearbeiter) sieht das.

**Wer hat Zugriff:** deckt die `note_shares_collaborators_read`-Policy oben
bereits ab — jeder mit einer eigenen Zeile in `note_shares` darf alle Zeilen
der Notiz lesen (Anzeigename kommt wie gehabt aus `profiles`). Nur *aendern*
(Rolle setzen, entfernen, neu einladen) bleibt Owner-only (`note_shares_owner_all`).

**Wer hat zuletzt geaendert:** neue Spalte auf `notes`, gepflegt vom bestehenden
`updated_at`-Trigger (Migration Block 8b in `supabase/migration.sql`) statt vom
Client, damit es unabhaengig vom Aufrufer immer stimmt:

```sql
alter table notes add column if not exists last_edited_by uuid references auth.users(id);

-- Ersetzt die Trigger-Funktion aus Block 8b: zusaetzlich zu updated_at wird bei
-- echten Inhaltsaenderungen (nicht bei reinen last_opened_at-Stempeln) auch
-- last_edited_by auf den aktuellen Aufrufer gesetzt.
create or replace function update_updated_at_column()
returns trigger as $$
begin
  if (to_jsonb(new) - 'last_opened_at' - 'updated_at' - 'last_edited_by')
     is distinct from (to_jsonb(old) - 'last_opened_at' - 'updated_at' - 'last_edited_by') then
    new.updated_at = now();
    new.last_edited_by = auth.uid();
  end if;
  return new;
end;
$$ language plpgsql;
```

Anzeige: `NoteHeader.tsx` bekommt eine kleine Zeile "Zuletzt bearbeitet von
{display_name}, {Datum}" (Join `last_edited_by` → `profiles.display_name`) —
sichtbar fuer Owner und alle Freigegebenen, weil es einfach eine ganz normale
Spalte auf der ohnehin lesbaren `notes`-Zeile ist, keine neue RLS noetig.

Bewusst nicht gebaut: **Presence/Live-Cursor** (wer die Notiz *gerade jetzt*
geoeffnet hat) — das waere Echtzeit-Infrastruktur, die laut "Bekannte Grenzen"
unten bewusst aussen vor bleibt. `last_edited_by` ist ein einfacher Snapshot,
kein Live-Signal.

---

## UI

- **"Teilen"-Button**: im ⋯-Actions-Menue der Edit-Seite (`app/(dashboard)/notes/[id]/edit/page.tsx`),
  sichtbar fuer Owner UND Freigegebene — Freigegebene sehen nur eine read-only Liste
  ("Wer hat Zugriff"), der Owner zusaetzlich die Verwaltungs-Controls (Rolle aendern,
  entfernen, einladen, Link erzeugen).
- **Teilen-Dialog** (neue Komponente, z. B. `components/editor/ShareDialog.tsx`):
  - Liste aller Personen mit Zugriff: Anzeigename (via `profiles`), Rolle (Betrachter/Bearbeiter).
    Fuer den Owner als Dropdown + Entfernen-Button, fuer alle anderen nur als Text (read-only).
  - Nur fuer den Owner: E-Mail-Eingabefeld + Rolle-Auswahl + "Einladen"-Button →
    `grant_note_access_by_email`-RPC; Fehlerfall `not_found` zeigt Hinweis auf den
    Freigabe-Link (s. u.).
  - Nur fuer den Owner: "Freigabe-Link"-Bereich (Rolle waehlen, Link generieren/anzeigen,
    Copy-Button, "Widerrufen").
- **Sidebar/Dashboard**: neuer Abschnitt "Mit dir geteilt" (`components/sidebar/Sidebar.tsx`
  oder eigener Dashboard-Block), analog zur bestehenden "Zuletzt"-Liste — Notizen, bei denen
  ich in `note_shares` stehe, aber nicht `user_id = ich` bin. Normaler klickbarer Notiz-Link,
  oeffnet `/notes/[id]/edit` (read-only oder editierbar je nach Rolle).
- **Dashboard/`NotesOverview.tsx`**: kleines Badge/Icon neben dem bestehenden Schloss-Icon,
  wenn eine Notiz mit mir geteilt wurde (zeigt auch die eigene Rolle beim Hover: "Betrachter"/"Bearbeiter").
- **Editor**: `editable`-Prop (bereits vorhandenes Pattern, aktuell nur fuer
  Draft-vs-Public-Ansicht genutzt) wird zu `role !== 'viewer'` erweitert — RLS blockt
  Schreibzugriff fuer Viewer ohnehin serverseitig, die UI blendet Editier-Werkzeuge
  (Werkzeugleiste, Slash-Menue, ⠿-Griff) zusaetzlich clientseitig aus, wie bei der
  bestehenden Public-Ansicht.
- **`NoteHeader.tsx`**: kleine Zeile "Zuletzt bearbeitet von {Name}, {Datum}" unter
  Titel/Beschreibung, sichtbar fuer Owner und alle Freigegebenen.

---

## Bekannte Grenzen (bewusst out of scope fuer v1)

- **Keine Echtzeit-Kollaboration.** Kein CRDT/OT — bearbeiten zwei Personen gleichzeitig,
  gewinnt wie bisher der letzte Autosave (kein Merge, keine Konfliktanzeige).
- **Keine Benachrichtigung.** Kein Mail-Versand in diesem Projekt — die freigegebene
  Person merkt es erst, wenn sie sich einloggt und "Mit dir geteilt" oeffnet (kein
  E-Mail-Push wie bei Notion).
- **Kein Re-Share.** Nur der Owner verwaltet Freigaben, Editoren koennen nicht weiter-teilen.
- **Direkte E-Mail-Freigabe braucht ein bestehendes Konto.** Kein Invite, der beim
  spaeteren Signup automatisch aktiv wird — dafuer gibt's den Freigabe-Link.
- **Link ist ein Bearer-Token.** Wer die URL hat, kann sie einloesen (wie bei den meisten
  "Freigabe-Link"-Features anderer Tools) — der Owner ist dafuer verantwortlich, den Link
  nur an die gewuenschte Person zu schicken. Widerrufen ist jederzeit moeglich.

---

## Umsetzungsschritte

- [ ] Bestehende `notes`-RLS-Policies im Supabase-Dashboard nachschauen und dokumentieren
- [ ] Migration Block 11: `note_shares` (inkl. `note_shares_collaborators_read`-Policy)
      + `note_share_links` + RLS + `notes`-Policy-Erweiterung + `grant_note_access_by_email`-
      und `redeem_note_share_link`-RPCs (SQL Editor)
- [ ] Migration Block 12: `notes.last_edited_by` + erweiterte `update_updated_at_column`-Trigger-Funktion
- [ ] `lib/types.ts`: `NoteShare`-, `NoteShareLink`-Typ, `Note.last_edited_by`
- [ ] `proxy.ts` + `login`/`register`-Seiten: `?next=`-Redirect-Parameter (Voraussetzung fuer
      den Link-Flow bei nicht eingeloggten Personen)
- [ ] `app/(dashboard)/notes/[id]/join/page.tsx`: ruft `redeem_note_share_link` auf, leitet
      danach zu `/notes/[id]/edit` weiter
- [ ] `ShareDialog.tsx`: Zugriffs-Liste (read-only fuer Freigegebene, verwaltbar fuer Owner),
      E-Mail-Einladung, Link generieren/widerrufen
- [ ] "Teilen"-Button im ⋯-Menue der Edit-Seite (sichtbar fuer Owner + Freigegebene, Controls nur fuer Owner)
- [ ] Edit-Seite/Editor: `editable` an Rolle koppeln statt nur an Owner-Vergleich
- [ ] `NoteHeader.tsx`: "Zuletzt bearbeitet von ..."-Zeile
- [ ] Sidebar/Dashboard: Abschnitt "Mit dir geteilt"
- [ ] `NotesOverview.tsx`: Badge fuer geteilte Notizen (+ Rolle im Tooltip)
- [ ] Manuell testen: E-Mail-Freigabe (bekanntes Konto) → sofort Zugriff, Notiz erscheint im
      Arbeitsbereich der anderen Person → als Bearbeiter im Teilen-Dialog sehen, dass noch
      eine dritte Person (Betrachter) Zugriff hat → Notiz bearbeiten → Owner sieht
      "Zuletzt bearbeitet von [Bearbeiter-Name]" → Rolle hochstufen/Freigabe entfernen;
      Freigabe-Link mit ausgeloggtem Test-Browser oeffnen → Registrierung → landet
      automatisch mit Zugriff auf der Notiz; Link widerrufen → alter Link greift nicht mehr
