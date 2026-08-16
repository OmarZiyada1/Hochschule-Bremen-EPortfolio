import { useQuery } from "@tanstack/react-query"

import { masterDataQueries } from "@/api/queries/masterData"
import { projectQueries } from "@/api/queries/projects"

/**
 * Die drei Kennzahlen der CTA-Sektion (Ticket KAN-31): clientseitig
 * abgeleitet statt ueber einen eigenen Statistik-Endpoint. Ein Hook je
 * Serveroperation; select reduziert auf die Zahl, damit die Seite nie auf
 * Listendaten zugreift, die sie nicht braucht.
 */

/** Zahl aller veroeffentlichten Projekte: totalElements einer Ein-Element-Seite (§6.6). */
export function useProjectCount() {
  return useQuery({
    ...projectQueries.list({ size: 1 }),
    select: (page) => page.totalElements,
  })
}

/** Zahl der Fakultaeten: Laenge der vollstaendigen Stammdatenliste (§6.1). */
export function useFacultyCount() {
  return useQuery({
    ...masterDataQueries.faculties(),
    select: (faculties) => faculties.length,
  })
}

/** Zahl der Studiengaenge: Laenge der vollstaendigen Stammdatenliste (§6.1). */
export function useStudyProgramCount() {
  return useQuery({
    ...masterDataQueries.studyPrograms(),
    select: (programs) => programs.length,
  })
}
