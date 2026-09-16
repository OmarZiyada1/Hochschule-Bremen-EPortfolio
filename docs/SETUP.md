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

Der Swap ist keine Zierde. Bei der Ersteinrichtung und auf dem Notweg werden
beide Images **auf dem Server** gebaut, und `pnpm build` typprüft dabei auch
die Playwright-Tests mit. Fehlt der Puffer, bricht der Bau nicht sauber ab,
sondern der Kernel schießt den Prozess ab; die Meldung nennt dann nicht den
Grund. Im Normalbetrieb baut seit KAN-101 die Action, dann wird der Puffer
hier nicht gebraucht; er bleibt trotzdem, weil genau die beiden Fälle, in
denen doch gebaut wird, die ungünstigsten sind.

**2. Betriebsnutzer und SSH**

Nicht als `root` betreiben. Eigener Nutzer, Mitglied der Gruppe `docker`, dazu
`fail2ban` und `unattended-upgrades`.

Die Abschaltung von `PermitRootLogin` und `PasswordAuthentication` steht
**nicht** hier, sondern im Abschnitt „Einmalige Einrichtung auf dem Server",
Schritt 6. Zwei Gründe: sie gehört hinter den Deploy-Nutzer, und sie gehört in
eine Datei unter `/etc/ssh/sshd_config.d/`, nicht in die Hauptdatei. Eine
Änderung dort bleibt auf Ubuntu wirkungslos, weil `50-cloud-init.conf` vorher
gelesen wird und `sshd` je Schlüssel den zuerst gefundenen Wert nimmt.

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

### Ausrollen: der automatische Weg (KAN-101)

Seit KAN-101 rollt ein Merge nach `main` sich selbst aus. Auf dem Server ist
im Normalbetrieb **nichts mehr zu tun**, auch kein `git pull` von Hand: der
Code kommt als fertiges Image, und die drei Dateien, die der Server aus dem
Repository braucht (`compose.base.yml`, `compose.prod.yml`, `Caddyfile`),
zieht die Ausrollung seit KAN-106 selbst nach. Sie holt den Merge-Commit als
`deploy` per `git fetch` und `git merge --ff-only` in den Checkout unter
`/opt/eportfolio` und weist nach, dass die drei Dateien dem Commit gleichen,
bevor irgendein Container angefasst wird.

**Warum das nötig war.** Bis KAN-106 holte der Deploy-Job keinen Quellcode.
Vier Läufe im September 2026 waren grün, ohne etwas auszurollen: das Checkout
auf dem Server stand noch vor dem Commit, der die `image:`-Schlüssel in
`compose.base.yml` eingeführt hat, Compose meldete `Skipped No image to be
pulled`, `up -d` ließ die alten Container stehen, und die Prüfung druckte nur
den Namen des laufenden Images, statt ihn mit der Marke zu vergleichen. Beides
ist seitdem ausgeschlossen: die Dateien werden nachgezogen, und die Ausrollung
vergleicht Marke, Image-ID und Digest, statt sie nur zu drucken.

`.github/workflows/deploy.yml` führt sieben Jobs aus, teils nebeneinander
(Zuschnitt aus KAN-102):

```
backend-tests  ─┐
                ├─ tests ─┬─ build-backend  ─┐
frontend-tests ─┘         └─ build-frontend ─┴─ deploy

marke laeuft daneben, ohne Vorgaenger, und liefert seine Marke an
build-backend, build-frontend und deploy.
```

| Job | Wann | Was |
| --- | --- | --- |
| `marke` | immer | bestimmt `sha-<kurzer commit-hash>`; ohne Abhängigkeit, läuft parallel zu den Tests |
| `backend-tests` | jeder Pull Request, jeder Push auf `main` oder `dev` | `./mvnw test` gegen Postgres 16 und Azurite |
| `frontend-tests` | wie oben | `pnpm test`, `typecheck`, `lint`, `build`; **ohne** Dienst-Container, MSW beantwortet die Requests |
| `tests` | nach beiden Testjobs, immer (außer beim von Hand gestarteten Lauf) | das Gate: fasst beide zu einem Ergebnis zusammen. Dieser Check heißt `Tests` und ist der, auf den der Branch-Schutz zeigt |
| `build-backend` | nur Push auf `main`, nur nach grünem `tests` | Backend-Image bauen und nach GHCR schieben, zweifach markiert |
| `build-frontend` | wie oben | Frontend-Image, dazu die vier Impressumswerte als build-args |
| `deploy` | Push auf `main`, nur wenn **beide** Build-Jobs grün sind; oder ein von Hand gestarteter Lauf (Rollback), nur auf `main` | über SSH als `deploy`: `deploy/ausrollen.sh`, die acht Schritte stehen unten |

Der Riegel liegt in der Abhängigkeit der Jobs: **ein roter Test erreicht den
Server nie**, und der Server bleibt dabei unverändert stehen. Auf `dev` laufen
die beiden Testjobs, das Gate und `marke`; gebaut und ausgerollt wird nichts.
Für einen Pull Request gilt dasselbe. Ein von Hand gestarteter Lauf
(*Actions → CI/CD → Run workflow*, Eingabe `image_tag`) überspringt Tests,
Gate und Bau und rollt eine früher gebaute Marke aus; das ist der Rollback,
siehe unten.

