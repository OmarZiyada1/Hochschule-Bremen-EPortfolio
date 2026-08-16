import { useQuery } from "@tanstack/react-query"

import { masterDataQueries } from "@/api/queries/masterData"

/**
 * Die vier Optionslisten der Filter-Seitenleiste (KAN-64): Fakultaeten,
 * Studiengaenge, Kategorien und Semester, alle PUBLIC und unpaginiert
 * (§6.1). Pfad, Typ und Key liegen in der Stammdaten-Fabrik (Skill
 * frontend-modul, Abschnitt 2); dieser Hook buendelt nur, was die
 * Seitenleiste braucht. Abschluss und Projekttyp sind Contract-Enums
 * (§2.7, §2.6) und brauchen keinen Request (projectFilters.ts).
 */
export function useFilterOptions() {
  return {
    faculties: useQuery(masterDataQueries.faculties()),
    studyPrograms: useQuery(masterDataQueries.studyPrograms()),
    categories: useQuery(masterDataQueries.categories()),
    semesters: useQuery(masterDataQueries.semesters()),
  }
}
