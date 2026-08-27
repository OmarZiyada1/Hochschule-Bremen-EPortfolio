# Namensschema: Deutsch nach Englisch

Verbindliche Zuordnung für die Umstellung des Projekts auf englische
Bezeichner. Sie gilt für **Java-Klassen und -Felder, JSON-Feldnamen,
Enum-Werte, Fehlercodes, Endpoint-Pfade, Query-Parameter und
Datenbankspalten**.

Nicht betroffen: die Prosa. Contract, Doku, Jira-Tickets, Javadoc und
Commit-Texte bleiben deutsch, weil die Thesis deutsch ist. Es ändern sich
die Bezeichner darin, nicht die Sätze darum herum. Oberflächentexte laufen
über i18n (Deutsch und Englisch, `react-i18next`).

Grundlage ist der Bestand aus Contract v17: 337 Bezeichner, 120 Java-Dateien,
8 Flyway-Migrationen.

## 1. Grundregeln

| Ebene | Regel |
| --- | --- |
| Java-Klassen | `PascalCase`, englisch |
| Java-Felder, JSON | `camelCase`, englisch |
| Datenbank | `snake_case`, englisch |
| Enum-Werte, Fehlercodes | `SCREAMING_SNAKE_CASE`, englisch |
| Endpoint-Pfade | `kebab-case`, englisch, Ressourcen im Plural |
| DTO-Suffixe | `…Request` / `…Response` statt `…Anfrage` / `…Antwort` |
| Konfigurations-Records | `…Properties` statt `…Eigenschaften` |
| Berechtigungsmethoden | `may…` statt `darf…` |

## 2. Entitäten

| Deutsch | Englisch | Tabelle |
| --- | --- | --- |
| `User` | `User` | `app_user` |
| `Portfolio` | `Portfolio` | `portfolio` |
| `Projekt` | `Project` | `project` |
| `Block` | `Block` | `block` |
| `Kommentar` | `Comment` | `comment` |
| `Kategorie` | `Category` | `category` |
| `Studiengang` | `StudyProgram` | `study_program` |
| `Fakultaet` | `Faculty` | `faculty` |
| `Modul` | `Module` | `module` |
| `Semester` | `Semester` | `semester` |
| `Schlagwort` | `Tag` | `tag` |
| `Reaktion` | `Reaction` | `reaction` |
| `Datei` | `StoredFile` | `stored_file` |
| `Projektmitglied` | `ProjectMember` | `project_member` |
| `ProjektStatusHistorie` | `ProjectStatusHistory` | `project_status_history` |
| `Top10Eintrag` | `Top10Entry` | `top10_entry` |
| `Top10Nominierung` | `Top10Nomination` | `top10_nomination` |
| `Top10Protokoll` | `Top10AuditEntry` | `top10_audit_entry` |
| `VerifizierungsCode` | `VerificationCode` | `verification_code` |

Join- und Nebentabellen: `projekt_redakteur` wird `project_editor`,
`projekt_tag` wird `project_tag`. Seit KAN-75 ist das keine Wertetabelle mehr, sondern die Verknüpfungstabelle zwischen `project` und `tag` (Contract v57, §3.19); der Text steht in `tag.name`, die Zuordnung trägt nur noch `tag_id`.

### Drei Namen, die nicht die wörtliche Übersetzung sind

**`Datei` wird `StoredFile`, nicht `File`.** `java.io.File` steht in jedem
Java-Namensraum. Eine Entität `File` daneben führt zu Importfehlern, die
erst beim Kompilieren auffallen, und zu Code, in dem `File` je nach Import
etwas anderes bedeutet. Der Endpoint heißt trotzdem `/files`, weil dort
keine Kollision droht.

**`User` bekommt die Tabelle `app_user`, nicht `"user"`.** `user` ist in
PostgreSQL ein reserviertes Wort und muss heute in jeder Abfrage in
Anführungszeichen stehen. Da die Tabelle ohnehin angefasst wird, entfällt
diese Dauerlast bei der Gelegenheit.

