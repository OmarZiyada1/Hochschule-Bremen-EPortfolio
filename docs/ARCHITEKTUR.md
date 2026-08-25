# Architektur

Beschreibt den Stand von Branch `main` einschließlich KAN-16
(Projekt-Lese-Endpoints), KAN-49 (englische Bezeichner) und KAN-50
(Konfiguration und Fremddienste, Abschnitt 9). Basis-Paket ist
`de.hsbremen.eportfolio`, Gruppen-ID `de.hsbremen`, Artefakt `eportfolio`.

Seit KAN-49 sind alle Bezeichner englisch nach `docs/NAMENSSCHEMA.md`: Klassen,
Felder, Methoden, JSON-Feldnamen, Enum-Werte, Fehlercodes, Endpoint-Pfade,
Query-Parameter, Datenbankspalten und Konfigurationsschlüssel. Deutsch bleibt
die Prosa: Javadoc, Kommentare, `@DisplayName`, diese Doku und Jira. Der
Contract führt sie seit v18 ebenso.

---

## 1. Paketbaum des Backends

Geschnitten wird nach Fachlichkeit (ein Paket je Feature), nicht nach
technischer Schicht. Entity, Repository und Service eines Features liegen im
selben Paket. Die Beschreibungen stammen aus den `package-info.java`-Dateien.

