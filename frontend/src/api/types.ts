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

/** Stammdatenbezug, wie ihn ReferenceResponse liefert (Contract 3.6 bis 3.9). */
export type ProjectReference = ApiSchemas["ReferenceResponse"]
