import type { components } from "@/api/schema"

/**
 * Lesbare Aliase auf die generierte schema.d.ts, damit Importpfade kurz
 * bleiben und kein Response-Typ von Hand nachgebaut wird (Frontend-Regel 2,
 * Skill frontend-api Abschnitt 1). Neue Aliase entstehen hier, nie als
 * eigene Interfaces in Komponenten.
 *
 * NonNullable, weil springdoc Felder nicht als required markiert und die
 * Enum-Eigenschaften deshalb optional generiert werden: der Alias meint den
 * Wert, nicht "Wert oder undefined".
 */
export type ApiSchemas = components["schemas"]

export type UserResponse = ApiSchemas["UserResponse"]
export type LoginResponse = ApiSchemas["LoginResponse"]
export type ProjectCardResponse = ApiSchemas["ProjectCardResponse"]

/** Projektdetail, Antwort der Workflow-Endpoints (§6.1, KAN-69). */
export type ProjectDetailResponse = ApiSchemas["ProjectDetailResponse"]

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
export type Role = NonNullable<UserResponse["role"]>

/** Kontostatus nach Contract 2.7. */
export type UserStatus = NonNullable<UserResponse["status"]>

/** Projektstatus nach Contract 2.2. */
export type ProjectStatus = NonNullable<
  ApiSchemas["ProjectCardResponse"]["status"]
>

/** Projektart nach Contract 2.6. */
export type ProjectType = NonNullable<
  ApiSchemas["ProjectCardResponse"]["projectType"]
>

/** Angestrebter Abschluss nach Contract 2.7. */
export type Degree = NonNullable<ApiSchemas["ProjectCardResponse"]["degree"]>

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
export type BlockType = NonNullable<BlockResponse["type"]>
