import { queryOptions } from "@tanstack/react-query"

import { api } from "@/api/client"
import { apiPaths } from "@/api/endpoints"
import type {
  CategoryResponse,
  FacultyResponse,
  ModuleResponse,
  SemesterResponse,
  StudyProgramResponse,
} from "@/api/types"

/**
 * queryOptions-Fabriken der Stammdaten (§6.1, Backend-Modul masterdata):
 * PUBLIC, vollstaendige Listen ohne PageResponse, ein Nachladen gibt es
 * nicht. Eine Datei fuer die Ressourcen dieses Moduls, wie das Backend sie
 * buendelt.
 *
 * Erste Verwender: die Kennzahlen der CTA-Sektion der Startseite (KAN-31)
 * fuer faculties und studyPrograms, die Filter-Seitenleiste der
 * Projektbibliothek (KAN-64) fuer categories und semesters, das
 * Metadatenformular (KAN-35) fuer modules und fuer die Parameter unten.
 *
 * <p><strong>Die Parameter sind optional, und das ist der Punkt.</strong>
 * Ohne Angabe verhalten sich die Fabriken wie bisher, es gibt also keine
 * Aenderung an den bestehenden Verwendern. Filtern muss aber genau das
 * Gegenteil von Bearbeiten:
 *
 * <ul>
 * <li>Die Seitenleiste braucht <em>alle</em> Semester, auch deaktivierte.
 * Sonst fielen veroeffentlichte Projekte aus der Suche, sobald ihr Semester
 * vorbei ist (§3.18). Das Metadatenformular braucht umgekehrt nur die
 * aktiven, denn nur die sind waehlbar; ein inaktives ergibt 400
 * VALIDATION_FAILED.</li>
 * <li>Die Seitenleiste zeigt alle Studiengaenge nebeneinander, das
 * Formular nur die der gewaehlten Fakultaet.</li>
 * </ul>
 *
 * <p>Die Parameter stehen im Query-Key, nicht nur im Request. Ohne das
 * teilten sich „alle Semester" und „nur aktive" einen Cache-Eintrag, und
 * welche Liste die Auswahl zeigt, entschiede die Reihenfolge der Aufrufe.
 */
export const masterDataQueries = {
  faculties: () =>
    queryOptions({
      queryKey: ["faculties"] as const,
      queryFn: () => api.get<FacultyResponse[]>(apiPaths.masterData.faculties),
    }),

  /**
   * @param facultyId Nur Studiengaenge dieser Fakultaet (§6.1, Filter
   *   {@code faculty}). Ohne Angabe kommen alle. Eine unbekannte ID ergibt
   *   eine leere Liste, keinen 404.
   */
  studyPrograms: (facultyId?: string) =>
    queryOptions({
      queryKey: ["studyPrograms", { faculty: facultyId ?? null }] as const,
      queryFn: () =>
        api.get<StudyProgramResponse[]>(apiPaths.masterData.studyPrograms, {
          query: { faculty: facultyId },
        }),
    }),
  categories: () =>
    queryOptions({
      queryKey: ["categories"] as const,
      queryFn: () =>
        api.get<CategoryResponse[]>(apiPaths.masterData.categories),
    }),

  /**
   * @param active Nur aktive Semester (§3.18, §6.1). Ohne Angabe kommen
   *   alle, auch die deaktivierten.
   */
  semesters: (active?: boolean) =>
    queryOptions({
      queryKey: ["semesters", { active: active ?? null }] as const,
      queryFn: () =>
        api.get<SemesterResponse[]>(apiPaths.masterData.semesters, {
          query: { active },
        }),
    }),

  /**
   * Module (§3.9, KAN-35).
   *
   * @param studyProgramId Nur Module dieses Studiengangs (§6.1, Filter
   *   {@code studyProgram}). Ohne Angabe kommen alle.
   */
  modules: (studyProgramId?: string) =>
    queryOptions({
      queryKey: ["modules", { studyProgram: studyProgramId ?? null }] as const,
      queryFn: () =>
        api.get<ModuleResponse[]>(apiPaths.masterData.modules, {
          query: { studyProgram: studyProgramId },
        }),
    }),
}