**Warum es den Gate-Job `tests` gibt und warum er `if: always()` trägt.** Ein
Job mit `needs` läuft nach Vorgabe nur, wenn alle Abhängigkeiten erfolgreich
waren. Ohne `always()` würde das Gate bei einem roten Teiljob deshalb nicht
rot, sondern **übersprungen**, und ein übersprungener Pflicht-Check gilt dem
Branch-Schutz als bestanden. Ein roter Pull Request wäre dann mergefähig. Der
Job prüft deshalb selbst und akzeptiert ausschließlich `success`; `skipped` und
`cancelled` sind Fehlschläge. Beim von Hand gestarteten Lauf läuft das Gate
gar nicht (`github.event_name != 'workflow_dispatch'`): dort gibt es keinen
Pull Request zu schützen, und ein Gate über zwei übersprungenen Testjobs wäre
rot, obwohl der Rollback gelungen ist.

Die Ausrollung dauert Sekunden statt der fünf bis zehn Minuten, die ein Bau
auf den zwei vCPU des VPS gekostet hat. **Ein Ausfall bleibt es trotzdem:**
auch mit fertigen Images ist ein `up -d` ein Stop-Start.

#### Was die Ausrollung auf dem Server tut, und woran sie scheitert

Der Fernteil steht seit KAN-106 nicht mehr im Workflow, sondern in
`deploy/ausrollen.sh`. Die Action holt die Datei aus dem Checkout des
Merge-Commits (beim Rollback: des Standes von `main`) und schickt sie per SSH
an `deploy`. Neun Schritte, 0 bis 8, in dieser Reihenfolge, und jeder bricht
bei einem Fehler ab:

| Schritt | Was | Bricht ab, wenn |
| --- | --- | --- |
| 0 Vorbedingungen | Nutzer, Eingaben, Eigentum an `/opt/eportfolio` und jeder Datei darunter, Docker, `curl`, `.env` (vorhanden, schreibbar, Profil `edge`), Sicherungsordner, Registry, GitHub, Checkout, `git fetch origin main` mit Zugehörigkeitsproben | das Skript als `root` läuft; `/opt/eportfolio` oder eine Datei darunter nicht `deploy` gehört; die `.env` nicht schreibbar ist oder `edge` nicht schaltet; die Marke in GHCR nicht lesbar ist (fehlt, oder das PAT ist abgelaufen); `deploy` GitHub nicht lesen kann; nicht `main` ausgecheckt ist; der Checkout lokale Änderungen an verfolgten Dateien hat; der Commit nicht auf `origin/main` liegt; beim Rollback die Marke keinen Commit auf `main` nennt; `db` nicht läuft |
| 1 Sichern | `pg_dump` nach `/var/backups/eportfolio/vor-<marke>-<datum>.sql.gz`, Aufbewahrung 14 Tage | die Sicherung leer oder beschädigt ist |
| 2 Checkout | `git merge --ff-only <merge-commit>` auf den in Schritt 0 geholten Stand, danach `HEAD` gleich Commit und die drei Deployment-Dateien gleich Commit | kein Fast-Forward möglich ist (eigene Commits auf dem Server); `HEAD` danach nicht der Commit ist, etwa bei einem erneut gestarteten **alten** Lauf (siehe Rollback) |
| 3 Konfiguration | `docker compose config` mit der `.env` des Servers, Auflösung der beiden `image:`-Zeilen auf die Marke | die Compose-Dateien mit der `.env` ungültig sind; Compose nicht auf `ghcr.io/…:<marke>` auflöst |
| 4 Ziehen | `compose pull backend frontend`, danach Vergleich der `RepoDigests` mit dem Digest, den der Build-Job geschoben hat | das Ziehen scheitert (Anmeldung, PAT, Netz); das Image keinen Registry-Digest trägt (auf dem Server gebaut); der Digest nicht der des Build-Jobs ist |
| 5 `.env` | `IMAGE_TAG=<marke>` über eine temporäre Datei, drei Riegel wie seit KAN-101, danach genau eine solche Zeile | die `.env` fehlt, kürzer würde oder ihr `POSTGRES_PASSWORD` verlöre |
| 6 Starten | `up -d --no-build --pull never --wait --wait-timeout 300` | ein Dienst nach fünf Minuten nicht `healthy` (Backend, Frontend, db) beziehungsweise `running` (caddy) ist; die Action hängt dann `ps` und die letzten 80 Logzeilen an |
| 7 Nachweis | je Container: genau einer, `running`, `healthy`, `Config.Image` gleich Marke, Image-ID gleich der ID hinter der Marke; die `.env` allein löst auf die Marke auf; caddy läuft, `caddy reload` übernimmt das Caddyfile, `https://<APP_DOMAIN>/` und `/api/site-content` antworten 200 (bis zu zwei Minuten Geduld je Pfad) | ein Container den neuen Namen, aber eine andere Image-ID trägt; caddy das Caddyfile nicht annimmt (dann läuft die alte Konfiguration weiter); die Seite von außen nicht mit 200 antwortet. Ab hier hängt jede Meldung den Rückweg an |
| 8 Aufräumen | `docker image prune`, danach je Image alle `sha-*`-Marken bis auf die fünf jüngsten und die in Benutzung | nie; ein nicht löschbares Image ist ein Hinweis, kein Fehler |

