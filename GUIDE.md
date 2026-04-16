# Inception – Kompletter Einsteigerguide

> Für alle, die noch nie von Docker gehört haben und nicht wissen, was hier passiert.

---

## Inhaltsverzeichnis

1. [Was macht dieses Projekt?](#1-was-macht-dieses-projekt)
2. [Was ist Docker?](#2-was-ist-docker)
3. [Die drei Dienste erklärt](#3-die-drei-dienste-erklärt)
4. [Projektstruktur](#4-projektstruktur)
5. [Jede Datei erklärt](#5-jede-datei-erklärt)
6. [Wie die Teile zusammenarbeiten](#6-wie-die-teile-zusammenarbeiten)
7. [Einrichten und Starten](#7-einrichten-und-starten)
8. [Häufige Fragen](#8-häufige-fragen)

---

## 1. Was macht dieses Projekt?

Dieses Projekt baut eine **vollständige WordPress-Website** – von Grund auf, mit echten Produktionskomponenten:

```
Browser  →  NGINX (Port 443, HTTPS)  →  WordPress (PHP)  →  MariaDB (Datenbank)
```

Wenn jemand `https://swied.42.fr` aufruft:
1. **NGINX** empfängt die Anfrage (verschlüsselt via HTTPS/SSL)
2. Leitet PHP-Anfragen weiter an **WordPress**
3. WordPress liest/schreibt Daten in **MariaDB** (die Datenbank)
4. Die fertige HTML-Seite geht zurück zum Browser

Alles läuft in **Docker-Containern** – isolierten Mini-Computern, die auf dem echten Computer laufen.

---

## 2. Was ist Docker?

### Die Idee in einem Satz

Docker packt ein Programm **zusammen mit allem, was es braucht** (Betriebssystem-Bibliotheken, Konfiguration, Abhängigkeiten) in eine Box – den **Container**. Diese Box läuft überall gleich.

### Wichtige Begriffe

| Begriff | Bedeutung | Analogie |
|---------|-----------|----------|
| **Image** | Bauplan / Vorlage für einen Container | Kuchenrezept |
| **Container** | Laufende Instanz eines Images | Der fertige Kuchen |
| **Dockerfile** | Anleitung zum Bauen eines Images | Das Rezept selbst |
| **Volume** | Ordner, der zwischen Container und Host geteilt wird | USB-Stick |
| **Network** | Virtuelles Netzwerk zwischen Containern | Privates WLAN |
| **docker-compose** | Tool, das mehrere Container zusammen verwaltet | Dirigent im Orchester |

### Warum Container statt direkte Installation?

- **Isolation**: MariaDB in seinem Container beeinflusst nicht NGINX in seinem
- **Reproduzierbarkeit**: Auf jedem Rechner dasselbe Ergebnis
- **Sauberkeit**: Kein Müll auf dem Host-System
- **Neustart-Logik**: Container können bei Fehler automatisch neu starten

---

## 3. Die drei Dienste erklärt

### NGINX – Der Türsteher

NGINX ist ein **Webserver**. Er sitzt vorne und nimmt alle Anfragen aus dem Internet entgegen.

- Hört auf Port **443** (HTTPS – verschlüsselt)
- Hat ein **selbst-signiertes SSL-Zertifikat** (damit HTTPS funktioniert)
- PHP-Dateien (`*.php`) schickt er **nicht selbst** aus – er delegiert sie an WordPress/PHP-FPM
- Statische Dateien (Bilder, CSS, JS) liefert er direkt aus

### WordPress – Das CMS

WordPress ist das eigentliche **Content-Management-System** – die Website-Software.

- Läuft nicht als normaler Webserver, sondern als **PHP-FPM** (FastCGI Process Manager)
- PHP-FPM hört auf Port **9000** – aber nur intern, nicht von außen erreichbar
- Beim ersten Start lädt es WordPress herunter, installiert es und legt zwei Benutzer an
- Speichert alle PHP-Dateien in einem geteilten Volume, das auch NGINX lesen kann

### MariaDB – Die Datenbank

MariaDB ist eine **relationale Datenbank** (kompatibel zu MySQL).

- Hört auf Port **3306** – nur intern im Docker-Netzwerk
- Speichert alle WordPress-Inhalte: Beiträge, Seiten, Benutzer, Einstellungen
- Beim ersten Start legt es die Datenbank und den Benutzer an, dann startet es normal

---

## 4. Projektstruktur

```
42-Inception/
│
├── .gitignore                      ← Git ignoriert .env und secrets/
│
├── secrets/                        ← Passwörter (NICHT in Git!)
│   ├── db_root_password.txt        ← MariaDB root-Passwort
│   ├── db_password.txt             ← Passwort für WordPress-Datenbankuser
│   ├── wp_admin_password.txt       ← WordPress Admin-Passwort
│   └── wp_user_password.txt        ← WordPress Editor-Passwort
│
└── srcs/                           ← Gesamter Quellcode
    ├── .env                        ← Umgebungsvariablen (NICHT in Git!)
    ├── .env.example                ← Vorlage für .env
    ├── docker-compose.yml          ← Orchestriert alle Container
    │
    └── requirements/               ← Je ein Ordner pro Dienst
        ├── nginx/
        │   ├── Dockerfile          ← Bauanleitung für NGINX-Image
        │   ├── .dockerignore
        │   ├── conf/
        │   │   └── nginx.conf      ← NGINX-Konfiguration
        │   └── tools/
        │       └── setup-nginx.sh  ← Startskript (generiert SSL-Zert)
        │
        ├── wordpress/
        │   ├── Dockerfile          ← Bauanleitung für WordPress-Image
        │   └── tools/
        │       └── wp-setup.sh     ← Startskript (installiert WP)
        │
        └── mariadb/
            ├── Dockerfile          ← Bauanleitung für MariaDB-Image
            ├── .dockerignore
            ├── conf/
            │   └── 50-server.cnf  ← MariaDB-Konfiguration
            └── tools/
                └── init_db.sh     ← Startskript (initialisiert DB)
```

---

## 5. Jede Datei erklärt

### `srcs/docker-compose.yml`

Die **Schaltzentrale**. Hier wird definiert, wie alle drei Container gebaut, konfiguriert und verbunden werden.

```yaml
services:
  nginx:       # Dienst 1
  wordpress:   # Dienst 2
  mariadb:     # Dienst 3

networks:
  inception:   # Gemeinsames internes Netzwerk

volumes:
  wp_files:    # Geteilte WordPress-Dateien
  wp_database: # Datenbankdaten

secrets:       # Passwörter aus Dateien lesen
```

**Wichtig: `depends_on`**
- NGINX wartet auf WordPress
- WordPress wartet auf MariaDB

So starten die Container in der richtigen Reihenfolge.

**Wichtig: Volumes**
- `wp_files` → gemappt auf `/home/swied/data/wordpress` auf dem Host
- `wp_database` → gemappt auf `/home/swied/data/mariadb` auf dem Host

Das bedeutet: Daten überleben Container-Neustarts, weil sie auf dem echten Dateisystem liegen.

---

### `srcs/.env` und `srcs/.env.example`

Umgebungsvariablen – Konfiguration ohne Passwörter.

```bash
DOMAIN_NAME=swied.42.fr       # Domain der Website
MYSQL_DATABASE=wordpress      # Name der Datenbank
MYSQL_USER=wp_user            # DB-Benutzer für WordPress
WORDPRESS_TITLE=Inception     # Titel der Website
WORDPRESS_ADMIN_USER=user     # WordPress Admin-Benutzername
WORDPRESS_ADMIN_EMAIL=...     # Admin-E-Mail
WORDPRESS_USER=editor         # Zweiter Benutzer (Rolle: Editor)
WORDPRESS_USER_EMAIL=...      # Editor-E-Mail
```

`.env` ist in `.gitignore` – kommt nie in Git. `.env.example` zeigt die Struktur ohne echte Werte.

---

### `secrets/*.txt`

Passwörter werden als **Docker Secrets** verwaltet – nicht als Umgebungsvariablen.

Der Unterschied:
- Umgebungsvariablen sind im Container-Prozess sichtbar (z.B. `env` Befehl)
- Secrets werden als Dateien unter `/run/secrets/` eingehängt – sicherer

Skripte lesen Passwörter so:
```bash
MYSQL_PASSWORD=$(cat /run/secrets/db_password)
```

---

### `srcs/requirements/nginx/Dockerfile`

```dockerfile
FROM debian:bookworm            # Basis: minimales Debian Linux
RUN apt-get install nginx openssl  # Installiere NGINX und SSL-Tools
COPY conf/nginx.conf ...        # Kopiere Konfiguration ins Image
COPY tools/setup-nginx.sh ...   # Kopiere Startskript
EXPOSE 443                      # Dokumentiert: dieser Container nutzt Port 443
ENTRYPOINT ["/usr/local/bin/setup-nginx.sh"]  # Dieses Skript startet beim Container-Start
```

---

### `srcs/requirements/nginx/tools/setup-nginx.sh`

```bash
# Generiert ein selbst-signiertes SSL-Zertifikat (beim ersten Start)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout nginx.key -out nginx.crt \
    -subj "/CN=${DOMAIN_NAME}"

# Startet NGINX im Vordergrund (wichtig für Docker!)
exec nginx -g "daemon off;"
```

`daemon off` ist nötig, weil Docker einen Prozess im **Vordergrund** erwartet. Würde NGINX im Hintergrund laufen, denkt Docker, der Container ist fertig, und stoppt ihn.

---

### `srcs/requirements/nginx/conf/nginx.conf`

```nginx
server {
    listen 443 ssl;                    # Nur HTTPS, kein HTTP
    server_name swied.42.fr;

    ssl_protocols TLSv1.2 TLSv1.3;    # Nur sichere SSL-Versionen

    root /var/www/html/wordpress;      # Hier liegen die WP-Dateien

    location ~ \.php$ {
        fastcgi_pass wordpress:9000;   # PHP → weiter an WordPress-Container
    }
}
```

`wordpress:9000` funktioniert, weil beide Container im selben Docker-Netzwerk `inception` sind. Docker löst den Hostnamen `wordpress` automatisch auf.

---

### `srcs/requirements/wordpress/Dockerfile`

Installiert:
- `php8.2-fpm` – PHP-Prozessmanager
- `php8.2-mysql` – PHP kann mit MySQL/MariaDB reden
- weitere PHP-Erweiterungen (gd, mbstring, xml, zip) – von WordPress benötigt
- `wp-cli` – Kommandozeilen-Tool um WordPress zu installieren/konfigurieren

Ändert PHP-FPM: statt Unix-Socket → TCP Port 9000 (einfacher zwischen Containern).

---

### `srcs/requirements/wordpress/tools/wp-setup.sh`

Beim ersten Start (wenn `wp-config.php` noch nicht existiert):

1. **Wartet** bis MariaDB erreichbar ist (Port 3306)
2. **Lädt WordPress herunter** via `wp core download`
3. **Erstellt `wp-config.php`** mit Datenbankverbindungsdaten
4. **Installiert WordPress** (legt Admin-Account an)
5. **Erstellt zweiten Benutzer** mit Editor-Rolle
6. Setzt Dateiberechtigungen auf `www-data`

Beim Folgestart (wp-config.php existiert bereits): überspringt alles, startet direkt PHP-FPM.

---

### `srcs/requirements/mariadb/Dockerfile`

Installiert `mariadb-server`, legt nötige Verzeichnisse an, kopiert Konfiguration und Startskript.

---

### `srcs/requirements/mariadb/conf/50-server.cnf`

```ini
bind-address = 0.0.0.0   # Hört auf alle Netzwerkinterfaces (nicht nur localhost)
port = 3306
datadir = /var/lib/mysql  # Wo Daten gespeichert werden
```

`bind-address = 0.0.0.0` ist nötig, damit WordPress aus seinem Container heraus die Datenbank erreichen kann.

---

### `srcs/requirements/mariadb/tools/init_db.sh`

Beim ersten Start (Datenverzeichnis leer):

1. **Initialisiert** das MySQL-Datenverzeichnis (`mysql_install_db`)
2. Startet **temporären MariaDB-Server** ohne Netzwerk (nur für Setup)
3. Führt **Setup-SQL** aus:
   - Setzt root-Passwort
   - Erstellt Datenbank
   - Erstellt Benutzer
   - Vergibt Rechte
4. Fährt temporären Server **herunter**
5. Startet MariaDB **normal** mit Netzwerk

---

## 6. Wie die Teile zusammenarbeiten

```
┌─────────────────────────────────────────────────────────┐
│                   Docker-Netzwerk: inception             │
│                                                          │
│  ┌──────────┐     PHP-Request     ┌───────────────────┐  │
│  │  NGINX   │ ──────────────────► │    WordPress      │  │
│  │ Port 443 │                     │  (PHP-FPM :9000)  │  │
│  └──────────┘                     └─────────┬─────────┘  │
│       ▲                                     │            │
│       │                              SQL-Queries         │
│  Browser                                    ▼            │
│  (HTTPS)                          ┌───────────────────┐  │
│                                   │     MariaDB       │  │
│                                   │    Port 3306      │  │
│                                   └───────────────────┘  │
│                                                          │
│  Volumes (auf dem Host gespeichert):                     │
│  wp_files    → /home/swied/data/wordpress                │
│  wp_database → /home/swied/data/mariadb                  │
└─────────────────────────────────────────────────────────┘
```

**Datenfluss bei einem Seitenaufruf:**

1. Browser → `https://swied.42.fr` → NGINX Port 443
2. NGINX prüft: ist es eine `.php`-Datei? → Ja
3. NGINX schickt Anfrage an `wordpress:9000` (FastCGI)
4. PHP-FPM verarbeitet die PHP-Datei
5. WordPress-Code fragt MariaDB: "Gib mir Beitrag #5"
6. MariaDB antwortet mit den Daten
7. WordPress baut HTML zusammen
8. HTML geht zurück: WordPress → NGINX → Browser

---

## 7. Einrichten und Starten

### Voraussetzungen

- Docker und Docker Compose installiert
- `/etc/hosts` enthält: `127.0.0.1 swied.42.fr`

### Schritt 1: Datenverzeichnisse anlegen

```bash
mkdir -p /home/swied/data/wordpress
mkdir -p /home/swied/data/mariadb
```

### Schritt 2: `.env`-Datei erstellen

```bash
cp srcs/.env.example srcs/.env
# srcs/.env nach Bedarf anpassen
```

### Schritt 3: Passwortdateien anlegen

```bash
mkdir -p secrets
echo "sicheres_root_passwort"   > secrets/db_root_password.txt
echo "sicheres_wp_db_passwort"  > secrets/db_password.txt
echo "sicheres_admin_passwort"  > secrets/wp_admin_password.txt
echo "sicheres_editor_passwort" > secrets/wp_user_password.txt
```

### Schritt 4: Starten

```bash
cd srcs
docker compose up --build
```

`--build` zwingt Docker, alle Images neu zu bauen (beim ersten Mal nötig).

### Schritt 5: Aufrufen

Browser öffnen: `https://swied.42.fr`

> Der Browser warnt vor dem Zertifikat (selbst-signiert = nicht von einer offiziellen Stelle). Einfach "Weiter" / "Trotzdem fortfahren" klicken.

WordPress-Admin: `https://swied.42.fr/wp-admin`

### Nützliche Befehle

```bash
# Container-Status prüfen
docker compose ps

# Logs anschauen
docker compose logs -f          # alle
docker compose logs -f nginx     # nur NGINX
docker compose logs -f wordpress # nur WordPress
docker compose logs -f mariadb   # nur MariaDB

# Container stoppen
docker compose down

# Container stoppen + Volumes löschen (ALLES zurücksetzen!)
docker compose down -v

# In laufenden Container einloggen
docker exec -it nginx bash
docker exec -it wordpress bash
docker exec -it mariadb bash
```

---

## 8. Häufige Fragen

**"Container startet nicht"**
→ `docker compose logs <dienstname>` zeigt den Fehler.

**"WordPress-Seite lädt nicht"**
→ Prüfe ob alle drei Container laufen: `docker compose ps`
→ Prüfe ob `/etc/hosts` den Eintrag für `swied.42.fr` hat.

**"Datenbank-Fehler in WordPress"**
→ MariaDB eventuell noch nicht fertig beim WordPress-Start. Das `wp-setup.sh` wartet zwar, aber `docker compose logs mariadb` zeigt ob es Fehler gab.

**"Ich will alles zurücksetzen"**
```bash
docker compose down -v
sudo rm -rf /home/swied/data/wordpress/*
sudo rm -rf /home/swied/data/mariadb/*
docker compose up --build
```

**"Was ist der Unterschied zwischen Image und Container?"**
→ Image = gespeicherter Bauplan (auf Festplatte). Container = laufende Instanz davon (im RAM). Aus einem Image können viele Container starten.

**"Warum kein HTTP, nur HTTPS?"**
→ Das ist Anforderung des Projekts. NGINX hört nur auf Port 443 (HTTPS), nicht auf Port 80 (HTTP).

**"Wo werden WordPress-Dateien gespeichert?"**
→ Im Volume `wp_files`, das auf `/home/swied/data/wordpress` auf dem Host zeigt. Auch wenn der Container gelöscht wird, bleiben die Daten dort erhalten.

**"Warum sind Passwörter in `.txt`-Dateien statt in `.env`?"**
→ Docker Secrets sind sicherer. Sie werden als gemountete Dateien unter `/run/secrets/` eingebunden und nicht als Umgebungsvariablen exponiert. Außerdem landet `.env` theoretisch schneller versehentlich in Git als separate Secret-Dateien.
