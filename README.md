# E-Portfolio-Portal der Hochschule Bremen (FK4)

Praktischer Teil einer Bachelorthesis an der Hochschule Bremen, Fakultät 4.
Das System soll Studierenden erlauben, Projektarbeiten als E-Portfolio zu
veröffentlichen; Redakteur:innen geben Beiträge frei, eine Top-10-Liste hebt
ausgewählte Projekte hervor. Umgesetzt wird ein Spring-Boot-Backend mit
PostgreSQL und ein React-Frontend. Das Backend deckt den API-Contract
vollständig ab (Auth, Projekte, Blöcke, Workflow, Kommentare, Dateien,
Top 10, Administration, Registrierung); das Frontend setzt darauf die
öffentlichen Ansichten, den blockbasierten Editor, die Redaktionsansicht und
die Administrationsseite. Verbindlicher Arbeitsstand ist das Jira-Board
(Projekt KAN); der Code in diesem Repository ist die Momentaufnahme dazu.

## Tech-Stack

Alle Versionen aus `backend/pom.xml` bzw. `frontend/package.json`.

| Bereich    | Technologie                                          |
|------------|------------------------------------------------------|
| Backend    | Java 21, Spring Boot 3.5.9 (Web, Data JPA, Security, Validation, Actuator, DevTools) |
| Auth       | JJWT 0.12.6 (HS512), BCrypt                          |
| Datenbank  | PostgreSQL 16 (Docker-Image `postgres:16`), Flyway    |
| Build      | Maven Wrapper (`backend/mvnw`)                        |
| Frontend   | React 19, TypeScript 6, Vite 8, Tailwind CSS 4, shadcn/ui auf Base UI, pnpm |
| API-Doku   | springdoc-openapi 2.8.6 (Swagger-UI, nur im Profil `dev`) |

## Repo-Aufbau

- `backend/`: Spring-Boot-Anwendung (Maven), inkl. Flyway-Migrationen unter `backend/src/main/resources/db/migration` und `Dockerfile`
- `frontend/`: React/Vite-App, inkl. `Dockerfile` und `nginx.conf`
- `docs/`: diese Dokumentation
- `compose.base.yml`: gemeinsame Grundlage; daneben `compose.dev.yml`, `compose.artifact.yml` und `compose.prod.yml`, je eine Betriebsart
- `.github/workflows/deploy.yml`: testet jeden Pull Request und rollt einen
  Merge nach `main` von selbst auf den Server aus (KAN-101)
- `eportfolio.ps1`: Menü für Starten, Bauen, Logs, Tests, Saatdaten und Aufräumen
- `stammdaten-seeder.sh` und `stammdaten-seeder-entfernen.sh`: die fünf
  Fakultäten, 75 Studiengänge und ihre Module, erhoben aus der
  Confluence-Seite „Fakultäten-Hierarchie"
- `kategorien-semester-seeder.sh`: die acht Kategorien und vier Semester,
  die im laufenden Programm nur aus dem `DevMasterDataSeeder` kommen und im
  Profil `prod` deshalb nie entstehen (KAN-99). Ohne diesen Lauf scheitert
  dort jedes Einreichen mit 400 `PROJECT_INCOMPLETE`
- `demo-daten-komplett.sh` und `demo-daten-raeumen.sh`: der Demobestand aus
  zehn Projekten und zehn Konten für die öffentliche Vorführung. Das
  Aufräumskript läuft **nur** gegen eine Entwicklungsdatenbank; es prüft das
  und bricht sonst ab
- `test-seeder.sh`, `test-sitzung.sh` und ihre Gegenstücke zum Entfernen,
  dazu `test-seeder-pruefen.sh`: Datenbestand der Usability-Testwoche
- `postman/`: Postman-Sammlung über alle Endpoints, im Menü unter `t` mit
  Newman ausführbar
- `Testmaterial/`: Bögen und Aufgabenkarten der Usability-Testwoche samt
  ihrem Generator; gehört zur empirischen Erhebung, nicht zur Anwendung
- `thesis/`: Textteil der Bachelorarbeit
- `.claude/`: Projektregeln, Skills und Agents für die Arbeit mit Claude Code

## Schnellstart

Voraussetzung ist Docker Desktop. Ausführlich in
[docs/SETUP.md](docs/SETUP.md).

```bash
cp .env.example .env
# In der .env mindestens POSTGRES_PASSWORD, JWT_SECRET und DEV_TEST_PASSWORD
# durch eigene Werte ersetzen. JWT_SECRET erzeugen mit:
#   openssl rand -base64 64
docker compose -f compose.base.yml -f compose.dev.yml up -d --build
```

Das startet Datenbank, Backend und Frontend. Der erste Lauf dauert, weil die
Maven-Abhängigkeiten und `node_modules` einmal geladen werden; beides bleibt
danach in benannten Volumes liegen.