**`Modul` bleibt `Module`.** Es kollidiert mit Jacksons `Module`, aber nur
dort, wo beide importiert werden, und das ist in Entity- und DTO-Paketen
nicht der Fall. `CourseModule` wäre kollisionsfrei, aber im Pfad
(`/course-modules`) und in jedem Satz umständlich. Wer beide braucht,
qualifiziert Jacksons Klasse voll aus.

## 3. Enums

| Deutsch | Englisch |
| --- | --- |
| `Rolle` | `Role` |
| `ProjektStatus` | `ProjectStatus` |
| `KommentarTyp` | `CommentType` |
| `KommentarStatus` | `CommentStatus` |
| `BlockTyp` | `BlockType` |
| `Projekttyp` | `ProjectType` |
| `Abschluss` | `Degree` |
| `NominierungStatus` | `NominationStatus` |
| `UserStatus` | `UserStatus` |
| `VerifizierungZweck` | `VerificationPurpose` |
| `Top10Aktion` | `Top10Action` |

### Werte

| Enum | Deutsch | Englisch |
| --- | --- | --- |
| `Role` | `STUDIERENDE` · `REDAKTEUR` · `ADMIN` | `STUDENT` · `EDITOR` · `ADMIN` |
| `ProjectStatus` | `ENTWURF` · `EINGEREICHT` · `GENEHMIGT` · `VEROEFFENTLICHT` · `UEBERARBEITUNG` | `DRAFT` · `SUBMITTED` · `APPROVED` · `PUBLISHED` · `REVISION` |
| `CommentType` | `ANTWORT` · `NOTIZ` · `AENDERUNG` | `REPLY` · `NOTE` · `CHANGE_REQUEST` |
| `CommentStatus` | `OFFEN` · `ERLEDIGT` | `OPEN` · `RESOLVED` |
| `BlockType` | `UEBERSCHRIFT` · `TEXT` · `LISTE` · `ZITAT` · `CODE` · `FORMEL` · `TABELLE` · `TRENNLINIE` | `HEADING` · `TEXT` · `LIST` · `QUOTE` · `CODE` · `FORMULA` · `TABLE` · `DIVIDER` |
| `BlockType` | `BILD` · `GALERIE` · `VIDEO` · `AUDIO` · `DOKUMENT` · `EINBETTUNG` | `IMAGE` · `GALLERY` · `VIDEO` · `AUDIO` · `DOCUMENT` · `EMBED` |
| `BlockType` | `INHALTSVERZEICHNIS` | `TABLE_OF_CONTENTS` (sechzehnter Wert seit Contract v84) |
| `ProjectType` | `REGULAR` · `PAPER` · `THESIS` | unverändert |
| `Degree` | `BACHELOR` · `MASTER` · `MBA` | unverändert |
| `NominationStatus` | `OFFEN` · `ANGENOMMEN` · `ABGELEHNT` · `ZURUECKGEZOGEN` | `PENDING` · `ACCEPTED` · `REJECTED` · `WITHDRAWN` (vierter Wert seit Contract v70, KAN-37) |
| `NominationTier` | `TOP_1` · `TOP_5` · `TOP_10` | unverändert (seit Contract v68, KAN-37) |
| `UserStatus` | `REGISTRIERUNG_OFFEN` · `AKTIV` · `DEAKTIVIERT` | `REGISTRATION_PENDING` · `ACTIVE` · `DEACTIVATED` |
| `VerificationPurpose` | `PRIVAT` · `HSB` · `PASSWORT_RUECKSETZUNG` | `PRIVATE_EMAIL` · `HSB_EMAIL` · `PASSWORD_RESET` |
| `Top10Action` | `HINZUGEFUEGT` · `ENTFERNT` · `UMSORTIERT` | `ADDED` · `REMOVED` · `REORDERED` |

`CommentStatus.OFFEN` wird `OPEN`, `NominationStatus.OFFEN` wird `PENDING`.
Beide hießen im Deutschen gleich, meinen aber Verschiedenes: ein
Änderungswunsch ist offen, solange er nicht umgesetzt ist, eine Nominierung
wartet auf eine Entscheidung.

