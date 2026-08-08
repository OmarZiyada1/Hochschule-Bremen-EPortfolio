# Setup — von `git clone` bis zur laufenden Anwendung

Diese Anleitung ist für jemanden geschrieben, der das Repository frisch klont
und nichts vorinstalliert hat. Sie beschreibt den Stand von Branch `main`
einschließlich KAN-14 (Stammdaten-Endpoints), dessen Merge noch aussteht.

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

Wer alles im Container laufen lässt (Abschnitt 2), braucht von dieser Liste
nur Docker, Git und OpenSSL: JDK, Node.js und pnpm stecken dann in den
Images. JDK 21 wird erst gebraucht, um das Backend auf dem Host zu starten
(Abschnitt 4) oder die Tests laufen zu lassen (Abschnitt 7); Node.js und pnpm
erst für das Frontend auf dem Host (Abschnitt 6).

Getestet wurde diese Anleitung unter Windows 11 mit Temurin JDK 21.0.8,
Docker 29.1.5 und Docker Compose v5.0.1.

---

## 2. Container starten

Es gibt drei Betriebsarten. Sie liegen in **getrennten Compose-Projekten**,
haben eigene Ports und eigene Volumes und können deshalb nebeneinander
laufen. Sie teilen sich insbesondere **keine Datenbank**: wer in DEV etwas
anlegt, findet es in ARTIFACT-DEV nicht wieder.

|  | DEV | ARTIFACT-DEV | PROD |
|---|---|---|---|
| Zweck | entwickeln | Auslieferungsstand prüfen | Produktivkonfiguration |
| Backend | `spring-boot:run`, Quellcode gemountet | Fat-Jar im JRE-Image | Fat-Jar im JRE-Image |
| Frontend | Vite-Dev-Server | Build hinter nginx | Build hinter nginx |
| Hot Reload | ja | nein | nein |
| Spring-Profil | `dev` | `dev` | `prod` |
| Dateien | Dateisystem | Dateisystem | Azure Blob Storage |
| Mails | Serverkonsole | Serverkonsole | SMTP-Relay |
| Swagger-UI | an | an | aus |
| Dev-Testnutzer | ja | ja | nein |
| Zugangsdaten nötig | nein | nein | **ja** |
| Oberfläche | 5173 | 5273 | 5373 |
| Backend | 8080 | 8180 | 8280 |
| Datenbank | 5432 | 5433 | 5434 |
| Compose-Projekt | `eportfolio-dev` | `eportfolio-artifact` | `eportfolio-prod` |

**ARTIFACT-DEV heißt so, weil beides zutrifft:** ausgeliefert wird das
gebaute Artefakt, konfiguriert ist weiterhin die Entwicklung. Diese
Betriebsart beantwortet die Frage „läuft mein Code auch als gebautes
Artefakt und nicht nur im Dev-Server?", nicht die Frage „verhält sich das
System wie im Betrieb?". Für die zweite Frage gibt es PROD.

### Die Befehle

Jede Betriebsart nennt ihre beiden Dateien ausdrücklich:

```bash
docker compose -f compose.base.yml -f compose.dev.yml      up -d --build
docker compose -f compose.base.yml -f compose.artifact.yml up -d --build
docker compose -f compose.base.yml -f compose.prod.yml     up -d --build
```

Dieselben Dateien gelten für alles Weitere, also `ps`, `logs`, `exec`,
`stop`, `down`. Wer sich das nicht merken will, nimmt das Menü (siehe
unten).

`compose.base.yml` enthält, was in allen drei gleich ist. Alles, was sich
unterscheidet, steht in genau einer Overlay-Datei: Projektname, Ports,
Bau-Stufe, Spring-Profil, Volumes. Wer wissen will, was eine Betriebsart
ausmacht, liest **eine** Datei.

### `docker compose up` ohne `-f` scheitert mit Absicht

```
no configuration file provided: not found
```

