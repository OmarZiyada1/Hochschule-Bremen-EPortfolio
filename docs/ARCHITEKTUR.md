# Architektur

Beschreibt den Stand von Branch `main` einschließlich KAN-16
(Projekt-Lese-Endpoints) und KAN-49 (englische Bezeichner), deren Merge noch
aussteht. Basis-Paket ist `de.hsbremen.eportfolio`, Gruppen-ID `de.hsbremen`,
Artefakt `eportfolio`.

Seit KAN-49 sind alle Bezeichner englisch nach `docs/NAMENSSCHEMA.md`: Klassen,
Felder, Methoden, JSON-Feldnamen, Enum-Werte, Fehlercodes, Endpoint-Pfade,
Query-Parameter, Datenbankspalten und Konfigurationsschlüssel. Deutsch bleibt
die Prosa: Javadoc, Kommentare, `@DisplayName`, diese Doku und Jira. Der
Contract steht dazu noch auf v17 und führt die Bezeichner unter ihren deutschen
Namen; nachgezogen wird das mit v18.

---

## 1. Paketbaum des Backends

Geschnitten wird nach Fachlichkeit (ein Paket je Feature), nicht nach
technischer Schicht. Entity, Repository und Service eines Features liegen im
selben Paket. Die Beschreibungen stammen aus den `package-info.java`-Dateien.

```
de.hsbremen.eportfolio
├── EportfolioApplication          Einstiegspunkt, @SpringBootApplication + @ConfigurationPropertiesScan
├── auth/                          Anmeldung und Ausstellung von Zugriffstokens
│   └── dto/                       (kein eigenes Paket; DTOs liegen in auth/dto)
├── comment/                       Kommentare zu Projekten
├── common/
│   ├── domain/                    feature-übergreifende Basisklassen für Entities
│   ├── dto/                       feature-übergreifende DTOs (Seitenformat aus §6.6)
│   ├── enums/                     von mehreren Features genutzte Aufzählungstypen
│   └── error/                     zentrale Fehlerbehandlung, Exceptions, globaler Handler
├── config/                        anwendungsweite Spring-Konfiguration (Security, JPA, Properties)
├── masterdata/                    Referenzdaten: Fakultät, Studiengang, Modul, Kategorie
│   └── dto/                       DTOs der vier Stammdaten-Endpoints
├── portfolio/                     das E-Portfolio eines Benutzers als Sammlung seiner Projekte
├── project/                       einzelne Projektbeiträge inkl. Inhaltsblöcken
│   └── dto/                       DTOs des Projekt-Features (Kachel, Detail, Filter, Teil-DTOs)
├── reaction/                      Reaktionen/Bewertungen auf Projekte
├── top10/                         Rangliste hervorgehobener Projekte
└── user/                          Benutzerkonten und Profildaten
```

Die Paketnamen sind mit KAN-49 englisch geworden: `projekt` wurde `project`,
`stammdaten` wurde `masterdata`, `benutzer` wurde `user`, `kommentar` wurde
`comment`, `reaktion` wurde `reaction`. `auth`, `common`, `config`, `portfolio`
und `top10` waren es bereits.

Was in welchem Paket steckt:

| Paket        | Inhalt (Stand `main`) |
|--------------|------------------------|
| `auth`       | `AuthController`, `AuthService`, `JwtService`, `JwtAuthenticationFilter`, `LoginAttemptService`, `DatabaseUserDetailsService`, `AuthenticatedUser`, `RestAuthenticationEntryPoint`, `RestAccessDeniedHandler`, Properties-Records (`JwtProperties`, `LoginAttemptProperties`), `dto/{LoginRequest, LoginResponse, UserResponse}` |
| `comment`    | `Comment`, `CommentRepository` |
| `common.domain` | `BaseEntity`, `AuditableEntity` |
| `common.dto`    | `PageResponse` (Seitenformat aus Contract §6.6) |
| `common.enums`  | `BlockType`, `CommentStatus`, `CommentType`, `Degree`, `NominationStatus`, `ProjectStatus`, `ProjectType`, `Role`, `UserStatus` |
| `common.error`  | `ApiError`, `ApiErrorWriter`, `ErrorCodes`, `GlobalExceptionHandler`, `ValidationException`, `ResourceNotFoundException` |
| `config`     | `SecurityConfig`, `JpaConfig`, `OpenApiConfig`, `CorsProperties` |
| `masterdata` | `Category`, `Faculty`, `Module`, `StudyProgram` + je ein Repository, `MasterDataController`, `MasterDataService`, `DevMasterDataSeeder`, `dto/{CategoryResponse, FacultyResponse, StudyProgramResponse, ModuleResponse}` |
| `portfolio`  | `Portfolio`, `PortfolioRepository` |
| `project`    | `Project`, `Block`, `ProjectMember`, `ProjectStatusHistory` + je ein Repository, `BlockValidationService`, `ProjectPermissionService`, `PermissionProperties`, `ProjectController`, `ProjectReadService`, `ProjectSpecifications`, `dto/{ProjectCardResponse, ProjectDetailResponse, ProjectFilterRequest, PersonResponse, MemberResponse, ReferenceResponse, BlockResponse, StatusHistoryResponse}` |
| `reaction`   | `Reaction`, `ReactionRepository`, `ReactionCount` (Abfrageergebnis für die Kachelzählung) |
| `top10`      | `Top10Entry`, `Top10Nomination` + je ein Repository |
| `user`       | `User`, `UserRepository`, `DevTestUserSeeder` |