**`REDAKTEUR` wird `EDITOR`.** Der blockbasierte Editor heißt im Code
deshalb durchgehend `BlockEditor` und der Frontend-Ordner
`features/project-content/`, damit „editor" nicht zwei Dinge bezeichnet.

## 4. Felder

### User und Portfolio

| Deutsch | Englisch |
| --- | --- |
| `vorname` · `nachname` | `firstName` · `lastName` |
| `email` · `hsbEmail` | `email` · `hsbEmail` |
| `emailVerifiziert` · `hsbEmailVerifiziert` | `emailVerified` · `hsbEmailVerified` |
| `passwortHash` | `passwordHash` |
| `passwortAenderungErforderlich` | `passwordChangeRequired` |
| `rolle` · `status` | `role` · `status` |
| `biografie` | `biography` |
| `avatarUrl` · `avatarDateiId` | `avatarUrl` · `avatarFileId` |
| `emailOeffentlich` (offener Punkt 10) | `emailPublic` |

### Projekt

| Deutsch | Englisch |
| --- | --- |
| `titel` | `title` |
| `kurzbeschreibung` | `summary` |
| `coverBildUrl` · `coverDateiId` | `coverImageUrl` · `coverFileId` |
| `projekttyp` | `projectType` |
| `autorId` | `authorId` |
| `fakultaetId` · `studiengangId` · `modulId` | `facultyId` · `studyProgramId` · `moduleId` |
| `abschluss` · `kategorieId` · `semesterId` | `degree` · `categoryId` · `semesterId` |
| `redakteure` · `redakteurIds` | `editors` · `editorIds` |
| `mitglieder` · `rolleImProjekt` | `members` · `projectRole` |
| `reaktionen` · `reaktionAnzahl` | `reactions` · `reactionCount` |

### Block, Datei, Kommentar

| Deutsch | Englisch |
| --- | --- |
| `typ` · `inhalt` | `type` · `content` |
| `reihenfolge` | `orderIndex` |
| `dateiId` · `dateiIds` | `fileId` · `fileIds` |
| `bildunterschrift` · `hoehe` | `caption` · `height` |
| `dateiname` · `groesse` · `pfad` | `fileName` · `size` · `path` |
| `hochgeladenVon` | `uploadedBy` |
| `text` · `status` | `text` · `status` |

`reihenfolge` wird `orderIndex` und nicht `order`, weil `order` in SQL ein
reserviertes Wort ist und die Spalte sonst dauerhaft in Anführungszeichen
stünde.

### Stammdaten

| Deutsch | Englisch |
| --- | --- |
| `aktiv` | `active` |
| `sortierung` | `sortOrder` |
| `richtung` (`HOCH` · `RUNTER`) | `direction` (`UP` · `DOWN`) |
| `verwendungszahl` | `usageCount` |

Die ersten drei Namen kommen mit dem `Semester` als Stammdatenzeile dazu (Contract
v45, §3.18, KAN-65). `sortierung` wird `sortOrder` und nicht `orderIndex`: der
Blockindex nummeriert eine Position innerhalb eines Dokuments, hier ordnet eine
vom Admin gesetzte Zahl eine Liste. Zwei verschiedene Sachverhalte tragen
deshalb zwei verschiedene Namen. Die Spalte heißt `sort_order`.

`verwendungszahl` wird `usageCount` und kommt mit dem `Tag` als
Stammdatenzeile dazu (Contract v57, §3.19, KAN-75). Sie ist kein Feld der
Entity, sondern eine Aggregation über `project_tag`, und steht deshalb nur in
`TagResponse`, nicht in `Tag`. Eine Spalte gibt es dafür nicht.

### Zeitstempel, Historie, Top-10, Verifizierung

