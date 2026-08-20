import { useMutation, useQueryClient } from "@tanstack/react-query"

import { uploadProjectFile } from "@/api/queries/files"
import {
  createProject,
  projectQueries,
  updateProject,
} from "@/api/queries/projects"
import type { ProjectUpdateRequest } from "@/api/types"

/**
 * Die schreibenden Vorgaenge des Metadatenformulars (KAN-35). Ein Hook je
 * Serveroperation; die Funktionen kommen aus den Fabriken unter
 * api/queries, Pfade und Typen kennt dieser Hook nicht (Skill
 * frontend-modul, Abschnitt 2).
 *
 * <p><strong>Keine Mutation hier laeuft mit {@code retry}.</strong> Das ist
 * bei {@code PUT /projects/{id}} keine Einstellungssache: ein zweiter
 * Versuch nach 409 {@code PROJECT_VERSION_CONFLICT} ueberschriebe genau die
 * fremde Aenderung, vor der die Versionspruefung schuetzt (§6.4, Skill
 * frontend-api Abschnitt 6). Der Standard von TanStack Query wiederholt
 * Mutationen ohnehin nicht; hier steht es, damit niemand es aus Versehen
 * einschaltet.
 */

/**
 * POST /api/projects (§6.1). Das Ergebnis traegt die neue ID, gegen die die
 * Route weiterleitet.
 *
 * <p>Invalidiert den {@code projects}-Ast: die eigene Projektliste unter
 * "Mein Portfolio" zeigt den neuen Entwurf sonst erst nach einem Reload.
 */
export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] })
    },
  })
}

/**
 * PUT /api/projects/{id} (§6.1).
 *
 * <p>Der zwischengespeicherte Detaildatensatz wird mit der Antwort
 * ueberschrieben statt neu abgefragt: die Antwort <em>ist</em> der neue
 * Stand samt erhoehter {@code version}, und ein zusaetzlicher GET liesse
 * die Seite ohne Not durch den Ladezustand laufen. Der Listen-Ast wird
 * dagegen invalidiert, weil Titel und Teaser dort auf den Kacheln stehen.
 */
export function useUpdateProject(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: ProjectUpdateRequest) =>
      updateProject(projectId, request),
    onSuccess: (updated) => {
      queryClient.setQueryData(
        projectQueries.detail(projectId).queryKey,
        updated
      )
      void queryClient.invalidateQueries({ queryKey: ["projects"] })
    },
  })
}

/**
 * POST /api/files mit projectId (§3.15): das Titelbild.
 *
 * <p>Der Upload macht das Bild noch nicht zum Titelbild. Er liefert die
 * Referenz {@code /api/files/{id}}; gespeichert wird sie erst mit dem
 * Formular, wie beim Avatar in KAN-34.
 */
export function useUploadCoverImage(projectId: string) {
  return useMutation({
    mutationFn: (file: File) => uploadProjectFile(file, projectId),
  })
}