---

## 2. Basisklassen

**`common.domain.BaseEntity`** (`@MappedSuperclass`)
Bringt den technischen Primärschlüssel mit: Feld `id` vom Typ `UUID`,
`@GeneratedValue(strategy = GenerationType.UUID)`, nur Getter. Alle Entities
erben davon.

**`common.domain.AuditableEntity`** (`@MappedSuperclass`, erbt `BaseEntity`)
Ergänzt `createdAt` und `updatedAt` (beide `Instant`, `not null`), gepflegt über
Spring Data Auditing (`@CreatedDate` / `@LastModifiedDate` +
`AuditingEntityListener`). `createdAt` ist `updatable = false`. Aktiviert wird
das Auditing durch `@EnableJpaAuditing` in `config.JpaConfig`.

Wer *nicht* `AuditableEntity` erbt, hat bewusst keine Zeitstempel: bei den
Stammdaten-Tabellen (`category`, `faculty`, …) gibt es in den Migrationen
keine Audit-Spalten.

---

## 3. Umsetzungsstand je Entity

„Service" meint einen Service, der diese Entity fachlich bearbeitet, nicht bloß
liest.

| Entity / Feature        | Entity | Migration | Repository | Service | Endpoint |
|-------------------------|:------:|:---------:|:----------:|:-------:|:--------:|
| `User`                  | ✓      | ✓ (1)     | ✓          | teilweise (`DatabaseUserDetailsService`, `AuthService`, nur Anmeldung) | nur `GET /api/auth/me` |
| `Faculty`               | ✓      | ✓ (1)     | ✓          | `MasterDataService` (nur lesend) | ✓ `GET /api/faculties` |
| `Category`              | ✓      | ✓ (1)     | ✓          | `MasterDataService` (nur lesend) | ✓ `GET /api/categories` |
| `StudyProgram`          | ✓      | ✓ (2)     | ✓          | `MasterDataService` (nur lesend) | ✓ `GET /api/study-programs?faculty={id}` |
| `Module`                | ✓      | ✓ (2)     | ✓          | `MasterDataService` (nur lesend) | ✓ `GET /api/modules?studyProgram={id}` |
| `Portfolio`             | ✓      | ✓ (2)     | ✓          | -       | - |
| `Project`               | ✓      | ✓ (3)     | ✓          | `ProjectPermissionService` (Rechteprüfung), `ProjectReadService` (nur lesend) | ✓ `GET /api/projects`, `GET /api/projects/{id}` |
| `ProjectMember`         | ✓      | ✓ (3)     | ✓          | -       | eingebettet in `GET /api/projects/{id}` |
| Tags (`project_tag`)    | `@ElementCollection` in `Project` | ✓ (3) | - | - | eingebettet in beide Projekt-Endpoints |
| Redakteurszuweisung (`project_editor`) | `@ManyToMany` in `Project` | ✓ (3) | - | - | Filter `?editor=`, eingebettet in `GET /api/projects/{id}` |
| `Comment`               | ✓      | ✓ (4)     | ✓          | -       | - |
| `Reaction`              | ✓      | ✓ (4)     | ✓          | -       | nur als `reactionCount` in den Projekt-Antworten |
| `ProjectStatusHistory`  | ✓      | ✓ (4)     | ✓          | -       | eingebettet in `GET /api/projects/{id}`, nur für Beteiligte |
| `Top10Entry`            | ✓      | ✓ (5)     | ✓          | -       | - |
| `Top10Nomination`       | ✓      | ✓ (5)     | ✓          | -       | - |
| `Block`                 | ✓      | ✓ (6, 7)  | ✓          | `BlockValidationService` (Validierung, kein CRUD) | eingebettet in `GET /api/projects/{id}` |
| Auth                    | keine Entity | -   | -          | `AuthService`, `JwtService`, `LoginAttemptService` | ✓ `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` |