| Deutsch | Englisch |
| --- | --- |
| `erstelltAm` · `aktualisiertAm` · `veroeffentlichtAm` | `createdAt` · `updatedAt` · `publishedAt` |
| `zeitpunkt` | `timestamp` |
| `ablauf` · `ablaufZeitpunkt` | `expiresAt` |
| `vonStatus` · `nachStatus` · `geaendertVon` | `fromStatus` · `toStatus` · `changedBy` |
| `nominiertVon` · `vorgeschlagenePosition` | `nominatedBy` · `proposedPosition` |
| `vorgeschlageneStufe` | `proposedTier` (seit Contract v68, KAN-37) |
| `entschiedenVon` · `entschiedenAm` | `decidedBy` · `decidedAt` |
| `aufgenommenAm` · `position` | `addedAt` · `position` |
| `adminId` · `aktion` | `adminId` · `action` |
| `positionVorher` · `positionNachher` | `previousPosition` · `newPosition` |
| `zweck` · `codeHash` · `verbraucht` | `purpose` · `codeHash` · `consumed` |
| `name` · `kuerzel` | `name` · `abbreviation` |
| `sammelmodul` | `collective` (Merkmal am `Module`, seit Contract v84) |
| `beteiligt` | `participant` (Listenfilter, seit Contract v84) |
| `hatReagiert` | `hasReacted` (Feld der Detailantwort, seit Contract v84) |
| `verzeichnisEintrag` | `TocEntry` mit `level` · `text` · `index` |

## 5. Fehler-Envelope und Seitenformat

| Deutsch | Englisch |
| --- | --- |
| `ApiFehler` | `ApiError` |
| `zeitpunkt` · `status` · `fehlercode` · `meldung` · `pfad` | `timestamp` · `status` · `errorCode` · `message` · `path` |
| `SeiteAntwort<T>` | `PageResponse<T>` |
| `inhalt` · `seite` · `groesse` · `gesamtElemente` · `gesamtSeiten` | `content` · `page` · `size` · `totalElements` · `totalPages` |

**Hinweis zu `PageResponse<T>`:** Die Felder heißen jetzt wie in Springs
`Page`, das Record bleibt aber ein eigenes. Der Grund dafür ändert sich mit
der Umbenennung nicht: Spring markiert die direkte Serialisierung von `Page`
seit 3.3 als instabil, und ein Antwortformat, das sich mit einem
Framework-Update verschiebt, taugt nicht als gemeinsame Grundlage. Das
zweite Argument von damals, deutsche Feldnamen seien die Konvention, entfällt
und wird im Contract gestrichen statt stehen gelassen.

## 6. Fehlercodes

| Deutsch | Englisch |
| --- | --- |
| `VALIDIERUNG_FEHLGESCHLAGEN` | `VALIDATION_FAILED` |
| `ANMELDUNG_FEHLGESCHLAGEN` | `LOGIN_FAILED` |
| `NICHT_AUTHENTIFIZIERT` | `NOT_AUTHENTICATED` |
| `TOKEN_UNGUELTIG` · `TOKEN_ABGELAUFEN` | `TOKEN_INVALID` · `TOKEN_EXPIRED` |
| `KONTO_NICHT_AKTIV` | `ACCOUNT_NOT_ACTIVE` |
| `REGISTRIERUNG_NICHT_ABGESCHLOSSEN` | `REGISTRATION_NOT_COMPLETED` |
| `KEINE_BERECHTIGUNG` | `NO_PERMISSION` |
| `PASSWORTAENDERUNG_ERFORDERLICH` | `PASSWORD_CHANGE_REQUIRED` |
| `ZU_VIELE_ANMELDEVERSUCHE` | `TOO_MANY_LOGIN_ATTEMPTS` |
| `VERIFIZIERUNGSCODE_UNGUELTIG` | `VERIFICATION_CODE_INVALID` |
| `BLOCKTYP_UNBEKANNT` | `BLOCK_TYPE_UNKNOWN` |
| `BLOCK_INHALT_UNGUELTIG` | `BLOCK_CONTENT_INVALID` |
| `BLOCK_UNGUELTIG` (nur im Code) | `BLOCK_CONTENT_INVALID` |
| `EMBED_PROVIDER_NICHT_ERLAUBT` | `EMBED_PROVIDER_NOT_ALLOWED` |
| `DATEI_TYP_NICHT_ERLAUBT` · `DATEI_ZU_GROSS` | `FILE_TYPE_NOT_ALLOWED` · `FILE_TOO_LARGE` |
| `PROJEKT_UNVOLLSTAENDIG` | `PROJECT_INCOMPLETE` |
| `PROJEKT_NICHT_GEFUNDEN` | `PROJECT_NOT_FOUND` |
| `RESSOURCE_NICHT_GEFUNDEN` | `RESOURCE_NOT_FOUND` |
| `PROJEKT_VERSION_KONFLIKT` | `PROJECT_VERSION_CONFLICT` |
| `PROJEKT_STATUS_NICHT_BEARBEITBAR` | `PROJECT_STATUS_NOT_EDITABLE` |
| `PROJEKT_STATUS_UEBERGANG_UNGUELTIG` | `PROJECT_STATUS_TRANSITION_INVALID` |
| `RESSOURCE_IN_VERWENDUNG` | `RESOURCE_IN_USE` |
| `PROJEKT_NICHT_VEROEFFENTLICHT` | `PROJECT_NOT_PUBLISHED` |
| `NOMINIERUNG_BEREITS_ENTSCHIEDEN` | `NOMINATION_ALREADY_DECIDED` |
| `INTERNER_FEHLER` | `INTERNAL_ERROR` |

