import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { adminQueries, changeProjectStatusInBulk } from "@/api/queries/admin"
import { masterDataQueries } from "@/api/queries/masterData"
import {
  type AdminProjectListParams,
  deleteProject,
  projectQueries,
  reassignEditors,
} from "@/api/queries/projects"
import type { ProjectBulkStatusRequest } from "@/api/types"

/**
 * Die Query- und Mutation-Hooks der Administrationsseite (KAN-38). Sie kennen
 * weder Pfade noch {@code api.*}: beides steht in den Fabriken unter
 * {@code src/api/queries/} (Skill frontend-modul, Abschnitt 2).
 */

/** Die Kennzahlen der Startansicht (§6.1). */
export function useAdminDashboard() {
  return useQuery(adminQueries.dashboard())
}

/** Die Projektliste der Verwaltung, ohne Statuseinschraenkung (§6.1). */
export function useAdminProjectList(params: AdminProjectListParams) {
  return useQuery(projectQueries.administration(params))
}

/**
 * Die Optionen der drei Auswahlfelder aus dem Template.
 *
 * <p>Dieselben drei Listen wie in „Meine Reviews", und aus demselben Grund
 * vollstaendig geladen statt gefiltert: es sind Stammdaten ohne Paginierung,
 * und der Cache-Eintrag wird mit jeder anderen Seite geteilt, die sie zeigt.
 */
export function useAdminFilterOptions() {
  return {
    studyPrograms: useQuery(masterDataQueries.studyPrograms()),
    semesters: useQuery(masterDataQueries.semesters()),
    modules: useQuery(masterDataQueries.modules()),
  }
}

/**
 * Der Sammel-Statuswechsel (§6.1).
 *
 * <p><strong>Invalidiert wird immer</strong>, auch wenn keine einzige Zeile
 * erfolgreich war: die Antwort ist eine Ergebnisliste, kein Alles-oder-nichts,
 * und schon eine erfolgreiche Zeile hat den Bestand veraendert. Getroffen
 * werden beide Ansichten, die Projektliste und die Kennzahlen, denn ein
 * Uebergang verschiebt {@code projectsByStatus}.
 */
export function useBulkProjectStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: ProjectBulkStatusRequest) =>
      changeProjectStatusInBulk(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] })
      void queryClient.invalidateQueries({
        queryKey: adminQueries.dashboard().queryKey,
      })
    },
  })
}

/**
 * Ein Projekt loeschen (§6.1, DELETE /projects/{id}, 204).
 *
 * <p>Fuer ADMIN in jedem Status; Bloecke und Dateien fallen serverseitig per
 * Cascade mit. Die Rueckfrage davor nennt genau das.
 */
export function useDeleteProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (projectId: string) => deleteProject(projectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] })
      void queryClient.invalidateQueries({
        queryKey: adminQueries.dashboard().queryKey,
      })
    },
  })
}

/**
 * Die Redaktion eines Projekts umverteilen (§6.1, PUT
 * /projects/{id}/editors).
 *
 * <p>Die Liste ersetzt die bisherige vollstaendig, ein leeres Array hebt die
 * Zuweisung auf. Anders als beim Metadaten-PUT gibt es hier keine Version:
 * der Endpoint aendert keine Metadaten (§6.4).
 */
export function useReassignEditors() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (variables: { projectId: string; editorIds: string[] }) =>
      reassignEditors(variables.projectId, variables.editorIds),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] })
      void queryClient.invalidateQueries({
        queryKey: projectQueries.detail(variables.projectId).queryKey,
      })
    },
  })
}