Erst nach Schritt 7 ist der Lauf grün. Ein Abbruch vor Schritt 6 lässt den
Server unverändert laufen, die `.env` eingeschlossen. Der Frontend-Container
trägt seit KAN-106 einen eigenen Healthcheck (`compose.prod.yml`), damit
Schritt 6 auch auf ihn warten kann; vorher galt er als fertig, sobald der
nginx-Prozess lief.

**Das Caddyfile wird nach jeder Ausrollung neu geladen.** Es liegt als
Bind-Mount im Container, und ein geänderter Dateiinhalt ändert für Compose
nichts an der Containerkonfiguration: `up -d` erstellt caddy nicht neu, und
ohne das `caddy reload` liefe die alte Konfiguration weiter, solange der
Container lebt. Der Aufruf ist unterbrechungsfrei und bei unverändertem
Caddyfile folgenlos; ein fehlerhaftes Caddyfile lehnt er ab, caddy behält
dann die bisherige Konfiguration, und die Ausrollung ist rot.

**Änderungen an `compose.prod.yml` oder `compose.base.yml` an `db` oder
`caddy`** (Ports, Logging, Volumes) wirken mit der nächsten Ausrollung und
erstellen den betroffenen Container neu, die Datenbank eingeschlossen. Das
ist gewollt, denn sonst käme eine solche Änderung nie auf den Server; es
gehört nur gewusst, dass ein solcher Merge die Datenbank kurz neu startet.

Ob der Server alle Voraussetzungen erfüllt, sagt `deploy/vps-pruefen.sh`,
als `root` aufgerufen. Es verändert weder Arbeitsverzeichnis noch `HEAD`
noch die `.env`; das Einzige, was es schreibt, ist ein `git fetch` als
`deploy` nach `.git/`, wie die Ausrollung selbst:

```bash
sudo bash /opt/eportfolio/deploy/vps-pruefen.sh
```

Je Punkt eine Zeile `OK`, `FEHLT` (mit dem Befehl, der es behebt) oder
`HINWEIS` (eine Entscheidung für einen Menschen, etwa die SSH-Härtung).
Jedes `FEHLT` ist eine Stelle, an der die nächste Ausrollung abbräche.

#### Einmalige Einrichtung auf dem Server

Die Reihenfolge ist nicht beliebig. Schritt 6 sperrt aus, wer die Schritte
davor übersprungen hat.

**1. Ein Administrationskonto mit `sudo`, falls es noch keines gibt**

Das ist der Schritt, den man zu überspringen versucht ist, und der hinterher
fehlt. Nach Schritt 6 ist die Anmeldung als `root` abgeschaltet, und der
Nutzer `deploy` aus Schritt 2 hat bewusst kein `sudo`. Ohne ein drittes Konto
führt danach kein Weg mehr auf den Server außer die Webkonsole des Anbieters.

```bash
adduser --gecos "" <name>
usermod -aG sudo <name>
install -d -m 700 -o <name> -g <name> /home/<name>/.ssh
# den eigenen oeffentlichen Schluessel eintragen, nicht den des Servers
install -m 600 -o <name> -g <name> /dev/null /home/<name>/.ssh/authorized_keys
echo 'ssh-ed25519 AAAA... eigener-rechner' >> /home/<name>/.ssh/authorized_keys
```

**2. Deploy-Nutzer**

```bash
adduser --system --group --shell /bin/bash --home /home/deploy deploy
usermod -aG docker deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
```

Kein Passwort, kein `sudo`. Die Mitgliedschaft in `docker` genügt für alles,
was die Ausrollung tut. Wer `deploy` zusätzlich `sudo` gäbe, machte das
GitHub-Secret zu einem Root-Zugang und hätte sich den eigenen Nutzer sparen
können.

**3. Schlüsselpaar, erzeugt auf dem Server**

```bash
sudo -u deploy ssh-keygen -t ed25519 -N '' -C 'github-actions-deploy' \
  -f /home/deploy/.ssh/id_ed25519_deploy
sudo -u deploy sh -c 'cat /home/deploy/.ssh/id_ed25519_deploy.pub \
  >> /home/deploy/.ssh/authorized_keys'
chmod 600 /home/deploy/.ssh/authorized_keys
cat /home/deploy/.ssh/id_ed25519_deploy      # Inhalt -> Secret VPS_SSH_KEY
```

Der private Teil verlässt den Server genau einmal und genau in diese eine
Richtung. Danach hat er auf dem Server nichts mehr zu suchen:

```bash
shred -u /home/deploy/.ssh/id_ed25519_deploy
```

**4. `/opt/eportfolio` übereignen und den Sicherungsordner anlegen**

```bash
chown -R deploy:deploy /opt/eportfolio
install -d -o deploy -g deploy /var/backups/eportfolio
```

