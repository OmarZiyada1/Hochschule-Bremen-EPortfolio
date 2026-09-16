import type { ProjectMetadataValues } from "@/features/projects/ProjectMetadataForm.schema"

/**
 * Die drei Schritte, in denen die rechte Spalte des Metadatenformulars
 * steht (KAN-103).
 *
 * <p><strong>Warum eine eigene Datei.</strong> Die Zuordnung Feld zu
 * Schritt wird an drei Stellen gebraucht: beim Rendern der Schritte, beim
 * Aufklappen des obersten beanstandeten Schrittes und beim Setzen des
 * Fokus in dessen erstes beanstandetes Feld. Stuende sie in der
 * Komponentendatei daneben, exportierte diese neben Komponenten auch
 * Konstanten, und Fast Refresh verloere den Formularzustand bei jeder
 * Aenderung ({@code react-refresh/only-export-components}), wie schon bei
 * {@code submitRequirements}.
 *
 * <p><strong>Die Reihenfolge ist verbindlich</strong>, und zwar zweimal:
 * sie ist die Reihenfolge auf dem Bildschirm und zugleich die Reihenfolge,
 * in der nach dem obersten beanstandeten Schritt gesucht wird. Dasselbe
 * gilt fuer {@code fields} innerhalb eines Schrittes.
 *
 * <p><strong>Die linke Spalte kommt hier nicht vor.</strong>
 * {@code title}, {@code summary} und {@code coverImageUrl} stehen in der
 * Vorschau und damit immer sichtbar; ein Fehler an ihnen braucht keinen
 * Schritt, der sich erst oeffnen muesste.
 */
export const METADATA_STEPS = [
  {
    id: "editorial",
    fields: ["editors", "members", "authorRole"],
  },
  {
    id: "classification",
    fields: ["facultyId", "studyProgramId", "degree", "semesterId", "moduleId"],
  },
  {
    id: "topics",
    fields: ["projectType", "categoryId", "tags"],
  },
] as const satisfies readonly {
  id: string
  fields: readonly (keyof ProjectMetadataValues)[]
}[]

export type MetadataStepDefinition = (typeof METADATA_STEPS)[number]

export type MetadataStepId = MetadataStepDefinition["id"]

/**
 * Der oberste Schritt, der eines der uebergebenen Felder enthaelt, oder
 * {@code undefined}, wenn keines davon in einem Schritt steht.
 *
 * <p>Aufgeklappt wird genau dieser eine: die Einzel-Offen-Regel bleibt
 * auch im Fehlerfall bestehen, die uebrigen betroffenen Schritte tragen
 * stattdessen die Markierung im Kopf.
 */
export function firstStepWith(
  flagged: readonly string[]
): MetadataStepDefinition | undefined {
  return METADATA_STEPS.find((step) =>
    step.fields.some((field) => flagged.includes(field))
  )
}

/**
 * Das erste beanstandete Feld eines Schrittes, in der Reihenfolge des
 * Formulars. Der Rueckgabewert ist zugleich die DOM-ID des Bedienelements:
 * jedes Feld der rechten Spalte traegt seinen Feldnamen als {@code id},
 * damit der Fokus ohne ein Ref durch drei Ebenen hindurchfindet.
 */
export function firstFlaggedFieldOf(
  step: MetadataStepDefinition,
  flagged: readonly string[]
): string | undefined {
  return step.fields.find((field) => flagged.includes(field))
}