Das ist kein Fehler im Aufbau, sondern der Zweck der Namensgebung. Compose
findet nur Dateien namens `compose.yml`, `compose.yaml`,
`docker-compose.yml` oder `docker-compose.yaml` von allein, und eine
`docker-compose.override.yml` daneben zieht es unsichtbar mit. Genau das
wollen wir hier nicht: bei drei Betriebsarten muss aus dem Befehl ablesbar
sein, welche lief. Deshalb heißt die Basisdatei `compose.base.yml`, und
deshalb gibt es keine Override-Datei mehr.

### Nebeneinander laufen lassen

Weil jede Betriebsart ein eigenes Projekt ist, stören sie sich nicht:

```bash
docker compose -f compose.base.yml -f compose.dev.yml      up -d
docker compose -f compose.base.yml -f compose.artifact.yml up -d
docker ps --filter name=eportfolio- --format "table {{.Names}}\t{{.Status}}"
```

```
eportfolio-artifact-backend-1   Up (healthy)
eportfolio-artifact-db-1        Up (healthy)
eportfolio-artifact-frontend-1  Up
eportfolio-dev-backend-1        Up (healthy)
eportfolio-dev-db-1             Up (healthy)
eportfolio-dev-frontend-1       Up
```

Die Volumes sind ebenso getrennt (`eportfolio-dev_pgdata` gegen
`eportfolio-artifact_pgdata`). Der Preis dafür sind drei Datenstände: jede
Betriebsart spielt beim ersten Start ihre eigenen Migrationen ein und füllt
ihre eigene Datenbank mit den Dev-Daten.

### Menü statt Befehle

Wer sich die Befehle nicht merken will, startet das Menü im
Wurzelverzeichnis:

```powershell
.\eportfolio.ps1
.\eportfolio.ps1 -Mode artifact    # mit vorgewählter Betriebsart
```

Im Kopf steht immer, welche Betriebsart gewählt ist; alle Punkte beziehen
sich darauf, gewechselt wird mit `b`. Es bündelt Starten und Bauen, Status
(auch über alle Betriebsarten hinweg), Gesundheit, Logs je Dienst, Shell und
`psql`, die Testläufe sowie das Aufräumen. Die löschenden Punkte fragen
vorher nach und benennen, was verloren geht. Jeder Docker-Befehl wird vor
der Ausführung angezeigt, damit man ihn auch von Hand verwenden kann.

Weigert sich PowerShell wegen der Ausführungsrichtlinie:

```powershell
powershell -ExecutionPolicy Bypass -File .\eportfolio.ps1
```

### Ein Origin

Das Frontend spricht die API unter der Adresse an, unter der es selbst
ausgeliefert wird, in DEV also `http://localhost:5173/api/…`. In DEV leitet
der Vite-Dev-Server weiter (`server.proxy` in `vite.config.ts`), in
ARTIFACT-DEV und PROD nginx (`frontend/nginx.conf`). Der Browser sieht
deshalb nie einen fremden Ursprung, es gibt kein CORS und keinen Preflight,
und im Anwendungscode steht keine Basis-URL.

### PROD braucht echte Zugangsdaten

`application-prod.yml` hat für jeden Pflichtwert bewusst keinen Default.
Fehlen die Werte, startet das Backend nicht und nennt beim Beenden, welche:

```
APPLICATION FAILED TO START

Reason: java.lang.IllegalStateException: app.storage.provider=azure, aber diese
Pflichtwerte fehlen: app.storage.container (AZURE_STORAGE_CONTAINER),
app.storage.connection-string (AZURE_STORAGE_CONNECTION_STRING).
Sie kommen aus der Umgebung, Vorlage: .env.example
```

`compose.prod.yml` reicht die Werte deshalb **ohne** die `:?`-Syntax durch,
obwohl Compose damit früher abbrechen könnte: die Meldung der Anwendung
nennt den fehlenden Schlüssel samt Herkunft und ist die nützlichere. Sie ist
außerdem dieselbe, die beim echten Ausrollen erscheint.

Ausgefüllt werden die acht Werte im zweiten Block der `.env` (Abschnitt 3).
Einzige Ausnahme ist `MAIL_PORT`: dort steht in `compose.prod.yml` ein
Default von 587, weil ein leerer Wert einen Umwandlungsfehler auslösen und
damit die eigentliche Meldung verdecken würde.

### In PROD hängt die Gesundheit am Mailserver