Es gibt drei Controller: `auth.AuthController`, `masterdata.MasterDataController`
und `project.ProjectController` (nur die beiden Lese-Endpoints aus KAN-16).
Datei-Upload, Registrierung, Admin-Bereich, die schreibenden Projekt-Endpoints
und die Top-10-Verwaltung sind noch nicht implementiert. Die Security-Regeln für
einen Teil dieser Pfade stehen bereits in `SecurityConfig` (siehe Abschnitt 5).

Die Stammdaten haben zusätzlich einen `DevMasterDataSeeder` (Profil `dev`,
idempotent): FK1 bis FK5 mit Beispiel-Studiengängen und -Modulen sowie ein Satz
Kategorien. Ohne diese Daten wären die vier Endpoints leere Listen. Die
Fakultäten entsprechen dem öffentlichen Stand der Hochschule, Studiengänge und
Module sind erfunden; deshalb ein Seeder und keine Migration, die die
Beispieldaten in jede Umgebung tragen würde.

---

## 4. Flyway-Migrationen

Liegen unter `backend/src/main/resources/db/migration`, Namensschema
`V<JJJJMMTTHHMM>__<beschreibung>.sql`. `spring.jpa.hibernate.ddl-auto` steht auf
`validate` — das Schema kommt ausschließlich von Flyway.

| # | Datei | Inhalt |
|---|-------|--------|
| 1 | `V202607221100__stammdaten_und_user.sql` | Tabellen ohne Fremdschlüssel: `app_user` (Login-Kennung ist die private `email`, zusätzlich `hsb_email`; `rolle` und `status` als Check-Constraints), `kategorie`, `fakultaet`. |
| 2 | `V202607221200__studiengang_modul_portfolio.sql` | `studiengang`, `modul`, `portfolio` — Tabellen, die nur auf bereits bestehende verweisen; zwei Fremdschlüssel-Indizes. |
| 3 | `V202607221300__projekt_und_zuordnungen.sql` | Das Projekt-Aggregat: `projekt` plus die Zuordnungstabellen `projekt_tag`, `projekt_redakteur`, `projektmitglied`; Indizes auf allen Fremdschlüsseln und auf `status`. |
| 4 | `V202607221400__kommentar_reaktion_historie.sql` | Am Projekt hängende Tabellen: `kommentar`, `reaktion`, `projekt_status_historie` plus Indizes. |
| 5 | `V202607221500__top10.sql` | `top10_eintrag` und `top10_nominierung`; bewusst **kein** Unique auf `position`, damit Zwischenzustände beim Umsortieren möglich sind. |
| 6 | `V202607221645__block.sql` | `block`: ein Datensatz je Top-Level-Knoten des ProseMirror-Dokuments, `inhalt` als `jsonb`, `typ` als Check-Constraint über die 14 Blocktypen, Unique auf `(projekt_id, reihenfolge)` als `deferrable initially deferred`. |
| 7 | `V202607221800__block_audit_und_schema_version.sql` | Nachtrag zu `block`: Spalte `schema_version` (Default 1) sowie `erstellt_am`/`aktualisiert_am` für die Umstellung auf `AuditableEntity`; die DB-Defaults werden anschließend wieder entfernt, damit JPA sie schreibt. |
| 8 | `V202608011519__projekt_version.sql` | Spalte `projekt.version` (`bigint not null default 0`) für Optimistic Locking nach §3.3/§6.4. Der Default bleibt dauerhaft stehen, damit Inserts aus reinem SQL nicht an der not-null-Bedingung scheitern. |
| 9 | `V202608031502__rename_to_english.sql` | KAN-49: das gesamte Schema auf englische Bezeichner. 13 Tabellen, 60 Spalten, alle Constraint- und Indexnamen. Die Enum-Werte wandern mit (`ENTWURF` wird `DRAFT`), deshalb werden die betroffenen Check-Constraints gelöst, der Bestand per `UPDATE` umgeschrieben und die Constraints mit explizitem Namen (`ck_project_status`) neu gesetzt. Details in `docs/NAMENSSCHEMA.md` §9. |

Aktueller Schemastand laut Flyway: `202608031502`, 9 Migrationen.