```
de.hsbremen.eportfolio
├── EportfolioApplication          Einstiegspunkt, @SpringBootApplication + @ConfigurationPropertiesScan
├── admin/                         Administrationsseite: Kennzahlen-Dashboard und Nutzerverwaltung
│   └── dto/                       DTOs der Administrationsseite (u. a. AdminUserResponse)
├── auth/                          Anmeldung und Ausstellung von Zugriffstokens
│   └── dto/                       (kein eigenes Paket; DTOs liegen in auth/dto)
├── comment/                       Kommentare zu Projekten
├── common/
│   ├── domain/                    feature-übergreifende Basisklassen für Entities
│   ├── dto/                       feature-übergreifende DTOs (Seitenformat aus §6.6)
│   ├── enums/                     von mehreren Features genutzte Aufzählungstypen
│   └── error/                     zentrale Fehlerbehandlung, Exceptions, globaler Handler
├── config/                        anwendungsweite Spring-Konfiguration (Security, JPA, Properties)
├── mail/                          Zustellung der Verifizierungs- und Rücksetzcodes (Port + zwei Adapter)
├── masterdata/                    Referenzdaten: Fakultät, Studiengang, Modul, Kategorie, Semester, Tag
│   └── dto/                       DTOs der sechs Stammdaten-Endpoints
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
| `admin`      | `AdminDashboardController`, `AdminDashboardService`, `AdminUserController`, `AdminUserService`, `AdminUserSpecifications`, `dto/{DashboardResponse, FacultyProjectCountResponse, AdminUserResponse, AdminUserCreateRequest, AdminUserUpdateRequest}`. Seit KAN-25, siehe Kapitel 12 |
| `auth`       | `AuthController`, `AuthService`, `JwtService`, `JwtAuthenticationFilter`, `AttemptCounter`, `LoginAttemptService`, `DatabaseUserDetailsService`, `AuthenticatedUser`, `RestAuthenticationEntryPoint`, `RestAccessDeniedHandler`, `dto/{LoginRequest, LoginResponse, UserResponse}`. Seit KAN-26 zusätzlich die Registrierung: `RegistrationService`, `VerificationCode`, `VerificationCodeRepository`, `VerificationCodeService`, `VerificationAttemptService`, `EmailAddresses`, `PasswordPolicy`, `dto/{RegisterRequest, VerifyRequest, ResendVerificationRequest, VerificationStatusResponse}`. Die Properties-Records liegen seit KAN-50 in `config` |
| `comment`    | `Comment`, `CommentRepository` |
| `common.domain` | `BaseEntity`, `AuditableEntity` |
| `common.dto`    | `PageResponse` (Seitenformat aus Contract §6.6) |
| `common.enums`  | `BlockType`, `CommentStatus`, `CommentType`, `Degree`, `NominationStatus`, seit KAN-37 `NominationTier`, `ProjectStatus`, `ProjectType`, `Role`, `Top10Action`, `UserStatus`, `VerificationPurpose` |
| `common.error`  | `ApiError`, `ApiErrorWriter`, `ErrorCodes`, `GlobalExceptionHandler`, `ValidationException`, `ResourceNotFoundException`, `ConflictException`, seit KAN-72 `RangeNotSatisfiableException` |
| `config`     | `SecurityConfig`, `JpaConfig`, `OpenApiConfig`, `AsyncConfig`, `SchedulingConfig`, `ConfigurationStartupLogger`, `ConfigurationValues` + **alle** Properties-Records (`CorsProperties`, `JwtProperties`, `LoginAttemptProperties`, `PermissionProperties`, `RegistrationProperties`, `StorageProperties`, `MailProperties`) und die Auswahl-Enums `StorageProvider`, `MailProvider` |
| `mail`       | `MailSender` (Port), `MailMessage`, `LogMailSender`, `SmtpMailSender`, `MailTemplateService`. Seit KAN-51, siehe Kapitel 10 |
| `masterdata` | `Category`, `Faculty`, `Module`, `StudyProgram`, seit KAN-65 `Semester`, seit KAN-75 `Tag` + `TagUsageCount` (Zählprojektion) + je ein Repository, `MasterDataController`, `MasterDataService`, `DevMasterDataSeeder`, `dto/{CategoryResponse, FacultyResponse, StudyProgramResponse, ModuleResponse, SemesterResponse, TagResponse}`. Seit KAN-25 zusätzlich das Admin-CRUD: `MasterDataAdminController`, `MasterDataAdminService`, `dto/{Category, Faculty, StudyProgram, Module, Semester}{Create, Update}Request`, dazu `SemesterMoveRequest` für die Reihenfolge |
| `portfolio`  | `Portfolio`, `PortfolioRepository` |
| `project`    | `Project`, `Block`, `ProjectMember`, `ProjectStatusHistory` + je ein Repository, `BlockValidationService`, `ProjectPermissionService`, `ProjectController`, `ProjectReadService`, `ProjectSpecifications`, `dto/{ProjectCardResponse, ProjectDetailResponse, ProjectFilterRequest, PersonResponse, MemberResponse, ReferenceResponse, BlockResponse, StatusHistoryResponse}`. Seit KAN-45 zusätzlich `dto/ProjectReferenceResponse` (nur ID und Titel, für Antworten, die ein Projekt bloß nennen). `PermissionProperties` liegt seit KAN-50 in `config` |
| `reaction`   | `Reaction`, `ReactionRepository`, `ReactionCount` (Abfrageergebnis für die Kachelzählung) |
| `top10`      | `Top10Entry`, `Top10Nomination`, `Top10Service`, `Top10NominationService`, `Top10Controller`, `Top10AdminController`, `Top10NominationController`, seit KAN-37 `OwnTop10NominationController` (die eigenen Vorschläge der Redaktion), `dto/{Top10EntryResponse, Top10NominationResponse, Top10NominationRequest, Top10AcceptRequest, Top10OrderRequest}` (KAN-24). Seit KAN-45 das Änderungsprotokoll: `Top10AuditEntry`, `Top10AuditEntryRepository`, `Top10AuditService`, `Top10AuditSpecifications`, `Top10Placement`, `dto/Top10AuditEntryResponse`, siehe Kapitel 13 |
| `user`       | `User`, `UserRepository`, `DevTestUserSeeder`, seit KAN-25 die Abfrageergebnisse `UserRoleCount` und `UserStatusCount` für die Dashboard-Kennzahlen |

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
| `User`                  | ✓      | ✓ (1)     | ✓          | `DatabaseUserDetailsService`, `AuthService` (Anmeldung), `RegistrationService` (Anlage und Verifizierung, KAN-26), `PasswordResetService` (Passwort-Rücksetzung, KAN-43), `AdminUserService` (Nutzerverwaltung, KAN-25) | `GET /api/auth/me`, `POST /api/auth/register`, `POST /api/auth/verify`, `POST /api/auth/verify/resend`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, `GET`/`POST /api/admin/users`, `GET`/`PATCH`/`DELETE /api/admin/users/{id}`, `POST /api/admin/users/{id}/reset-password` |
| `VerificationCode`      | ✓      | ✓ (10)    | ✓          | `VerificationCodeService` (Ausstellen, Prüfen, Aufräumen) | kein eigener; eingelöst über `POST /api/auth/verify` |
| `Faculty`               | ✓      | ✓ (1)     | ✓          | `MasterDataService` (nur lesend), `MasterDataAdminService` (CRUD, KAN-25) | ✓ `GET /api/faculties`, `POST`/`PATCH`/`DELETE /api/admin/faculties` |
| `Category`              | ✓      | ✓ (1)     | ✓          | `MasterDataService` (nur lesend), `MasterDataAdminService` (CRUD, KAN-25) | ✓ `GET /api/categories`, `POST`/`PATCH`/`DELETE /api/admin/categories` |
| `StudyProgram`          | ✓      | ✓ (2)     | ✓          | `MasterDataService` (nur lesend), `MasterDataAdminService` (CRUD, KAN-25) | ✓ `GET /api/study-programs?faculty={id}`, `POST`/`PATCH`/`DELETE /api/admin/study-programs` |
| `Module`                | ✓      | ✓ (2)     | ✓          | `MasterDataService` (nur lesend), `MasterDataAdminService` (CRUD, KAN-25) | ✓ `GET /api/modules?studyProgram={id}`, `POST`/`PATCH`/`DELETE /api/admin/modules` |
| `Portfolio`             | ✓      | ✓ (2)     | ✓          | -       | - |
| `Project`               | ✓      | ✓ (3)     | ✓          | `ProjectPermissionService` (Rechteprüfung), `ProjectReadService` (nur lesend) | ✓ `GET /api/projects`, `GET /api/projects/{id}` |
| `ProjectMember`         | ✓      | ✓ (3)     | ✓          | -       | eingebettet in `GET /api/projects/{id}` |
| `Tag`                   | ✓      | ✓ (16)    | ✓          | `MasterDataService` (nur lesend); angelegt als Nebenwirkung von `ProjectWriteService.applyTags` | ✓ `GET /api/tags?q=&limit=` |
| Tags (`project_tag`)    | `@ManyToMany` in `Project` auf `Tag` (seit KAN-75, davor `@ElementCollection` mit dem Text selbst) | ✓ (3, umgebaut in 16) | - | - | eingebettet in beide Projekt-Endpoints, weiterhin als Liste von Namen |
| Redakteurszuweisung (`project_editor`) | `@ManyToMany` in `Project` | ✓ (3) | - | - | Filter `?editor=`, eingebettet in `GET /api/projects/{id}` |
| `Comment`               | ✓      | ✓ (4)     | ✓          | -       | - |
| `Reaction`              | ✓      | ✓ (4)     | ✓          | -       | nur als `reactionCount` in den Projekt-Antworten |
| `ProjectStatusHistory`  | ✓      | ✓ (4)     | ✓          | -       | eingebettet in `GET /api/projects/{id}`, nur für Beteiligte |
| `Top10Entry`            | ✓      | ✓ (5)     | ✓          | `Top10Service` (öffentliche Liste, Reihenfolge, Entzug des Platzes) | ✓ `GET /api/top10`, `PUT /api/admin/top10` |
| `Top10Nomination`       | ✓      | ✓ (5, 20, 21) | ✓          | `Top10NominationService` (Vorschlag und Entscheidung) | ✓ `POST /api/projects/{id}/top10-nomination`, `GET /api/top10-nominations?nominatedBy=me` (die eigenen, seit KAN-37), `POST /api/top10-nominations/{id}/withdraw` (zurückziehen, seit Contract v70), `GET /api/admin/top10-nominations`, `POST /api/admin/top10-nominations/{id}/accept` bzw. `/reject` |
| `Top10AuditEntry`       | ✓      | ✓ (13)    | ✓          | `Top10AuditService` (ein Schreibweg, fünf Aufrufer; KAN-45) | ✓ `GET /api/admin/top10-audit`, nur lesend |
| `Block`                 | ✓      | ✓ (6, 7)  | ✓          | `BlockValidationService` (Validierung, kein CRUD) | eingebettet in `GET /api/projects/{id}` |
| Auth                    | keine Entity | -   | -          | `AuthService`, `JwtService`, `LoginAttemptService`, `VerificationAttemptService` | ✓ `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` |

Der Admin-Bereich steht seit KAN-25 (Kapitel 12): Dashboard, Nutzerverwaltung
und Stammdaten-CRUD, dazu die Top-10-Kuratierung aus KAN-24 und das
Änderungsprotokoll aus KAN-45 (Kapitel 13). Die zuletzt offenen Zeilen aus §6.1
sind inzwischen umgesetzt: `POST /admin/categories/{id}/merge` und
`POST /admin/projects/status` mit KAN-46, `POST /admin/users/{id}/reset-password`
mit KAN-43 (das serverseitig erzeugte Initialpasswort steht genau einmal in der
Antwort und setzt `passwordChangeRequired`, §6.7). Die Security-Regel für alle
diese Pfade steht als `/api/admin/**` mit `hasRole("ADMIN")` schon lange in
`SecurityConfig` (siehe Abschnitt 5); für KAN-25, KAN-45 und die beiden
Nachzügler war dort nichts zu ergänzen.

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
| 10 | `V202608081410__verification_code.sql` | KAN-26: `verification_code` für die Einmalcodes des Registrierungsflusses (§3.16). `code_hash` statt Klartext, `on delete cascade` auf `app_user`, Check-Constraint `ck_verification_code_purpose` über alle drei Werte aus §2.11 einschließlich `PASSWORD_RESET`, den erst KAN-43 ausstellt. Ein gemeinsamer Index auf `(user_id, purpose)`, weil immer nach beidem zusammen gesucht wird. |
| 11 | `V202608081524__user_password_change_required.sql` | KAN-28: Spalte `app_user.password_change_required` (`boolean not null default false`) für die erzwungene Passwortänderung (§3.1, §6.7). Der Default bleibt wie bei den Verifizierungs-Flags dauerhaft stehen: `false` ist der Regelzustand jedes selbst registrierten Kontos. |
| 12 | `V202608081745__stored_file.sql` | KAN-23: `stored_file` für hochgeladene Medien (§3.15). Die Bytes liegen im Objektspeicher (§3.15.1), die Spalte `path` hält nur den anbieterneutralen Schlüssel ohne Container und Endpoint. `project_id` nullable (`null` = Avatar) mit `on delete cascade`; `uploaded_by` kaskadiert bewusst nicht, weil die Person Teil der Rechteprüfung beim Löschen ist (§6.1). Index auf `project_id`. |
| 13 | `V202608091930__top10_audit_entry.sql` | KAN-45: `top10_audit_entry` für das unveränderliche Änderungsprotokoll der Top-10 (§3.17). Check-Constraint `ck_top10_audit_action` über die drei Werte aus §2.12. `project_id` nullable mit **`on delete set null`**: ein Projekt wird über `DELETE /projects/{id}` wirklich gelöscht, und mit `cascade` verschwänden genau die Zeilen, die festhalten, dass es einmal einen Platz belegt hat. `admin_id` kaskadiert nicht, weil Konten deaktiviert und nicht gelöscht werden (§6.1). Indizes auf beiden Fremdschlüsseln sowie ein zusammengesetzter Index `(timestamp desc, id asc)` für die Standardsortierung des Endpoints (§6.6). |
| 14 | `V202608130640__user_pending_email_and_email_change.sql` | KAN-60: Spalte `app_user.pending_email` (`varchar(255)`, nullable) für den selbständigen Wechsel der privaten E-Mail-Adresse (§3.1); bewusst ohne Unique-Constraint, den Wettlauf entscheidet die Bestätigung. Der Check-Constraint `ck_verification_code_purpose` wird gelöst und mit dem vierten Wert `EMAIL_CHANGE` aus §2.11 neu gesetzt. |
| 15 | `V202608161915__semester.sql` | KAN-65: Tabelle `semester` (§3.18) mit `name` (unique, 64 Zeichen), `active` und `sort_order`, dazu die Spalte `project.semester_id` mit Fremdschlüssel und Index. Die Migration überführt jeden vorhandenen, nicht leeren Freitext aus `project.semester` in eine Zeile, setzt den Verweis und löscht danach die alte Spalte. Kein Default auf `active` und `sort_order`: JPA schreibt beide Spalten bei jedem Insert mit. Die übernommene Reihenfolge ist die alphabetische des Textes und wird auf der Administrationsseite zurechtgerückt, weil sie sich aus dem Namen nicht verlässlich berechnen lässt. |
| 16 | `V202608191630__tag.sql` | KAN-75: Tabelle `tag` (§3.19) mit `name` (64 Zeichen) und dem **Ausdrucksindex** `uq_tag_name_lower` auf `lower(name)`; ein gewöhnliches `unique (name)` ließe genau die Dubletten zu, wegen derer es die Tabelle gibt. `project_tag` wird von der Wertetabelle zur Verknüpfungstabelle: neue Spalte `tag_id`, alte Spalte `tag` gelöscht, Primärschlüssel jetzt `(project_id, tag_id)`, Fremdschlüssel `fk_project_tag_tag` **ohne** Kaskade (verwaiste Tags bleiben stehen), Index `idx_project_tag_tag_id` für die Gegenrichtung. Die Übernahme des Bestands normalisiert wie der Schreibweg (trimmen, innere Mehrfach-Leerzeichen zusammenziehen, Vergleich ohne Rücksicht auf Groß- und Kleinschreibung); Anzeigename ist die häufigste Schreibweise, bei Gleichstand entscheidet die Kollation. Doppelte Paare fallen weg, bevor der neue Primärschlüssel steht, sonst scheiterte er an einem Projekt mit zwei Schreibweisen desselben Worts. |
| 17 | `V202608221430__author_is_project_member.sql` | KAN-35: die Autor:in wird zur gewöhnlichen `project_member`-Zeile, `project_role` wird freigestellt (Contract v65, §3.13.1). Erst die Spalte nullable machen, dann die Zeilen anlegen; umgekehrt scheiterten die Inserts an der not-null-Bedingung. **Mit 18 wieder zurückgenommen.** |
| 18 | `V202608221930__author_role_instead_of_membership.sql` | KAN-35: Rücknahme von 17 (Contract v66, §3.3). Die Autor:in ist keine Mitgliedszeile, sondern steht in `project.author_id`; bleiben sollte allein die Funktionsbezeichnung, und die bekommt sie als neue Spalte `project.author_role`. Die vorige Migration wird nicht geändert, sondern zurückgenommen: eine eingespielte Datei nachträglich anzufassen ist bei Flyway ein Prüfsummenfehler. |
| 19 | `V202608221955__author_member_rows_removed_again.sql` | KAN-35: Nachräumen zu 18. Zwischen 18 und dem Neustart mit dem zugehörigen Programmstand legte die laufende Anwendung weiter Mitgliedszeilen für die Autor:in an; solche Projekte ließen sich danach nicht mehr speichern (400 nach §3.13.1). |
| 20 | `V202608231030__nomination_tier.sql` | KAN-37: Spalte `top10_nomination.proposed_tier` (`varchar(32) not null`) für die Nominierungsstufe aus §2.13 (Contract v68), mit Check-Constraint `ck_top10_nomination_proposed_tier` über `TOP_1`, `TOP_5`, `TOP_10`. Drei Schritte, weil die Spalte am Ende `not null` steht und die Tabelle bereits Zeilen tragen kann: anlegen, aus `proposed_position` ableiten (1 → `TOP_1`, 2 bis 5 → `TOP_5`, alles Weitere und `null` → `TOP_10`), dann `not null` setzen. Kein Default: die Stufe ist Pflichtangabe des Anfragekörpers, ein Default würde eine fehlende Angabe still zu einer Aussage machen. |
| 21 | `V202608241200__nomination_withdrawn.sql` | KAN-37: `NominationStatus` (§2.8) bekommt mit Contract v70 den vierten Wert `WITHDRAWN`. Die Spalte `top10_nomination.status` bleibt, nur ihr Check-Constraint `ck_top10_nomination_status` kannte den Wert nicht; ohne die Migration endete jedes Zurückziehen im Constraint-Verstoß und damit in einem 500. Bestehende Zeilen werden nicht umgeschrieben: `WITHDRAWN` entsteht erst durch den neuen Endpoint, kein vorhandener Stand wird umgedeutet. |
| 22 | `V202608242020__biography_max_500.sql` | KAN-79: `portfolio.biography` wird mit Contract v75 (§3.2) von `text` auf `varchar(500)` verengt. Die Grenze stand bis dahin nur im Code (`@Size(max = 5000)`) und damit an keiner Stelle, die ein zweiter Schreibweg passieren müsste. Zwei Schritte in dieser Reihenfolge: erst den Bestand mit `left(biography, 500)` kürzen, dann den Typ ändern; umgekehrt scheitert das `alter column type`, sobald auch nur eine Zeile länger ist. Das Kürzen ist verlustbehaftet und in der Klärungsrunde zu KAN-79 bewusst so entschieden. Kein Check-Constraint daneben: die Typlänge ist die Bedingung, und `ddl-auto: validate` prüft sie gegen `@Column(length = 500)` im Entity. |
| 23 | `V202608251745__abbreviation_required.sql` | KAN-80: `study_program.abbreviation` und `module.abbreviation` werden mit Contract v81 (§3.7, §3.9) von `nullable` auf `not null` gehoben. Das Kürzel des Studiengangs steht seitdem oben rechts auf der Projektkachel und hinter dem Namen in den Projektdetails; eine Ansicht, die es zeigt, kann eine leere Stelle nicht sinnvoll füllen. Das Modul bekommt die Pflicht mit, obwohl es sein Kürzel derzeit nirgends zeigt: eine halb gepflegte Hierarchie fällt sonst erst dann auf, wenn eine künftige Ansicht danach greift. Zwei Schritte in dieser Reihenfolge: erst den Bestand füllen, dann `set not null`; umgekehrt scheitert die Bedingung, solange auch nur eine Zeile `null` ist. Der Backfill nimmt die ersten drei Buchstaben des Namens in Großschreibung (Zeichenklasse `[:alpha:]`, damit Umlaute stehen bleiben), ersatzweise `N.N.`; die Administration korrigiert solche Zeilen über die Studienstruktur. Die Dev-Stammdaten aus `DevMasterDataSeeder` tragen durchgehend Kürzel und sind nicht betroffen. |

Aktueller Schemastand laut Flyway: `202608251745`, 23 Migrationen.

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
| `POST` auf `/api/auth/register`, `/api/auth/verify`, `/api/auth/verify/resend` | Zwangsläufig offen (KAN-26): wer sich registriert, hat noch kein Token, und ein Konto in `REGISTRATION_PENDING` bekäme selbst mit Token ein 401 `ACCOUNT_NOT_ACTIVE`. An die Stelle der Anmeldung treten das Einmalgeheimnis im Postfach und das Rate-Limit aus `VerificationAttemptService`. Einzeln aufgeführt und nicht als `/api/auth/**`, weil unter demselben Präfix mit `/auth/me` und `/auth/logout` Pfade liegen, die ein Token brauchen. |
| `POST` auf `/api/auth/forgot-password`, `/api/auth/reset-password` | Aus demselben Grund offen (KAN-43): wer sein Passwort vergessen hat, kann sich nicht anmelden. An die Stelle der Anmeldung treten der Rücksetzcode im Postfach und das Rate-Limit aus `VerificationAttemptService` (§6.5, seit Contract v34 auch an `reset-password`). |
| `GET /actuator/health` | Health-Check ohne Anmeldung; es ist der einzige freigeschaltete Actuator-Endpoint (`management.endpoints.web.exposure.include: health`). |
| `GET` auf `/api/categories`, `/api/faculties`, `/api/study-programs`, `/api/modules`, `/api/semesters`, `/api/tags` | PUBLIC-Lesezugriff auf die Stammdaten (§5). Umgesetzt im `MasterDataController`. Hier entscheidet **kein** Berechtigungsservice mit: die Listen hängen an keiner Ressource mit Eigentümer und enthalten nichts Schützenswertes. |
| `GET` auf `/api/projects`, `/api/projects/*` | PUBLIC-Lesezugriff auf veröffentlichte Inhalte, umgesetzt im `ProjectController` (KAN-16). Was ein nicht angemeldeter Aufrufer tatsächlich sieht, entscheidet der `ProjectPermissionService`. |
| `GET` auf `/api/projects/*/blocks`, `/api/portfolios/*`, `/api/top10` | Ebenfalls PUBLIC, **diese Endpoints existieren aber noch nicht.** Die Regeln stehen vorab da, damit die späteren Controller nicht versehentlich hinter `authenticated()` verschwinden. |
| `GET` auf `/api/files/*` | PUBLIC seit KAN-23: Avatare und Dateien veröffentlichter Projekte sind nach §3.15 ohne Anmeldung abrufbar, und ein öffentliches Profil mit nicht abrufbarem Profilbild wäre in sich widersprüchlich. Ob ein Aufrufer die Datei tatsächlich zu sehen bekommt, entscheidet der `FileService` am Projektstatus, nicht die Filterkette. `POST` und `DELETE` fallen unter `authenticated()`. |
| `HEAD` auf `/api/files/*` | Seit KAN-72 zusammen mit der Range-Auslieferung (§3.15). RFC 9110 definiert HEAD als GET ohne Rumpf: wo das GET offen ist, gibt HEAD nichts preis, was jenes nicht schon preisgibt. Ohne die Zeile ergäbe ein anonymes HEAD auf die Datei eines veröffentlichten Projekts 401, während das GET derselben Datei 200 liefert, und ein Medienelement könnte Größe und `Accept-Ranges` nicht vorab erfragen. Bewusst nur für diesen Pfad: die übrigen PUBLIC-GETs liefern JSON, für das ein HEAD keinen Zweck hat. |
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

Seit KAN-26 gibt es davon **zwei Ausprägungen**. Die Zählmechanik steht in
`auth/AttemptCounter` und wird von zwei Diensten benutzt:

| Dienst | Zählt | Setzt zurück bei |
|--------|-------|------------------|
| `LoginAttemptService` | fehlgeschlagene Anmeldungen | erfolgreicher Anmeldung |
| `VerificationAttemptService` | **jeden** Aufruf von `POST /auth/verify`, `POST /auth/verify/resend`, `POST /auth/forgot-password` und `POST /auth/reset-password` (KAN-43, Contract v34); seit KAN-60 auch jeden E-Mail-Wechselversuch über `PUT /auth/me` (Schlüssel Wunschadresse + IP, gezählt vor der Passwortprüfung) | erfolgreich eingelöstem Code |

Beide lesen dieselben Grenzwerte, führen aber **getrennte Zähler**. Ein erneut
angeforderter Verifizierungscode darf niemanden aus der Anmeldung aussperren:
das wären zwei verschiedene Vorgänge, die sich gegenseitig blockieren, und die
betroffene Person könnte den Zustand nicht deuten. Beim erneuten Senden wird
jeder Aufruf gezählt und nicht nur ein fehlgeschlagener, weil dort der Versand
selbst die begrenzte Ressource ist.

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
| Neue Konfigurationswerte | `@ConfigurationProperties`-Record in `config/` (Vorbild `config/JwtProperties`), **nie** neben das Feature; Werte in `application.yml`, profilabhängige Werte in `application-<profil>.yml`. Schlüssel englisch und `kebab-case`, Registrierung passiert automatisch über `@ConfigurationPropertiesScan`. Kommt der Wert aus der Umgebung: `ConfigurationValues.isMissing` gegen den nicht aufgelösten Platzhalter prüfen (siehe Abschnitt 9) |
| Neues Geheimnis | Platzhalter **ohne Default** in `application-prod.yml` (`${AZURE_STORAGE_CONNECTION_STRING}`), Zeile in `.env.example`, niemals ein Wert in einer eingecheckten Datei. Beides prüfen `NoSecretsInConfigurationTest` und `ConfigurationPlaceholderTest` |
| Neuer Test | `backend/src/test/java/de/hsbremen/eportfolio/<feature>/FooTest.java`, gleiche Paketstruktur wie der Produktivcode; Testdaten-Helfer wie `TestUser`/`TestProject`/`TestMasterData` daneben |
| Neuer Bezeichner überhaupt | erst `docs/NAMENSSCHEMA.md` nachschlagen; steht er dort nicht, nach den Grundregeln aus §1 bilden und die Tabelle ergänzen |

---

## 7. Frontend

Das Frontend liegt als Verzeichnis `frontend/` im selben Repository wie das
Backend. Grundlage ist KAN-6: Werkzeugkette, Ordnerstruktur und Tokenschicht.
Alle Seiten-Tickets setzen darauf auf.

### 7.1 Stack

| Bereich | Wahl |
|---------|------|
| Paketmanager, Build | pnpm, Vite |
| Sprache und Bibliothek | TypeScript, React 19 |
| Styling | Tailwind CSS 4 (Konfiguration im CSS über `@theme inline`, keine `tailwind.config.js`), shadcn/ui |
| Routing | React Router |
| Serverdaten | TanStack Query |
| Oberflächentext | react-i18next, Deutsch als Standard, Englisch gepflegt |
| Tests | Vitest, Testing Library, MSW |

### 7.2 Struktur

Ablage nach Feature, dieselbe Idee wie package-by-feature im Backend (§1):
Was fachlich zusammengehört, liegt beieinander, statt nach technischer
Schicht sortiert zu werden.

```
frontend/src/
  api/                    client.ts, errors.ts, schema.d.ts, page.ts
  components/
    ui/                   shadcn-Primitiven (generiert, Namen unverändert)
    layout/               NavBar, Footer, Sidebar
    common/               ProjectCard, StatusBadge, Top10Card, EmptyState, …
  features/<feature>/
    <Feature>Page.tsx     die Route-Komponente
    components/           nur hier verwendete Bausteine
    hooks/                Query- und Mutation-Hooks
  i18n/                   de.json, en.json, index.ts
  lib/                    utils.ts, name.ts, project.ts, theme.ts
  routes/
  styles/tokens/          tokens.css, typography-tokens.css
```

Ein Baustein, den eine zweite Seite braucht, wandert nach `components/common/`,
statt kopiert zu werden. Zwei Fassungen derselben Projektkachel driften
zuverlässig auseinander.

### 7.3 Tokenschicht

Alle Farben, Radien und Schriftgrößen liegen in zwei Dateien unter
`frontend/src/styles/tokens/`: `tokens.css` (Farben und Radien) und
`typography-tokens.css` (Schrift). Beide spiegeln die Figma-Collections;
maßgeblich ist Figma, die Werte-Tabelle steht in Confluence „Foundation".

Die Farben liegen in **zwei Ebenen**, und diese Trennung ist keine Formalie,
sondern die technische Voraussetzung für zwei Dinge:

1. **Primitives** (`--blau-*`, `--neutral-*`, `--rot-*`, `--bernstein-*`,
   `--gruen-*`, `--basis-*`) sind Rohwerte ohne Bedeutung, identisch in hell
   und dunkel. Komponenten binden **nie** direkt daran.
2. **Semantic** ordnet jedem Rohwert eine Rolle zu, mit eigenem hellem und
   dunklem Verweis. Komponenten binden ausschließlich hier an.

Ohne die Alias-Ebene ist ein Moduswechsel nicht abbildbar: Ein Rohwert kann
nicht gleichzeitig hell und dunkel sein, eine Rolle dagegen kann je Modus auf
einen anderen Rohwert zeigen. Zusätzlich setzt shadcn/ui genau dieses
Rollenmodell mit diesen Bezeichnern voraus.

Daraus folgen zwei Regeln, die im Repository gelten:

- Eine Hex-Farbe außerhalb von `frontend/src/styles/tokens/` ist ein Befund.
- Eine Primitive-Stufe, auf die keine Semantic-Rolle mehr verweist, bleibt
  nicht im Code. Sie ist unerreichbar und verleitet dazu, sie doch direkt zu
  verwenden.

Die Tokennamen sind englisch, auch dort, wo das Projekt sonst deutsch
benennt: shadcn/ui erwartet diese Bezeichner. Die Gruppen `status-*` und
`role-*` tragen wörtlich die Enum-Werte des API-Contracts (§2.1, §2.2), damit
sich die Badge-Farbe ohne Übersetzungstabelle aus der API-Antwort ableiten
lässt.

Fakultäts- und Studiengangs-Badges sind bewusst einfarbig
(`badge-neutral-bg`/`-fg`) und unterscheiden sich allein durch ihre
Beschriftung (Confluence „Designentscheidungen", Abschnitt 2.4).

### 7.4 Wo kommt was hin

| Vorhaben | Ort |
|----------|-----|
| Neue Seite | `features/<feature>/<Feature>Page.tsx`, Route in `routes/` eintragen mit dem Wrapper der passenden Zugriffsebene |
| Baustein für genau eine Seite | `features/<feature>/components/` |
| Baustein für mehrere Seiten | `components/common/` bei Domänenbezug, `components/layout/` bei Rahmen (NavBar, Footer, Breadcrumb) |
| shadcn-Primitive | `components/ui/`, über die CLI erzeugt, Bibliotheksname unverändert; ein Umbenennen bricht jedes spätere `shadcn add` |
| Zugriff auf einen Endpoint | ein Hook je Serveroperation in `features/<feature>/hooks/`, Aufruf über den zentralen Client in `api/`; **kein `fetch` außerhalb von `api/`** |
| Response- oder Request-Typ | nicht schreiben, sondern aus `/v3/api-docs` nach `api/schema.d.ts` generieren; die Datei wird eingecheckt und nicht bearbeitet |
| Neue Farbe oder Größe | als **Rolle** in `styles/tokens/`, nie als Rohwert in der Komponente; fehlt die Rolle, wird sie angelegt |
| Sichtbarer Text | i18n-Schlüssel in `i18n/de.json` **und** `en.json`; Enum-Werte sind Schlüsselbestandteil (`project.status.PUBLISHED`), nicht Text |
| Filter-, Sortier- und Seitenzustand | in die URL, nicht in `useState`; sonst ist ein Ergebnis weder teilbar noch übersteht es den Zurück-Knopf |
| Neuer Test | neben die Einheit als `*.test.tsx`, Serverantworten über MSW |

### 7.5 Grenzen, die das Frontend nicht überschreitet

- **Die Sichtbarkeitsregel im Routing ist Bequemlichkeit, keine
  Sicherheitsmaßnahme** (Contract §5). Jede Seite behandelt 401 und 403
  trotzdem sichtbar; eine leere Fläche ist kein Zustand, sondern ein
  übersehener Fall.
- **Jede Fehlerantwort wird zum Envelope aus §6.2**, und entschieden wird
  über `errorCode`, nie über den Meldungstext.
- **Keine Attrappe im ausgelieferten Code.** Fehlt der Endpoint, wird die
  Ansicht nicht gebaut, sondern das blockierende Backend-Ticket benannt.

Details zu Aussehen, Komponentenablage und Barrierefreiheit stehen im Skill
`frontend-design`, zur Anbindung an die API im Skill `frontend-api`, zum
Ablauf je Ticket im Skill `frontend-modul`.

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

**Nichts fällt hinten heraus** (KAN-55, Contract v31): Was keiner der
spezifischen Methoden zugeordnet ist, fängt `handleUnexpected` ab und
beantwortet es mit 500 `INTERNAL_ERROR`, generischer Meldung und vollständigem
Stacktrace im Protokoll. Ausnahmen, die ihren Statuscode selbst mitbringen
(unbekannter Pfad 404, nicht zugelassene Methode 405, nicht gelesener
Content-Type 415), behalten ihn und laufen über `RESOURCE_NOT_FOUND`
beziehungsweise `VALIDATION_FAILED`; ohne diese Abzweigung würde der
Auffang-Handler aus einem 405 einen 500 machen.

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

---

## 9. Konfiguration und austauschbare Fremddienste

Stand KAN-50, Contract §6.8. Dieses Kapitel beschreibt, wo Konfiguration steht
und warum sie so geschnitten ist. Der Port `MailSender` samt beiden Adaptern
steht seit KAN-51 (Kapitel 10); `FileStorage` entsteht mit KAN-23.

### Alle Properties-Records liegen in `config`

Vorher lagen sie neben dem Feature, das sie liest (`auth/JwtProperties`,
`project/PermissionProperties`). Mit den Fremddiensten wäre daraus eine halbe
Regel geworden, denn Speicher und Mailversand gehören keinem Feature: gelesen
werden sie später von KAN-23 und KAN-51, konfiguriert aber an einer Stelle.
Deshalb gilt seit KAN-50 ohne Ausnahme: **jeder
`@ConfigurationProperties`-Record liegt in `config`.** Die fachlichen Enums aus
Contract §2 bleiben davon unberührt in `common/enums`; sie beschreiben Daten,
nicht die Umgebung.

### Die drei Profildateien

| Datei | Inhalt |
|-------|--------|
| `application.yml` | alles Profilunabhängige und nichts Geheimes. Die Auswahl-Properties `app.storage.provider` und `app.mail.provider` stehen hier **nicht**: ein Default würde ein Profil, das die Auswahl vergisst, still in den Entwicklungsadapter fallen lassen. |
| `application-dev.yml` | `local` und `log`, dazu die Datasource aus der `.env`. Kein einziger Wert aus der Umgebung für die Fremddienste, damit gar nicht erst die Versuchung entsteht, Zugangsdaten „nur kurz" in diese eingecheckte Datei zu schreiben. |
| `application-prod.yml` | `azure` und `smtp`, ausschließlich Platzhalter ohne Default. Bewusst **kein** `spring.config.import` für eine `.env`: im Betrieb kommen die Werte aus der Umgebung des Prozesses. |

### Ein Platzhalter ohne Default ist kein Fail-Fast-Netz

Das ist die Falle, die in KAN-50 beim Ausprobieren aufgefallen ist und die
`ConfigurationValues` schließt.

Springs `Binder` löst Platzhalter mit `ignoreUnresolvablePlaceholders = true`
auf. Fehlt `AZURE_STORAGE_CONTAINER` in der Umgebung, scheitert die Bindung
also **nicht**: der Record bekommt die Zeichenfolge
`${AZURE_STORAGE_CONTAINER}` als Wert. Die Anwendung startete damit anstandslos
und schrieb ins Startprotokoll `Container=${AZURE_STORAGE_CONTAINER}`.
Ein `@NotBlank` findet das nie, die Zeichenfolge ist nicht leer.

`ConfigurationValues.isMissing` zählt deshalb drei Fälle als fehlend: nicht
gesetzt, leer, und Platzhalter (auch mitten im Wert, denn
`https://${APP_HOST}/portfolio` ist als Basis-URL genauso unbrauchbar). Geprüft
wird in `StorageProperties`, `MailProperties`, `JwtProperties` und
`CorsProperties`, also überall dort, wo ein Wert aus der Umgebung kommt.
`UnresolvedPlaceholderTest` hält den Fall fest.

**Für jeden neuen Konfigurationswert aus der Umgebung gilt damit:** die Prüfung
mitziehen. Sonst gibt es genau wieder eine Property, die im Betrieb still den
Namen ihrer eigenen Umgebungsvariablen trägt.

Nicht abgedeckt bleibt `spring.datasource.*`: das sind Springs eigene
Properties. Fehlt dort ein Wert, scheitert der Verbindungsaufbau, was laut
genug ist.

### Bedingte Pflichtwerte

Die Azure-Zugangsdaten sind nur bei `provider=azure` Pflicht. Sie tragen
deshalb kein `@NotBlank`, sondern werden im Kompaktkonstruktor von
`StorageProperties` geprüft. Der Grund ist praktisch: mit `@NotBlank` an jedem
Feld müssten im dev-Profil Platzhalterwerte in der eingecheckten
`application-dev.yml` stehen, die von echten Zugangsdaten nicht zu
unterscheiden wären. Die Meldung nennt jeden fehlenden Schlüssel samt
Umgebungsvariable und niemals einen vorhandenen Wert.

### Startprotokoll

`ConfigurationStartupLogger` schreibt beim `ApplicationReadyEvent` je Port eine
Zeile: welcher Adapter aktiv ist, bei `azure` zusätzlich Speicherkonto und
Container. Aus der Verbindungszeichenfolge wird ausschließlich der Kontoname
herausgelöst, weil in derselben Zeichenfolge auch der Kontoschlüssel steht.

### Kein Geheimnis im Repository

Zwei Tests halten das ohne Zutun fest:

- `NoSecretsInConfigurationTest`: in keiner eingecheckten `application*.yml`
  trägt ein Schlüssel, dessen Name auf ein Geheimnis hindeutet, etwas anderes
  als einen Platzhalter ohne Default. Gerade der Default ist die Falle:
  `${JWT_SECRET:geheim}` sieht richtig aus und ist ein eingecheckter Zugang.
- `ConfigurationPlaceholderTest`: jeder Pflicht-Platzhalter aus den yml-Dateien
  steht in `.env.example`.

Beide suchen die Dateien, statt sie aufzuzählen; ein später angelegtes
`application-staging.yml` fällt damit automatisch mit unter die Prüfung.

---

## 10. Das Mail-Modul

Stand KAN-51, Contract §6.8 und §3.1.1. Paket `mail`, der erste Adapter hinter
einem der beiden Ports aus Kapitel 9.

| Klasse | Rolle |
|--------|-------|
| `MailSender` | Port, eine Methode `send(MailMessage)`. Synchron und werfend |
| `MailMessage` | Record: `to`, `subject`, `bodyText`, `bodyHtml` (optional) |
| `LogMailSender` | Adapter bei `app.mail.provider=log`, schreibt in die Serverkonsole |
| `SmtpMailSender` | Adapter bei `app.mail.provider=smtp`, versendet über `spring.mail.*` |
| `MailTemplateService` | **die einzige Klasse, die aufrufende Services benutzen.** Je fachlichem Anlass eine Methode; hier sitzen `@Async` und die Fehlerbehandlung |

Die Arbeitsteilung ist der Kern des Moduls: der Port bleibt eine gewöhnliche,
synchrone Methode, die bei einem Fehler wirft. Asynchronität und das Schlucken
des Fehlers stehen genau einmal, nämlich im `MailTemplateService`. Damit gilt
die Zusage aus §6.8 automatisch auch für jeden künftigen Adapter, und ein
Adapter muss nichts über sie wissen.

**Absender steht nicht in der Nachricht.** Adresse und Anzeigename sind eine
Eigenschaft des Systems und kommen aus `MailProperties`. Stünden sie in
`MailMessage`, müsste jede aufrufende Stelle sie mitgeben und könnte sie
unterschiedlich setzen.

**Kein Code in einer Betreffzeile.** Betreffzeilen erscheinen in
Benachrichtigungen auf Sperrbildschirmen, also dort, wo niemand angemeldet sein
muss. `MailTemplateServiceTest` hält das für alle drei Vorlagen fest. Aus
demselben Grund gibt `MailMessage.toString()` den Textkörper nicht preis: sonst
genügte eine einzige spätere Logzeile, um das Einmalgeheimnis ins Protokoll zu
tragen.

**Der Versand blockiert den Fachvorgang nicht.** Die Methoden des
`MailTemplateService` laufen über `@Async` mit dem begrenzten Executor aus
`config/AsyncConfig` und fangen jeden Fehler ab. Scheitert die Zustellung, gilt
die Registrierung trotzdem als erfolgreich; der Wiederholungsweg ist
`POST /auth/verify/resend` durch die Person selbst (§6.8).

Bei voller Warteschlange wird verworfen und protokolliert. Die übliche
`CallerRunsPolicy` liefe im aufrufenden Thread und erzeugte genau die Blockade,
die §6.8 ausschließt; `AbortPolicy` würde den Fachvorgang scheitern lassen.

**Auch die Relay-Verbindung ist fail-fast.** `spring.mail.*` sind Springs eigene
Properties und tragen keine Prüfung; ein fehlendes `MAIL_HOST` fiele deshalb
nirgends auf, weil dieses Modul den Fehlschlag ja bewusst leise macht. Genau die
Verbindung aus beidem wäre das Szenario aus §6.8, das erst auffällt, wenn sich
niemand mehr registrieren kann. `SmtpMailSender` prüft den Host deshalb beim
Start mit derselben `ConfigurationValues.isMissing`-Regel wie Kapitel 9.

**Grenze, bewusst getragen:** keine Zustellgarantie, keine Wiedervorlage
fehlgeschlagener Mails. Gehört in den Ausblick der Arbeit.

Der Zustelltest läuft gegen GreenMail, einen SMTP-Server im Arbeitsspeicher
(Testabhängigkeit, kein Dienst in den `compose.*.yml`).

---

## 11. Registrierung und Verifizierung

Stand KAN-26, Contract §3.1.1, §3.16 und §6.1. Der erste fachliche Nutzer des
Mail-Moduls aus Kapitel 10.

| Klasse | Rolle |
|--------|-------|
| `RegistrationService` | die drei Endpoints: `register`, `verify`, `resend`. Hier steht die Domain-Regel und sonst nirgends |
| `VerificationCodeService` | stellt Codes aus, prüft und entwertet sie, räumt verbrauchte weg. Die einzige Stelle, an der ein Code im Klartext existiert |
| `VerificationAttemptService` | Rate-Limit beider Verifizierungs-Endpoints (Abschnitt 5) |
| `EmailAddresses` | Kleinschreibung und „Teil hinter dem letzten `@`" |
| `PasswordPolicy` | Mindest- und Höchstlänge, auch für KAN-28 und KAN-43 |
| `config/RegistrationProperties` | die beiden Domainlisten und die Laufzeit der Codes |

### Die Rolle folgt der Domain

Persistiert wird die Rolle, die sich aus der Domain der `hsbEmail` ergibt,
und nur sie. Eine Rollenangabe im Request gibt es seit Contract v41 nicht
mehr (KAN-63); das frühere Feld `selectedRole` steuerte nur die Beschriftung
im Formular und wurde nie übernommen, sondern lediglich gegen die abgeleitete
Rolle geprüft. Bestimmte eine übermittelte Auswahl die Rolle, könnte jede
Person mit studentischer Adresse durch Umsetzen eines Feldes im Request
Redaktionsrechte erhalten, und die Freigabe von Portfolios hinge an einer
Selbstauskunft.

**Verglichen wird auf Gleichheit, nicht per Suffix.** Ein
`endsWith("hs-bremen.de")` ließe `boesehs-bremen.de` durch und entwertete die
ganze Prüfung. Soll eine Subdomain gelten, kommt sie in die Liste.

Die Listen stehen in `application.yml` unter `app.registration` und nicht im
Code, weil die Hochschule mehr als eine Adressendung führt und sich ihr Bestand
unabhängig von dieser Software ändert. `RegistrationDomainConfigurationTest`
läuft mit erfundenen Domains und belegt damit, dass die Konfiguration
tatsächlich zieht.

### Was am Code hängt und nicht in der Konfiguration steht

| Festlegung | Wert | Wo |
|------------|------|-----|
| Länge des Codes | 6 Stellen inklusive führender Nullen, `SecureRandom` | `VerificationCodeService` |
| Hash des Codes | BCrypt über denselben `PasswordEncoder` wie beim Passwort | `VerificationCodeService` |
| Passwort | mindestens 12, höchstens 72 Zeichen, keine Zeichenklassen-Regel | `PasswordPolicy` |
| Gültigkeit eines Codes | 24 Stunden | Property `app.registration.code-lifetime` |

Die Obergrenze von 72 Zeichen ist kein Sicherheitsmerkmal, sondern ein
BCrypt-Detail: der Algorithmus verarbeitet nur die ersten 72 Byte. Ohne die
Grenze wären zwei lange Passwörter, die sich erst ab Zeichen 73 unterscheiden,
dasselbe Passwort.

### Adressen sind nicht zwischen Groß- und Kleinschreibung zu unterscheiden

`EmailAddresses.normalize` schreibt jede Adresse klein, bei der Registrierung
wie bei der Anmeldung und bei jedem Nachschlagen im Verifizierungsflow. Ohne
diese Regel wären `Max@example.org` und `max@example.org` zwei Konten, obwohl
beide dasselbe Postfach meinen: der Unique-Constraint aus §3.1 griffe nicht, und
wer sich mit anderer Schreibweise anmeldet als er sich registriert hat, liefe in
ein `LOGIN_FAILED`, das er nicht auflösen kann. `AuthService.login`
normalisiert deshalb seit KAN-26 ebenfalls.

### Ununterscheidbare Antworten

`POST /auth/verify` und `POST /auth/verify/resend` antworten für bekannte und
unbekannte Adressen gleich (§6.1). Bei `verify` heißt das 400
`VERIFICATION_CODE_INVALID` für jeden Fall, in dem kein gültiger Code vorliegt,
**einschließlich der Antwortzeit**: gibt es das Konto nicht, wird trotzdem
einmal gegen einen Platzhalter-Hash gerechnet, wie in `AuthService.login`. Bei
`resend` heißt es 204, ob nun eine Mail rausging oder nicht.

Die Registrierung selbst kann das nicht leisten: beide Adressen sind eindeutig,
eine zweite Anmeldung darauf muss scheitern, und der Grund muss benennbar sein.
Deshalb 409 `RESOURCE_IN_USE` mit dem betroffenen Feld in der Meldung. §6.1
trägt diese eine Offenlegung ausdrücklich.

### Grenze, bewusst getragen

Der Zähler des Rate-Limits liegt wie der des Logins nur im Arbeitsspeicher
(Abschnitt 5). Ein Neustart hebt die Sperre auf; ein Automat mit langem Atem
könnte danach weiterprobieren. Für den Prototyp ausreichend, gehört mit dem
gemeinsamen Zähler aus Abschnitt 5 in den Ausblick.

---

## 12. Die Administrationsseite

Stand KAN-25 und KAN-46, Contract §6.1 (Abschnitt „Administration"), §6.6 und
§3.1. Der Bereich heißt durchgehend **Administrationsseite**, nie Cockpit.

### Der Schnitt liegt quer, und das ist begründet

Die Endpoints unter `/api/admin` liegen bewusst **nicht** alle in einem Paket:

| Endpoint-Gruppe | Paket | Warum dort |
|-----------------|-------|------------|
| `GET /admin/dashboard`, `/admin/users/**` | `admin` | siehe unten |
| `POST`/`PATCH`/`DELETE` auf `/admin/categories`, `/admin/faculties`, `/admin/study-programs`, `/admin/modules`, `/admin/semesters`, dazu `POST /admin/categories/{id}/merge` und `POST /admin/semesters/{id}/move` | `masterdata` | arbeitet auf den Entities dieses Features, wie der Lesedienst daneben |
| `/admin/top10-nominations/**`, `PUT /admin/top10` | `top10` | dasselbe, seit KAN-24 |
| `POST /admin/projects/status` | `project` | dasselbe, seit KAN-46: der Endpoint bewegt Projekte durch den Zustandsautomaten und ruft dafür den `ProjectWorkflowService` |

Das gemeinsame Merkmal dieser Endpoints ist ihr Pfadpräfix und die Regel in
`SecurityConfig`, nicht ihr Gegenstand. Sie nach Zielgruppe zusammenzulegen
hieße, den Schnitt nach Fachlichkeit aus Abschnitt 1 aufzugeben.

Zwei Bausteine passen in kein Feature und begründen das Paket `admin`:

1. **Das Dashboard** zählt Projekte, Konten, Blöcke und Nominierungen zusammen.
   In eines dieser vier Pakete gelegt, wäre es dort ein Fremdkörper mit drei
   Abhängigkeiten nach außen.
2. **Die Nutzerverwaltung** läge nach dem Schnitt in `user`, kann es aber nicht:
   sie braucht `AuthenticatedUser`, `EmailAddresses` und `PasswordPolicy` aus
   `auth`, und `auth` kennt bereits `user.User` und `user.UserRepository`. Aus
   der heute einseitigen Abhängigkeit würde ein Kreis. Von `admin` aus zeigen
   dagegen alle Pfeile nach außen.

### Das Dashboard: fünf Gruppenabfragen statt dreißig Zählungen

Die vier Enum-Aufschlüsselungen umfassen fünf Projektstatus, drei Rollen, drei
Kontostatus und vierzehn Blocktypen, dazu kommen seit Contract v76 die
Fakultäten. Jeden Wert einzeln zu zählen wäre derselbe Inhalt in dreißig
Datenbankrunden, und jede neue Enum-Konstante bräuchte eine weitere Zeile Code.
Stattdessen liefert je ein `group by` die Ergebniszeilen
(`ProjectStatusCount`, `ProjectFacultyCount`, `BlockTypeCount`, `UserRoleCount`,
`UserStatusCount`, im Stil von `ReactionCount`), und der Dienst füllt die
fehlenden Enum-Werte mit 0 auf.

**`projectsByFaculty` fällt aus dem Muster** (Contract v76, KAN-38). Es
gruppiert nicht über ein Enum, sondern über eine Stammdatenzeile (§3.8), und ist
deshalb eine Liste aus `{ faculty, count }` und keine Karte: eine Karte über die
UUID zwänge die Oberfläche, zusätzlich `GET /faculties` zu laden, nur um eine
Balkenreihe zu beschriften. Der vollständige Bestand, gegen den aufgefüllt wird,
steht nicht im Code, sondern in der Tabelle; deshalb braucht diese Kennzahl als
einzige eine zweite Abfrage (`FacultyRepository.findAllByOrderByAbbreviationAsc`).
Projekte ohne Fakultät gehen nicht ein, weil `Project.facultyId` bis zum
Einreichen null ist (§3.3); die Summe der Liste ist daher nicht die Gesamtzahl
der Projekte.

**Das Auffüllen ist Teil der Zusage** (Contract v26): eine Karte enthält immer
alle Werte ihres Enums. Ohne das müsste das Frontend die Listen aus §2 ein
zweites Mal führen, um ein vollständiges Diagramm zu zeichnen. `EnumMap` sorgt
zusätzlich für eine stabile, fachlich lesbare Reihenfolge; bei `ProjectStatus`
ist es die des Zustandsautomaten aus §4.1.

`blocksByType` ist überhaupt nur möglich, weil `Block.type` eine eigene Spalte
ist und nicht bloß im `jsonb` des Inhalts steckt (§2.5).

### `hsbEmail` hat genau zwei Orte: Nutzerverwaltung und die Person selbst

§3.1 erlaubt die HSB-Adresse in der Nutzerverwaltung (`AdminUserResponse`)
und seit Contract v50 in den Auth-Antworten an die Person selbst
(`auth.dto.UserResponse`: Login, Registrierung, `GET/PUT /auth/me`, KAN-69);
das Profilformular zeigt sie als nicht änderbares Feld. Dritte sehen die
Adresse weiterhin nie. Es bleiben bewusst **zwei getrennte** Records: wäre es
dasselbe, gelangte die Adresse zwangsläufig in jede Antwort, die einen User
einbettet. `AdminUserHsbEmailVisibilityTest` hält beide Seiten fest und
prüft dabei den gesamten Antworttext, nicht nur ein benanntes Feld.

### Was KAN-25 entschieden hat, weil der Contract schwieg

Alle fünf Punkte stehen seit v26 auch im Contract (§6.1):

| Punkt | Regel | Grund |
|-------|-------|-------|
| Rolle bei `POST /admin/users` | kommt aus dem Body, auch `ADMIN`; die Domain der `hsbEmail` wird trotzdem gegen §3.1.1 geprüft | Die Ableitung aus der Domain schützt die *Selbst*registrierung vor Selbstauskunft. Hier entscheidet ein Admin, und `ADMIN` kann keine Domain ergeben. Die Adresse bleibt aber Zugehörigkeitsnachweis |
| Eigenes Konto | `role` und `status` nicht änderbar, `DELETE` auf sich selbst abgewiesen, beides 400; der Name bleibt änderbar | §6.5 lässt beides sofort wirken; danach ist der Endpoint nicht mehr erreichbar und der Schritt nicht zurückzunehmen |
| Letzter Admin | **nicht** zusätzlich geschützt | Kostete je Schreibvorgang eine Zählabfrage und verhinderte doch nur einen von mehreren Wegen in denselben Zustand |
| `status` im `PATCH` | nur `ACTIVE` und `DEACTIVATED`; `REGISTRATION_PENDING` ergibt 400 | Der Wert beschreibt eine laufende Registrierung. Bei einem verifizierten Konto wäre er eine Sperre ohne Ausweg: Login 401, und `resend` verschickt für ein bestätigtes Flag nichts mehr |
| Doppelter Stammdaten-Wert | 409 `RESOURCE_IN_USE` | Dieselbe Aussage wie die vergebene Adresse bei der Registrierung, und §6.3 führt „bereits vergeben" unter 409 |

### Löschen von Stammdaten

Eine noch referenzierte Zeile ergibt 409 `RESOURCE_IN_USE`. Bei Fakultät und
Studiengang zählen **beide** Richtungen: die Projekte, die direkt darauf
verweisen, und die Stammdaten-Zeilen darunter. Deren Fremdschlüssel sind
`not null`; ohne die Prüfung scheiterte das `DELETE` an der Datenbank und ergäbe
einen 500 statt der Auskunft, was im Weg steht.

Abgegrenzt davon: eine unbekannte ID im **Body** (etwa `facultyId`) ergibt 400
`VALIDATION_FAILED`, nur die unbekannte ID im **Pfad** ergibt 404 (§6.3.1).

### Zusammenführen von Kategorien: der dritte Weg

Umgesetzt mit KAN-46 (`POST /admin/categories/{id}/merge`, Contract §6.1).
Die Löschsperre oben hat eine Kehrseite: eine versehentlich doppelt angelegte
Kategorie, an der schon Projekte hängen, ließ sich bis dahin überhaupt nicht
mehr loswerden. Löschen ist gesperrt, und umhängen konnte man die Projekte
nirgends. Das Zusammenführen schließt genau diese Lücke; es hängt alle Projekte
der Quelle an das Ziel und löscht danach die Quelle, beides in einem Vorgang,
weil es zwischen den zwei Schritten keinen Endpoint gibt, mit dem sich der erste
ausführen ließe.

Zwei Festlegungen dazu (Contract v32):

- **Veröffentlichte Projekte gehen mit.** §4.1 sperrt die *Inhaltsbearbeitung*
  außerhalb von `DRAFT` und `REVISION`, gerichtet an `PUT /projects/{id}` und
  `PUT /projects/{id}/blocks`. Hier räumt die Administration Stammdaten auf.
  Wären veröffentlichte Projekte ausgenommen, bliebe die Quelle referenziert und
  der Endpoint träfe genau die Fälle nicht, für die es ihn gibt.
- **Die Zeilen werden geladen und einzeln geschrieben**, kein Massen-`UPDATE` in
  JPQL. Nur so wandern `version` und `updatedAt` mit, und ein gleichzeitig
  geöffneter Editor läuft in 409 `PROJECT_VERSION_CONFLICT`, statt die alte
  Kategorie stillschweigend zurückzuschreiben (§6.4). Der Preis ist bekannt: die
  betroffenen Projekte rücken in der nach `updatedAt` sortierten Liste nach vorn.

### Sammel-Statuswechsel: eine Schleife, kein zweiter Zustandsautomat

`POST /admin/projects/status` (KAN-46) liegt im Paket `project` und ruft je
Projekt dieselbe Methode des `ProjectWorkflowService` wie der jeweilige
Einzel-Endpoint. Damit gelten Rechteprüfung (§5), Übergangstabelle (§4.1),
Statushistorie (§3.12), Top-10-Entzug (§3.11.1) und der
`CHANGE_REQUEST`-Kommentar unverändert; eine zweite Umsetzung der
Übergangslogik entsteht nicht.

Drei Punkte tragen den Endpoint:

1. **Bericht je Zeile statt Alles-oder-nichts.** In einer Auswahl kann ein
   einzelnes Projekt in einem Status stehen, den §4.1 nicht zulässt. Die Antwort
   ist deshalb 200 mit `{ results: [ { projectId, success, errorCode } ] }`, ein
   Eintrag je angefragter ID in der Reihenfolge des Bodys.
2. **Eine Transaktion je Projekt.** Die Schleife im `ProjectAdminService` läuft
   mit `Propagation.NOT_SUPPORTED`, jeder Aufruf des Workflow-Dienstes öffnet
   daraufhin seine eigene. Ohne das machte die erste gescheiterte Zeile die ganze
   Transaktion `rollback-only`, und die als erfolgreich gemeldeten Übergänge
   wären wieder weg. Aus demselben Grund ist `ProjectBulkStatusIntegrationTest`
   der einzige Integrationstest im Paket ohne `@Transactional`: er räumt selbst
   auf.
3. **Fehler im Aufruf sind keine Zeile.** Eine unbekannte `action`, eine leere
   Auswahl oder eine `reason`, die nicht zur Aktion passt, ergeben 400
   `VALIDATION_FAILED` für die ganze Anfrage. Alles, was §6.2 nicht als
   Fehlercode kennt, wird weitergeworfen und ergibt einen 500: ein
   Programmfehler ist keine Aussage über ein einzelnes Projekt.

### Kein Hard-Delete, und keine neue Migration

`DELETE /admin/users/{id}` setzt `status = DEACTIVATED`. `Project.authorId` ist
`not null` (§3.3); ein echtes Löschen müsste fremde Projekte mitreißen oder die
Fremdschlüssel verletzen, dasselbe gilt für Kommentare, Reaktionen und die
Statushistorie. Ein zweiter Aufruf ergibt wieder 204: das Ergebnis ist dasselbe,
ein 409 meldete einen Fehler, den niemand beheben müsste.

KAN-25 bringt **keine Schemaänderung** mit. Alle Felder, die die
Administrationsseite liest und schreibt, gibt es seit Migration 1 bis 11; neu
sind allein Abfragen darauf.

### Grenze, bewusst getragen

Ein vollständiges Löschen eines Kontos auf Betroffenenverlangen bräuchte eine
Anonymisierung der Autorschaft statt einer Kaskade. Für den Prototyp
zurückgestellt, in §7 als offener Punkt 9 vermerkt und im Ausblick der Arbeit
aufzugreifen.

---

## 13. Das Top-10-Änderungsprotokoll

Umgesetzt mit KAN-45 (§2.12, §3.17, `GET /admin/top10-audit`). Die Top-10 ist
die sichtbarste kuratorische Entscheidung des Portals und wird von einer
einzigen Rolle ohne Vier-Augen-Prinzip getroffen. Das Protokoll beantwortet
deshalb eine Frage, die die Statushistorie (§3.12) nicht beantworten kann:
welcher Platz war wann durch welches Projekt belegt, und wer hat das veranlasst.

### Ein Schreibweg, fünf Aufrufer

`Top10AuditService.record` ist die einzige Stelle, an der eine Protokollzeile
entsteht. Die Methode nimmt **keine Aktion** entgegen, sondern zwei Zustände der
Liste (vorher, nachher) und bildet die Differenz:

| Projekt | Ergebnis |
|---------|----------|
| nur nachher vorhanden | `ADDED` mit `newPosition` |
| nur vorher vorhanden | `REMOVED` mit `previousPosition` |
| in beiden, anderer Platz | `REORDERED` mit beiden Positionen |
| in beiden, gleicher Platz | keine Zeile |

Der Zuschnitt ist die Antwort auf den Satz aus §3.17, verteilte Protokollierung
führe zuverlässig dazu, dass ein Pfad vergessen wird. Wäre die Aktion ein
Parameter, müsste jeder Aufrufer sie selbst bestimmen, und `PUT /admin/top10`
müsste alle drei Fälle nebeneinander behandeln.

Aufgerufen wird `record` von fünf Stellen, alle über `Top10Service` gebündelt:

1. `PUT /admin/top10` (`setOrder`): Aufnahme, Entfernung und Umsortierung in
   einem Zug. Der Vorzustand wird **vor** der Positionsschleife festgehalten,
   weil diese die Plätze der wiederverwendeten Einträge überschreibt.
2. die Annahme einer Nominierung (`addAt`): `ADDED`.
3. der Entzug des Platzes beim Verlassen von `PUBLISHED`
   (`removeOnLeavingPublished`, gerufen aus `ProjectWorkflowService`):
   `REMOVED`. Seit Contract v72 kann dieser Weg nicht mehr auslösen:
   `requireNotInTop10` weist den Übergang nach `REVISION` mit **409**
   `RESOURCE_IN_USE` ab, solange das Projekt einen Platz belegt. Der
   Aufruf bleibt als Sicherung stehen, und §3.17 führt den Weg weiter.
4. das Zurückziehen einer angenommenen Nominierung durch die
   Administration (`removeOnWithdrawnNomination`, gerufen aus
   `Top10NominationService.withdraw`, seit Contract v70): `REMOVED`.
   Das ist seitdem der Weg, auf dem ein kuratiertes Projekt die Liste
   verlässt, ohne dass jemand die ganze Reihenfolge neu setzt.
5. das Löschen eines Projekts, das einen Platz belegt
   (`removeOnProjectDeletion`, gerufen aus `ProjectWriteService.delete`):
   `REMOVED`.

Die Wege 3 und 4 sind Entscheidungen aus der Klärungsrunde zu KAN-45 und mit
Contract v28 in §3.17 nachgetragen. Ohne sie verließe ein Projekt die Liste,
ohne dass das Protokoll davon wüsste.

### `adminId` heißt „wer es veranlasst hat", nicht „welcher Admin"

Weg 3 wird von der Redaktion ausgelöst, das Feld hält dort also eine Person mit
der Rolle `EDITOR`. An der Rechtematrix ändert das nichts: kuratieren darf
weiterhin allein ADMIN, und die Zeile „Top-10-Protokoll lesen" aus §5 liegt als
`ProjectPermissionService.mayReadTop10Audit` ebenfalls bei ADMIN.

### Das Protokoll ist unveränderlich, und zwar strukturell

Es gibt keinen schreibenden Endpoint, kein `DELETE` und keine Korrekturmethode.
Durchgesetzt wird das nicht nur durch Verzicht: die Setter von
`Top10AuditEntry` sind **paketprivat**, und `Top10AuditEntryRepository` führt
keine Lösch- oder Ändermethode. Außerhalb von `top10` kann niemand eine Zeile
bauen oder umschreiben.

### Warum der Fremdschlüssel auf `on delete set null` steht

`DELETE /projects/{id}` löscht wirklich (§6.1). Mit `on delete cascade`
verschwänden genau die Zeilen, die festhalten, dass ein Projekt einmal einen
Platz belegt hat, und die Zusage „das Protokoll wird nie gelöscht" wäre nicht zu
halten. Ältere Zeilen verlieren beim Löschen also nur ihren Verweis.

Die Zeile aus Weg 4 entsteht dagegen von Anfang an **ohne** Projektverweis. Zwei
Gründe, die in dieselbe Richtung zeigen: der Verweis wäre mit demselben Vorgang
wieder leer, und eine frisch geschriebene Zeile, die auf ein zum Löschen
vorgemerktes Projekt zeigt, lässt Hibernate beim Flush nicht durch
(`TransientObjectException`, der Endpoint endete in einem 500). Ein
Titel-Schnappschuss ist bewusst nicht mitgeschrieben worden: er führte eine
Angabe, die niemand mehr prüfen kann.

### Sortierung: der Gleichstandsbrecher ist hier der Regelfall

Alle Zeilen eines `PUT /admin/top10` tragen denselben Zeitstempel; sie gehören
zu einer Entscheidung. Sortierbar ist deshalb ausschließlich `timestamp`
(Positivliste wie im `ProjectReadService`), Standard ist `timestamp,desc`, und
`id,asc` hängt immer an. Ohne ihn erschiene beim Blättern dieselbe Zeile auf
zwei Seiten und eine andere auf keiner. Die Migration legt dafür den
zusammengesetzten Index `(timestamp desc, id asc)` an.

### Grenze, bewusst getragen

Ein gelöschtes Projekt ist im Protokoll nicht mehr benennbar, nur noch als
freigewordener Platz erkennbar. Das ist der Preis dafür, keine Angabe zu
führen, die niemand mehr gegen die Wirklichkeit prüfen kann; die Oberfläche
zeigt solche Zeilen als „Projekt gelöscht" (KAN-40).
