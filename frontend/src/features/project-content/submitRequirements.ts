import type { ProjectDetailResponse } from "@/api/types"

/**
 * Was §3.3 zum Einreichen verlangt, ablesbar an der Detailantwort.
 *
 * <p><strong>Wortgleich mit
 * {@code ProjectWorkflowService.REQUIRED_FOR_SUBMIT}.</strong> Verbindlich
 * bleibt der Server mit 400 {@code PROJECT_INCOMPLETE}; diese Liste sagt
 * der Autor:in nur vorher, was noch fehlt, statt sie es nach dem
 * Absenden erfahren zu lassen. Kommt im Contract ein Pflichtfeld dazu,
 * gehoert es hier hinein; bis dahin meldet der Server es, und die Meldung
 * erscheint am Formular.
 *
 * <p>Eigene Datei, damit die Komponente daneben ausschliesslich Komponenten
 * ausgibt (Fast Refresh, {@code react-refresh/only-export-components}).
 */
export const REQUIRED_FOR_SUBMIT = [
  "projectType",
  "facultyId",
  "studyProgramId",
  "degree",
  "categoryId",
  "semesterId",
  "editorIds",
] as const

export type RequiredSubmitField = (typeof REQUIRED_FOR_SUBMIT)[number]

/** Welche der sieben Angaben am Projekt noch fehlen, in der Reihenfolge des Formulars. */
export function missingForSubmit(
  project: ProjectDetailResponse
): RequiredSubmitField[] {
  const present: Record<RequiredSubmitField, boolean> = {
    projectType: project.projectType != null,
    facultyId: project.faculty != null,
    studyProgramId: project.studyProgram != null,
    degree: project.degree != null,
    categoryId: project.category != null,
    semesterId: project.semester != null,
    editorIds: (project.editors ?? []).length > 0,
  }
  return REQUIRED_FOR_SUBMIT.filter((field) => !present[field])
}