Der erste Befehl ist seit KAN-106 mehr als eine Ordnungsfrage: die Ausrollung
schreibt als `deploy` in diesen Checkout (`git merge --ff-only`) und bricht
ab, bevor sie etwas anfasst, wenn das Verzeichnis jemand anderem gehört. Eine
einzelne Datei, die `root` gehört (typisch nach einem `git pull` als `root`),
genügt dafür. Nach jedem Handgriff als `root` in diesem Verzeichnis den Befehl
wiederholen; `deploy/vps-pruefen.sh` zählt solche Dateien.

Der zweite Befehl ist keine Feinheit: der Deploy-Schritt zieht vor **jeder**
Ausrollung einen `pg_dump` genau dorthin, und zwar ohne Fallunterscheidung.
Fehlt das Verzeichnis, **bricht die Ausrollung ab** und sagt warum.

Warum ohne Fallunterscheidung, obwohl nur Migrationen gefährlich sind: eine
Erkennung über den Commit-Vergleich beantwortet die falsche Frage. Sie
vergleicht Push gegen Push, während es auf den Abstand zwischen **Serverstand**
und neuem Stand ankäme. Scheitert ein Lauf in einem der Build-Jobs oder in `deploy`, bleibt der
Server zurück; der nächste Push verglich dann ab dem gescheiterten Commit, sähe
keine Migration mehr und rollte sie ungesichert aus. Genau der Fall, gegen den
die Sicherung da ist. Ein `pg_dump` dieses Bestands kostet Sekunden.

Die Dateien heißen `vor-sha-<hash>-<datum>.sql.gz` und werden nach 14 Tagen
gelöscht, dieselbe Frist wie beim täglichen Timer aus KAN-98. Die beiden
Aufräumregeln stören sich nicht: der Timer schreibt nach `/var/backups/`
selbst, die Ausrollung in das Unterverzeichnis darunter.

**5. Lesezugang zur Registry**

Ein Personal Access Token (classic) mit **ausschließlich** `read:packages`,
einmalig als `deploy` hinterlegt:

```bash
sudo -u deploy -H sh -c 'echo <PAT> | docker login ghcr.io -u <github-konto> --password-stdin'
```

Das `-H` ist wichtig: ohne es schriebe Docker die Anmeldung nach
`/root/.docker/config.json`, und der Nutzer `deploy` fände sie nie. Prüfen:

```bash
sudo -u deploy docker pull ghcr.io/omarziyada1/eportfolio-backend:main
```

Auf dem Server liegt damit **kein Token mit Schreibrechten**. Geschoben wird
ausschließlich aus der Action, und zwar mit deren eingebautem `GITHUB_TOKEN`,
das nur für den einzelnen Lauf gilt.

**5b. Lesezugang zu GitHub für `deploy` (KAN-106)**

Die Ausrollung zieht den Checkout als `deploy` nach. Dafür braucht dieser
Nutzer einen eigenen Schlüssel, den GitHub als Deploy-Key **ohne**
Schreibrecht kennt. Der Schlüssel von `root`, mit dem der Server einmal
geklont wurde, ist dafür der falsche: er ist bei GitHub mit Schreibrecht
hinterlegt, und an `/root/.ssh` kommt `deploy` ohnehin nicht heran.

```bash
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
sudo -u deploy -H ssh-keygen -t ed25519 -N '' -C 'eportfolio-vps-deploy-lesend' \
  -f /home/deploy/.ssh/id_ed25519_github
cat /home/deploy/.ssh/id_ed25519_github.pub
# -> GitHub: Settings, Deploy keys, Add deploy key, OHNE "Allow write access"
sudo -u deploy -H tee /home/deploy/.ssh/config > /dev/null <<'EOF'
Host github.com
  IdentityFile ~/.ssh/id_ed25519_github
  IdentitiesOnly yes
EOF
chmod 600 /home/deploy/.ssh/config
# Wirtsschluessel von GitHub aus der veroeffentlichten Liste, nicht per ssh-keyscan:
# https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints
sudo -u deploy -H tee -a /home/deploy/.ssh/known_hosts > /dev/null <<'EOF'
github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl
EOF
sudo -u deploy -H git -C /opt/eportfolio remote set-url origin \
  git@github.com:OmarZiyada1/Hochschule-Bremen-EPortfolio.git
sudo -u deploy -H git -C /opt/eportfolio ls-remote --exit-code --heads origin main
```

Fehlt `/opt/eportfolio` auf einem neuen Server noch ganz, entsteht es erst
jetzt, mit diesem Schlüssel und als `deploy`:
`sudo -u deploy -H git clone git@github.com:OmarZiyada1/Hochschule-Bremen-EPortfolio.git /opt/eportfolio`.

Der letzte Befehl muss genau eine Zeile liefern. Die `~/.ssh/config` ist
keine Feinheit: der Dateiname ist keiner der Standardnamen, und ohne die
Zeile `IdentityFile` scheitert jeder Aufruf mit `Permission denied
(publickey)`, obwohl der Schlüssel daneben liegt.

