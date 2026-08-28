import type { components } from "@/api/schema"

/**
 * Lesbare Aliase auf die generierte schema.d.ts, damit Importpfade kurz
 * bleiben und kein Response-Typ von Hand nachgebaut wird (Frontend-Regel 2,
 * Skill frontend-api Abschnitt 1). Neue Aliase entstehen hier, nie als
 * eigene Interfaces in Komponenten.
 *
 * Die Aliase greifen unveraendert auf die generierten Typen zu. Seit KAN-76
 * fuehrt jedes Antwortschema seine Pflichtfelder, deshalb meint etwa
 * ProjectCardResponse["status"] bereits den Wert und nicht "Wert oder
 * undefined"; eine Huelle darum waere wirkungslos.
 */
export type ApiSchemas = components["schemas"]

export type UserResponse = ApiSchemas["UserResponse"]
export type LoginResponse = ApiSchemas["LoginResponse"]
export type ProjectCardResponse = ApiSchemas["ProjectCardResponse"]

/** Projektdetail, Antwort der Workflow-Endpoints (§6.1, KAN-69). */
export type ProjectDetailResponse = ApiSchemas["ProjectDetailResponse"]

/**
 * Anlegen und Metadaten aendern, POST /api/projects und
 * PUT /api/projects/{id} (§6.1, KAN-35).
 *
 * <p><strong>Die beiden Requests sind nicht dasselbe.</strong>
 * ProjectUpdateRequest fuehrt zusaetzlich das Pflichtfeld version fuer das
 * Optimistic Locking (§6.4), und seine Einzelfelder haben ersetzende
 * Semantik: ein fehlendes oder null gesetztes Feld loescht den Wert. Beim
 * Anlegen gibt es nichts zu loeschen, dort heisst ein fehlendes Feld nur
 * „noch nicht gesetzt".
 */
export type ProjectCreateRequest = ApiSchemas["ProjectCreateRequest"]
export type ProjectUpdateRequest = ApiSchemas["ProjectUpdateRequest"]

/**
 * Projektmitglied im Request (§3.13): Co-Autor:in oder Mitwirkende mit
 * freier Funktionsbezeichnung. Nicht zu verwechseln mit der zugewiesenen
 * Redaktion, die die System-Rolle EDITOR traegt (§3.3).
 *
 * Nur die Request-Seite hat einen Verwender; MemberResponse bekommt keinen
 * Alias auf Vorrat, das Formular liest die Antwort ueber
 * ProjectDetailResponse.members.
 */
export type MemberRequest = ApiSchemas["MemberRequest"]

/**
 * Antwort der Bearbeitungssperre (§6.9, seit Contract v85, KAN-86): wer den
 * Beitrag gerade haelt und ob es die anfragende Person selbst ist.
 *
 * Der Halter bekommt einen eigenen Alias, weil die Oberflaeche ihn einzeln
 * weiterreicht: der Dialog zeigt den Namen, die Antwort daneben traegt nur
 * das Ja oder Nein.
 */
export type EditLockResponse = ApiSchemas["EditLockResponse"]
export type EditLockHolderResponse = ApiSchemas["EditLockHolderResponse"]

/**
 * Person aus GET /api/users/lookup (§6.1, KAN-44). Fuehrt ausschliesslich
 * id, firstName und lastName: der Endpoint ist kein Personenverzeichnis,
 * und hsbEmail verlaesst den Server hier nicht (§3.1).
 */
export type UserLookupResponse = ApiSchemas["UserLookupResponse"]

/** Registrierung und Verifizierung nach Contract §3.1.1, §6.1 (KAN-33). */
export type RegisterRequest = ApiSchemas["RegisterRequest"]
export type VerifyRequest = ApiSchemas["VerifyRequest"]
export type VerificationStatusResponse =
  ApiSchemas["VerificationStatusResponse"]
export type ResendVerificationRequest = ApiSchemas["ResendVerificationRequest"]