Weil im Profil `prod` `spring.mail.host` gesetzt ist, legt Spring Boot von
allein eine Gesundheitsprüfung für den Mailserver an. Sie öffnet bei **jedem**
Aufruf von `/actuator/health` eine SMTP-Verbindung. Ist das Relay nicht
erreichbar, ist der Container folgerichtig `unhealthy`:

```
HTTP 503

{"status":"DOWN","components":{
  "db":{"status":"UP"},
  "mail":{"status":"DOWN","details":{"error":"jakarta.mail.MessagingException: ..."}}}}
```

Das ist kein Fehler des Container-Aufbaus, sondern die richtige Auskunft: ohne
Mailversand kann sich niemand registrieren (Contract §3.1.1). Mit einem
erreichbaren Relay meldet dieselbe Prüfung `UP`.

Wichtig ist nur, dass sie **antwortet**. JavaMail wartet ohne Timeout
unbegrenzt; `/actuator/health` blieb dann stumm, der Docker-Healthcheck lief
in seinen eigenen Timeout, und am Container stand `unhealthy` ohne jeden
Hinweis auf den Grund. `application-prod.yml` setzt deshalb
`connectiontimeout`, `timeout` und `writetimeout` auf je 5000 ms. Die Antwort
kommt damit nach gut fünf Sekunden und nennt die Ursache.

In DEV und ARTIFACT-DEV tritt das nicht auf: dort läuft der Log-Adapter,
`spring.mail.host` ist nicht gesetzt, und die Prüfung entsteht gar nicht.

### Nur die Datenbank

Wer Backend und Frontend auf dem Host starten will (Abschnitte 4 und 6),
braucht nur die Datenbank. Sinnvoll ist dafür die von DEV:

```bash
docker compose -f compose.base.yml -f compose.dev.yml up -d db
```

Der Dienst hat einen Healthcheck (`pg_isready`). Das Backend **im Container**
wartet darüber; beim Start von Hand ersetzt er das Warten nicht.

### `POSTGRES_HOST` und `POSTGRES_PORT`, die Falle

Die beiden Werte in der `.env` beschreiben den Weg **vom Host** zur
Datenbank und bleiben deshalb auf `localhost` und dem veröffentlichten Port.
Innerhalb eines Compose-Netzes gilt etwas anderes: dort heißt die Datenbank
`db` und hört immer auf `5432`. `compose.base.yml` setzt diese beiden Werte
für den Backend-Container daher fest und liest die `.env` an dieser Stelle
nicht.

`POSTGRES_PORT` ist zugleich der Host-Port, den **DEV** veröffentlicht. Das
ist Absicht und der Grund, warum DEV als einzige Betriebsart keine eigene
Portvariable für die Datenbank hat: wer das Backend aus der IDE gegen die
DEV-Datenbank startet, trifft damit denselben Port. ARTIFACT-DEV und PROD
haben eigene Variablen, weil sie für den Start aus der IDE nicht gedacht
sind.

---

## 3. `.env` anlegen

Die `.env` liegt im Repository-Wurzelverzeichnis und wird **nicht** eingecheckt
(`.gitignore`). Vorlage ist `.env.example`:

```bash
cp .env.example .env
```

Gelesen wird die Datei von zwei Stellen:

- die `compose.*.yml` — Compose lädt `.env` aus dem Verzeichnis, in dem es
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
| `POSTGRES_PORT`         | ja (Backend) | `application-dev.yml`, `compose.dev.yml` (Default `5432`) | wie oben |
| `POSTGRES_DB`           | ja      | beide            | Compose bricht ab mit „POSTGRES_DB fehlt …" |
| `POSTGRES_USER`         | ja      | beide            | Compose bricht ab mit „POSTGRES_USER fehlt …" |
| `POSTGRES_PASSWORD`     | ja      | beide            | Compose bricht ab mit „POSTGRES_PASSWORD fehlt …" |
| `JWT_SECRET`            | **ja**  | `application.yml` → `app.security.jwt.secret` | **Die Anwendung startet nicht.** Es gibt bewusst keinen Default-Wert im Code. |
| `CORS_ALLOWED_ORIGINS`  | im Profil `dev` nein, im Profil `prod` ja | `application.yml`, Default `http://localhost:5173`; `application-prod.yml` ohne Default | im `dev` greift der Default, im `prod` startet die Anwendung nicht |
| `DEV_TEST_PASSWORD`     | nein, aber praktisch nötig | `DevTestUserSeeder` | Die App startet, legt aber **keine** Testnutzer an und schreibt eine Warnung ins Log. Ohne Testnutzer kann man sich nirgends anmelden. |