Danach hat der Schlüssel von `root` keine Aufgabe mehr:
`rm /root/.ssh/id_ed25519_eportfolio /root/.ssh/id_ed25519_eportfolio.pub`,
den Eintrag für `github.com` aus `/root/.ssh/config` streichen und bei GitHub
den Deploy-Key mit Schreibrecht löschen. Ein Schreibschlüssel auf einem
Server, der nur lesen muss, ist ein Risiko ohne Nutzen.

**5c. Prüfen, bevor die erste Ausrollung läuft**

```bash
sudo bash /opt/eportfolio/deploy/vps-pruefen.sh
```

Kein `FEHLT` in der Ausgabe, dann findet die Ausrollung alles vor, was
Schritt 0 von `deploy/ausrollen.sh` verlangt.

**6. SSH härten**

> **Vorher eine zweite Sitzung öffnen und offen lassen.** Wer sich hier
> aussperrt, kommt nur noch über die Webkonsole des Anbieters herein.

In der zweiten Sitzung zuerst prüfen, dass beide Konten funktionieren:

```bash
ssh <name>@<host> 'id'                       # Administrationskonto
ssh -i <privater-schluessel> deploy@<host> 'docker ps'   # Deploy-Konto
```

Erst danach:

```bash
tee /etc/ssh/sshd_config.d/00-eportfolio.conf > /dev/null <<'EOF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
EOF
sshd -t && systemctl reload ssh
```

**Als Datei unter `sshd_config.d/` und nicht als Änderung an
`/etc/ssh/sshd_config`**, und mit `00-` am Anfang. `sshd` nimmt bei jedem
Schlüssel den **zuerst** gefundenen Wert, und die Einbindung des Verzeichnisses
steht ganz oben in der Hauptdatei. Ubuntu legt dort selbst
`50-cloud-init.conf` ab, die `PasswordAuthentication yes` setzen kann; eine
Datei mit `99-` im Namen käme danach und bliebe wirkungslos. Eine Änderung in
der Hauptdatei ebenso.

#### Die Secrets im Repository

Unter *Settings → Secrets and variables → Actions*:

| Secret | Inhalt | woher |
| --- | --- | --- |
| `VPS_HOST` | Hostname oder IP des Servers | bekannt |
| `VPS_SSH_KEY` | privater Schlüssel aus Schritt 3 | vollständig, mit Kopf- und Fußzeile |
| `VPS_SSH_KNOWN_HOSTS` | öffentlicher Wirtsschlüssel des Servers | siehe unten |
| `VITE_IMPRINT_OPERATOR` | Betreiber laut Impressum | wie in der `.env` |
| `VITE_IMPRINT_STREET` | Straße und Hausnummer | wie in der `.env` |
| `VITE_IMPRINT_CITY` | Postleitzahl und Ort | wie in der `.env` |
| `VITE_IMPRINT_EMAIL` | Kontaktpostfach | wie in der `.env` |

**Der Hostname steht ausdrücklich als Secret** und nicht im Workflow: ein
öffentlich gewordener Workflow soll nicht die Serveradresse mitliefern.

**Der Nutzername ist seit KAN-106 kein Secret mehr.** Bis dahin gab es ein
Secret `VPS_USER` mit dem Wert `deploy`, und GitHub ersetzt jeden Wert eines
benutzten Secrets im Protokoll durch `***`: in jeder Meldung des Fernteils
stand `***` statt `deploy`, auch in den Behebungsbefehlen (`chown -R ***:***`)
und im Pfad `***/ausrollen.sh`. Der Workflow trägt den Namen jetzt fest; das
Secret wird nicht mehr gelesen und kann gelöscht werden.

**`VPS_SSH_KNOWN_HOSTS` auf dem Server erzeugen**, nicht mit `ssh-keyscan`
von außen. Ein Scan von außen glaubt dem, der antwortet, und genau das soll
der Eintrag ja ausschließen:

```bash
printf '%s %s\n' "<genau der Wert aus VPS_HOST>" \
  "$(cut -d' ' -f1,2 /etc/ssh/ssh_host_ed25519_key.pub)"
```

Der Name muss **zeichengenau** dem entsprechen, was in `VPS_HOST` steht. Ein
Eintrag auf den Hostnamen passt nicht, wenn sich die Action zur IP verbindet;
der Lauf scheitert dann mit `Host key verification failed`.

#### Die vier Impressumswerte

**Sie müssen als Secrets hinterlegt sein.** Vite backt sie beim Bündeln
in die JS-Dateien ein, und das Image entsteht jetzt in der Action, nicht mehr
auf dem VPS: es sieht die `.env` des Servers nie. Fehlen sie, bricht nichts
ab, das Impressum sagt dann nur sichtbar, dass die Angaben fehlen. In der
`.env` auf dem Server bleiben sie trotzdem stehen, sie werden für den Notweg
weiter unten gebraucht.

#### Branch-Schutz für `main`