`BLOCK_UNGUELTIG` war ein Sonderfall und ist mit KAN-49 verschwunden: der
`BlockValidationService` führte den Code als eigenes Literal, das es in
Contract §6.2 nie gab. Er heißt jetzt wie dort und steht als Konstante in
`ErrorCodes.java`, damit die Regel „ein Fehlercode existiert erst, wenn er an
beiden Orten steht" auch für ihn gilt.

## 7. Endpoints

| Deutsch | Englisch |
| --- | --- |
| `/auth/passwort` | `/auth/password` |
| `/auth/registrierung` | `/auth/register` |
| `/auth/verifizierung` | `/auth/verify` |
| `/auth/verifizierung/erneut-senden` | `/auth/verify/resend` |
| `/auth/passwort-vergessen` | `/auth/forgot-password` |
| `/auth/passwort-zuruecksetzen` | `/auth/reset-password` |
| `/projekte` | `/projects` |
| `/projekte/{id}/einreichen` | `/projects/{id}/submit` |
| `/projekte/{id}/zurueckziehen` | `/projects/{id}/withdraw` |
| `/projekte/{id}/genehmigen` | `/projects/{id}/approve` |
| `/projekte/{id}/veroeffentlichen` | `/projects/{id}/publish` |
| `/projekte/{id}/ueberarbeitung` | `/projects/{id}/request-revision` |
| `/projekte/{id}/reaktion` | `/projects/{id}/reaction` |
| `/projekte/{id}/redakteure` | `/projects/{id}/editors` |
| `/projekte/{id}/kommentare` | `/projects/{id}/comments` |
| `/projekte/{id}/top10-nominierung` | `/projects/{id}/top10-nomination` |
| `/kommentare/{id}` · `/kommentare/{id}/status` | `/comments/{id}` · `/comments/{id}/status` |
| `/dateien` · `/dateien/{id}` | `/files` · `/files/{id}` |
| `/kategorien` · `/fakultaeten` | `/categories` · `/faculties` |
| `/studiengaenge` · `/module` | `/study-programs` · `/modules` |
| `/users/auswahl` | `/users/lookup` |
| `/admin/kategorien` · `/admin/fakultaeten` | `/admin/categories` · `/admin/faculties` |
| `/admin/studiengaenge` · `/admin/module` | `/admin/study-programs` · `/admin/modules` |
| `/admin/top10-nominierungen` | `/admin/top10-nominations` |
| `…/annehmen` · `…/ablehnen` | `…/accept` · `…/reject` |
| `/admin/top10-protokoll` | `/admin/top10-audit` |
| `/admin/users/{id}/passwort-zuruecksetzen` | `/admin/users/{id}/reset-password` |
| `/admin/kategorien/{id}/zusammenfuehren` | `/admin/categories/{id}/merge` |
| `/admin/projekte/status` | `/admin/projects/status` |