Seit KAN-50 kommen vier weitere Variablen dazu. Sie gehören **ausschließlich
zum Profil `prod`**; zum Entwickeln bleiben sie leer, denn dort liegen Dateien
im Dateisystem und Mails in der Serverkonsole (API-Contract §6.8):

| Variable | Wird gelesen von | Wenn sie im Profil `prod` fehlt |
|----------|------------------|----------------------------------|
| `AZURE_STORAGE_CONTAINER` | `app.storage.container` | Start bricht ab: `app.storage.provider=azure, aber diese Pflichtwerte fehlen: app.storage.container (AZURE_STORAGE_CONTAINER)` |
| `AZURE_STORAGE_CONNECTION_STRING` | `app.storage.connection-string` | wie oben, mit dem anderen Schlüssel. Der Wert ist ein Geheimnis (er enthält den Kontoschlüssel) |
| `MAIL_FROM_ADDRESS` | `app.mail.from-address` | Start bricht ab |
| `APP_BASE_URL` | `app.mail.base-url` | Start bricht ab |

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

Dieser Abschnitt beschreibt den Start **auf dem Host**. Wer den Weg aus
Abschnitt 2 gewählt hat, hat das Backend bereits laufen; dort steht auch, wie
eine Codeänderung im Container wirksam wird.

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
die `.env` geladen wird und der Testnutzer-Seeder greift.

Seit KAN-50 gibt es daneben `application-prod.yml`. Es wird zum Entwickeln nicht
gebraucht und ist bewusst unbequem: es liest **keine** `.env`, sondern
ausschließlich die Umgebung des Prozesses, und jeder Wert darin ist Pflicht.
Wer es trotzdem lokal ausprobieren will, setzt alle Variablen aus beiden
Tabellen in Abschnitt 3 als echte Umgebungsvariablen und startet mit
`SPRING_PROFILES_ACTIVE=prod`. Ein Profil `staging` existiert nicht.

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
`Dev-Testnutzer angelegt: …` sowie `Dev-Stammdaten ergaenzt: 46 neue
Datensaetze.` auftauchen (8 Kategorien, 5 Fakultäten, 11 Studiengänge,
22 Module).

Ab dem zweiten Start bleiben beide Seeder still: sie legen nur nach, was fehlt,
und sind damit beliebig oft ausführbar.

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
Zu sehen sind bisher zwei Gruppen: **Auth** (drei Endpoints) und **Stammdaten**
(vier Endpoints). Bei den Stammdaten zeigt die UI bewusst kein Schloss — sie
sind PUBLIC und brauchen kein Token.

### Stammdaten abrufen (ohne Token)

Diese vier Endpoints liefern die Referenzlisten für Filter und Auswahlfelder.
Sie sind sortiert nach `name` und nicht paginiert:

```bash
curl http://localhost:8080/api/kategorien
curl http://localhost:8080/api/fakultaeten
curl http://localhost:8080/api/studiengaenge
curl http://localhost:8080/api/module
```

Die letzten beiden lassen sich filtern — die ID stammt jeweils aus der
übergeordneten Liste:

```bash
curl "http://localhost:8080/api/studiengaenge?fakultaet=<id-aus-/api/fakultaeten>"
curl "http://localhost:8080/api/module?studiengang=<id-aus-/api/studiengaenge>"
```

Eine unbekannte ID ergibt `200` mit leerer Liste (der Parameter filtert, er
adressiert keine Ressource); ein Wert, der keine UUID ist, ergibt `400` im
Fehler-Envelope.

Die Daten kommen vom `DevStammdatenSeeder` und existieren nur im Profil `dev`.
Anders als beim Testnutzer-Seeder braucht er keine Variable in der `.env`.

