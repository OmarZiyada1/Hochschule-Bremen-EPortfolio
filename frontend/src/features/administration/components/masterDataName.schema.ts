import { z } from "zod"

/**
 * Eingabepruefung der einfeldrigen Stammdatenformulare (KAN-39,
 * Frontend-Regel 12): Kategorie und Semester tragen genau einen Namen, beim
 * Anlegen wie beim Umbenennen.
 *
 * <p><strong>Eine Fabrik statt vier Schemata.</strong> Die Regel ist
 * dieselbe (Pflichtfeld, Obergrenze), nur die Zahl unterscheidet sich; vier
 * Abschriften liefen beim naechsten Nachtrag auseinander. Die Grenzen kommen
 * aus den Request-DTOs des Servers und nicht aus dem Entwurf: was der Server
 * ablehnt, lehnt auch dieses Schema ab.
 *
 * <p>zod prueft ausschliesslich Eingaben. Die Antworttypen kommen aus der
 * generierten schema.d.ts, und die 409 RESOURCE_IN_USE des Servers ist keine
 * Formatfrage: sie erscheint als eigene Meldung am Feld.
 */

/** {@code CategoryCreateRequest.name}: hoechstens 255 Zeichen. */
export const CATEGORY_NAME_MAX = 255

/** {@code SemesterCreateRequest.name}: hoechstens 64 Zeichen (§3.18). */
export const SEMESTER_NAME_MAX = 64

/** {@code FacultyCreateRequest.name} und die uebrigen Stammdatennamen. */
export const MASTER_DATA_NAME_MAX = 255

/** {@code abbreviation} an Fakultaet, Studiengang und Modul. */
export const MASTER_DATA_ABBREVIATION_MAX = 64

export function nameFormSchema(max: number, tooLongMessageKey: string) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, "validation.masterData.nameRequired")
      .max(max, tooLongMessageKey),
  })
}

export interface NameFormValues {
  name: string
}

/**
 * Die Feldnamen, die der Server in einem 400 VALIDATION_FAILED nennen kann
 * (§6.2, Format {@code feld: Text}).
 */
export const NAME_SERVER_FIELDS = ["name"] as const
