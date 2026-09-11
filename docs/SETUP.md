# Setup: von `git clone` bis zur laufenden Anwendung

Diese Anleitung ist für jemanden geschrieben, der das Repository frisch klont
und nichts vorinstalliert hat. Sie beschreibt den Stand von Branch `main`.
Bezeichner, Endpoint-Pfade und Fehlercodes sind seit KAN-49 durchgehend
englisch (`docs/NAMENSSCHEMA.md`); deutsch bleibt allein die Prosa.

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

Maven wird **nicht** gebraucht: das Repository bringt den Maven Wrapper
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

`eportfolio.ps1` im Wurzelverzeichnis ist der bequemste Weg und für den
täglichen Gebrauch gedacht. Es ersetzt keinen Docker-Befehl, sondern setzt sie
zusammen: jeder Aufruf wird vor der Ausführung angezeigt (`> docker compose -f
… up -d`), man kann ihn also jederzeit von Hand weiterverwenden.

```powershell
.\eportfolio.ps1
.\eportfolio.ps1 -Mode artifact    # mit vorgewählter Betriebsart
```

Weigert sich PowerShell wegen der Ausführungsrichtlinie:

```powershell
powershell -ExecutionPolicy Bypass -File .\eportfolio.ps1
```

**Vor dem Menü prüft das Skript drei Dinge** und bricht sonst ab, statt in
einen unverständlichen Docker-Fehler zu laufen: ob `docker` im `PATH` liegt, ob
der Docker-Daemon antwortet (also Docker Desktop läuft), und ob es eine `.env`
neben dem Skript gibt. Fehlt sie, nennt es den Befehl zum Anlegen und die drei
Werte, die mindestens gesetzt sein müssen.

Im Kopf steht immer, welche Betriebsart gewählt ist, mit Projektname,
Spring-Profil und Port der Oberfläche. **Alle Punkte beziehen sich auf diese
eine Betriebsart**, gewechselt wird mit `b`. Die Gruppen:

| Punkte | Was |
| --- | --- |
| `1` bis `5` | Starten und Bauen: starten, neu bauen und starten, nur die Datenbank starten, Images bauen, Images ohne Cache bauen |
| `6` bis `12` | Beobachten: Status, Status **aller** Betriebsarten, Gesundheit (Health, Proxy, OpenAPI in einem Durchgang), Logs folgen für alle Dienste oder je Backend, Frontend, Datenbank |
| `13` bis `18` | Arbeiten: Backend neu übersetzen (löst in DEV den Hot Reload aus), Shell im Backend oder Frontend, `psql` in der Datenbank, Backend-Tests, Frontend-Tests |
| `t`, `tc` | Die Postman-Sammlung aus `postman/` mit Newman gegen die laufende Betriebsart; `tc` räumt nur die Reste eines abgebrochenen Laufs weg |
| `s1` bis `s7` | Saatdaten, siehe nächster Abschnitt |
| `19` bis `24` | Aufräumen: stoppen, Container entfernen, diese Betriebsart samt Datenbank entfernen, Images entfernen, alle drei Betriebsarten entfernen, Build-Cache leeren |

Nach dem Starten nennt das Skript die vier Adressen der gewählten Betriebsart
(Oberfläche, API, Swagger-UI, Health) mit den richtigen Ports, damit man sie
nicht aus der Tabelle oben ablesen muss. In PROD steht dort ausdrücklich, dass
die Swagger-UI abgeschaltet ist.

Die löschenden Punkte sind im Menü mit eckigen Klammern markiert
(`[inkl. ihrer Datenbank]`), fragen vorher nach und benennen, was verloren
geht. `24` betrifft als einziger Punkt **alle** Docker-Projekte auf dem
Rechner und nicht nur dieses.

### Saatdaten

Die Gruppe `s1` bis `s7` füllt und leert die Datenbank der gewählten
Betriebsart. Sie ist in PROD gesperrt: der Produktivbestand entsteht über die
Administrationsseite und nicht über ein Skript, das an der Anwendung vorbei
schreibt.

| Punkt | Was |
| --- | --- |
| `s1` / `s2` | Stammdaten anlegen und entfernen: fünf Fakultäten, 75 Studiengänge und ihre Module, erhoben aus der Confluence-Seite „Fakultäten-Hierarchie". `s2` entfernt die **gesamte** Hierarchie und löst dabei die Fakultäts-, Studiengangs- und Modulangabe der Projekte. |
| `s3` / `s4` | Testbestand der Usability-Testwoche anlegen und entfernen: Konten, rund fünfzig Projekte samt Blöcken und Titelbildern, die zwei gleichbedeutenden Kategorien aus Aufgabe D3, Nominierungen und Änderungsprotokoll. |
| `s5` / `s6` | Eine einzelne Sitzung TN00 bis TN11 vorbereiten und entfernen. `s5` läuft **je Sitzung** und ist zugleich der Rücksetzschritt zwischen zwei Testpersonen. |
| `s7` | Den Bestand gegen die Seed-Prüfliste zählen. Ändert nichts. |

Die Punkte rufen Shell-Skripte im Wurzelverzeichnis auf, dieselbe Bauart wie
die vorhandenen `demo-daten-*.sh`. Unter Windows kommt `bash` mit Git. Jedes
Skript läuft auch ohne das Menü; dann sagt ihm `DB_CONTAINER`, welche
Datenbank gemeint ist.

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

- die `compose.*.yml`: Compose lädt `.env` aus dem Verzeichnis, in dem es
  aufgerufen wird.
- `backend/src/main/resources/application-dev.yml`: importiert
  `optional:file:../.env[.properties]` und `optional:file:./.env[.properties]`,
  damit der Start sowohl aus `backend/` als auch aus dem Wurzelverzeichnis
  funktioniert. `optional:` bedeutet: fehlt die Datei, ist das kein Fehler, die
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

Der zweite Block der `.env` gehört **ausschließlich zum Profil `prod`**; zum
Entwickeln bleibt er leer, denn dort liegen Dateien im Dateisystem und Mails in
der Serverkonsole (API-Contract §6.8). Im Profil `prod` ist jeder dieser acht
Werte Pflicht:

| Variable | Wird gelesen als | Bedeutung |
|----------|------------------|-----------|
| `AZURE_STORAGE_CONTAINER` | `app.storage.container` | Name des Blob-Containers für die hochgeladenen Dateien |
| `AZURE_STORAGE_CONNECTION_STRING` | `app.storage.connection-string` | Verbindungszeichenfolge des Speicherkontos. **Geheimnis**, sie enthält den Kontoschlüssel |
| `MAIL_FROM_ADDRESS` | `app.mail.from-address` | Absender der Verifizierungs- und Rücksetzmails; muss zur Domain des Relays passen |
| `APP_BASE_URL` | `app.mail.base-url` | öffentliche Adresse des Frontends, Basis der Links in diesen Mails, ohne abschließenden Schrägstrich |
| `MAIL_HOST` | `spring.mail.host` | Adresse des SMTP-Relays |
| `MAIL_PORT` | `spring.mail.port` | **587**, der STARTTLS-Port. 465 (SMTPS) funktioniert nicht, siehe Abschnitt 9 |
| `MAIL_USERNAME` | `spring.mail.username` | Kennung des Relay-Kontos, meist die Postfachadresse |
| `MAIL_PASSWORD` | `spring.mail.password` | Passwort oder Anwendungsschlüssel des Relay-Kontos. **Geheimnis** |

Fehlt einer davon, bricht der Start ab und nennt ihn samt Umgebungsvariablen:
`app.storage.provider=azure, aber diese Pflichtwerte fehlen:
app.storage.container (AZURE_STORAGE_CONTAINER)`. `MAIL_PORT` ist die einzige
Ausnahme mit einem Default (587 in `compose.prod.yml`), weil ein leerer Wert
einen Umwandlungsfehler auslöste und damit die eigentliche Meldung verdeckte.

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
zurück, falls es kein gültiges Base64 ist; eine ausreichend lange Passphrase
funktioniert also auch, ist aber schwächer.

Ohne OpenSSL geht es auch mit PowerShell:

```powershell
$b = New-Object byte[] 64
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
[Convert]::ToBase64String($b)
```

### Weitere Werte

`POSTGRES_PASSWORD` und `DEV_TEST_PASSWORD` sind in der Vorlage `change-me` und
müssen ersetzt werden. Achtung bei `POSTGRES_PASSWORD`: siehe Abschnitt 8, das
Passwort steckt nach dem ersten Start im Volume fest.

### PROD-Werte beschaffen (KAN-54)

Die acht Werte des zweiten Blocks stammen aus zwei Fremddiensten. Echte Werte
gehören ausschließlich in die lokale `.env` beziehungsweise die Umgebung des
Prozesses, niemals in dieses Dokument, ins Repository oder in ein Ticket.

**Azure-Speicherkonto** (für `AZURE_STORAGE_CONTAINER` und
`AZURE_STORAGE_CONNECTION_STRING`):

1. Speicherkonto anlegen (Portal oder `az storage account create`):
   Typ StorageV2, Redundanz Standard_LRS genügt, und zwingend
   **„Anonymen Blob-Zugriff zulassen" deaktiviert**. Zur Region: manche
   Abonnements (etwa Azure for Students) lassen nur bestimmte Regionen zu;
   ein Verstoß scheitert mit `RequestDisallowedByAzure`, die erlaubte Liste
   nennt `az policy assignment list --disable-scope-strict-match`.
2. Darin einen Container anlegen, Zugriffsebene **privat** (der Standard).
   Sein Name ist der Wert für `AZURE_STORAGE_CONTAINER`.
3. Die Verbindungszeichenfolge steht im Portal unter Speicherkonto >
   Sicherheit + Netzwerk > Zugriffsschlüssel (oder
   `az storage account show-connection-string`). Sie enthält den
   Kontoschlüssel und ist damit ein Geheimnis.

**SMTP-Relay** (für die fünf `MAIL_*`-Werte und `APP_BASE_URL`): jeder
Anbieter, der authentifiziertes SMTP mit STARTTLS anbietet; im Projekt wird
ein Postfach eines gewöhnlichen Mail-Hosters verwendet. `MAIL_HOST` nennt der
Anbieter, `MAIL_USERNAME` ist die Postfachadresse, `MAIL_FROM_ADDRESS` muss
zur Domain des Relays passen, sonst weist es den Versand ab.
**`MAIL_PORT` muss der STARTTLS-Port sein, üblicherweise 587.** Die Anwendung
erzwingt STARTTLS (`application-prod.yml`); gegen den SMTPS-Port 465, der TLS
ab dem ersten Byte erwartet, kommt keine Verbindung zustande und die
Gesundheitsprüfung meldet `mail DOWN`. `APP_BASE_URL` ist die öffentliche
Adresse des Frontends, für einen lokalen PROD-Lauf also
`http://localhost:5373`, ohne abschließenden Schrägstrich: sie ist die Basis
der Links in den Verifizierungsmails.

### Prüfen, dass die PROD-Werte greifen

Der Reihe nach, jeder Schritt setzt den vorherigen voraus:

1. **Start und Startprotokoll.** `docker compose -f compose.base.yml -f
   compose.prod.yml up -d --build`, dann `... logs backend`. Erwartet sind
   die beiden Zeilen des `ConfigurationStartupLogger`: `Speicher-Adapter=azure`
   mit Kontoname und Container (aus der Verbindungszeichenfolge wird nur der
   Kontoname gelöst, nie der Schlüssel) und `Mail-Adapter=smtp` mit dem
   Absender. Fehlt ein Pflichtwert, bricht der Start ab und nennt ihn
   (Abschnitt 9).
2. **Gesundheit.** `curl http://localhost:8280/actuator/health` muss
   innerhalb weniger Sekunden `"db":{"status":"UP"}` und
   `"mail":{"status":"UP"}` liefern. `mail DOWN` nennt in `details` die
   Ursache; der häufigste Fall ist der falsche Port (465 statt 587).
3. **Mailversand.** Eine Registrierung über `POST /api/auth/register` mit
   echten, erreichbaren Adressen; beide Codes müssen zugestellt werden, die
   Bestätigung über `POST /api/auth/verify` setzt das Konto auf `ACTIVE`.
4. **Speicher.** Nach Login ein Upload über `POST /api/files` und der Abruf
   über `GET /api/files/{id}`: gleicher Inhalt, korrekter `Content-Type`.
5. **Gegenprobe Zugriffsebene.** Die direkte Blob-URL
   (`https://<kontoname>.blob.core.windows.net/<container>/<schlüssel>`, der
   Schlüssel steht in der Spalte `path` der Tabelle `file`) muss **ohne**
   Signatur scheitern, erwartet ist 409 `PublicAccessNotPermitted`. Diese
   Probe gehört dazu, weil eine versehentlich öffentliche Zugriffsebene von
   der Anwendung aus nicht auffällt: ausgeliefert wird immer über
   `GET /api/files/{id}` (§3.15.1).

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
gesetztes `SPRING_PROFILES_ACTIVE` läuft die Anwendung also im Profil `dev`,
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

Erwartete Antwort: `{"status":"UP", ...}`; der Pfad ist ohne Token freigegeben.
Im Log sollten außerdem die Zeilen von Flyway (`Successfully validated 28
migrations` bzw. beim ersten Lauf `Migrating schema "public"`) und die beiden
Dev-Seeder auftauchen: drei Zeilen `Dev-Testnutzer angelegt: …` und
`Dev-Stammdaten ergaenzt: 12 neue Datensaetze.` (8 Kategorien und 4 Semester).

