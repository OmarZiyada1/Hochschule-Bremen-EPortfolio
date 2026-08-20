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
