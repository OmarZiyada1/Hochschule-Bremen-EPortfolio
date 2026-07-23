# Setup — von `git clone` bis zur laufenden Anwendung

Diese Anleitung ist für jemanden geschrieben, der das Repository frisch klont
und nichts vorinstalliert hat. Sie beschreibt den Stand von Branch `main`.

Alle Befehle werden **aus dem Repository-Wurzelverzeichnis** ausgeführt, sofern
nicht anders angegeben.

---

## 1. Voraussetzungen

| Werkzeug        | Version                        | Prüfen mit                |
|-----------------|--------------------------------|---------------------------|
| JDK             | 21 (`java.version` in `pom.xml`) | `java -version`           |
| Docker + Compose| Docker Engine mit `docker compose` (Compose v2 oder neuer) | `docker --version`, `docker compose version` |
| Git             | beliebig                        | `git --version`           |
| OpenSSL         | für das JWT-Secret; in Git Bash enthalten | `openssl version` |

Maven wird **nicht** gebraucht — das Repository bringt den Maven Wrapper
(`backend/mvnw`, `backend/mvnw.cmd`) mit.

Node.js/pnpm werden nur für das Frontend gebraucht, das in `main` nicht
enthalten ist (siehe Abschnitt 6).

Getestet wurde diese Anleitung unter Windows 11 mit Temurin JDK 21.0.8,
Docker 29.1.5 und Docker Compose v5.0.1.

---

## 2. Datenbank starten

Die Datenbank läuft als Container, definiert in `docker-compose.yml`:

- Image: `postgres:16`
- Containername: `eportfolio-db`
- Compose-Projektname: `eportfolio`
- Port: `${POSTGRES_PORT}` auf dem Host → `5432` im Container (Default `5432:5432`)
- Volume: `pgdata`, wegen des Projektnamens tatsächlich `eportfolio_pgdata`, gemountet auf `/var/lib/postgresql/data`

`docker-compose.yml` liest `POSTGRES_DB`, `POSTGRES_USER` und
`POSTGRES_PASSWORD` aus der `.env`. Alle drei sind mit `:?`-Syntax als
Pflichtwerte markiert — fehlt einer, bricht Compose mit einer Meldung ab, statt
mit Defaults zu starten. Also zuerst Schritt 3, dann:

```bash
docker compose up -d db
```

Prüfen:

```bash
docker ps --filter name=eportfolio-db
```

Es gibt (noch) keine Container für Backend und Frontend; die entsprechenden
Blöcke in `docker-compose.yml` sind auskommentiert.

---

## 3. `.env` anlegen

Die `.env` liegt im Repository-Wurzelverzeichnis und wird **nicht** eingecheckt
(`.gitignore`). Vorlage ist `.env.example`:

```bash
cp .env.example .env
```

Gelesen wird die Datei von zwei Stellen:

- `docker-compose.yml` — Compose lädt `.env` aus dem Verzeichnis, in dem es
  aufgerufen wird.
- `backend/src/main/resources/application-dev.yml` — importiert
  `optional:file:../.env[.properties]` und `optional:file:./.env[.properties]`,
  damit der Start sowohl aus `backend/` als auch aus dem Wurzelverzeichnis
  funktioniert. `optional:` bedeutet: fehlt die Datei, ist das kein Fehler — die
  Werte können stattdessen echte Umgebungsvariablen sein.

### Die Variablen

| Variable                | Pflicht | Wird gelesen von | Wenn sie fehlt |
|-------------------------|---------|------------------|----------------|
| `POSTGRES_HOST`         | ja (Backend) | `application-dev.yml` (JDBC-URL) | Start bricht ab: Platzhalter in der Datasource-URL nicht auflösbar |
| `POSTGRES_PORT`         | ja (Backend) | `application-dev.yml`, `docker-compose.yml` (Default `5432`) | wie oben |
| `POSTGRES_DB`           | ja      | beide            | Compose bricht ab mit „POSTGRES_DB fehlt …" |
| `POSTGRES_USER`         | ja      | beide            | Compose bricht ab mit „POSTGRES_USER fehlt …" |
| `POSTGRES_PASSWORD`     | ja      | beide            | Compose bricht ab mit „POSTGRES_PASSWORD fehlt …" |
| `JWT_SECRET`            | **ja**  | `application.yml` → `app.security.jwt.secret` | **Die Anwendung startet nicht.** Es gibt bewusst keinen Default-Wert im Code. |
| `CORS_ERLAUBTE_ORIGINS` | nein    | `application.yml`, Default `http://localhost:5173` | Default greift |
| `DEV_TEST_PASSWORT`     | nein, aber praktisch nötig | `DevTestnutzerSeeder` | Die App startet, legt aber **keine** Testnutzer an und schreibt eine Warnung ins Log. Ohne Testnutzer kann man sich nirgends anmelden. |