---

## 6. Frontend starten

Dieser Abschnitt beschreibt den Start **auf dem Host**. Wer den Weg aus
Abschnitt 2 gewählt hat, hat das Frontend bereits laufen.

```bash
cd frontend
pnpm install
pnpm dev
```

Paketmanager ist pnpm; im Repo liegen `pnpm-lock.yaml` und
`pnpm-workspace.yaml`. Die Version steht als `packageManager` in der
`package.json`, Corepack nimmt sie von dort.

Der Vite-Dev-Server hört auf **5173**, festgelegt in `vite.config.ts`
(`strictPort: true`). Fest deshalb, weil `CORS_ALLOWED_ORIGINS` und
`app.mail.base-url` auf diese Adresse zeigen: ein stilles Ausweichen auf 5174
würde beides ins Leere laufen lassen.

`vite.config.ts` leitet außerdem `/api` und `/v3/api-docs` an das Backend
weiter. Ziel ist `http://localhost:8080`, im Container der Dienstname aus
`VITE_PROXY_TARGET`. Damit liegt die API immer unter demselben Ursprung wie
die Oberfläche, und im Anwendungscode steht keine Basis-URL.

Was auf `main` vorhanden ist: Routing, i18n (Deutsch und Englisch),
Design-Tokens samt Token-Galerie unter `/dev/tokens` und die
shadcn-Grundlage. Eine Anbindung an die API gibt es noch nicht,
`frontend/src/api/` ist leer. `pnpm gen:api` erzeugt die Typen aus dem
laufenden Backend nach `src/api/schema.d.ts`.

---

## 7. Tests ausführen

```bash
cd backend
./mvnw test
```

Stand `main` plus KAN-14: **108 Tests, alle grün** (`Tests run: 108,
Failures: 0, Errors: 0, Skipped: 0`). Sie verteilen sich auf neun Testklassen:

| Testklasse | Tests | Art |
|------------|------:|-----|
| `EportfolioApplicationTests` | 1 | Kontext lädt (`@SpringBootTest`) |
| `auth/AnmeldeversuchServiceTest` | 7 | Unit |
| `auth/AuthControllerTest` | 14 | `@WebMvcTest` |
| `auth/AuthServiceTest` | 13 | Unit, teils `@Nested` |
| `auth/JwtServiceTest` | 6 | Unit |
| `projekt/ProjektBerechtigungServiceTest` | 40 | Unit, `@Nested` entlang der Rechtematrix |
| `stammdaten/StammdatenServiceTest` | 9 | Unit |
| `stammdaten/StammdatenControllerTest` | 9 | `@WebMvcTest` |
| `stammdaten/StammdatenIntegrationTest` | 9 | `@SpringBootTest` gegen die echte DB |

Im Surefire-Textreport stehen bei `AuthServiceTest` und
`ProjektBerechtigungServiceTest` `0` Tests, weil verschachtelte Klassen dort
unter ihrem `@DisplayName` erscheinen. Die Zahlen oben stammen aus den
XML-Reports (`target/surefire-reports/TEST-*.xml`).

`TestUser`, `TestProjekt` und `TestStammdaten` sind Hilfsklassen ohne eigene
Tests.

**Wichtig:** Die Tests brauchen eine laufende Datenbank und eine gültige
`.env`. `EportfolioApplicationTests` und `StammdatenIntegrationTest` sind
`@SpringBootTest`s, starten also den kompletten Kontext inklusive Datasource und
Flyway. Ohne Container schlägt der Testlauf fehl. Eine Testkonfiguration mit
In-Memory-DB oder Testcontainers gibt es nicht.

Der Testlauf läuft im Profil `dev` und damit gegen dieselbe Datenbank wie die
Anwendung. Was er schreibt, rollt er wieder zurück (`@Transactional` am
Integrationstest); die Seeder laufen beim Hochfahren des Testkontexts aber
regulär durch, ein Testlauf befüllt eine leere Datenbank also mit den
Dev-Daten.

---

## 8. Aufräumen