Unverändert: `/auth/login`, `/auth/logout`, `/auth/me`, `/projects/{id}/blocks`,
`/portfolio/me`, `/portfolios/{userId}`, `/top10`, `/admin/dashboard`,
`/admin/users`, `/admin/top10`.

### Query-Parameter

`kategorie` wird `category`, `fakultaet` wird `faculty`, `studiengang` wird
`studyProgram`, `modul` wird `module`, `abschluss` wird `degree`, `typ` wird
`type`, `autor` wird `author`, `redakteur` wird `editor`, `rolle` wird
`role`, `von` und `bis` werden `from` und `to`. Unverändert: `q`, `sort`,
`semester`, `status`, `page`, `size`, `admin`.

Sortierbare Felder bei `GET /projects`: `title`, `semester`, `status`,
`createdAt`, `updatedAt`, `publishedAt`.

## 8. Klassen im Backend

| Deutsch | Englisch |
| --- | --- |
| `ProjektBerechtigungService` | `ProjectPermissionService` |
| `ProjektLeseService` | `ProjectReadService` |
| `ProjektSpezifikationen` | `ProjectSpecifications` |
| `ProjektKachelAntwort` | `ProjectCardResponse` |
| `ProjektDetailAntwort` | `ProjectDetailResponse` |
| `LoginAnfrage` | `LoginRequest` |
| `BenutzerAntwort` · `UserAntwort` | `UserResponse` |
| `AdminUserAntwort` | `AdminUserResponse` |
| `AngemeldeterBenutzer` | `AuthenticatedUser` |
| `BenutzerDetailsService` | `DatabaseUserDetailsService` |
| `AnmeldeversuchService` | `LoginAttemptService` |
| `JwtAuthentifizierungsFilter` | `JwtAuthenticationFilter` |
| `RestAuthentifizierungsEinstieg` | `RestAuthenticationEntryPoint` |
| `ApiFehlerSchreiber` | `ApiErrorWriter` |
| `Fehlercodes` | `ErrorCodes` |
| `ValidierungException` | `ValidationException` |
| `CorsEigenschaften` | `CorsProperties` |
| `BerechtigungEigenschaften` | `PermissionProperties` |
| `StammdatenService` · `StammdatenController` | `MasterDataService` · `MasterDataController` |
| `DevStammdatenSeeder` | `DevMasterDataSeeder` |
| `DevTestnutzerSeeder` | `DevTestUserSeeder` |
| `ReaktionAnzahl` | `ReactionCount` |
| `ProjektVerweisAntwort` | `ProjectReferenceResponse` |
| `Top10ProtokollAntwort` | `Top10AuditEntryResponse` |
| `Top10ProtokollService` | `Top10AuditService` |
| `Top10Platzierung` | `Top10Placement` |
| `KategorieZusammenfuehrenAnfrage` | `CategoryMergeRequest` |
| `ProjektSammelStatusAnfrage` · `…Antwort` · `…Ergebnis` | `ProjectBulkStatusRequest` · `ProjectBulkStatusResponse` · `ProjectBulkStatusResultResponse` |
| `ProjektAdminService` · `ProjektAdminController` | `ProjectAdminService` · `ProjectAdminController` |
| `darfMitgliederPflegen` | `mayManageMembers` |
| `darfProjektVerlassen` | `mayLeaveProject` |
| `RegistrierungService` | `RegistrationService` |
| `VerifizierungsCodeService` | `VerificationCodeService` |
| `VerifizierungsversuchService` | `VerificationAttemptService` |
| `Versuchszaehler` | `AttemptCounter` |
| `RegistrierungAnfrage` | `RegisterRequest` |
| `VerifizierungAnfrage` | `VerifyRequest` |
| `ErneutSendenAnfrage` | `ResendVerificationRequest` |
| `VerifizierungsstandAntwort` | `VerificationStatusResponse` |
| `RegistrierungEigenschaften` | `RegistrationProperties` |
| `Passwortregeln` | `PasswordPolicy` |
| `EMailAdressen` | `EmailAddresses` |
| `ausgestellterCode` · `klartextCode` | `IssuedCode` · `plainCode` |
| `gewaehlteRolle` | `selectedRole` (entfallen mit Contract v41, KAN-63: die Registrierung erhebt keine Rollenangabe mehr) |
| `ProfilAendernAnfrage` | `ProfileUpdateRequest` |
| `NutzerAuswahlAntwort` | `UserLookupResponse` |
| `NutzerAuswahlService` · `NutzerAuswahlController` | `UserLookupService` · `UserLookupController` |
| `NutzerAuswahlSpezifikationen` | `UserLookupSpecifications` |