Der Riegel in den Jobs verhindert, dass ein roter Stand **ausgerollt** wird:
schlägt ein Testjob nach dem Merge fehl, laufen die Build-Jobs und `deploy`
nicht, und auf dem Server bleibt der alte Stand. Er verhindert nicht, dass ein
roter Pull Request überhaupt gemergt wird. Dafür braucht es eine Regel unter
*Settings → Branches → Add branch ruleset* für `main`:

* *Require a pull request before merging*
* *Require status checks to pass* mit dem Check **Tests**

Ausdrücklich **`Tests` und nicht** `Backend-Tests` oder `Frontend-Tests`: das
Gate fasst beide zusammen, und wer die Einzelchecks einträgt, muss die Regel
bei jedem weiteren Teiljob nachziehen. Der Name ist seit KAN-101 derselbe
geblieben, eine bestehende Regel musste durch den Umbau nicht angefasst
werden.

Ohne diese Regel bleibt der Server zwar sauber, aber `main` trägt einen roten
Stand, und die nächste Ausrollung ist blockiert, bis ihn jemand repariert.

#### Rollback

Ausgerollt wird über `sha-<kurzer commit-hash>` und nicht über `:main`. Das ist
der Unterschied zwischen „wir haben irgendwas Neues" und „auf dem Server läuft
Commit abc1234": ohne den SHA gibt es keinen definierten Punkt, auf den ein
Rollback zurückgeht.

**Der vorgesehene Weg ist der Workflow selbst (KAN-106).** Unter *Actions →
CI/CD → Run workflow* den Zweig `main` wählen und als `image_tag` die Marke
eintragen, die zurückkommen soll, etwa `sha-9f67fac`. Auf jedem anderen Zweig
bricht schon der Job `marke` rot ab, damit ein Fehlgriff im Zweig-Menü nicht
als grüner Lauf ohne Wirkung endet. Tests und Bau laufen
dabei nicht; die Ausrollung ist dieselbe wie nach einem Merge, mit denselben
Prüfungen (Sicherung, Checkout, Digest, Gesundheit, HTTPS), nur dass der
Digest gegen die Registry statt gegen einen Bau dieses Laufs geprüft wird.
Die Marke muss zu einem Commit auf `main` gehören und in GHCR liegen; beides
prüft das Skript, bevor es etwas anfasst. Der Checkout auf dem Server bleibt
dabei auf dem Stand von `main`, die Compose-Dateien sind also die aktuellen;
brachte ausgerechnet die letzte Änderung an ihnen den Fehler, bleibt der
Notweg unten.

Ein alter Lauf lässt sich dafür **nicht** über *Re-run* wiederholen: Schritt 2
verlangt, dass `HEAD` nach dem Fast-Forward genau der Commit des Laufs ist,
und der Server steht dann schon weiter. Die Meldung nennt den Weg über *Run
workflow*.

Welcher Stand gerade läuft:

```bash
docker inspect --format '{{.Config.Image}}' \
  $(docker compose -f compose.base.yml -f compose.prod.yml ps -q backend frontend)
```

Zurück auf einen älteren Stand **von Hand**, nur wenn GitHub Actions nicht
erreichbar ist, und als `deploy`, nicht als `root`: nur `deploy` ist an GHCR
angemeldet, als `root` scheitert das Ziehen, und was `root` anlegt, hält die
nächste automatische Ausrollung an:

```bash
sudo -iu deploy
cd /opt/eportfolio
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=sha-<alt>/' .env
docker compose -f compose.base.yml -f compose.prod.yml pull backend frontend
docker compose -f compose.base.yml -f compose.prod.yml up -d --no-build
```

**Das bringt den Code zurück, nicht das Schema.** Flyway-Migrationen laufen
beim Start des Backends und haben keinen Rückweg; ein älteres Image trifft
dann auf eine neuere Datenbank. Brachte der zurückgerollte Stand eine
Migration mit, ist die Sicherung unter `/var/backups/eportfolio/` der einzige
Weg, und das Zurückspielen steht im Abschnitt „Sichern".

**Wie weit zurück das reicht.** Auf dem Server bleiben die letzten **fünf**
Stände liegen, ältere räumt die Ausrollung selbst ab. Ohne diese Regel wüchsen
die Images unbegrenzt: jede Ausrollung legt rund 800 MB an, und `docker image
prune` rührt markierte Images nie an. Auf einem Server, dessen volle Platte
zuerst Postgres trifft, wäre das nach etwa zwanzig Merges ein echtes Problem.
Ein älterer Stand ist damit nicht verloren, er wird nur nachgeladen: in GHCR
bleibt jede Marke liegen, und `pull` holt sie zurück.

**Ein Aufräum-Auftrag des Anbieters redet dabei mit.** Hostinger legt beim
Aufsetzen des VPS `/etc/cron.d/docker-image-prune` an, im Original mit

```text
57 0 * * * root docker image prune -af --filter "until=24h"
```

Das `-a` entfernt auch **markierte** Images, sobald sie älter als 24 Stunden
sind und kein Container sie benutzt. Damit war die Reserve aus dem Absatz
darüber jede Nacht um 00:57 verschwunden, nachgewiesen am 16.09.2026: nach dem
Ausrollen von `sha-56f34e3` lagen beide Stände bereit, zwölf Stunden später nur
noch der laufende. Schlimmer ist der zweite Fall: `until` zählt ab dem **Bau**
des Images, nicht ab dem Ziehen, und so kann der Auftrag eine gerade gezogene
ältere Marke zwischen Schritt 4 und Schritt 6 entfernen; die Ausrollung
scheitert dann an `--pull never`.