/** Passwort-Flows nach Contract §6.1, §6.7 (KAN-33). */
export type PasswordChangeRequest = ApiSchemas["PasswordChangeRequest"]
export type ForgotPasswordRequest = ApiSchemas["ForgotPasswordRequest"]
export type ResetPasswordRequest = ApiSchemas["ResetPasswordRequest"]

/** Zweck eines Verifizierungscodes nach Contract §2.11. */
export type VerificationPurpose = VerifyRequest["purpose"]

/** Eigene Profildaten aendern, PUT /api/auth/me (§6.1, KAN-44, KAN-60). */
export type ProfileUpdateRequest = ApiSchemas["ProfileUpdateRequest"]

/** Portfolio nach Contract §3.2, §6.1 (KAN-34). */
export type OwnPortfolioResponse = ApiSchemas["OwnPortfolioResponse"]
export type PortfolioResponse = ApiSchemas["PortfolioResponse"]
export type PortfolioUpdateRequest = ApiSchemas["PortfolioUpdateRequest"]

/** Metadaten einer hochgeladenen Datei, POST /api/files (§3.15, KAN-23). */
export type StoredFileResponse = ApiSchemas["StoredFileResponse"]

/** Rollen nach Contract 2.1: genau drei Werte. PUBLIC ist keine Rolle. */
export type Role = UserResponse["role"]

/** Kontostatus nach Contract 2.7. */
export type UserStatus = UserResponse["status"]

/** Projektstatus nach Contract 2.2. */
export type ProjectStatus = ApiSchemas["ProjectCardResponse"]["status"]

/**
 * Projektart nach Contract 2.6: genau drei Werte.
 *
 * Exclude<..., null>, weil das Feld am Projekt bis zum Einreichen leer bleibt
 * (Contract 3.3) und der Alias die Werteliste meint, nicht den Feldinhalt.
 * Anders waere Record<ProjectType, ...> in projectFilters.ts nicht bildbar.
 */
export type ProjectType = Exclude<
  ApiSchemas["ProjectCardResponse"]["projectType"],
  null
>

/** Angestrebter Abschluss nach Contract 2.7: genau drei Werte, wie oben. */
export type Degree = Exclude<ApiSchemas["ProjectCardResponse"]["degree"], null>

/** Stammdatenbezug, wie ihn ReferenceResponse liefert (Contract 3.6 bis 3.9). */
export type ProjectReference = ApiSchemas["ReferenceResponse"]

/** Eintrag der kuratierten Top-10 (Contract 3.11, 6.1): Platz, Aufnahmezeitpunkt, Projektkachel. */
export type Top10EntryResponse = ApiSchemas["Top10EntryResponse"]

/**
 * Nominierung fuer die Top-10 (Contract 3.11, 6.1; KAN-37). Der Request
 * traegt seit Contract v68 allein die Stufe, die Antwort fuehrt sie neben
 * dem von der Administration entschiedenen Platz.
 */
export type Top10NominationResponse = ApiSchemas["Top10NominationResponse"]
export type Top10NominationRequest = ApiSchemas["Top10NominationRequest"]

/** Vorgeschlagene Stufe nach Contract 2.13: genau drei Werte. */
export type NominationTier = Top10NominationRequest["proposedTier"]

/** Stand einer Nominierung nach Contract 2.8. */
export type NominationStatus = Top10NominationResponse["status"]

/**
 * Eine Zeile des Top-10-Aenderungsprotokolls (Contract 3.17, 6.1; KAN-40).
 *
 * <p><strong>project ist nullbar, und das ist kein Randfall.</strong> Der
 * Fremdschluessel steht auf {@code on delete set null}: wird ein Projekt
 * geloescht, verliert die Zeile ihren Verweis und bleibt trotzdem stehen
 * (§3.17). Die Oberflaeche stellt solche Zeilen als „Projekt geloescht" dar
 * und verlinkt sie nicht.
 *
 * <p><strong>admin heisst „wer veranlasst hat" und nicht „welcher
 * Admin".</strong> Den Entzug eines Platzes beim Verlassen von PUBLISHED
 * loest die Redaktion aus; die Anzeige nennt deshalb den Namen und keine
 * Rolle (§3.17).
 *
 * <p>Der Typ steht seit KAN-40 in der Generierung. Bis dahin fehlte er, weil
 * er ausschliesslich als Elementtyp von {@code PageResponse<T>} vorkommt und
 * springdoc den generischen Parameter genau einmal aufloest; nachgetragen
 * wird er in {@code config/OpenApiConfig} des Backends.
 */