Fakultäten, Studiengänge und Module legt der Seeder **nicht** an. Sie sind eine
Datenlieferung und kein Programmbestandteil und kommen deshalb aus
`stammdaten-seeder.sh` (Menüpunkt `s1`, siehe Abschnitt 2, „Saatdaten").
Ohne diesen Lauf antworten `GET /api/faculties`, `/api/study-programs` und
`/api/modules` mit einer leeren Liste, und im Metadaten-Formular eines Projekts
bleiben die zugehörigen Auswahlfelder leer.

Ab dem zweiten Start bleiben beide Seeder still: sie legen nur nach, was fehlt,
und sind damit beliebig oft ausführbar.

DevTools sind aktiv: gespeicherte Änderungen an Java-Klassen lösen einen
Neustart aus, sofern die IDE neu kompiliert (in `.vscode/settings.json` ist der
Auto-Build dafür eingeschaltet).

---

## 5. Anmelden und die API ausprobieren

### Dev-Testnutzer

`DevTestUserSeeder` legt im Profil `dev` drei aktive Konten an, aber nur, wenn
`DEV_TEST_PASSWORD` gesetzt ist. Das Passwort ist für alle drei derselbe Wert
aus der `.env`. Die Domain `dev.invalid` ist nach RFC 2606 garantiert nicht
auflösbar; das sind ausdrücklich Entwicklungsdaten.

| E-Mail (Login-Kennung)      | Rolle     |
|-----------------------------|-----------|
| `dev-studi@dev.invalid`     | `STUDENT` |
| `dev-redakteur@dev.invalid` | `EDITOR`  |
| `dev-admin@dev.invalid`     | `ADMIN`   |

Angemeldet wird sich mit der **privaten** E-Mail-Adresse (`email`). Die
HSB-Adresse (`hsbEmail`, z. B. `dev-admin@hs-bremen.de`) ist nur
Zugehörigkeitsnachweis; ein Login damit schlägt fehl.

### Login per curl

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dev-admin@dev.invalid","password":"<DEV_TEST_PASSWORD>"}'
```

Antwort enthält `token`. Damit:

```bash
curl http://localhost:8080/api/auth/me -H "Authorization: Bearer <token>"
```

Beide Feldnamen sind englisch, wie alle JSON-Felder der API: `password` und
nicht `passwort`. Ein deutsches Feld ergibt 400 `VALIDATION_FAILED`, weil
`password` dann fehlt.

### Swagger-UI

- URL: <http://localhost:8080/swagger-ui.html> (leitet auf `/swagger-ui/index.html`)
- OpenAPI-Dokument: <http://localhost:8080/v3/api-docs>

Die Oberfläche ist **nur im Profil `dev`** erreichbar: in `application.yml`
stehen `springdoc.swagger-ui.enabled` und `springdoc.api-docs.enabled` auf
`false`, `application-dev.yml` schaltet beide ein. Diese Richtung ist Absicht:
ein später angelegtes Profil (`prod`, `staging`) erbt automatisch „aus".

So meldet man sich in der UI an:

1. `POST /api/auth/login` aufklappen, „Try it out", im Body eines der oben
   genannten Dev-Konten und das `DEV_TEST_PASSWORD` eintragen, ausführen.
2. Den Wert des Felds `token` aus der Antwort kopieren.
3. Oben rechts auf „Authorize" klicken und **nur das Token** einfügen; das
   Präfix `Bearer ` ergänzt die Oberfläche selbst.

Danach schickt die UI bei jedem Aufruf `Authorization: Bearer <token>` mit.
Zu sehen ist die vollständige API: Auth und Registrierung, Projekte, Blöcke,
Workflow, Kommentare, Reaktionen, Dateien, Bearbeitungssperre, Portfolios,
Stammdaten, Nutzerauswahl, Top 10 samt Nominierungen, Support,
Startseitentexte und der Admin-Bereich. Ohne Schloss stehen die Endpoints, die
keinen Token brauchen (nächster Abschnitt).

### Ohne Token abrufbar

Maßgeblich ist `config/SecurityConfig.java`; die vollständige Liste mit
Begründung je Pfad steht in [ARCHITEKTUR.md](ARCHITEKTUR.md), Abschnitt 5.

**Lesend.** Diese Pfade stehen als `GET` auf `permitAll`:

```bash
# Referenzlisten für Filter und Auswahlfelder
curl http://localhost:8080/api/categories
curl http://localhost:8080/api/faculties
curl http://localhost:8080/api/study-programs
curl http://localhost:8080/api/modules
curl http://localhost:8080/api/semesters
curl http://localhost:8080/api/tags

# veröffentlichte Inhalte
curl http://localhost:8080/api/projects
curl http://localhost:8080/api/projects/<id>
curl http://localhost:8080/api/projects/<id>/blocks
curl http://localhost:8080/api/projects/<id>/comments
curl http://localhost:8080/api/portfolios/<userId>
curl http://localhost:8080/api/files/<id>          # auch als HEAD
curl http://localhost:8080/api/top10
curl http://localhost:8080/api/site-content
```

Offen ist dabei nur die Filterkette. Was ein nicht angemeldeter Aufrufer
tatsächlich zu sehen bekommt, entscheiden `ProjectPermissionService` und
`FileService` an Status und Eigentümer der Ressource: ein Projekt in `DRAFT`
ergibt hier 404 und nicht 401.

**Schreibend.** Sechs Pfade sind ausdrücklich ohne Token erreichbar, alles
Übrige braucht eines:

| Pfad | Warum |
| --- | --- |
| `POST /api/auth/login` | hier holt man sich das Token erst |
| `POST /api/auth/register`, `/verify`, `/verify/resend` | wer sich registriert, hat noch kein Konto |
| `POST /api/auth/forgot-password`, `/reset-password` | wer sein Passwort vergessen hat, kann sich nicht anmelden |
| `POST /api/support` | der häufigste Support-Fall ist „ich komme nicht hinein"; gebremst über `SupportRateLimitService` statt über die Anmeldung |

**Sortierung.** Kategorien, Fakultäten, Studiengänge und Module kommen nach
`name`. Zwei Listen weichen ab, und zwar mit Absicht: Semester sortieren nach
`sortOrder`, weil sich aus „WiSe 2025/26" keine Reihenfolge berechnen lässt,
und Schlagworte nach Verwendungshäufigkeit absteigend, bei Gleichstand nach
`name`. Keine dieser Listen ist paginiert.

**Filter.** Vier der Listen lassen sich einschränken:

```bash
curl "http://localhost:8080/api/study-programs?faculty=<id-aus-/api/faculties>"
curl "http://localhost:8080/api/modules?studyProgram=<id-aus-/api/study-programs>"
curl "http://localhost:8080/api/semesters?active=true"
curl "http://localhost:8080/api/tags?q=react&limit=10"
```

Bei den ersten beiden stammt die ID aus der übergeordneten Liste. Eine
unbekannte ID ergibt `200` mit leerer Liste (der Parameter filtert, er
adressiert keine Ressource); ein Wert, der keine UUID ist, ergibt `400`
`VALIDATION_FAILED` im Fehler-Envelope aus §6.2.

**Woher die Daten kommen.** Kategorien und Semester legt der
`DevMasterDataSeeder` an, nur im Profil `dev`. Fakultäten, Studiengänge und
Module kommen aus `stammdaten-seeder.sh` (Abschnitt 4); ohne diesen Lauf sind
die drei Listen leer, ohne dass ein Fehler auftritt. Schlagworte entstehen
überhaupt nicht durch Pflege, sondern als Nebenwirkung beim Speichern eines
Projekts: es gibt deshalb kein `/api/admin/tags`. Die übrigen Stammdaten pflegt
die Administrationsseite unter `/api/admin/…`.

### Die ganze API in einem Lauf

`postman/` enthält eine Postman-Sammlung über alle Endpoints. Menüpunkt `t` in
`eportfolio.ps1` führt sie mit Newman gegen die laufende Betriebsart aus und
räumt hinterher auf; `tc` räumt allein auf, wenn ein Lauf abgebrochen ist.

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

Was im Frontend vorhanden ist: Routing, i18n (Deutsch und Englisch),
Design-Tokens samt Token-Galerie unter `/dev/tokens`, die shadcn-Grundlage und
die Komponentenbibliothek mit eigener Prüffläche unter `/dev/components`
(KAN-29), die API-Anbindung in `src/api/` (ein Client, ein Fehlertyp) und
darauf die Feature-Ordner unter `src/features/`: öffentliche Startseite und
Projektbibliothek, Anmeldung und Registrierung, Portfolio, blockbasierter
Editor, Kommentare, Redaktionsansicht, Support, Hilfe und die
Administrationsseite.

Weitere nützliche Skripte:

```bash
pnpm gen:api      # Typen aus dem laufenden Backend nach src/api/schema.d.ts
pnpm typecheck    # tsc -b
pnpm lint         # eslint, --max-warnings 0
pnpm test         # Vitest, siehe Abschnitt 7
pnpm e2e          # Playwright
```

`src/api/schema.d.ts` wird eingecheckt und **nicht von Hand bearbeitet**: die
Datei entsteht aus `/v3/api-docs`, das Backend muss dafür laufen. Direkt danach
Prettier über **genau diese eine Datei** laufen lassen, sonst steht sie
vollständig im Diff, obwohl sich fachlich nichts geändert hat:

```bash
pnpm gen:api
pnpm exec prettier --write src/api/schema.d.ts
```

Nicht `pnpm format`: das Skript formatiert den ganzen Baum und zieht Hunderte
unbeteiligter Dateien in den Diff.

---

## 7. Tests ausführen

### Backend

```bash
cd backend
./mvnw test
```

69 Testklassen unter `backend/src/test/java`, geschnitten wie der
Produktivcode nach Fachlichkeit: je ein Paket `auth`, `project`, `masterdata`,
`admin`, `top10`, `file`, `mail`, `comment`, `reaction`, `editlock`,
`portfolio`, `support`, `sitecontent`, `user`, `config`, `common`. Drei Arten
kommen vor:

| Art | Woran erkennbar | Wofür |
|-----|-----------------|-------|
| Unit | keine Spring-Annotation, z. B. `ProjectPermissionServiceTest` | Fachlogik, insbesondere die Rechtematrix aus Contract §5 |
| `@WebMvcTest` | z. B. `ProjectControllerTest` | Statuscodes, Envelope, Serialisierung, ohne Datenbank |
| `@SpringBootTest` | die `…IntegrationTest`-Klassen | vollständiger Kontext gegen die echte Postgres |

Eine feste Testzahl steht hier bewusst nicht: sie ist mit jedem Ticket eine
andere. Verbindlich ist, dass der Lauf grün endet; die Zahl nennt Surefire am
Ende selbst (`Tests run: …, Failures: 0, Errors: 0`), im Zweifel genauer die
XML-Reports unter `backend/target/surefire-reports/`. Im Textreport stehen bei
Klassen mit `@Nested` scheinbar `0` Tests, weil verschachtelte Klassen dort
unter ihrem `@DisplayName` erscheinen.

Ohne eigene Tests, weil sie Vorbedingungen bauen: `TestUser`, `TestProject`,
`TestMasterData`, `TestFiles`, `TestReaction`, `TestTop10` und
`TestConfigurationFiles`. Sie nehmen, was in der Datenbank schon da ist, und
legen nur sonst etwas an; neue Tests bauen ihre Vorbedingungen darüber und
nicht von Hand.

**Wichtig:** Die Tests brauchen eine laufende Datenbank und eine gültige
`.env`. Die `…IntegrationTest`-Klassen starten den kompletten Kontext
inklusive Datasource und Flyway. Ohne Container schlägt der Testlauf fehl.
Eine Testkonfiguration mit In-Memory-DB oder Testcontainers gibt es nicht,
und zwar bewusst: geprüft wird gegen dasselbe PostgreSQL 16, gegen das die
Anwendung läuft, samt `jsonb`, partiellen Indizes und Check-Constraints.

Der Testlauf läuft im Profil `dev` und damit gegen dieselbe Datenbank wie die
Anwendung. Was er schreibt, rollt er wieder zurück (`@Transactional` an den
Integrationstests); die Seeder laufen beim Hochfahren des Testkontexts aber
regulär durch, ein Testlauf befüllt eine leere Datenbank also mit den
Dev-Daten.

**Verbindungen:** Ein voller Lauf öffnet viele Verbindungen gleichzeitig.
Läuft daneben noch das Backend im Container, meldet Postgres irgendwann
`FATAL: sorry, too many clients already`. Dann vorher den Backend-Container
der Betriebsart stoppen und verwaiste Java-Prozesse beenden.

### Frontend

```bash
cd frontend
pnpm test
```

Vitest mit Testing Library, Serverantworten über MSW; die Dateien liegen als
`*.test.ts`/`*.test.tsx` neben der Einheit, die sie prüfen. Kein laufendes
Backend nötig: MSW beantwortet die Requests. Dazu `pnpm e2e` für die
Playwright-Läufe, die ihrerseits eine laufende Anwendung brauchen.

Beide Läufe gibt es auch im Menü: Punkt `17` für das Backend, `18` für das
Frontend, `t` für die Postman-Sammlung über die laufende API.

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

### `APPLICATION FAILED TO START`: `JwtProperties failed: Reason: darf nicht leer sein`

`JWT_SECRET` ist leer oder fehlt. Es gibt keinen Default im Code. Wert erzeugen
mit `openssl rand -base64 64` und in die `.env` eintragen. Ist die Variable gar
nicht vorhanden, scheitert Spring stattdessen schon daran, den Platzhalter
`${JWT_SECRET}` aufzulösen; die Meldung sieht dann anders aus, die Ursache ist
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

### PROD: `mail DOWN` trotz korrekter Zugangsdaten

`/actuator/health` meldet nach gut fünf Sekunden `"mail":{"status":"DOWN"}`
mit einer `MessagingException` in den Details. Häufigste Ursache:
`MAIL_PORT=465`. Das ist der SMTPS-Port, der TLS ab dem ersten Byte erwartet;
die Anwendung erzwingt aber STARTTLS auf einer zunächst unverschlüsselten
Verbindung (`application-prod.yml`). Richtig ist der STARTTLS-Port des
Anbieters, üblicherweise **587**. Danach Betriebsart PROD neu starten, ein
Neuladen der `.env` ohne Neustart gibt es nicht.

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

### Port 5432 ist belegt: `Bind for 0.0.0.0:5432 failed`

Vollständige Meldung von Compose: `driver failed programming external
connectivity … Bind for 0.0.0.0:5432 failed: port is already allocated`. Meist
läuft eine andere Postgres-Instanz (lokale Installation oder der Container eines
anderen Projekts).

Statt die fremde Instanz zu stoppen, reicht ein anderer Host-Port in der `.env`:

```
POSTGRES_PORT=5433
```

Die Variable steuert beides, den Host-Port von DEV in `compose.dev.yml` und die
JDBC-URL in `application-dev.yml`. Ein Wert genügt also, danach
`docker compose up -d db`. Im Container bleibt der Port unverändert 5432.

### `FATAL: password authentication failed for user "eportfolio"`

Das Passwort in der `.env` passt nicht zu dem, was im Volume steht. Postgres
wertet `POSTGRES_PASSWORD` **nur beim allerersten Start** aus, wenn das
Datenverzeichnis leer ist. Wird das Passwort später in der `.env` geändert,
behält die Datenbank im Volume der Betriebsart (in DEV `eportfolio-dev_pgdata`)
das alte.

Zwei Wege:

1. Passwort in der `.env` wieder auf den Wert setzen, mit dem das Volume
   angelegt wurde.
2. Das Volume verwerfen und neu aufbauen; **alle Daten sind danach weg**,
   Flyway legt das Schema beim nächsten Backend-Start neu an:

   ```bash
   docker compose -f compose.base.yml -f compose.dev.yml down -v
   docker compose -f compose.base.yml -f compose.dev.yml up -d db
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

Im Log steht `DEV_TEST_PASSWORD ist nicht gesetzt - es werden keine Testnutzer
angelegt.` Wert in der `.env` ergänzen und die Anwendung neu starten. Ist die
Anwendung schon einmal ohne den Wert gelaufen, reicht ein Neustart: der Seeder
legt fehlende Konten nach.

Wird `DEV_TEST_PASSWORD` **geändert**, nachdem die Konten existieren, ändert der
Seeder die Passwörter nicht: er überspringt vorhandene E-Mail-Adressen. Dann
entweder das alte Passwort weiterverwenden oder die Zeilen aus `app_user`
löschen.

### `429 TOO_MANY_LOGIN_ATTEMPTS`

Nach 5 Fehlversuchen ist die Kombination aus E-Mail bzw. IP für 15 Minuten
gesperrt (`app.security.login-attempts` in `application.yml`). Der Zähler liegt
nur im Arbeitsspeicher: ein Neustart der Anwendung hebt die Sperre sofort auf.

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

---

## 10. Betrieb auf einem Server (PROD auf einem VPS)

Bis KAN-98 beschrieb dieses Dokument PROD als Betriebsart, die man **lokal**
startet, um die Produktivkonfiguration zu prüfen. Dieser Abschnitt beschreibt
den Dauerbetrieb auf einem eigenen Server. Er ersetzt die frühere Aussage,
`APP_BASE_URL` sei „für einen lokalen PROD-Lauf also `http://localhost:5373`":
das gilt weiterhin für den lokalen Lauf, auf einem Server steht dort die
öffentliche `https`-Adresse.

### Was auf dem Server dazukommt

Drei Dinge, die es lokal nicht gibt:

| | wozu |
| --- | --- |
| Dienst `caddy` | terminiert TLS und ist das einzige nach außen offene Tor |
| `Caddyfile` | dessen Konfiguration; kennt keine Adresse, liest `APP_DOMAIN` |
| `COMPOSE_PROFILES=edge` | schaltet den Dienst `caddy` überhaupt erst ein |
| `APP_DOMAIN`, `ACME_EMAIL` | Adresse und Kontaktpostfach für das Zertifikat |

Alle übrigen Ports sind auf `127.0.0.1` gebunden. Von außen erreichbar sind
ausschließlich 22, 80 und 443.

**Warum `caddy` hinter einem Profil steht.** Der Dienst trägt in
`compose.prod.yml` das Profil `edge` und läuft ohne `COMPOSE_PROFILES=edge`
nicht mit. Das ist kein Schmückwerk: startete er lokal mit leerem
`APP_DOMAIN`, läse der `Caddyfile` die leere Adresse als globalen
Optionsblock und bräche ab mit `unrecognized global option: tls`. Der
Container liefe in eine Neustartschleife, und der lokale PROD-Lauf aus
Abschnitt 3 wäre kaputt.

Der Schalter steht in der `.env` und **nicht** als `--profile edge` am Aufruf.
Damit ist der Startbefehl auf dem Server derselbe wie lokal, und ein
vergessener Schalter kann nicht still den Terminierer weglassen.

### Reihenfolge der Erstausrollung

Die Reihenfolge ist nicht beliebig. Schritt 4 lässt sich später nur noch mit
Datenverlust korrigieren, und Schritt 3 entscheidet, ob die Datenbank
zwischenzeitlich offen im Netz steht.

**1a. System aktuell machen**

```bash
apt update && apt full-upgrade -y && reboot
```

Bewusst ein eigener Block, der mit `reboot` endet. Stuende der Swap-Teil im
selben Block, liefe er beim Einfuegen am Stueck noch waehrend des
Herunterfahrens los oder gar nicht: `reboot` kehrt sofort zurueck, und eine
Kommentarzeile haelt die Shell nicht an. Das Ergebnis waere ein Server ohne
Swap, und genau darauf laeuft der naechste Absatz hinaus.

**1b. Nach dem Neustart: Swap anlegen und Sicherheitsupdates**

```bash
fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
apt install -y unattended-upgrades && dpkg-reconfigure -f noninteractive unattended-upgrades
```

Danach pruefen, und zwar alle drei:

```bash
swapon --show                 # muss /swapfile file 4G zeigen
grep swap /etc/fstab          # ohne diese Zeile ist der Swap nach dem naechsten Neustart weg
systemctl is-enabled docker   # muss "enabled" sagen, sonst startet nach einem
                              # Neustart kein Container, egal welche restart-Regel
```

Der Swap ist keine Zierde. Auf dem Server werden beide Images gebaut, und
`pnpm build` typprüft dabei auch die Playwright-Tests mit. Fehlt der Puffer,
bricht der Bau nicht sauber ab, sondern der Kernel schießt den Prozess ab; die
Meldung nennt dann nicht den Grund.

**2. Betriebsnutzer und SSH**

Nicht als `root` betreiben. Eigener Nutzer, Mitglied der Gruppe `docker`, in
`/etc/ssh/sshd_config` anschließend `PermitRootLogin no` und
`PasswordAuthentication no`, dazu `fail2ban` und `unattended-upgrades`.

**3. Firewall, BEVOR der Stapel zum ersten Mal startet**

Beim Anbieter eine Firewall-Gruppe anlegen: **TCP** 22, 80 und 443 zulassen,
alles Übrige verwerfen, der Maschine zuweisen, aktivieren. Im Hostinger-Panel
gehört danach noch ein Klick auf **Synchronisieren**: ohne ihn stehen die
Regeln nur im Panel und nicht auf dem Server.

`compose.prod.yml` veröffentlicht zusätzlich 443/udp für HTTP/3. Bleibt UDP in
der Firewall gesperrt, ist das kein Fehler: Browser sprechen dann TCP, und
außer einem ungenutzten Port ändert sich nichts. Wer HTTP/3 wirklich will,
nimmt 443/UDP mit auf.

**`ufw` allein genügt nicht.** Docker trägt seine Weiterleitungen selbst in
die iptables-Ketten `DOCKER-USER` und `nat` ein und umgeht damit die Regeln
von `ufw`. Ein veröffentlichter Containerport ist trotz aktiver `ufw` von
außen erreichbar. Deshalb greift `compose.prod.yml` zusätzlich an der
Bindeadresse an: beide Schichten zusammen, damit nicht eine einzelne
vergessene Stelle das System öffnet.

**4. `.env` anlegen, mit eigenen Geheimnissen**

```bash
cp .env.example .env && chmod 600 .env
```

Vor dem ersten Start zu setzen:

* `POSTGRES_PASSWORD`: **nicht** den Wert aus der Vorlage und nicht den der
  Entwicklungsumgebung. Postgres brennt das Passwort bei der Initialisierung
  des Volumes ein; danach hilft nur noch der Weg unten unter „Passwort der
  Datenbank nachträglich ändern". Neuen Wert etwa mit `openssl rand -base64 32`.
* `JWT_SECRET`: eigener Wert, mindestens 64 Byte.
* `COMPOSE_PROFILES=edge`: ohne diese Zeile startet der TLS-Terminierer nicht,
  und die Seite ist nur über die auf `127.0.0.1` gebundenen Ports erreichbar,
  also von außen gar nicht. Auf dem eigenen Rechner bleibt die Zeile leer.
* `APP_DOMAIN`: der Name ohne Schema, etwa `eportfolio.example.org`. Muss
  bereits per A-Eintrag auf den Server zeigen, sonst scheitert die Ausstellung
  des Zertifikats, und Let's Encrypt zählt den Fehlversuch mit.
* `ACME_EMAIL`: ein Postfach, das jemand liest.
* `APP_BASE_URL` und `CORS_ALLOWED_ORIGINS`: dieselbe Adresse wie
  `APP_DOMAIN`, mit `https://` davor und ohne abschließenden Schrägstrich.

Diese drei gehören zusammen. Laufen sie auseinander, verschickt die Anwendung
Maillinks ins Leere (`APP_BASE_URL` steht wörtlich im Mailtext) oder weist
jeden schreibenden Aufruf mit **403** `Invalid CORS request` ab.

**5. Starten**

```bash
docker compose -f compose.base.yml -f compose.prod.yml up -d --build
```

Der erste Lauf dauert mehrere Minuten: beide Images werden gebaut.

**6. Prüfen**

```bash
docker compose -f compose.base.yml -f compose.prod.yml ps
curl -fsS http://127.0.0.1:8280/actuator/health   # db UP und mail UP
curl -I https://<APP_DOMAIN>                       # 200 mit gueltigem Zertifikat
curl -I http://<APP_DOMAIN>                        # 308 auf https
curl -o /dev/null -s -w '%{http_code}\n' https://<APP_DOMAIN>/actuator/health  # 404
```

Von einem **anderen** Rechner aus gegenprüfen, dass weder 5434 noch 8280
antworten. Auf dem Server selbst antworten sie, das ist Absicht.

**7. Erstbestand einspielen**

Die Datenbank ist jetzt bis auf das Schema leer: die beiden Seeder im Code
tragen `@Profile("dev")` und laufen hier nicht. Wie der Bestand entsteht,
steht im naechsten Abschnitt.

### Erstbestand auf PROD (KAN-99)

Vier Schritte, und **die Reihenfolge ist nicht beliebig**. Der erste ist der
einzige, der sich nicht nachholen laesst.

#### Die Reihenfolge, und warum sie zwingend ist

Der `InitialAdminSeeder` legt das erste ADMIN-Konto nur an, wenn `app_user`
**vollstaendig leer** ist (§3.1.1). Diese Bedingung faellt unwiderruflich weg,
sobald irgendein Konto entsteht, und dafuer genuegt schon:

* ein Lauf von `demo-daten-komplett.sh` (er legt zehn Konten an),
* oder eine einzige Selbstregistrierung ueber `POST /api/auth/register`, denn
  dieser Pfad ist oeffentlich.

Danach gibt es keinen Weg mehr zurueck: der Runner schweigt fortan, und ein
Admin muss von Hand per SQL entstehen. Deshalb gilt:

> **Erst den Bootstrap-Admin belegen, dann alles andere.**

Nachsehen, bevor irgendetwas laeuft:

```bash
docker exec eportfolio-prod-db-1 psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "select email, role, status, password_change_required from app_user;"
```

Ist die Tabelle leer, gehoeren die drei `BOOTSTRAP_ADMIN_`-Werte in die `.env`
(Abschnitt 3), danach `up -d` und dann diese Abfrage erneut. Steht das Konto
da, ist der Schritt erledigt und die Werte koennen aus der `.env` verschwinden:
sie werden nie wieder gebraucht, und solange sie dort stehen, ist das
Initialpasswort ueber `docker inspect` lesbar.

**Schweigen im Protokoll ist eine Diagnose.** Der Seeder meldet das Fehlen der
Werte auf `debug`, und `application-prod.yml` setzt keine Protokollebene, es
gilt also INFO. Findet

```bash
docker logs eportfolio-prod-backend-1 2>&1 | grep -i "Bootstrap-Admin"
```

**gar nichts**, dann waren die Werte nicht gesetzt. Findet es
`es bestehen bereits N Konten`, war die Tabelle nicht leer. Findet es
`BOOTSTRAP_ADMIN_PASSWORD muss zwischen 12 und 72 Zeichen lang sein`, lag es am
Passwort; diese eine Meldung steht auf `error`.

#### 1. Fakultaeten, Studiengaenge, Module

```bash
cd /opt/eportfolio
DB_CONTAINER=eportfolio-prod-db-1 bash stammdaten-seeder.sh
```

**Genau einmal.** Ein zweiter Lauf raeumt seinen eigenen ID-Praefix ab und
loest dabei `project.module_id` und `project.study_program_id` aller Projekte,
die auf diese Lieferung zeigen. Da auf PROD saemtliche 75 Studiengaenge aus
genau dieser Lieferung stammen, trifft das dort faktisch jedes Projekt. Die
Fakultaet bliebe stehen, Studiengang und Modul waeren weg.

#### 2. Kategorien und Semester

```bash
DB_CONTAINER=eportfolio-prod-db-1 bash kategorien-semester-seeder.sh
```

Idempotent ueber `where not exists`, ein zweiter Lauf ist folgenlos. Ohne
diesen Schritt antworten `GET /api/categories` und `/api/semesters` mit **200**
und einer leeren Liste, und erst das Einreichen scheitert mit **400**
`PROJECT_INCOMPLETE`.

#### 3. Demobestand fuer die Vorfuehrung

Vier Dinge muessen vorher stimmen, sonst bricht der Lauf mitten drin ab:

* **Das Backend laeuft.** Das Skript liest `SPRING_PROFILES_ACTIVE`,
  `AZURE_STORAGE_CONTAINER` und `AZURE_STORAGE_CONNECTION_STRING` per
  `printenv` aus dem Backend-Container, nicht aus der `.env`. Steht der
  Container, bricht es ab.
* **Der Blob-Container existiert.** `AzureBlobFileStorage` legt ihn
  ausdruecklich **nicht** an. Hat auf dieser Instanz noch nie jemand eine Datei
  hochgeladen, kann er im Speicherkonto fehlen, und das Hochladen scheitert
  erst nach dem Schreiben der Datenbank.
* **Ausgehende Verbindungen sind offen** zu `picsum.photos`,
  `loremflickr.com`, `upload.wikimedia.org`, `download.samplelib.com`,
  `www.w3.org`, `www.orimi.com` und `pdfobject.com`. Nur die Bildquelle hat
  einen Rueckfall, die uebrigen nicht.
* **Auf dem Wirt liegen `docker`, `curl`, `tar` und `openssl`**, und es ist
  Platz fuer zwei Fremdimages: `httpd:2.4-alpine` (rund 20 MB, fuer den
  bcrypt-Hash) und `mcr.microsoft.com/azure-cli` (mehrere hundert MB, fuer das
  Hochladen).

```bash
cd /opt/eportfolio
read -rsp 'Demopasswort (mindestens 12 Zeichen): ' DEMO_PASSWORT; echo
export DEMO_PASSWORT
BACKEND_CONTAINER=eportfolio-prod-backend-1 \
DB_CONTAINER=eportfolio-prod-db-1 \
bash demo-daten-komplett.sh
unset DEMO_PASSWORT
```

`read -rsp` und nicht `DEMO_PASSWORT=... bash …`: die zweite Form schreibt das
Passwort in `~/.bash_history` und in die Prozessumgebung. Wird die Variable gar
nicht gesetzt, wuerfelt das Skript eines und nennt es **genau einmal** am Ende
des Laufs. Wer es dort nicht mitschreibt, hat drei unbrauchbare Vorfuehrkonten
und muss den ganzen Lauf wiederholen, und der vergibt dann wieder ein anderes.

Am Ende sind **genau drei Konten anmeldbar**: `student@`, `redaktion@` und
`admin@demo.invalid`. Die uebrigen sieben tragen keinen brauchbaren Hash.

Zwei Dinge, die man ueber diesen Bestand wissen muss, bevor er auf einem
oeffentlich erreichbaren Server steht:

* **`admin@demo.invalid` ist ein echter ADMIN**, und sein
  `password_change_required` steht auf `false`. Das ist Absicht: bei `true`
  muesste die erste Person, die sich zur Vorfuehrung anmeldet, das Passwort
  aendern, und alle danach kaemen nicht mehr hinein. Die Folge ist aber, dass
  das einmal genannte Passwort unbefristet gilt. Es gehoert entsprechend stark
  gewaehlt und nicht weitergegeben.
* **Die 30 Schlagworte lassen sich nicht wieder entfernen.** Sie entstehen mit
  `gen_random_uuid()` und liegen damit ausserhalb jedes ID-Praefixes; kein
  zweiter Lauf und kein auf PROD lauffaehiges Skript raeumt sie weg. Dafuer
  braeuchte es handgeschriebenes SQL gegen die 30 Namen.

**Wenn der Lauf mitten drin abbricht.** `demo-daten-raeumen.sh` ist auf PROD
gesperrt und kann hier nicht helfen; es verlangt eine Entwicklungsdatenbank und
ein Backend im Profil `dev`. Der einfachste Ausweg ist, das Skript noch einmal
vollstaendig laufen zu lassen: es raeumt seinen eigenen vorigen Lauf ueber die
festen ID-Praefixe selbst ab. Nur das Passwort ist dann ein anderes, sofern
`DEMO_PASSWORT` nicht wieder gesetzt wird.

#### 4. Gegenprobe

```bash
docker exec eportfolio-prod-db-1 psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
select 'Fakultaeten' as was, count(*) from faculty
union all select 'Studiengaenge',  count(*) from study_program
union all select 'Sammelmodule',   count(*) from module where collective
union all select 'Kategorien',     count(*) from category
union all select 'Semester',       count(*) from semester
union all select 'Konten',         count(*) from app_user
union all select 'Projekte',       count(*) from project
union all select 'Bloecke',        count(*) from block
union all select 'Dateizeilen',    count(*) from stored_file
union all select 'Startseitentexte', count(*) from site_content;"
```

Erwartet: 5 Fakultaeten, 75 Studiengaenge, 75 Sammelmodule, 8 Kategorien,
4 Semester, 10 Konten (11 mit dem Bootstrap-Admin), 10 Projekte, 120 Bloecke,
50 Dateizeilen, 4 Startseitentexte.

Von aussen, und das ist die Probe, die wirklich zaehlt:

```bash
curl -s https://<domain>/api/site-content
curl -s -o /dev/null -w "%{http_code}\n" https://<domain>/api/projects
```

Der erste Aufruf muss `home.hero.label` und `home.hero.subtitle` in beiden
Sprachen nennen, der zweite mit 200 antworten. Danach die Startseite im Browser
oeffnen: unter der Ueberschrift steht jetzt der Hinweis, dass alle gezeigten
Projekte und Personen erfunden sind.

#### Was auf diesem Server nichts zu suchen hat

* `stammdaten-seeder-entfernen.sh` und ein **zweiter** Lauf von
  `stammdaten-seeder.sh`: beide reissen die Studiengangs- und Modulzuordnung
  bestehender Projekte ab.
* `demo-daten-raeumen.sh`: loescht jedes Projekt und jedes Konto ohne
  Rueckfrage. Es bricht auf PROD von selbst ab, aber es gehoert dort auch nicht
  aufgerufen.
* `test-seeder.sh` und `test-sitzung.sh`: der Usability-Testbestand traegt
  erfundene Namen an der echten Domain `hs-bremen.de` und ein Klartextpasswort
  aus dem Repository.

### Aktualisieren

```bash
cd /opt/eportfolio
git pull
docker compose -f compose.base.yml -f compose.prod.yml up -d --build
```

Zwei Dinge dazu, beide unangenehm und beide besser vorher gewusst:

* **Das ist ein Stop-Start mit echtem Ausfall.** Bei diesem Stapel gibt es
  keinen unterbrechungsfreien Weg. Für ein Vorführsystem ist das vertretbar,
  es gehört nur eingeplant.
* **Immer beide Dienste neu erstellen, nie nur einen.** Wird allein das
  Backend ersetzt, bekommt es eine neue Adresse im Compose-Netz, und der
  nginx des Frontends hält die alte fest: die API antwortet danach dauerhaft
  mit **502**, obwohl beide Container laufen.

Vor jedem Update mit neuen Flyway-Migrationen eine Sicherung ziehen. Eine
Migration, die zur Hälfte durchgelaufen ist, hat keinen Rückweg.

### Sichern

```bash
docker exec eportfolio-prod-db-1 pg_dump -U eportfolio -d eportfolio \
  | gzip > /pfad/ausserhalb/eportfolio-$(date +%F).sql.gz
```

Als täglichen systemd-Timer einrichten:

```bash
cat > /etc/systemd/system/eportfolio-dump.service <<'EOF'
[Unit]
Description=Taegliche Sicherung der E-Portfolio-Datenbank
[Service]
Type=oneshot
EnvironmentFile=/opt/eportfolio/.env
ExecStart=/bin/sh -c 'docker exec eportfolio-prod-db-1 pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > /var/backups/eportfolio-$(date +%%F).sql.gz'
ExecStartPost=/bin/sh -c 'find /var/backups -name "eportfolio-*.sql.gz" -mtime +14 -delete'
EOF
cat > /etc/systemd/system/eportfolio-dump.timer <<'EOF'
[Unit]
Description=Taeglich um 03:30
[Timer]
OnCalendar=*-*-* 03:30:00
Persistent=true
[Install]
WantedBy=timers.target
EOF
mkdir -p /var/backups && systemctl daemon-reload && systemctl enable --now eportfolio-dump.timer
systemctl start eportfolio-dump.service && ls -l /var/backups
```

`POSTGRES_USER` und `POSTGRES_DB` kommen aus der `.env` und stehen nicht fest
verdrahtet im Auftrag: ein Timer zeigt seine Fehlerausgabe niemandem, und ein
geänderter Name würde sonst still eine leere Sicherung erzeugen.

Die Dateien gehören **vom Server herunter**. Eine Sicherung, die neben dem
Original liegt, ist keine.

**Zurückspielen**, der Teil, der geübt sein muss:

```bash
gunzip -c /var/backups/eportfolio-JJJJ-MM-TT.sql.gz | docker exec -i eportfolio-prod-db-1 psql -U eportfolio -d eportfolio
```

**Die Datenbank allein genügt nicht.** Im Profil `prod` liegen die
hochgeladenen Dateien in Azure Blob Storage, nicht in der Datenbank und nicht
im Container. Ein allein zurückgespielter Datenbankstand hat Dateizeilen ohne
Bytes, und `GET /api/files/{id}` antwortet dann mit 500. Zur vollständigen
Sicherung gehören beide Seiten.

Eine Rückspielprobe gehört dazu. Eine Sicherung, die nie zurückgespielt
wurde, ist eine Vermutung.

### Passwort der Datenbank nachträglich ändern

Abschnitt 8 nennt bisher nur, dass das Passwort im Volume festhängt, und legt
damit `down -v` nahe. Ohne Datenverlust geht es so:

```bash
# 1. neues Passwort IN der Datenbank setzen, ueber die Standardeingabe statt
#    als Befehlsargument: ein Argument steht in der Prozessliste des Wirts und
#    ist dort fuer jeden sichtbar, der ps aufrufen darf.
docker exec -i eportfolio-prod-db-1 psql -U eportfolio -d eportfolio <<'EOF'
alter user eportfolio with password 'HIER-DAS-NEUE';
EOF
# 2. denselben Wert in die .env schreiben
# 3. Backend neu erzeugen, damit es die neue Umgebung sieht
docker compose -f compose.base.yml -f compose.prod.yml up -d --force-recreate backend
```

Der Heredoc hält das Passwort aus der Argumentliste heraus, nicht aber aus der
Shell-Historie. Die betreffende Zeile danach mit `history -d` entfernen, oder
die Sitzung von vornherein mit `unset HISTFILE` beginnen.

### Zwei Fallen im Umgang mit dem Server

**`docker compose config` gibt Geheimnisse im Klartext aus.** Der Befehl setzt
alle Variablen ein und schreibt Azure-Kontoschlüssel, `JWT_SECRET` und beide
Passwörter in das Terminal, wo sie in der Sitzungshistorie stehen bleiben. Zum
Prüfen der zusammengeführten Konfiguration deshalb
`docker compose ... config --no-interpolate` verwenden. Dasselbe gilt für
`docker inspect`: die Umgebung eines Containers ist für jedes Mitglied der
Gruppe `docker` lesbar.

**Die `.env` liegt unverschlüsselt auf dem Server.** Das ist hinnehmbar, muss
aber bekannt sein: wer Zugriff auf den Server hat, hat Zugriff auf das
Azure-Speicherkonto und das Mailkonto. Der Kreis der Konten auf dem Server ist
entsprechend klein zu halten.