### JWT-Secret erzeugen

Das ist der Punkt, an dem man ohne Anleitung hängen bleibt. `JWT_SECRET` hat
keinen eingebauten Fallback, und der Wert muss lang genug sein: signiert wird
mit HS512, `JwtService` verlangt mindestens **64 Byte** Schlüsselmaterial und
wirft sonst beim Start eine `IllegalStateException`.

```bash
openssl rand -base64 64
```

Die Ausgabe (einzeilig, ohne Zeilenumbrüche) in die `.env` eintragen:

```
JWT_SECRET=<hier die Ausgabe einfügen>
```

`JwtService` liest den Wert zuerst als Base64 und fällt auf die Rohbytes
zurück, falls es kein gültiges Base64 ist — eine ausreichend lange Passphrase
funktioniert also auch, ist aber schwächer.

Ohne OpenSSL geht es auch mit PowerShell:

```powershell
$b = New-Object byte[] 64
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
[Convert]::ToBase64String($b)
```

### Weitere Werte

`POSTGRES_PASSWORD` und `DEV_TEST_PASSWORT` sind in der Vorlage `change-me` und
müssen ersetzt werden. Achtung bei `POSTGRES_PASSWORD`: siehe Abschnitt 8, das
Passwort steckt nach dem ersten Start im Volume fest.

---

## 4. Backend starten

```bash
cd backend
./mvnw spring-boot:run
```

Unter Windows in PowerShell oder CMD stattdessen:

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

Zum Profil: `application.yml` setzt `spring.profiles.default: dev`. Ohne
gesetztes `SPRING_PROFILES_ACTIVE` läuft die Anwendung also im Profil `dev` —
das ist der Normalfall für lokale Entwicklung und die Voraussetzung dafür, dass
die `.env` geladen wird und der Testnutzer-Seeder greift. Ein anderes Profil
(`prod`, `staging`) existiert bisher nicht.

Der Port ist der Spring-Boot-Default **8080**; in keiner `application*.yml`
steht ein `server.port`.

Beim Start führt Flyway die Migrationen aus `classpath:db/migration` aus;
Hibernate steht auf `ddl-auto: validate` und legt selbst nichts an.

**Prüfen, dass es läuft:**

```bash
curl http://localhost:8080/actuator/health
```

Erwartete Antwort: `{"status":"UP", ...}` — der Pfad ist ohne Token freigegeben.
Im Log sollten außerdem die Zeilen von Flyway (`Successfully validated 7
migrations` bzw. `Migrating schema "public"`) und beim ersten Lauf drei Zeilen
`Dev-Testnutzer angelegt: …` auftauchen.

DevTools sind aktiv: gespeicherte Änderungen an Java-Klassen lösen einen
Neustart aus, sofern die IDE neu kompiliert (in `.vscode/settings.json` ist der
Auto-Build dafür eingeschaltet).

---

## 5. Anmelden und die API ausprobieren

### Dev-Testnutzer

`DevTestnutzerSeeder` legt im Profil `dev` drei aktive Konten an — nur, wenn
`DEV_TEST_PASSWORT` gesetzt ist. Das Passwort ist für alle drei derselbe Wert
aus der `.env`. Die Domain `dev.invalid` ist nach RFC 2606 garantiert nicht
auflösbar; das sind ausdrücklich Entwicklungsdaten.

| E-Mail (Login-Kennung)      | Rolle       |
|-----------------------------|-------------|
| `dev-studi@dev.invalid`     | STUDIERENDE |
| `dev-redakteur@dev.invalid` | REDAKTEUR   |
| `dev-admin@dev.invalid`     | ADMIN       |

Angemeldet wird sich mit der **privaten** E-Mail-Adresse (`email`). Die
HSB-Adresse (`hsbEmail`, z. B. `dev-admin@hs-bremen.de`) ist nur
Zugehörigkeitsnachweis; ein Login damit schlägt fehl.

