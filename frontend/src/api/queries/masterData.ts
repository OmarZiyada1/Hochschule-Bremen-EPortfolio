import { queryOptions } from "@tanstack/react-query"

import { api } from "@/api/client"
import { apiPaths } from "@/api/endpoints"
import type {
  CategoryResponse,
  FacultyResponse,
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
 * Projektbibliothek (KAN-64) fuer categories und semesters.
 *
 * semesters kommt bewusst ohne active-Parameter: ein deaktiviertes Semester
 * bleibt ein gueltiger Filterwert, sonst fielen veroeffentlichte Projekte
 * aus der Suche, sobald ihr Semester vorbei ist (§3.18).
 */
export const masterDataQueries = {
  faculties: () =>
    queryOptions({
      queryKey: ["faculties"] as const,
      queryFn: () => api.get<FacultyResponse[]>(apiPaths.masterData.faculties),
    }),
  studyPrograms: () =>
    queryOptions({
      queryKey: ["studyPrograms"] as const,
      queryFn: () =>
        api.get<StudyProgramResponse[]>(apiPaths.masterData.studyPrograms),
    }),
  categories: () =>
    queryOptions({
      queryKey: ["categories"] as const,
      queryFn: () =>
        api.get<CategoryResponse[]>(apiPaths.masterData.categories),
    }),
  semesters: () =>
    queryOptions({
      queryKey: ["semesters"] as const,
      queryFn: () =>
        api.get<SemesterResponse[]>(apiPaths.masterData.semesters),
    }),
}