Die Dateinamen 1 bis 8 tragen weiterhin deutsche Beschreibungen
(`__projekt_und_zuordnungen.sql`). Das bleibt so: eingespielte Migrationen
werden nie geändert, ihr Name steht in `flyway_schema_history` und in der
Prüfsumme.

---

## 5. Sicherheit

### Ablauf einer Anfrage

1. **Login**: `POST /api/auth/login` mit privater E-Mail und Passwort.
   `AuthService.login` prüft in dieser Reihenfolge:
   Sperre (`LoginAttemptService`) → Konto suchen (`findByEmail`) → BCrypt-Vergleich
   → `status == ACTIVE`. Bei unbekannter Adresse wird trotzdem gegen einen
   Platzhalter-Hash gerechnet, damit die Antwortzeit keinen Rückschluss auf
   existierende Konten erlaubt. Unbekannte Adresse und falsches Passwort liefern
   dieselbe Meldung und denselben Fehlercode.
2. **Token**: `JwtService.createToken` signiert mit HS512. Claims: `sub` =
   `userId`, `role`, `iss` = `eportfolio`, `iat`, `exp`. Laufzeit 8 Stunden
   (`app.security.jwt.lifetime`, Default `PT8H`). Bewusst **keine** E-Mail im
   Token: ein JWT ist signiert, nicht verschlüsselt.
3. **Filter**: `JwtAuthenticationFilter` (vor
   `UsernamePasswordAuthenticationFilter`) liest `Authorization: Bearer <token>`.
   Kein Header → die Anfrage läuft ohne `Authentication` weiter (PUBLIC-Fall).
   Header vorhanden, aber Token abgelaufen/ungültig/ohne passendes Konto → sofort
   401 im Fehler-Envelope, statt still anonym weiterzulaufen.
4. **Rolle und Status pro Request aus der DB**: der Filter lädt bei *jeder*
   Anfrage `role` und `status` frisch aus `app_user` und verwendet **nicht** den
   Rollen-Claim des Tokens. Ist der Status nicht `ACTIVE`, endet die Anfrage mit
   401. Das kostet eine Abfrage pro Request, sperrt ein deaktiviertes Konto aber
   sofort aus, statt erst nach bis zu acht Stunden.
