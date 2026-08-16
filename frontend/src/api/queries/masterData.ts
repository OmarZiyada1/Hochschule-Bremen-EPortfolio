import { queryOptions } from "@tanstack/react-query"

import { api } from "@/api/client"
import { apiPaths } from "@/api/endpoints"
import type { FacultyResponse, StudyProgramResponse } from "@/api/types"

/**
 * queryOptions-Fabriken der Stammdaten (§6.1, Backend-Modul masterdata):
 * PUBLIC, vollstaendige Listen ohne PageResponse, ein Nachladen gibt es
 * nicht. Eine Datei fuer die Ressourcen dieses Moduls, wie das Backend sie
 * buendelt.
 *
 * Erster Verwender sind die Kennzahlen der CTA-Sektion der Startseite
 * (KAN-31): Fakultaets- und Studiengangzahl sind die Laenge dieser Listen,
 * ein eigener Statistik-Endpoint lohnt den Contract-Eintrag nicht (Ticket).
 * categories kommt erst mit seinem Verwender (Filter-Seitenleiste, KAN-64).
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
}