**Jeder Befehl gilt nur für die genannte Betriebsart.** Wer alle drei
loswerden will, wiederholt ihn mit `compose.artifact.yml` und
`compose.prod.yml` oder nimmt Menüpunkt 23.

```bash
# Backend beenden: Strg+C im Terminal, in dem mvnw läuft

# Container stoppen (Daten bleiben im Volume erhalten)
docker compose -f compose.base.yml -f compose.dev.yml stop

# Container entfernen, Volumes behalten
docker compose -f compose.base.yml -f compose.dev.yml down

# Container UND die Volumes DIESER Betriebsart entfernen: Datenbankinhalt,
# hochgeladene Dateien, und in DEV zusätzlich das Maven-Repository und
# node_modules. Der nächste Start dauert danach wieder so lange wie der
# allererste.
docker compose -f compose.base.yml -f compose.dev.yml down -v

# Was ist überhaupt noch da?
docker ps   --filter name=eportfolio- --format "table {{.Names}}\t{{.Status}}"
docker volume ls --filter name=eportfolio-

# Prüfen, ob ein Port noch belegt ist (hier DEV-Backend)
netstat -ano | findstr :8080     # Windows
lsof -i :8080                    # macOS/Linux
```

Aus der Zeit vor der Trennung in drei Betriebsarten können Volumes mit dem
Präfix `eportfolio_` übrig sein (ohne Bindestrich, also
`eportfolio_pgdata` statt `eportfolio-dev_pgdata`). Sie gehören zu keinem
der drei Projekte mehr, belegen aber weiter Platz. Vor dem Löschen prüfen,
ob darin noch ein Datenstand liegt, den jemand braucht:

```bash
docker volume ls --filter name=eportfolio_
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

### `APPLICATION FAILED TO START`: „aber diese Pflichtwerte fehlen: app.storage…"

Nur im Profil `prod`. Vollständige Meldung: `app.storage.provider=azure, aber
diese Pflichtwerte fehlen: app.storage.container (AZURE_STORAGE_CONTAINER). Sie
kommen aus der Umgebung, Vorlage: .env.example`. Genannt wird jeder fehlende
Schlüssel mitsamt der Umgebungsvariablen, aus der er kommt.

Zwei Ursachen sind gleich häufig: die Variable ist gar nicht gesetzt, oder sie
ist gesetzt, aber der Prozess sieht sie nicht (etwa weil sie in der `.env`
steht, die im Profil `prod` bewusst nicht geladen wird). In beiden Fällen
enthält der Wert nach der Bindung den nicht aufgelösten Platzhalter, und genau
darauf schlägt die Prüfung an.

Wer das Profil nicht braucht: `SPRING_PROFILES_ACTIVE` nicht setzen, dann läuft
`dev` und keine dieser Variablen wird gebraucht.

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

### Port 5432 ist belegt — `Bind for 0.0.0.0:5432 failed`

Vollständige Meldung von Compose: `driver failed programming external
connectivity … Bind for 0.0.0.0:5432 failed: port is already allocated`. Meist
läuft eine andere Postgres-Instanz (lokale Installation oder der Container eines
anderen Projekts).

Statt die fremde Instanz zu stoppen, reicht ein anderer Host-Port in der `.env`:

```
POSTGRES_PORT=5433
```

Die Variable steuert beides — den Host-Port von DEV in `compose.dev.yml` und die
JDBC-URL in `application-dev.yml`. Ein Wert genügt also, danach
`docker compose up -d db`. Im Container bleibt der Port unverändert 5432.

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
   docker compose -f compose.base.yml -f compose.dev.yml down -v
   docker compose up -d db
   ```

### `Connection refused` beim Backend-Start

Der Container läuft nicht oder ist noch nicht bereit. `docker ps --filter
name=eportfolio-db` prüfen; frisch gestartetes Postgres braucht ein paar
Sekunden.

Der Dienst `db` hat einen Healthcheck (`pg_isready`), und das Backend **im
Container** wartet darüber (`depends_on: condition: service_healthy`). Wer das
Backend von Hand auf dem Host startet, wartet nicht: dort muss die Datenbank
vorher oben sein.

