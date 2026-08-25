import { z } from "zod"

import {
  MASTER_DATA_ABBREVIATION_MAX,
  MASTER_DATA_NAME_MAX,
} from "@/features/administration/components/masterDataName.schema"

/**
 * Eingabepruefung der Studienstruktur (§3.7 bis §3.9, KAN-39,
 * Frontend-Regel 12).
 *
 * <p><strong>Drei Ebenen, ein Formular.</strong> Fakultaet, Studiengang und
 * Modul tragen dieselben drei Felder: Name, Kurzform und die uebergeordnete
 * Zeile. Sie unterscheiden sich nur darin, welche davon Pflicht sind, und
 * deshalb gibt es eine Fabrik statt dreier Abschriften, die auseinanderlaufen
 * wuerden.
 *
 * <p><strong>Die Kurzform ist nur an der Fakultaet Pflicht.</strong>
 * {@code Faculty.abbreviation} ist unique und not null (§3.8): ein Name
 * allein ergaebe dort 400 VALIDATION_FAILED. An Studiengang und Modul darf
 * sie fehlen (§3.7, §3.9), und eine leere Eingabe heisst dort „keine".
 *
 * <p><strong>Die uebergeordnete Zeile ist eine ID im Koerper.</strong> Eine
 * unbekannte ergibt <strong>400</strong>, nicht 404 (§6.3.1): sie macht die
 * Anfrage unbrauchbar und beschreibt keine fehlende Ressource.
 */
export type StudyStructureKind = "faculty" | "studyProgram" | "module"

export interface StudyStructureFormValues {
  name: string
  /** Leer heisst „keine"; an der Fakultaet ist das Feld Pflicht. */
  abbreviation: string
  /**
   * {@code facultyId} beim Studiengang, {@code studyProgramId} beim Modul.
   * Ein Feldname im Formular fuer beides: die Ebene entscheidet, wie er im
   * Koerper heisst, und das steht an genau einer Stelle
   * ({@link parentFieldOf}).
   */
  parentId: string
}

export function studyStructureSchema(kind: StudyStructureKind) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, "validation.masterData.nameRequired")
      .max(MASTER_DATA_NAME_MAX, "validation.masterData.nameTooLong"),
    abbreviation:
      kind === "faculty"
        ? z
            .string()
            .trim()
            .min(1, "validation.masterData.abbreviationRequired")
            .max(
              MASTER_DATA_ABBREVIATION_MAX,
              "validation.masterData.abbreviationTooLong"
            )
        : z
            .string()
            .trim()
            .max(
              MASTER_DATA_ABBREVIATION_MAX,
              "validation.masterData.abbreviationTooLong"
            ),
    parentId:
      kind === "faculty"
        ? z.string()
        : z
            .string()
            .min(
              1,
              kind === "studyProgram"
                ? "validation.masterData.facultyRequired"
                : "validation.masterData.studyProgramRequired"
            ),
  })
}

/**
 * Wie das Feld {@code parentId} im Koerper des Servers heisst. Die Fakultaet
 * hat keine uebergeordnete Zeile und deshalb keinen Namen.
 */
export function parentFieldOf(kind: StudyStructureKind): string | null {
  switch (kind) {
    case "faculty":
      return null
    case "studyProgram":
      return "facultyId"
    case "module":
      return "studyProgramId"
  }
}