Die Datei auf dem Server trägt deshalb seit KAN-106 ein `-f` statt `-af`,
räumt also weiter jede Nacht die unmarkierten Schichten ab und lässt die
Stände in Ruhe. Das Original liegt unter
`/root/docker-image-prune.hostinger-original`. Ein Update des Anbieters könnte
die Datei ersetzen; `deploy/vps-pruefen.sh` prüft sie deshalb und meldet ein
zurückgekehrtes `-a` als HINWEIS. Verloren wäre auch dann nichts, ein Rollback
zieht die Marke neu aus GHCR.

**Zwei Wege, auf denen ein ausgerollter Stand versehentlich überschrieben
wird.** Beide enden damit, dass `sha-<hash>` auf dem Server nicht mehr das
zeigt, was der Commit `<hash>` enthält:

* ein `--build` im Notweg unten, solange `IMAGE_TAG` noch gesetzt ist,
* ein `docker compose -f compose.base.yml -f compose.artifact.yml build` auf
  dem Server. ARTIFACT trägt bewusst keine eigene Marke, es teilt sich das
  Image mit PROD, und auf dem Server steht die Marke der letzten Ausrollung in
  der `.env`.

Auf dem Server wird deshalb im Normalbetrieb überhaupt nicht gebaut.

#### Wenn die Action rot ist

| Meldung | Ursache |
| --- | --- |
| `Host key verification failed` | `VPS_SSH_KNOWN_HOSTS` passt nicht zu `VPS_HOST` (Hostname gegen IP) |
| `Permission denied (publickey)` beim `ssh` der Action | Schlüssel nicht in `~deploy/.ssh/authorized_keys`, oder `VPS_SSH_KEY` unvollständig kopiert |
| `Dieses Skript laeuft als root` | `VPS_USER` steht nicht auf `deploy` |
| `/opt/eportfolio gehoert root, nicht deploy` | Schritt 4 nicht ausgeführt, oder nach einem Handgriff als `root` nicht wiederholt |
| `Unter /opt/eportfolio gehoeren Dateien nicht deploy` | ein `git pull` oder Editieren als `root`; `chown -R deploy:deploy /opt/eportfolio` |
| `.env ist fuer deploy nicht schreibbar` | die `.env` wurde als `root` neu angelegt; `chown deploy:deploy` und `chmod 600` |
| `COMPOSE_PROFILES in der .env schaltet das Profil edge nicht` | die Zeile fehlt oder wurde geändert; ohne caddy ist die Seite von außen weg |
| `Commit ... liegt nicht auf origin/main` | der Lauf gehört zu einem Commit, der nicht (mehr) auf `main` liegt, etwa nach einem Force-Push |
| `Die Marke ... nennt keinen Commit auf main` | Rollback mit einer Marke, die nie über `main` gebaut wurde, oder Tippfehler |
| `Rollback nur von main aus` (Job `marke`) | *Run workflow* wurde auf einem anderen Zweig gestartet |
| `ist in GHCR nicht lesbar` | Marke falsch (Rollback mit Tippfehler), oder das PAT ist abgelaufen: Schritt 5 wiederholen; die Docker-Meldung dahinter sagt, welches von beiden |
| `git erreicht origin nicht` | Schritt 5b fehlt, oder der Deploy-Key wurde bei GitHub gelöscht |
| `ausgecheckt, erwartet main` | auf dem Server ist ein anderer Zweig oder ein einzelner Commit ausgecheckt |
| `hat lokale Aenderungen an verfolgten Dateien` | jemand hat auf dem Server eine verfolgte Datei bearbeitet; als `deploy` ansehen (`git diff`), dann `git stash` oder `git checkout -- <datei>` |
| `Der Dienst db laeuft nicht` | der Stapel steht; die Erstausrollung ist Handarbeit (oben) |
| `Kein beschreibbares /var/backups/eportfolio` | Schritt 4 nicht ausgeführt |
| `Keine .env in /opt/eportfolio` | die Datei fehlt oder liegt woanders; sie wird nicht neu erzeugt, das wäre geraten |
| `Fast-Forward ... nicht moeglich` | der Server hat eigene Commits; `git log --oneline origin/main..HEAD` zeigt sie |
| `HEAD ist ..., erwartet ...` | ein alter Lauf wurde erneut gestartet, der Server steht schon weiter; Rollback über *Run workflow* |
| `Compose loest nicht auf` | `compose.base.yml` ohne `image:`-Zeile, oder ein Overlay überschreibt sie |
| `Ziehen fehlgeschlagen` | Anmeldung, PAT, Netz oder Marke; die Docker-Meldung darüber sagt, was |
| `ist nicht das Image, das die Action geschoben hat` | unter der Marke liegt ein anderes Image: auf dem Server gebaut, oder die Marke in GHCR überschrieben |
| `.env unvollstaendig, nicht ersetzt` | die Datei trägt kein `POSTGRES_PASSWORD` mehr; die alte bleibt unangetastet stehen |
| `Der Stapel ist nicht vollstaendig hochgekommen` | ein Dienst wurde nach fünf Minuten nicht gesund; die Action hängt `ps` und die letzten 80 Zeilen der Logs an, meist ein fehlender Wert in der `.env` |
| `traegt den neuen Namen, aber nicht das neue Image` | Compose hat den Container nicht neu erstellt; `docker compose ps -a` und `docker images` ansehen |
| `Profil edge ist gesetzt, aber caddy laeuft nicht` | der TLS-Terminierer ist nicht hochgekommen; die Seite wäre von außen weg, obwohl das Backend gesund meldet |
| `caddy hat das Caddyfile ... nicht uebernommen` | das Caddyfile des Commits ist fehlerhaft; caddy läuft mit der alten Konfiguration weiter, die Seite bleibt oben |
| `antwortet mit ... statt 200` | der Stapel läuft, ist aber von außen nicht erreichbar: DNS, Zertifikat, Firewall des Anbieters, caddy |