export type Top10AuditEntryResponse = ApiSchemas["Top10AuditEntryResponse"]

/**
 * Art der protokollierten Aenderung nach Contract 2.12: ADDED, REMOVED,
 * REORDERED. Die drei Werte beschreiben die Wirkung auf die Liste und nicht
 * den Anlass; ein Platz wird auch dann REMOVED, wenn ihn niemand aktiv
 * geraeumt hat.
 */
export type Top10Action = Top10AuditEntryResponse["action"]

/**
 * Der Koerper von POST /api/admin/top10-nominations/{id}/accept (§6.1): der
 * Platz, den die Administration vergibt. Die vorgeschlagene Stufe bindet ihn
 * nicht (§2.13, §3.11.1 Regel 4).
 */
export type Top10AcceptRequest = ApiSchemas["Top10AcceptRequest"]

/**
 * Der Koerper von PUT /api/admin/top10 (§3.11.1 Regel 3): die vollstaendige,
 * geordnete Liste. <strong>Die Reihenfolge ist der Array-Index</strong>,
 * Platz 1 ist das erste Element; einen eigenen position-Parameter gibt es
 * bewusst nicht. Der Aufruf ersetzt die Liste, was nicht genannt ist, faellt
 * heraus.
 */
export type Top10OrderRequest = ApiSchemas["Top10OrderRequest"]

/**
 * Kommentare eines Projekts (Contract 2.3, 2.4, 3.5, 6.1; KAN-37).
 *
 * <p>Die drei Typen und die beiden Staende laufen unveraendert durch den
 * Code und werden nur fuer die Anzeige uebersetzt (Frontend-Regel 6):
 * comment.type.REPLY, comment.status.OPEN.
 */
export type CommentResponse = ApiSchemas["CommentResponse"]
export type CommentCreateRequest = ApiSchemas["CommentCreateRequest"]
export type CommentStatusRequest = ApiSchemas["CommentStatusRequest"]

/** Kommentartyp nach Contract 2.3: REPLY, NOTE, CHANGE_REQUEST. */
export type CommentType = CommentCreateRequest["type"]

/**
 * Stand eines Aenderungswunsches nach Contract 2.4.
 *
 * <p>Abgeleitet vom Request und nicht von der Antwort: an
 * CommentResponse.status ist das Feld leer, solange der Kommentar kein
 * CHANGE_REQUEST ist (§2.4), und der Alias meint die Werteliste und nicht
 * den Feldinhalt. Im Request ist der Stand Pflicht, dort steht er also ohne
 * Umweg ueber ein Exclude.
 */
export type CommentStatus = CommentStatusRequest["status"]

/** Fakultaet aus GET /api/faculties (Contract 3.8). */
export type FacultyResponse = ApiSchemas["FacultyResponse"]

/** Studiengang aus GET /api/study-programs (Contract 3.7). */
export type StudyProgramResponse = ApiSchemas["StudyProgramResponse"]

/** Kategorie aus GET /api/categories (Contract 3.6). */
export type CategoryResponse = ApiSchemas["CategoryResponse"]

/** Semester aus GET /api/semesters (Contract 3.18, seit v45 Stammdaten). */
export type SemesterResponse = ApiSchemas["SemesterResponse"]

/**
 * Modul aus GET /api/modules (Contract 3.9), eingetragen mit seinem ersten
 * Verwender KAN-35. Traegt studyProgramId, weil dasselbe Feld zugleich der
 * Filter ist: GET /api/modules?studyProgram={id}.
 */
export type ModuleResponse = ApiSchemas["ModuleResponse"]