Kommt der Fehler aus dem Backend-Container, zeigt die Adresse in der Meldung,
wo es klemmt. Steht dort `localhost:5432`, greift die `.env` statt der in
`compose.base.yml` fest gesetzten Werte `db` und `5432`. Prüfen mit:

```bash
docker compose -f compose.base.yml -f compose.dev.yml exec backend env | grep POSTGRES
```

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
hilft `docker compose -f compose.base.yml -f compose.dev.yml down -v` und ein Neuaufbau.

### `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` beim Bau des Frontend-Images

pnpm weist Pakete ab, die jünger als 24 Stunden sind. Die Regel ist ein
Standardwert von pnpm 11 und steht nirgends im Repo. Sie trifft jeden frischen
`pnpm install`, also auch den auf dem Host, sobald zuletzt eine sehr neue
Version ins Lockfile gekommen ist.

Der Image-Bau setzt deshalb `PNPM_CONFIG_MINIMUM_RELEASE_AGE=0`, und zwar nur
dort (Begründung im Kommentar in `frontend/Dockerfile`): bei eingefrorenem
Lockfile wird nichts aufgelöst, sondern genau das installiert, was eingecheckt
ist, mitsamt Prüfsummen.

Als Umgebungsvariable und nicht als Schalter am Aufruf, weil jeder
pnpm-Befehl vorab noch einmal selbst `pnpm install` startet: ein
`--config.minimumReleaseAge=0` am `pnpm install` wirkt deshalb nicht auf das
anschließende `pnpm build`. Aus demselben Grund hilft der Schalter auch auf
dem Host nicht weiter.

Auf dem Host bleibt die Regel bewusst aktiv. Wer dort davon aufgehalten wird,
wartet die 24 Stunden ab oder setzt die Variable für die eine Sitzung:

```bash
PNPM_CONFIG_MINIMUM_RELEASE_AGE=0 pnpm test
```

### `failed to stat active key during commit: snapshot … does not exist`

Ein beschädigter Eintrag im Build-Cache von BuildKit, meist nach einem
abgebrochenen Build. Der Cache wird bei jedem weiteren Versuch erneut
gelesen, der Fehler wiederholt sich also unverändert. Gezielt umgehen:

```bash
docker compose -f compose.base.yml -f compose.dev.yml build --no-cache backend
```

### Der Frontend-Container zieht dauerhaft CPU, Vite antwortet nicht mehr

Im Container überwacht Vite die Dateien per Polling, weil Bind Mounts von
Windows keine Dateiereignisse melden. Polling kostet pro Datei und Durchlauf
einen Zugriff. Gerät dabei ein großes Verzeichnis mit in die Überwachung,
lastet der Watcher einen Kern dauerhaft aus, die Event-Loop verhungert, und
der Dev-Server nimmt keine Anfragen mehr an. Von außen sieht das aus wie ein
Timeout, nicht wie ein Fehler.

Prüfen:

```bash
docker stats --no-stream --format "{{.Name}}\t{{.CPUPerc}}"
```

`vite.config.ts` schließt deshalb `node_modules`, `dist`, `.git` und
`.pnpm-store` aus. Der letzte Punkt ist der wichtigste: `pnpm` legt einen
Paketspeicher im Projekt an, sobald das Repository auf einem anderen Laufwerk
liegt als der globale Speicher (unter Windows der Normalfall, Projekt auf
`D:`, Speicher auf `C:`). Das Verzeichnis ist mehrere hundert Megabyte groß
und taucht erst auf, wenn jemand `pnpm install` auf dem Host ausgeführt hat.

Kommt ein weiteres großes Verzeichnis hinzu, gehört es in dieselbe Liste.

### nginx beendet sich mit `host not found in upstream "backend"`

Betrifft nur ARTIFACT-DEV und PROD. nginx löst den Dienstnamen beim
Start auf; existiert der Backend-Container zu diesem Zeitpunkt nicht, bricht
es ab. `depends_on` in `compose.base.yml` verhindert das im Normalfall.
Tritt es doch auf, wurde der Frontend-Container einzeln gestartet: dann
die Betriebsart ohne Dienstnamen starten, also `... up -d` statt `... up -d frontend`.