**Ein gescheiterter Deploy rollt nicht automatisch zurück, und die Seite ist
dann unten.** Der Riegel in den Jobs schützt davor, dass ein roter *Test* auf
den Server kommt; ist die Ausrollung selbst schon gelaufen und das Backend
kommt nicht hoch, steht dort der neue, kaputte Stand. Das ist Absicht: eine
Flyway-Migration dieses Standes kann bereits gelaufen sein, und ein
automatisch zurückgerolltes älteres Image träfe dann auf ein neueres Schema.
Das kann schlimmer sein als der Stillstand. Die Action schreibt die drei
Befehle für den Rückweg und den Pfad der Sicherung in ihre Fehlerausgabe.

Ein **einzelner Testfehler wird nicht automatisch wiederholt**, und zwar
bewusst: ein roter Lauf bleibt rot und wird über *Re-run failed jobs* von Hand
erneut gestartet. Ein automatischer zweiter Versuch verdeckt ein flackerndes
Testverfahren, und das wäre bei `main` gleich `prod` die teuerste Form von
Ruhe.

### Aktualisieren von Hand (Notweg)

Dieser Weg wird bei der Ersteinrichtung gebraucht und dann, wenn GitHub
Actions oder GHCR nicht erreichbar sind. Im Normalbetrieb ersetzt ihn der
Abschnitt darüber.

```bash
sudo -iu deploy
cd /opt/eportfolio
git pull --ff-only
docker compose -f compose.base.yml -f compose.prod.yml up -d --build
```

Als `deploy` und nicht als `root`: das Verzeichnis gehört `deploy`, und ein
`git pull` als `root` hinterließe Dateien, die `deploy` nicht mehr schreiben
kann; die nächste automatische Ausrollung bräche daran ab (Schritt 0). Ist es
doch einmal als `root` passiert: `chown -R deploy:deploy /opt/eportfolio`.

Drei Dinge dazu, alle unangenehm und alle besser vorher gewusst:

* **Das ist ein Stop-Start mit echtem Ausfall.** Bei diesem Stapel gibt es
  keinen unterbrechungsfreien Weg. Für ein Vorführsystem ist das vertretbar,
  es gehört nur eingeplant.
* **Immer beide Dienste neu erstellen, nie nur einen.** Wird allein das
  Backend ersetzt, bekommt es eine neue Adresse im Compose-Netz, und der
  nginx des Frontends hält die alte fest: die API antwortet danach dauerhaft
  mit **502**, obwohl beide Container laufen.

* **`IMAGE_TAG` vorher leeren.** Steht in der `.env` noch die Marke der
  letzten automatischen Ausrollung, überschreibt ein `--build` genau diese
  Marke mit dem lokal gebauten Ergebnis. Der Name `sha-abc1234` zeigte danach
  auf etwas anderes als der Commit `abc1234`, und ein späterer Rollback
  dorthin holte den falschen Stand zurück. Also erst `IMAGE_TAG=` setzen,
  bauen, und die Zeile beim nächsten automatischen Lauf wieder von der Action
  füllen lassen.

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
# aus dem taeglichen Timer
gunzip -c /var/backups/eportfolio-JJJJ-MM-TT.sql.gz | docker exec -i eportfolio-prod-db-1 psql -U eportfolio -d eportfolio

# aus der Sicherung, die die Ausrollung selbst gezogen hat (KAN-101)
ls -lt /var/backups/eportfolio/
gunzip -c /var/backups/eportfolio/vor-sha-<hash>-JJJJ-MM-TT-HHMM.sql.gz | docker exec -i eportfolio-prod-db-1 psql -U eportfolio -d eportfolio
```

Es gibt also **zwei** Ablagen, und sie haben verschiedene Zwecke: der Timer
sichert täglich um 03:30, die Ausrollung sichert den Stand unmittelbar vor
einem Deployment. Nach einer schiefgegangenen Migration ist die zweite die
richtige, sie liegt nur Sekunden vor dem Schaden.

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
