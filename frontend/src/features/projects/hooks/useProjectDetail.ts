import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  addReaction,
  projectQueries,
  removeReaction,
} from "@/api/queries/projects"
import type { ProjectDetailResponse } from "@/api/types"

/**
 * Lesende und schreibende Hooks der Projektdetailseite (KAN-32). Pfad, Typ
 * und Query-Key liegen in der Fabrik unter api/queries (Skill
 * frontend-modul, Abschnitt 2); diese Hooks benennen nur die Fachlichkeit.
 */

/**
 * Ein Projekt mit Bloecken, Metadaten und Reaktionszahl.
 *
 * <p>Eine unbekannte oder nicht sichtbare ID ergibt 404 PROJECT_NOT_FOUND,
 * ein fehlendes Recht 403 NO_PERMISSION (§6.3.1). Beides stellt die Seite
 * dar; entschieden wird ueber errorCode, nie ueber den Meldungstext
 * (Frontend-Regel 3).
 */
export function useProjectDetail(projectId: string) {
  return useQuery(projectQueries.detail(projectId))
}

/**
 * Reaktion setzen und entfernen (§6.1, §3.10).
 *
 * <p><strong>Der Zaehler kommt aus der Antwort, nie aus dem Client.</strong>
 * Beide Richtungen sind idempotent und liefern 200 {@code { count }}; ein
 * zweiter Klick ist deshalb kein Fehler, sondern bestaetigt den Stand. Statt
 * die Seite neu zu laden, wird der zwischengespeicherte Detaildatensatz an
 * genau einem Feld nachgezogen: {@code reactionCount}. Alles andere bleibt
 * stehen, also auch der Blockinhalt, der sich durch eine Reaktion nicht
 * aendert.
 *
 * <p>Bewusst ohne {@code invalidateQueries} auf den Detaildatensatz: eine
 * erneute Abfrage brachte denselben Zaehler, den die Antwort schon traegt,
 * und liesse den Inhalt dabei kurz durch den Ladezustand laufen. Die
 * Listenansichten zeigen den Zaehler ebenfalls, sind hier aber nicht
 * sichtbar; sie holen ihn beim naechsten Aufruf ohnehin frisch.
 */
export function useProjectReaction(projectId: string) {
  const queryClient = useQueryClient()
  const queryKey = projectQueries.detail(projectId).queryKey

  function applyCount(count: number | undefined): void {
    if (count === undefined) {
      return
    }
    queryClient.setQueryData<ProjectDetailResponse>(queryKey, (current) =>
      current === undefined ? current : { ...current, reactionCount: count }
    )
  }

  const add = useMutation({
    mutationFn: () => addReaction(projectId),
    onSuccess: (response) => applyCount(response.count),
  })

  const remove = useMutation({
    mutationFn: () => removeReaction(projectId),
    onSuccess: (response) => applyCount(response.count),
  })

  return { add, remove }
}