### Login per curl

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dev-admin@dev.invalid","passwort":"<DEV_TEST_PASSWORT>"}'
```

Antwort enthält `token`. Damit:

```bash
curl http://localhost:8080/api/auth/me -H "Authorization: Bearer <token>"
```

### Swagger-UI

- URL: <http://localhost:8080/swagger-ui.html> (leitet auf `/swagger-ui/index.html`)
- OpenAPI-Dokument: <http://localhost:8080/v3/api-docs>

Die Oberfläche ist **nur im Profil `dev`** erreichbar: in `application.yml`
stehen `springdoc.swagger-ui.enabled` und `springdoc.api-docs.enabled` auf
`false`, `application-dev.yml` schaltet beide ein. Diese Richtung ist Absicht —
ein später angelegtes Profil (`prod`, `staging`) erbt automatisch „aus".

So meldet man sich in der UI an:

1. `POST /api/auth/login` aufklappen, „Try it out", im Body eines der oben
   genannten Dev-Konten und das `DEV_TEST_PASSWORT` eintragen, ausführen.
2. Den Wert des Felds `token` aus der Antwort kopieren.
3. Oben rechts auf „Authorize" klicken und **nur das Token** einfügen — das
   Präfix `Bearer ` ergänzt die Oberfläche selbst.

Danach schickt die UI bei jedem Aufruf `Authorization: Bearer <token>` mit.
Weil bisher nur die drei Auth-Endpoints existieren, ist außer ihnen nichts zu
sehen.

---

## 6. Frontend starten

Im Branch `main` gibt es **kein** `frontend/`-Verzeichnis. Das Frontend liegt
auf Branch
`KAN-6-Frontend-Projekt-Setup-Design-Tokens-aus-Figma-übernehmen` und ist dort
ein **Scaffold**: das unveränderte Vite-/React-/shadcn-Startprojekt mit einer
`App.tsx`, die „Project ready!" und einen Button anzeigt. Es gibt keine Seiten,
kein Routing und keine Anbindung an das Backend.

Wer es sich ansehen will:

```bash
git checkout KAN-6-Frontend-Projekt-Setup-Design-Tokens-aus-Figma-übernehmen
cd frontend
pnpm install
pnpm dev
```

Paketmanager ist pnpm (im Repo liegt `pnpm-lock.yaml` und
`pnpm-workspace.yaml`). Der Vite-Dev-Server läuft standardmäßig auf Port 5173 —
genau die Adresse, die in `CORS_ERLAUBTE_ORIGINS` voreingestellt ist. Ob der
Port tatsächlich 5173 ist, ist nicht verifiziert; in `vite.config.ts` wurde
nicht nachgesehen.

---

## 7. Tests ausführen

```bash
cd backend
./mvnw test
```

Stand `main`: **81 Tests, alle grün** (`Tests run: 81, Failures: 0, Errors: 0,
Skipped: 0`). Sie verteilen sich auf sechs Testklassen:

- `EportfolioApplicationTests` — 1 (Kontext lädt)
- `auth/AnmeldeversuchServiceTest` — 7
- `auth/AuthControllerTest` — 14
- `auth/JwtServiceTest` — 6
- `auth/AuthServiceTest` — Rest, größtenteils in `@Nested`-Klassen
- `projekt/ProjektBerechtigungServiceTest` — Rest, in 10 `@Nested`-Klassen entlang der Rechtematrix

Die genaue Aufteilung der letzten beiden ist aus dem Surefire-Report nicht
eindeutig ablesbar, weil verschachtelte Klassen dort unter ihrem
`@DisplayName` statt unter dem Klassennamen erscheinen.

`TestUser` und `TestProjekt` sind Hilfsklassen ohne eigene Tests.

**Wichtig:** Die Tests brauchen eine laufende Datenbank und eine gültige
`.env`. `EportfolioApplicationTests` ist ein `@SpringBootTest`, startet also den
kompletten Kontext inklusive Datasource und Flyway. Ohne Container schlägt der
Testlauf fehl. Eine Testkonfiguration mit In-Memory-DB oder Testcontainers gibt
es nicht.

---

## 8. Aufräumen

```bash
# Backend beenden: Strg+C im Terminal, in dem mvnw läuft

# Container stoppen (Daten bleiben im Volume erhalten)
docker compose stop db

# Container entfernen, Volume behalten
docker compose down

# Container UND Datenbankinhalt entfernen
docker compose down -v