/** Schlagwort aus GET /api/tags (Contract 3.19, seit v57 Stammdaten). */
export type TagResponse = ApiSchemas["TagResponse"]

/**
 * Blockliste eines Projekts nach Contract 3.4 und 6.1 (KAN-10). Die
 * Huellen kommen wie alles andere aus der Generierung; von Hand
 * geschrieben wird allein das Typmodell fuer content, weil springdoc
 * JsonNode als Record<string, never> erzeugt und damit nichts hergibt
 * (features/project-content/blockTypes.ts).
 */
export type BlockResponse = ApiSchemas["BlockResponse"]
export type BlocksResponse = ApiSchemas["BlocksResponse"]
export type BlockRequest = ApiSchemas["BlockRequest"]
export type BlocksUpdateRequest = ApiSchemas["BlocksUpdateRequest"]

/** Blocktyp nach Contract 2.5: genau vierzehn Werte. */
export type BlockType = BlockResponse["type"]

/**
 * Bausteine der Projektdetailseite (Contract 3.12, 6.1; KAN-32).
 * ReactionResponse traegt allein den Zaehler nach der Aenderung (3.10).
 *
 * Fuer die Referenz entsteht hier kein weiterer Alias: dafuer steht oben
 * bereits ProjectReference. Zwei Namen fuer denselben Schema-Typ in einer
 * Datei sind eine Fehlerquelle, kein Komfort. Der Mitglieds-Typ hat mit
 * KAN-35 einen Verwender bekommen und steht seitdem oben bei den
 * Projekt-Requests, nicht mehr auf Vorrat; fuer PersonResponse gibt es
 * weiterhin keinen, die Detailseite reicht das ganze Projektobjekt durch.
 */
export type StatusHistoryResponse = ApiSchemas["StatusHistoryResponse"]
export type ReactionResponse = ApiSchemas["ReactionResponse"]

/**
 * Kennzahlen der Administrationsseite, GET /api/admin/dashboard (§6.1,
 * KAN-38). Die vier Aufschluesselungen kommen als Karte ueber ihr Enum und
 * enthalten jeden Wert, auch die mit 0; der Client interpretiert einen
 * fehlenden Schluessel deshalb nie als Null, sondern als Fehler.
 *
 * <p>projectsByFaculty faellt aus dem Muster (Contract v76): die Fakultaet
 * ist keine Enum-Konstante, sondern eine Stammdatenzeile, und die Kennzahl
 * ist deshalb eine Liste aus { faculty, count } statt einer Karte. Sie
 * enthaelt jede Fakultaet, auch die ohne Projekte, aber keine Projekte ohne
 * Fakultaet: ihre Summe ist nicht die Gesamtzahl.
 */
export type DashboardResponse = ApiSchemas["DashboardResponse"]
export type FacultyProjectCountResponse =
  ApiSchemas["FacultyProjectCountResponse"]

/**
 * Sammel-Statuswechsel der Projektverwaltung, POST
 * /api/admin/projects/status (§6.1, KAN-38).
 *
 * <p><strong>Die Antwort ist eine Ergebnisliste, kein Sammelerfolg.</strong>
 * Je angefragter ID steht eine Zeile darin, in der Reihenfolge des Bodys,
 * und jede traegt success und im Fehlerfall den errorCode aus §6.2. Einen
 * Meldungstext liefert sie bewusst nicht: angezeigt wird nach dem Code ueber
 * i18n (Frontend-Regel 3).
 */
export type ProjectBulkStatusRequest = ApiSchemas["ProjectBulkStatusRequest"]
export type ProjectBulkStatusResponse = ApiSchemas["ProjectBulkStatusResponse"]
export type ProjectBulkStatusResultResponse =
  ApiSchemas["ProjectBulkStatusResultResponse"]

/** Der auszufuehrende Uebergang des Sammel-Aufrufs: publish oder request-revision. */
export type BulkStatusAction = NonNullable<ProjectBulkStatusRequest["action"]>

