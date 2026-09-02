# Freigabe- und Zugriffsmodell

Das Wiki ist ein Single-Author-System. Nur der in `wiki_owners` eingetragene
Supabase-User darf Inhalte erstellen, bearbeiten, veroeffentlichen oder
loeschen. Besucher brauchen kein Konto und bekommen nie Schreibzugriff.

## Sichtbarkeit

Jeder Inhalt hat einen von drei Zustaenden:

1. `private`: Nur der Owner sieht den Entwurf.
2. `link`: Der eingefrorene Snapshot ist unter `/share/[token]` lesbar.
3. `public`: Der eingefrorene Snapshot ist unter `/notes/[slug]` lesbar und
   erscheint in der Bibliothek.

Autosaves aktualisieren ausschliesslich die Live-Spalten des Entwurfs. Erst
`publish_note(...)` kopiert den aktuellen Stand atomar nach `published`.
Oeffentliche und geheime Leserouten verwenden Security-Definer-RPCs, die nur
diesen Snapshot zurueckgeben. Dadurch koennen Besucher die Live-Spalten auch
nicht direkt ueber die Supabase-API auslesen.

## Geheime Links

Pro Inhalt existiert hoechstens ein Datensatz in `note_share_links`. Der UUID-
Token besitzt ausreichend Entropie, um nicht erraten zu werden. Es handelt sich
um einen Bearer-Link: Jeder, an den die URL weitergeleitet wird, kann sie lesen.

- `rotate_note_share_link(...)` ersetzt den Token und macht den alten Link
  sofort ungueltig.
- `set_note_private(...)` loescht den Link sofort.
- Ein Wechsel auf `public` loescht den Link ebenfalls.
- Link-Inhalte werden von `list_public_notes()` nie ausgegeben.
- Die Linkseite liefert generische Metadaten und `noindex`, damit Titel und
  Beschreibung nicht durch Link-Previews verraten werden.

## Datenbank-Sicherheit

Migration Block 11 in `supabase/migration.sql` ersetzt alle alten Policies auf
`notes`, `note_categories`, `profiles` und `note_share_links`. Das ist wichtig,
weil mehrere permissive PostgreSQL-Policies sonst mit OR kombiniert wuerden.

Die App entfernt die Registrierung und prueft `is_wiki_owner()` in Login,
Proxy, Dashboard und Erstellungsflow. RLS bleibt die verbindliche letzte
Schutzschicht. Zusaetzlich muss in Supabase unter Authentication → Settings
**Allow new users to sign up** deaktiviert werden.

## Bewusst nicht in Version 1

- Empfaengerkonten oder Freigaben an konkrete E-Mail-Adressen
- Mehrere parallele Links pro Inhalt
- Ablaufdatum oder zusaetzliches Passwort
- Kommentare und Schreibzugriff fuer Leser
- Zugriffsstatistiken