`DatabaseUserDetailsService` heißt nicht `UserDetailsService`, weil Spring
Security ein Interface dieses Namens mitbringt, das die Klasse implementiert.

Unverändert, weil bereits englisch: `BaseEntity`, `AuditableEntity`,
`GlobalExceptionHandler`, `BlockValidationService`, `SecurityConfig`,
`OpenApiConfig`, alle `…Repository`.

## 9. Datenbank

Bestehende Migrationen werden **nicht** geändert (`CLAUDE.md`, Regel 1). Die
Umbenennung läuft über **eine neue Migration** mit
`ALTER TABLE … RENAME TO` und `ALTER TABLE … RENAME COLUMN`. PostgreSQL zieht
Constraints, Indizes und Fremdschlüssel dabei automatisch mit; benannte
Constraints werden zusätzlich per `ALTER … RENAME CONSTRAINT` angeglichen,
damit `ck_block_typ` nicht neben `block.type` stehen bleibt.

**Berichtigung mit KAN-49.** Diese Tabelle nannte ursprünglich vier
„betroffene benannte Constraints", von denen es drei gar nicht gab: benannt
war allein `uq_block_projekt_reihenfolge`, alle Check-Constraints trugen von
Postgres erzeugte Namen (`block_typ_check`, `app_user_rolle_check`, …), und
`top10_protokoll` war bis dahin nicht angelegt; die Tabelle heisst `top10_audit_entry` und ist mit KAN-45 entstanden, nicht mit KAN-24.

Hinzu kommt: ein reines `RENAME` genügt bei den Check-Constraints nicht, weil
sich die **Enum-Werte** mitändern (`ENTWURF` wird `DRAFT`). Jede betroffene
Constraint wird deshalb gelöst, der Bestand per `UPDATE` umgeschrieben und die
Constraint mit explizitem Namen neu gesetzt (Skill `flyway-migration`,
Regel 3). Wo sich nur der Spaltenname ändert und nicht die erlaubten Werte,
genügt `ALTER TABLE … RENAME CONSTRAINT`.

| Alt | Neu | Weg |
| --- | --- | --- |
| `app_user_rolle_check` | `ck_app_user_role` | neu, Werte ändern sich |
| `app_user_status_check` | `ck_app_user_status` | neu, Werte ändern sich |
| `projekt_status_check` | `ck_project_status` | neu, Werte ändern sich |
| `projekt_status_historie_von_status_check` | `ck_project_status_history_from_status` | neu, Werte ändern sich |
| `projekt_status_historie_nach_status_check` | `ck_project_status_history_to_status` | neu, Werte ändern sich |
| `kommentar_typ_check` | `ck_comment_type` | neu, Werte ändern sich |
| `kommentar_status_check` | `ck_comment_status` | neu, Werte ändern sich |
| `top10_nominierung_status_check` | `ck_top10_nomination_status` | neu, Werte ändern sich |
| `block_typ_check` | `ck_block_type` | neu, Werte ändern sich |
| `projekt_projekttyp_check` | `ck_project_project_type` | nur `RENAME` |
| `projekt_abschluss_check` | `ck_project_degree` | nur `RENAME` |
| `top10_eintrag_position_check` | `ck_top10_entry_position` | nur `RENAME` |
| `top10_nominierung_vorgeschlagene_position_check` | `ck_top10_nomination_proposed_position` | nur `RENAME` |
| `uq_block_projekt_reihenfolge` | `uq_block_project_order_index` | nur `RENAME`, bleibt `deferrable` |