/**
 * Redaktion eines fremden Projekts umverteilen, PUT
 * /api/projects/{id}/editors (§6.1, ADMIN). Die Liste ersetzt die bisherige
 * vollstaendig; [] hebt die Zuweisung auf.
 */
export type ProjectEditorsRequest = ApiSchemas["ProjectEditorsRequest"]

/**
 * Nutzerverwaltung, GET/POST /api/admin/users und GET/PATCH/DELETE
 * /api/admin/users/{id} (§3.1, §6.1, KAN-39).
 *
 * <p><strong>AdminUserResponse ist der einzige Antworttyp mit fremder
 * hsbEmail</strong> (§3.1). Sie erscheint deshalb ausschliesslich in der
 * Nutzerverwaltung; die eigene Adresse fuehren seit Contract v50 auch die
 * Auth-Antworten an die Person selbst. Fuer Auswahlfelder gibt es
 * {@link UserLookupResponse}, das keine Adresse traegt.
 *
 * <p><strong>Anlegen und Aendern sind nicht dasselbe.</strong>
 * AdminUserCreateRequest fuehrt alle sechs Felder als Pflicht,
 * einschliesslich des Initialpassworts, das der Client erzeugt (Contract
 * v27). AdminUserUpdateRequest fuehrt vier optionale Felder; ein fehlendes
 * heisst „unveraendert", nicht „loeschen".
 */
export type AdminUserResponse = ApiSchemas["AdminUserResponse"]
export type AdminUserCreateRequest = ApiSchemas["AdminUserCreateRequest"]
export type AdminUserUpdateRequest = ApiSchemas["AdminUserUpdateRequest"]

/**
 * Antwort von POST /api/admin/users/{id}/reset-password (§6.7, KAN-43): das
 * vom Server erzeugte Initialpasswort. Es erscheint in genau dieser einen
 * Antwort und wird nirgends gespeichert.
 */
export type AdminPasswordResetResponse =
  ApiSchemas["AdminPasswordResetResponse"]

/**
 * Stammdaten schreiben (§3.6 bis §3.9, §3.18, §6.1, KAN-39). Gelesen wird
 * ueber die PUBLIC-Listen; hier stehen allein die Koerper der
 * Admin-Endpoints.
 *
 * <p><strong>Create und Update unterscheiden sich in der Pflicht.</strong>
 * Beim Anlegen ist der Name Pflicht und beim Studiengang zusaetzlich die
 * facultyId, beim Modul die studyProgramId; beim Aendern ist jedes Feld
 * optional und ein fehlendes heisst „unveraendert". Die Kurzform ist nur an
 * der Fakultaet Pflicht (unique, not null, §3.8), an Studiengang und Modul
 * darf sie fehlen.
 */
export type CategoryCreateRequest = ApiSchemas["CategoryCreateRequest"]
export type CategoryUpdateRequest = ApiSchemas["CategoryUpdateRequest"]
export type CategoryMergeRequest = ApiSchemas["CategoryMergeRequest"]
export type FacultyCreateRequest = ApiSchemas["FacultyCreateRequest"]
export type FacultyUpdateRequest = ApiSchemas["FacultyUpdateRequest"]
export type StudyProgramCreateRequest = ApiSchemas["StudyProgramCreateRequest"]
export type StudyProgramUpdateRequest = ApiSchemas["StudyProgramUpdateRequest"]
export type ModuleCreateRequest = ApiSchemas["ModuleCreateRequest"]
export type ModuleUpdateRequest = ApiSchemas["ModuleUpdateRequest"]
export type SemesterCreateRequest = ApiSchemas["SemesterCreateRequest"]
export type SemesterUpdateRequest = ApiSchemas["SemesterUpdateRequest"]

/**
 * Richtung des Verschiebens, POST /api/admin/semesters/{id}/move (§3.18).
 * UP tauscht mit der Zeile darueber, DOWN mit der darunter.
 */
export type SemesterMoveRequest = ApiSchemas["SemesterMoveRequest"]
export type SemesterMoveDirection = SemesterMoveRequest["direction"]