5. **Autorisierung**: zwei Ebenen: `SecurityFilterChain` und
   `@EnableMethodSecurity` decken die Rollenebene ab; die Ressourcenebene („nur
   eigene Ressource") liegt in `ProjectPermissionService`, weil sie an den
   Daten hängt (Autor, Projektmitgliedschaft, zugewiesene Redakteur:innen) und
   sich nicht annotieren lässt.

### Weitere Festlegungen in `SecurityConfig`

- **Stateless**: `SessionCreationPolicy.STATELESS`, keine Session, kein Cookie.
- **CSRF aus**, begründet: ohne Cookie gibt es nichts, was der Browser
  automatisch mitschickt. Landet das Token je in einem Cookie, muss CSRF-Schutz
  zurück.
- **CORS**: nur für `/api/**`, erlaubte Origins aus `CORS_ALLOWED_ORIGINS`
  (Default `http://localhost:5173`), erlaubte Header nur `Authorization` und
  `Content-Type`, `allowCredentials = false`.
- **Passwörter**: `BCryptPasswordEncoder` mit Spring-Default-Stärke 10.
- **Fehlerformat**: `RestAuthenticationEntryPoint` und
  `RestAccessDeniedHandler` sorgen dafür, dass auch die von Spring Security
  selbst erzeugten 401/403 im Envelope aus `ApiError` (`timestamp`, `status`,
  `errorCode`, `message`, `path`) ankommen und die API nicht zwei Fehlerformate
  hat. Denselben Zweck erfüllt im `GlobalExceptionHandler` die Behandlung von
  `MethodArgumentTypeMismatchException`: ein Query-Parameter, der keine UUID
  ist (`?faculty=abc`), landete sonst in Springs eigenem Fehlerkörper.

### Offene Pfade und warum

| Pfad | Grund |
|------|-------|
| `OPTIONS /**` | CORS-Preflight muss ohne Token durchgehen. |
| `POST /api/auth/login` | Hier holt man sich das Token erst. |
| `GET /actuator/health` | Health-Check ohne Anmeldung; es ist der einzige freigeschaltete Actuator-Endpoint (`management.endpoints.web.exposure.include: health`). |
| `GET` auf `/api/categories`, `/api/faculties`, `/api/study-programs`, `/api/modules` | PUBLIC-Lesezugriff auf die Stammdaten (§5). Umgesetzt im `MasterDataController`. Hier entscheidet **kein** Berechtigungsservice mit: die Listen hängen an keiner Ressource mit Eigentümer und enthalten nichts Schützenswertes. |
| `GET` auf `/api/projects`, `/api/projects/*` | PUBLIC-Lesezugriff auf veröffentlichte Inhalte, umgesetzt im `ProjectController` (KAN-16). Was ein nicht angemeldeter Aufrufer tatsächlich sieht, entscheidet der `ProjectPermissionService`. |
| `GET` auf `/api/projects/*/blocks`, `/api/portfolios/*`, `/api/top10` | Ebenfalls PUBLIC, **diese Endpoints existieren aber noch nicht.** Die Regeln stehen vorab da, damit die späteren Controller nicht versehentlich hinter `authenticated()` verschwinden. |
| `/api/admin/**` | Nicht offen, sondern `hasRole("ADMIN")`. |
| `/swagger-ui/**`, `/swagger-ui.html`, `/v3/api-docs/**` | Die Doku ist gerade der Ort, an dem man sich das Token erst besorgt; hinter `authenticated()` wäre sie nutzlos. Im Gegenzug ist springdoc außerhalb des Profils `dev` komplett abgeschaltet, und hinter den Pfaden liegt nur die Beschreibung der API, keine Daten. |

Alles Übrige: `anyRequest().authenticated()`.

### Brute-Force-Bremse

`LoginAttemptService` zählt getrennt je E-Mail und je Client-IP; einer der
beiden Zähler reicht für die Sperre. Grenzwerte in `application.yml`
(`app.security.login-attempts`): 5 Fehlversuche, 15 Minuten Sperre. Der Zähler
liegt **nur im Arbeitsspeicher**:
ein Neustart hebt die Sperre auf, und bei mehreren Instanzen zählt jede für
sich. Als Client-IP wird bewusst `request.getRemoteAddr()` genommen, ohne
`X-Forwarded-For` auszuwerten.

---

## 6. Wo kommt was hin

| Vorhaben | Ort |
|----------|-----|
| Neues Enum, das mehrere Features nutzen | `backend/src/main/java/de/hsbremen/eportfolio/common/enums/` |
| Neue Entity | in das Paket des Features, z. B. `…/project/Foo.java`; von `BaseEntity` oder `AuditableEntity` erben |
| Neue Migration | `backend/src/main/resources/db/migration/V<JJJJMMTTHHMM>__<beschreibung>.sql`; bestehende Dateien **nie** ändern |
| Neues Repository | neben die Entity, z. B. `…/project/FooRepository.java`, Interface über `JpaRepository` |
| Neuer Service | neben die Entity, z. B. `…/project/FooService.java`, `@Service` |
| Neuer Endpoint | `…/<feature>/FooController.java`, `@RestController` mit `@RequestMapping("/api/…")`; Pfad `kebab-case` und englisch (`/study-programs`), Zugriffsregel in `config/SecurityConfig` prüfen |
| Neuer paginierter Endpoint | `Pageable`-Parameter im Controller mit `@PageableDefault`, Antwort als `common/dto/PageResponse<T>` (Contract §6.6); Springs `Page` wird nie direkt serialisiert. Die erlaubten Sortierfelder im Service als Positivliste prüfen, sonst sortiert ein `?sort=author.passwordHash` über beliebige Pfade des Objektmodells (Vorbild `project/ProjectReadService`) |
| Neuer Listenfilter | Baustein als `Specification<T>` neben die Entity, z. B. `project/ProjectSpecifications`; die Sichtbarkeitsschranke aus Contract §5 bleibt Startwert der UND-Verknüpfung, damit kein Filter sie aufweichen kann |
| Neues DTO | `…/<feature>/dto/`, z. B. `…/project/dto/FooResponse.java`; Records mit Bean-Validation-Annotationen wie in `auth/dto/LoginRequest`, Abbildung aus der Entity über eine statische `from(…)`-Methode wie in `masterdata/dto/StudyProgramResponse`. Suffixe `…Request` und `…Response` |
| Neuer Fehlercode | Konstante in `common/error/ErrorCodes.java` **und** Zeile in Contract §6.2 (Contract-Version erhöhen, Skill `api-contract-sync`); ein Code an nur einem der beiden Orte ist ein Befund. Siehe Abschnitt 8 |
| Neue Konfigurationswerte | `@ConfigurationProperties`-Record neben das Feature (Vorbild `auth/JwtProperties`), Werte in `application.yml`; Schlüssel englisch und `kebab-case`, Registrierung passiert automatisch über `@ConfigurationPropertiesScan` |
| Neuer Test | `backend/src/test/java/de/hsbremen/eportfolio/<feature>/FooTest.java`, gleiche Paketstruktur wie der Produktivcode; Testdaten-Helfer wie `TestUser`/`TestProject`/`TestMasterData` daneben |
| Neuer Bezeichner überhaupt | erst `docs/NAMENSSCHEMA.md` nachschlagen; steht er dort nicht, nach den Grundregeln aus §1 bilden und die Tabelle ergänzen |

---

## 7. Frontend

Liegt **nicht** in `main`, sondern auf Branch
`KAN-6-Frontend-Projekt-Setup-Design-Tokens-aus-Figma-übernehmen` im Verzeichnis
`frontend/`.

Stand dort: das unveränderte Vite-Startprojekt mit React 19, TypeScript,
Tailwind CSS 4 und shadcn/ui. Enthalten sind `main.tsx`, eine `App.tsx`, die
„Project ready!" und einen Beispiel-Button rendert, ein `theme-provider.tsx`,
die shadcn-Button-Komponente und `lib/utils.ts`. `frontend/README.md` ist die
Template-Datei von shadcn.

Es gibt kein Routing, keinen API-Client, keine Anbindung an das Backend und
keine eigenen Seiten.

Zum Ticketziel „Design-Tokens aus Figma übernehmen": `frontend/src/index.css`
definiert zwar den vollständigen Token-Satz (Farben in `oklch`, Radien,
Schriften), die Farbwerte sind aber die neutralen shadcn-Defaults mit Chroma 0.
Übernommen ist bisher nur die Schrift (Geist Variable) und die abgestufte
Radius-Skala. Ob darüber hinaus Tokens aus Figma gesetzt werden sollten und
welche, ist aus dem Repo nicht ersichtlich — **unklar**.

---

## 8. Fehlerbehandlung

Jede Fehlerantwort verlässt den Server im Envelope aus Contract §6.2
(`common/error/ApiError`: `timestamp`, `status`, `errorCode`, `message`,
`path`). Es gibt genau zwei Wege dorthin:

- **`common/error/GlobalExceptionHandler`** (`@RestControllerAdvice`) für alles,
  was aus Controllern und Services kommt.
- **`auth/RestAuthenticationEntryPoint`** (401) und
  **`auth/RestAccessDeniedHandler`** (403) für Fehler, die schon in der
  Security-Filterkette auftreten und den Handler deshalb nie erreichen. Beide
  schreiben über denselben `ApiErrorWriter`, damit das Frontend nicht zwei
  Formate unterscheiden muss.

Fehlercodes stehen als Konstante in `common/error/ErrorCodes.java` **und** als
Zeile in Contract §6.2: beides oder keins. Der `BlockValidationService` war bis
KAN-49 die Ausnahme; sein Literal `BLOCK_UNGUELTIG` stand nur im Code und heißt
jetzt `ErrorCodes.BLOCK_CONTENT_INVALID`, wie §6.2 den Code führt.

### Bekannte Einschränkung: Versionskonflikt-Handler

`handleVersionConflict` fängt **jede**
`ObjectOptimisticLockingFailureException` ab und beantwortet sie mit 409
`PROJECT_VERSION_CONFLICT`. Das ist heute korrekt, weil `Project` die einzige
Entity mit `@Version` ist und §6.2 nur diesen einen Konfliktcode dieser Art
kennt.

**Sobald eine zweite Entity versioniert wird** (etwa `Block`, wenn Blöcke
einzeln gesperrt werden sollen), meldet der Handler für sie den falschen Code.
Dann ist zu tun:

1. In `ErrorCodes` einen eigenen Code für die neue Entity anlegen und ihn nach
   §6.2 nachtragen (Contract-Version erhöhen).
2. Im Handler nach der betroffenen Entity unterscheiden:
   `ObjectOptimisticLockingFailureException.getPersistentClassName()` liefert
   sie. Für einen unbekannten Typ bleibt es beim heutigen Verhalten, damit kein
   Konflikt unbemerkt als 500 durchrutscht.
3. Den Fall in `ProjectVersionConflictTest` (oder einem Gegenstück für die neue
   Entity) mit abdecken.

Festgehalten in KAN-15, wo der Handler entstanden ist.
