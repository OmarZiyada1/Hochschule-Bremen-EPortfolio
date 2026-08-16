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
