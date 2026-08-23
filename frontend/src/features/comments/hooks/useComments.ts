import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  commentQueries,
  createComment,
  setCommentStatus,
} from "@/api/queries/comments"
import type { CommentCreateRequest, CommentStatus } from "@/api/types"

/**
 * Lesende und schreibende Hooks der Kommentarspalte (§2.3, §2.4, §6.1;
 * KAN-37). Pfad, Typ und Query-Key liegen in der Fabrik unter api/queries
 * (Skill frontend-modul, Abschnitt 2); diese Hooks benennen nur die
 * Fachlichkeit.
 *
 * <p><strong>Der Kommentarpfad beruehrt {@code Project.version} nicht.</strong>
 * Ein Kommentar aendert das Projekt nicht, also gibt es hier weder ein
 * Optimistic Locking noch einen Weg in die Schreibwarteschlange des Editors
 * (KAN-36): {@code useAutosave} bleibt unberuehrt, und ein Kommentar
 * waehrend eines laufenden Speichertakts erzeugt keinen Versionskonflikt.
 */

/**
 * Die Kommentare eines Projekts, aufsteigend nach {@code createdAt} und
 * ohne Paginierung (§6.1).
 *
 * <p><strong>Der Umfang kommt vom Server.</strong> Eine {@code NOTE}
 * erscheint fuer die Projektseite gar nicht erst in der Antwort; der Client
 * filtert nichts nach (Skill frontend-api, Abschnitt 8).
 */
export function useComments(projectId: string, enabled = true) {
  return useQuery({ ...commentQueries.list(projectId), enabled })
}

/**
 * Einen Kommentar anlegen (§6.1), <strong>201</strong>.
 *
 * <p>Danach wird die Liste invalidiert statt von Hand ergaenzt: welche
 * Kommentare die anfragende Person sehen darf, entscheidet der Server, und
 * ein selbst eingefuegter Eintrag stuende in einer Reihenfolge, die der
 * Server so nicht liefert.
 */
export function useCreateComment(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: CommentCreateRequest) =>
      createComment(projectId, request),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: commentQueries.list(projectId).queryKey,
      })
    },
  })
}

/**
 * Den Stand eines Aenderungswunsches umschalten (§2.4, §6.1), in beide
 * Richtungen.
 *
 * <p>Die Liste wird danach neu geholt, weil sich mit dem Stand auch die
 * Reihenfolge der Darstellung aendert: offene Aenderungswuensche stehen
 * oben, und ein abgehakter Punkt rueckt damit in den Verlauf zurueck.
 */
export function useSetCommentStatus(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      commentId,
      status,
    }: {
      commentId: string
      status: CommentStatus
    }) => setCommentStatus(commentId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: commentQueries.list(projectId).queryKey,
      })
    },
  })
}