Prüfen: <http://localhost:5173> zeigt die Oberfläche,
<http://localhost:8080/actuator/health> muss `{"status":"UP"}` liefern. Die API
lässt sich über <http://localhost:8080/swagger-ui.html> ausprobieren. Anmelden
mit `dev-studi@dev.invalid` und dem `DEV_TEST_PASSWORD` aus der `.env`; daneben
gibt es `dev-redakteur@…` und `dev-admin@…` mit denselben Zugangsdaten.

Fakultäten, Studiengänge und Module legt beim Start niemand an: sie sind eine
Datenlieferung und kommen aus `stammdaten-seeder.sh` (Menüpunkt `s1`). Ohne
diesen Lauf bleiben die zugehörigen Auswahlfelder leer, ohne dass ein Fehler
auftritt.

### Bequemer: das Menü

`eportfolio.ps1` im Wurzelverzeichnis fasst alles zusammen, was man im Alltag
braucht, und ist der empfohlene Weg:

```powershell
.\eportfolio.ps1
.\eportfolio.ps1 -Mode artifact    # mit vorgewählter Betriebsart
```

Es prüft zuerst, ob Docker läuft und ob es eine `.env` gibt, und nennt sonst
den fehlenden Schritt. Dann zeigt es ein Menü mit Betriebsart im Kopf:
Starten und Bauen, Status und Gesundheit, Logs je Dienst, Shell und `psql`,
die Backend- und Frontend-Testläufe, die Postman-Sammlung über alle Endpoints,
die Saatdaten und das Aufräumen. Jeder Docker-Befehl wird vorher angezeigt,
man kann ihn also auch von Hand verwenden; die löschenden Punkte fragen nach
und benennen, was verloren geht. Menüpunkte im Einzelnen in
[docs/SETUP.md](docs/SETUP.md), Abschnitt 2.

Weigert sich PowerShell wegen der Ausführungsrichtlinie:
`powershell -ExecutionPolicy Bypass -File .\eportfolio.ps1`.

Das Menü setzt Windows mit PowerShell voraus; unter macOS und Linux führen die
`docker compose`-Befehle oben zum selben Ergebnis. Die Saatdaten-Punkte rufen
ohnehin Shell-Skripte im Wurzelverzeichnis auf, die auch ohne das Menü laufen;
dann sagt ihnen `DB_CONTAINER`, welche Datenbank gemeint ist.

Das Frontend spricht die API unter seinem eigenen Ursprung an
(`http://localhost:5173/api/…`), in DEV über den Vite-Proxy, sonst über
nginx. Deshalb gibt es kein CORS und keine Basis-URL im Code.

### Drei Betriebsarten

Sie liegen in getrennten Compose-Projekten, haben eigene Ports und eigene
Volumes und laufen bei Bedarf nebeneinander. Einzelheiten in
[docs/SETUP.md](docs/SETUP.md), Abschnitt 2.

| Betriebsart | Overlay | Profil | Oberfläche | Wofür |
|---|---|---|---|---|
| DEV | `compose.dev.yml` | `dev` | 5173 | entwickeln, mit Hot Reload |
| ARTIFACT-DEV | `compose.artifact.yml` | `dev` | 5273 | gebautes Jar und Frontend prüfen |
| PROD | `compose.prod.yml` | `prod` | 5373 | Produktivkonfiguration, braucht Azure und SMTP |

`docker compose up` ohne `-f` scheitert absichtlich: bei drei Betriebsarten
soll aus dem Befehl ablesbar sein, welche lief.

Wer lieber auf dem Host entwickelt, braucht zusätzlich JDK 21, Node.js und
pnpm und startet nur die Datenbank im Container:

```bash
docker compose -f compose.base.yml -f compose.dev.yml up -d db
cd backend && ./mvnw spring-boot:run
cd frontend && pnpm install && pnpm dev
```

Ohne gesetztes `JWT_SECRET` startet die Anwendung nicht: das ist Absicht, siehe
[docs/SETUP.md](docs/SETUP.md).

## Konfiguration

Alles Konfigurierbare liegt an einer Stelle: die gebundenen Werte als
`@ConfigurationProperties`-Records in
[backend/src/main/java/de/hsbremen/eportfolio/config/](backend/src/main/java/de/hsbremen/eportfolio/config/),
die Werte selbst in `application.yml` und je Profil daneben. Zugangsdaten
stehen ausschließlich in der nicht eingecheckten `.env` beziehungsweise in der
Umgebung des Prozesses (API-Contract §6.8).

### Zwei Fremddienste, je zwei Adapter

Das Portal braucht einen Objektspeicher für hochgeladene Dateien und einen
Mailversand für Verifizierungscodes. Beide sind über einen Port abstrahiert und
über eine Property austauschbar; je zwei Adapter stehen bereit
(`backend/…/file/` und `backend/…/mail/`). Welcher greift, entscheidet allein
die Property:

| Property               | Wert    | Wirkung                                        |
|------------------------|---------|------------------------------------------------|
| `app.storage.provider` | `local` | Ablage im Dateisystem, Entwicklung              |
| `app.storage.provider` | `azure` | Azure Blob Storage, Betrieb                     |
| `app.mail.provider`    | `log`   | Nachricht in die Serverkonsole, Entwicklung     |
| `app.mail.provider`    | `smtp`  | Versand über ein SMTP-Relay, Betrieb            |

Profil `dev` setzt `local` und `log`, Profil `prod` setzt `azure` und `smtp`.
Einen Default gibt es bewusst nicht: fällt die Property weg, startet die
Anwendung nicht. Ein Produktivsystem, das Mails ins Log schreibt statt sie zu
versenden, fällt sonst erst auf, wenn sich niemand mehr registrieren kann.

### Zum Entwickeln reicht `docker compose up`

Beide Entwicklungsadapter kommen ohne fremden Dienst aus. Es braucht also kein
Speicherkonto und kein Postfach, und keine der Variablen aus dem
prod-Abschnitt der `.env.example`.

### Im Betrieb: alles aus der Umgebung

`application-prod.yml` enthält keinen einzigen Wert, nur Verweise der Form
`${AZURE_STORAGE_CONNECTION_STRING}`, und zwar ohne Default-Teil. Fehlt einer
davon, startet die Anwendung nicht und nennt den fehlenden Schlüssel:

```
APPLICATION FAILED TO START

Reason: java.lang.IllegalStateException: app.storage.provider=azure, aber diese
Pflichtwerte fehlen: app.storage.container (AZURE_STORAGE_CONTAINER).
Sie kommen aus der Umgebung, Vorlage: .env.example
```

Das ist dieselbe Fail-Fast-Regel wie beim JWT-Secret: eine Anwendung, die mit
halber Konfiguration hochkommt und erst beim ersten Upload scheitert, verschiebt
den Fehler an die Stelle, an der er am teuersten ist.

Zwei Dinge werden dabei automatisch geprüft, damit sie nicht auseinanderlaufen:
`NoSecretsInConfigurationTest` hält fest, dass in keiner eingecheckten
`application*.yml` ein Wert steht, der wie ein Schlüssel aussieht, und
`ConfigurationPlaceholderTest`, dass jeder Pflicht-Platzhalter auch in
`.env.example` dokumentiert ist.

### Was beim Start im Log steht

Je Port eine Zeile mit dem aktiven Adapter, bei `azure` zusätzlich Speicherkonto
und Container. Niemals ein Schlüssel oder Passwort:

```
Konfiguration: Speicher-Adapter=azure, Speicherkonto=..., Container=...
Konfiguration: Mail-Adapter=smtp, Absender=...
```

## Ausrollen

`main` ist der Produktivstand, `dev` der Entwicklungsstand. Ein Merge nach
`main` rollt sich selbst aus: die Action testet, baut beide Images, schiebt sie
nach GHCR, und der Server zieht sie und startet neu. **Ein fehlgeschlagener
Test oder Build erreicht den Server nie.** Auf `dev` laufen nur die Tests.

Auf dem Server ist im Normalbetrieb nichts mehr zu tun, auch kein `git pull`:
die Ausrollung (`deploy/ausrollen.sh`, seit KAN-106) zieht den Checkout auf
dem Server selbst auf den Merge-Commit, damit Compose-Dateien und Caddyfile
dort immer die des ausgerollten Standes sind, und sie ist erst grün, wenn
beide Container nachweislich das neue Image tragen (Marke, Image-ID, Digest)
und die Seite über HTTPS antwortet. Ausgerollt wird über
`sha-<kurzer commit-hash>`; ein Rollback ist ein von Hand gestarteter Lauf
desselben Workflows mit der alten Marke.

Einrichtung, Secrets, Rollback und die Fehlerbilder der Action stehen in
[docs/SETUP.md](docs/SETUP.md), Abschnitt 10.

## Links

- Jira-Board: <https://hsb-portfolio.atlassian.net/browse/KAN>
- Confluence, API-Contract (Seiten-ID 36732929): <https://hsb-portfolio.atlassian.net/wiki/pages/viewpage.action?pageId=36732929>

## Weitere Dokumentation

- [docs/SETUP.md](docs/SETUP.md): Installation, Start, Testnutzer, Fehlerbehebung
- [docs/ARCHITEKTUR.md](docs/ARCHITEKTUR.md): Paketstruktur, Migrationen, Sicherheitsablauf, wo was hingehört
- [docs/NAMENSSCHEMA.md](docs/NAMENSSCHEMA.md): verbindliche Zuordnung Deutsch nach Englisch für Klassen, Felder, Enums, Endpoints und Datenbankspalten