# Prüfen, ob Port 8080 noch belegt ist
netstat -ano | findstr :8080     # Windows
lsof -i :8080                    # macOS/Linux
```

---

## 9. Wenn etwas nicht startet

### `docker compose up` bricht sofort ab mit „POSTGRES_… fehlt"

Es gibt keine `.env`, oder sie liegt nicht im Verzeichnis, aus dem `docker
compose` aufgerufen wird. `cp .env.example .env` im Repository-Wurzelverzeichnis
ausführen und die Werte setzen.

### `APPLICATION FAILED TO START` — `JwtEigenschaften failed: Reason: darf nicht leer sein`

`JWT_SECRET` ist leer oder fehlt. Es gibt keinen Default im Code. Wert erzeugen
mit `openssl rand -base64 64` und in die `.env` eintragen. Ist die Variable gar
nicht vorhanden, scheitert Spring stattdessen schon daran, den Platzhalter
`${JWT_SECRET}` aufzulösen — die Meldung sieht dann anders aus, die Ursache ist
dieselbe.

### `IllegalStateException: JWT_SECRET ist zu kurz`

Vollständige Meldung: `JWT_SECRET ist zu kurz: HS512 braucht mindestens 64 Byte
Schluesselmaterial. Neuen Wert erzeugen mit: openssl rand -base64 64`. Genau das
tun und den kompletten Wert einsetzen.

### Port 8080 ist belegt

Meldung: `Web server failed to start. Port 8080 was already in use.` Meist läuft
noch eine ältere Instanz der Anwendung. Prozess-ID ermitteln und beenden:

```bash
netstat -ano | findstr :8080        # Windows: letzte Spalte ist die PID
taskkill /PID <pid> /F              # Windows
```

```bash
lsof -i :8080                       # macOS/Linux
kill <pid>
```

Alternativ mit anderem Port starten:
`./mvnw spring-boot:run -Dspring-boot.run.arguments=--server.port=8081`.

### `FATAL: password authentication failed for user "eportfolio"`

Das Passwort in der `.env` passt nicht zu dem, was im Volume steht. Postgres
wertet `POSTGRES_PASSWORD` **nur beim allerersten Start** aus, wenn das
Datenverzeichnis leer ist. Wird das Passwort später in der `.env` geändert,
behält die Datenbank im Volume `eportfolio_pgdata` das alte.

Zwei Wege:

1. Passwort in der `.env` wieder auf den Wert setzen, mit dem das Volume
   angelegt wurde.
2. Das Volume verwerfen und neu aufbauen — **alle Daten sind danach weg**,
   Flyway legt das Schema beim nächsten Backend-Start neu an:

   ```bash
   docker compose down -v
   docker compose up -d db
   ```

### `Connection refused` beim Backend-Start

Der Container läuft nicht oder ist noch nicht bereit. `docker ps --filter
name=eportfolio-db` prüfen; frisch gestartetes Postgres braucht ein paar
Sekunden. Ein Healthcheck ist in `docker-compose.yml` nicht definiert, das
Backend wartet also nicht.

### Kein Login möglich, keine Testnutzer vorhanden

Im Log steht `DEV_TEST_PASSWORT ist nicht gesetzt - es werden keine Testnutzer
angelegt.` Wert in der `.env` ergänzen und die Anwendung neu starten. Ist die
Anwendung schon einmal ohne den Wert gelaufen, reicht ein Neustart — der Seeder
legt fehlende Konten nach.

Wird `DEV_TEST_PASSWORT` **geändert**, nachdem die Konten existieren, ändert der
Seeder die Passwörter nicht: er überspringt vorhandene E-Mail-Adressen. Dann
entweder das alte Passwort weiterverwenden oder die Zeilen aus `app_user`
löschen.

### `429 ZU_VIELE_ANMELDEVERSUCHE`

Nach 5 Fehlversuchen ist die Kombination aus E-Mail bzw. IP für 15 Minuten
gesperrt (`app.security.anmeldeversuche` in `application.yml`). Der Zähler liegt
nur im Arbeitsspeicher — ein Neustart der Anwendung hebt die Sperre sofort auf.

### Flyway meldet `Validate failed` / Checksum-Fehler

Eine bereits ausgeführte Migrationsdatei wurde nachträglich geändert.
Migrationen werden nicht editiert, sondern durch eine neue Datei ergänzt. Lokal
hilft `docker compose down -v` und ein Neuaufbau.
