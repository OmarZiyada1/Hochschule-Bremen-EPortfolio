# Stand

Verbindlicher Stand ist das [Jira-Board](https://hsb-portfolio.atlassian.net/browse/KAN);
diese Datei ist eine Momentaufnahme vom **29.07.2026** und veraltet schnell.

Grundlage sind die Branches und Commits im Repository, nicht die Ticketstände in
Jira.

---

## Erledigt und in `main`

### KAN-3 — Grundgerüst

Spring Boot 3.5.9 auf Java 21, PostgreSQL 16 als Container
(`docker-compose.yml`), Actuator-Health-Check. Konfiguration über `.env` mit
Vorlage `.env.example`; `application-dev.yml` importiert sie. DevTools aktiv.
Nicht enthalten: Dockerfile fürs Backend, CI, weitere Profile außer `dev`.

### KAN-4 — Datenmodell

Enums, `BaseEntity`/`AuditableEntity`, `JpaConfig` und fünf Flyway-Migrationen
(app_user, Stammdaten, Studiengang/Modul/Portfolio, Projekt-Aggregat,
Kommentar/Reaktion/Historie, Top-10) mit den passenden Entities und
Repositories. `ddl-auto` steht auf `validate`.
Nicht enthalten: Services, Controller, DTOs und Testdaten zu diesen Entities —
das Modell ist bisher reine Persistenz.

### KAN-9 — Block-Entity und Validierung

`Block` als Top-Level-Knoten des ProseMirror-Dokuments (`inhalt` als `jsonb`,
`typ` als Projektion), `BlockTyp` mit 14 Werten, zwei Migrationen (Tabelle,
danach `schema_version` + Audit-Spalten). `BlockValidationService` prüft
Knotentyp, typabhängige Pflichtfelder und die Provider-Allowlist für
VIDEO/EINBETTUNG.
Nicht enthalten: die Endpoints, die Blöcke lesen oder schreiben — insbesondere
das im Contract erwähnte `PUT /projekte/{id}/blocks`.

### KAN-5 — Authentifizierung

`POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`. JWT mit
HS512 (JJWT 0.12.6), 8 Stunden Laufzeit, `JWT_SECRET` ohne Default.
`JwtAuthentifizierungsFilter` lädt Rolle und Status bei jedem Request aus der
DB. BCrypt für Passwörter, CORS konfigurierbar, einheitliches Fehler-Envelope,
Brute-Force-Bremse (5 Versuche / 15 Minuten, getrennt nach E-Mail und IP).
`DevTestnutzerSeeder` legt im Profil `dev` drei Konten an.
Nicht enthalten: Registrierung, E-Mail-Verifikation, Passwort-Zurücksetzen,
Refresh-Tokens.

### KAN-11 — OpenAPI/Swagger-UI

springdoc-openapi 2.8.6, `OpenApiConfig` mit Bearer-Schema und den Metadaten der
API (Titel, Version v10), Freigabe von `/swagger-ui/**`, `/swagger-ui.html` und
`/v3/api-docs/**` in `SecurityConfig`, OpenAPI-Annotationen am `AuthController`.
Beide Schalter stehen in `application.yml` auf `false` und werden nur in
`application-dev.yml` eingeschaltet — die Doku ist damit außerhalb von `dev`
weder als Oberfläche noch als rohes Dokument erreichbar.
Nicht enthalten: Endpoint-Beschreibungen jenseits der Auth-Endpoints, weil es
zu diesem Zeitpunkt keine weiteren Controller gab (nachgeholt mit KAN-14).

### KAN-12 — Projektdokumentation

`README.md` mit Überblick, Tech-Stack, Repo-Aufbau und Schnelleinstieg sowie die
drei Dateien in `docs/`: `ARCHITEKTUR.md` (Paketbaum, Basisklassen,
Migrationsliste, Security-Ablauf, „Wo kommt was hin"), `SETUP.md` (von
`git clone` bis zur laufenden Anwendung inkl. Fehlersuche) und diese Datei.

### KAN-13 — Coding-Richtlinie und Claude-Setup

`CLAUDE.md` als verbindliche Projektregel (Quellenreihenfolge, Stack,
Backend-Regeln, Arbeitsablauf je Ticket) sowie vier Skills
(`backend-modul`, `flyway-migration`, `api-contract-sync`, `jira-ticket`) und
drei Agents (`backend-modul-builder`, `contract-pruefer`, `code-reviewer`) unter
`.claude/`. Kein Produktivcode.

Testabdeckung `main`: 81 Tests, alle grün (108 mit KAN-14, siehe unten).

---

## Erledigt, aber nicht in `main`

### KAN-14 — Stammdaten-Endpoints

Branch `KAN-14-stammdaten-endpoints`, Merge steht aus. Die vier öffentlichen
Lese-Endpoints aus Contract §6.1: `GET /api/kategorien`, `/api/fakultaeten`,
`/api/studiengaenge?fakultaet={id}`, `/api/module?studiengang={id}` — ohne
Token, sortiert nach `name`, ohne Paginierung. Dazu `StammdatenController`,
`StammdatenService`, vier Antwort-Records in `stammdaten/dto` und der
`DevStammdatenSeeder` (Profil `dev`, idempotent): FK1–FK5 mit
Beispiel-Studiengängen und -Modulen sowie acht Kategorien. Ein ungültiger
UUID-Parameter lief bisher an §6.2 vorbei und liefert jetzt 400 im Envelope;
`VALIDIERUNG_FEHLGESCHLAGEN` ist damit Konstante in `Fehlercodes` statt Literal
im Handler. Keine Migration angefasst, `ddl-auto: validate` grün.
Testabdeckung mit diesem Branch: 108 Tests, alle grün.
Nicht enthalten: Schreiben von Stammdaten (Administrationsseite) und der
Abgleich der §§ 3.6–3.9 mit der Contract-Seite.

### KAN-6 — Frontend-Setup

Branch `KAN-6-Frontend-Projekt-Setup-Design-Tokens-aus-Figma-übernehmen`.
Vite + React 19 + TypeScript + Tailwind 4 + shadcn/ui, pnpm. Reines Scaffold:
Beispiel-`App.tsx`, ein Button, Theme-Provider. Design-Tokens sind die
neutralen shadcn-Defaults; übernommen ist bisher nur die Schrift Geist.
Kein Routing, kein API-Client, keine Backend-Anbindung.

---

## Bekannte Lücken und Einschränkungen

- **Fast keine Endpoints.** Es gibt zwei Controller: `AuthController` und —
  erst auf dem Branch zu KAN-14 — `StammdatenController`. Projekte, Portfolios,
  Blöcke, Kommentare, Reaktionen und Top-10 sind persistiert, aber über die API
  weder les- noch schreibbar. Die Stammdaten sind lesbar, aber nicht
  schreibbar; angelegt werden sie bisher nur vom Dev-Seeder.
- **Logout entwertet das Token nicht.** Die API ist stateless; ein signiertes
  JWT bleibt bis zum Ablauf gültig. Der Endpoint leert nur den SecurityContext
  des einen Requests. Kompensiert wird das dadurch, dass der Filter bei jedem
  Request `status = AKTIV` nachprüft — ein deaktiviertes Konto ist sofort
  draußen.
- **Die Brute-Force-Bremse ist nur im Arbeitsspeicher.** Ein Neustart hebt jede
  Sperre auf, und bei mehreren Instanzen zählt jede für sich. Für den Prototyp
  bewusst so gewählt.
- **Kein Optimistic Locking.** Keine Entity hat ein `@Version`-Feld. Zwei
  parallele Änderungen am selben Datensatz überschreiben sich gegenseitig, ohne
  dass es auffällt — relevant, sobald der Editor mit Autosave dazukommt.
- **Kein Datei-Upload.** Weder Entity noch Tabelle noch Endpoint. Die Blocktypen
  BILD, GALERIE, VIDEO, AUDIO und DOKUMENT existieren im Schema, es gibt aber
  nichts, was Dateien entgegennimmt oder ausliefert.
- **Unbekannte Pfade antworten mit 401 statt 404.** `anyRequest().authenticated()`
  greift, bevor überhaupt geprüft wird, ob ein Handler existiert. Ein Tippfehler
  in der URL sieht damit aus wie ein Rechteproblem.
- **Kein Reverse-Proxy-Betrieb vorgesehen.** Die Client-IP für die Login-Sperre
  kommt aus `getRemoteAddr()`; `X-Forwarded-For` wird bewusst nicht ausgewertet.
  Hinter einem Proxy zählen sonst alle Anfragen auf dieselbe IP.
- **Keine Registrierung.** `app_user` kennt `email_verifiziert` und
  `hsb_email_verifiziert`, der Status startet auf `REGISTRIERUNG_OFFEN` — den
  Weg dorthin gibt es nicht. Konten entstehen ausschließlich über den
  Dev-Seeder.
- **Nur ein Profil.** `dev` ist Default und einziges vorhandenes Profil. Es gibt
  keine Konfiguration für Produktion, kein Backend-Dockerfile, keine CI.
- **Tests brauchen eine echte Datenbank.** `EportfolioApplicationTests` ist ein
  `@SpringBootTest` gegen die laufende Postgres-Instanz; ohne Container
  scheitert `./mvnw test`. Keine Testcontainers, keine In-Memory-DB.
- **Zwei fachliche Fragen sind offen** und deshalb konfigurierbar statt fest
  entschieden (`app.berechtigung` in `application.yml`): das Vier-Augen-Prinzip
  (`vier-augen-prinzip: true`) und ob Admins fremde Inhalte bearbeiten dürfen
  (`admin-darf-fremde-inhalte-bearbeiten: false`). Beides ist laut Kommentar im
  Code noch mit den Prüfern zu klären.
- **Die Auth-Fehlercodes stehen noch nicht im Contract.** `Fehlercodes` vergibt
  sie vorab; laut Kommentar sind sie mit v11 der Confluence-Seite nachzutragen.
  Mit KAN-14 kommt `VALIDIERUNG_FEHLGESCHLAGEN` dazu — der Code wurde vorher
  schon als Literal im `GlobalExceptionHandler` verwendet und steht ebenfalls
  noch nicht in §6.2.
- **`OpenApiConfig` nennt weiterhin „v10".** Der Contract steht inzwischen auf
  v11; Titel und Beschreibung der API sind nicht nachgezogen.