Primär-, Unique- und Fremdschlüssel wandern ebenfalls per `RENAME CONSTRAINT`
mit (`projekt_pkey` wird `project_pkey` usw.), die eigenständigen Indizes per
`ALTER INDEX … RENAME TO` (`idx_projekt_autor_id` wird
`idx_project_author_id`). Postgres benennt beides bei einem Tabellen- oder
Spalten-Rename nicht selbst um.

`ck_top10_audit_action` entsteht erst mit der Tabelle `top10_audit_entry`
und gehört deshalb nicht in diese Migration. Angelegt hat sie **KAN-45**
(Migration 13), nicht KAN-24: dort entstanden nur die kuratierte Liste und
das Nominierungsprotokoll.

`ddl-auto: validate` ist danach der Beleg: läuft die Anwendung hoch, passen
Entitäten und Schema zusammen.

## 10. Konfiguration

Auch `application.yml` und `.env` tragen deutsche Schlüssel. Sie wandern mit,
weil sonst ein englischer Record `CorsProperties` an einem deutschen Präfix
hinge.

| Alt | Neu |
| --- | --- |
| `app.security.cors.erlaubte-origins` | `app.security.cors.allowed-origins` |
| `CORS_ERLAUBTE_ORIGINS` | `CORS_ALLOWED_ORIGINS` |
| `app.berechtigung.*` | `app.permission.*` |
| `app.berechtigung.vier-augen-prinzip` | `app.permission.four-eyes-principle` |
| `app.berechtigung.admin-darf-fremde-inhalte-bearbeiten` | `app.permission.admin-may-edit-foreign-content` |
| `app.security.jwt.laufzeit` | `app.security.jwt.lifetime` |
| `app.security.anmeldeversuche.*` | `app.security.login-attempts.*` |
| `app.security.anmeldeversuche.max-fehlversuche` | `app.security.login-attempts.max-failed-attempts` |
| `app.security.anmeldeversuche.sperrdauer` | `app.security.login-attempts.lockout-duration` |
| `DEV_TEST_PASSWORT` | `DEV_TEST_PASSWORD` |
| `app.registrierung.studierenden-domains` | `app.registration.student-domains` |
| `app.registrierung.mitarbeitenden-domains` | `app.registration.staff-domains` |
| `app.registrierung.code-laufzeit` | `app.registration.code-lifetime` |

Die Zeilen ab `vier-augen-prinzip` sind mit KAN-49 dazugekommen: die Regel
„auch `application.yml` und `.env` tragen deutsche Schlüssel, sie wandern mit"
stand schon da, die Liste nannte aber nur drei Beispiele. Unverändert bleiben
`JWT_SECRET`, `POSTGRES_*` und `app.security.jwt.issuer`, die sind bereits
englisch.

`.env` und `.env.example` sind mitzuziehen, sonst startet die Anwendung
lokal mit stillen Standardwerten statt mit den gesetzten.

## 11. Frontend

Namen englisch, Ordner nach Feature:

```
frontend/src/
  api/                  client.ts, errors.ts, schema.d.ts, page.ts
  components/
    ui/                 shadcn/Base-UI-Primitiven (generiert)
    layout/             NavBar, Footer, Sidebar
    common/             ProjectCard, StatusBadge, Top10Card, EmptyState, …
  features/<feature>/
    <Feature>Page.tsx
    components/
    hooks/              useProjectList, useProjectDetail
  i18n/                 de.json, en.json, index.ts
  lib/                  utils.ts, name.ts, project.ts, theme.ts
  routes/
  styles/tokens/
```

Breadcrumb hat bewusst keine eigene Hülle: die Primitive aus
`components/ui/` reicht, eine Hülle trüge kein Domänenwissen (KAN-29).

Der blockbasierte Editor liegt unter `features/project-content/`, seine
Hauptkomponente heißt `BlockEditor`. So bezeichnet „editor" im Code
durchgehend die Rolle und nicht zwei Dinge.

Enum-Werte erscheinen unverändert im Code (`PUBLISHED`, `EDITOR`) und werden
ausschließlich für die Anzeige übersetzt, über i18n-Schlüssel der Form
`project.status.PUBLISHED`.
