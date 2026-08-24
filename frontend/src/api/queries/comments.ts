import { queryOptions } from "@tanstack/react-query"

import { api } from "@/api/client"
import { apiPaths } from "@/api/endpoints"
import type {
  CommentCreateRequest,
  CommentResponse,
  CommentStatus,
} from "@/api/types"

/**
 * queryOptions-Fabrik der Ressource Kommentare (§2.3, §2.4, §3.5, §6.1;
 * KAN-37). Pfad, Response-Typ und Query-Key stehen hier an genau einer
 * Stelle; Feature-Hooks konsumieren die Fabrik und kennen weder Pfade noch
 * api.* (Skill frontend-modul, Abschnitt 2).
 *
 * <p><strong>Ohne Paginierung</strong>, aufsteigend nach createdAt: §6.1
 * fuehrt fuer diese Zeile keine, und ein Verlauf, den man von unten nach
 * oben liest, waere ein anderer Gegenstand als eine Trefferliste.
 *
 * <p><strong>Was in der Liste steht, entscheidet der Server.</strong> Eine
 * NOTE erscheint fuer die Projektseite gar nicht erst in der Antwort
 * (§6.1). Der Client filtert deshalb nichts nach: eine clientseitige
 * Filterung waere ueber die API auslesbar und damit keine (Skill
 * frontend-api, Abschnitt 8).
 *
 * <p>Der Key traegt nur die Projekt-ID. Der sichtbare Umfang haengt an der
 * angemeldeten Person, und die wechselt nicht innerhalb einer Sitzung, ohne
 * dass der Auth-Kontext den Cache ohnehin leert; dieselbe Ueberlegung wie
 * bei projectQueries.detail.
 */
export const commentQueries = {
  list: (projectId: string) =>
    queryOptions({
      queryKey: ["comments", projectId] as const,
      queryFn: () =>
        api.get<CommentResponse[]>(apiPaths.projects.comments(projectId)),
    }),
}

/**
 * POST /api/projects/{id}/comments (§6.1), ergibt <strong>201</strong>.
 *
 * <p>Welche Typen die anfragende Person anlegen darf, entscheidet der
 * Server (§5): REPLY schreibt die gesamte Projektseite samt Redaktion und
 * Administration, NOTE und CHANGE_REQUEST allein EDITOR und ADMIN. Die
 * Oberflaeche bietet deshalb nur an, was greift, und behandelt ein trotzdem
 * eintreffendes 403 sichtbar (Skill frontend-api, Abschnitt 8).
 *
 * <p>Ein CHANGE_REQUEST entsteht serverseitig mit Status OPEN; der Client
 * schickt keinen Stand mit.
 */
export function createComment(
  projectId: string,
  request: CommentCreateRequest
): Promise<CommentResponse> {
  return api.post<CommentResponse>(
    apiPaths.projects.comments(projectId),
    request
  )
}

/**
 * DELETE /api/comments/{id} (§6.1), ergibt <strong>204</strong> ohne
 * Koerper.
 *
 * <p><strong>Wer loeschen darf, entscheidet der Server</strong> (§6.1,
 * Zeile „Autor:in / ADMIN"): die verfassende Person ihren eigenen
 * Kommentar, die Administration jeden. Ausdruecklich nicht die Autor:in des
 * Projekts, nur weil der Kommentar an ihrem Projekt haengt; ein
 * Aenderungswunsch waere sonst wegklickbar, statt erledigt zu werden. Die
 * Oberflaeche bietet den Knopf deshalb nur dort an, wo er greift, und
 * behandelt ein trotzdem eintreffendes 403 sichtbar.
 */
export function deleteComment(commentId: string): Promise<void> {
  return api.delete<void>(apiPaths.comments.detail(commentId))
}

/**
 * PATCH /api/comments/{id}/status (§6.1, §2.4): den Stand eines
 * Aenderungswunsches umschalten.
 *
 * <p><strong>In beide Richtungen</strong>, und von jeder Person, die §5
 * dazu berechtigt: Projektseite, Redaktion und Administration. §2.4
 * begruendet den Rueckweg damit, dass die Redaktion ein zu frueh gesetztes
 * RESOLVED wieder oeffnen koennen muss, ohne dafuer einen neuen Kommentar
 * schreiben zu muessen. Ein Aufruf mit dem bereits gesetzten Wert ist
 * wirkungslos und kein Fehler.
 *
 * <p>Nur ein CHANGE_REQUEST traegt einen Stand; bei REPLY und NOTE
 * antwortet der Server mit 400 VALIDATION_FAILED (§6.1, Kommentare: ein
 * eigener Fehlercode ist dafuer bewusst nicht vergeben). Die Oberflaeche
 * zeigt den Umschalter deshalb ausschliesslich an einem Aenderungswunsch.
 */
export function setCommentStatus(
  commentId: string,
  status: CommentStatus
): Promise<CommentResponse> {
  return api.patch<CommentResponse>(apiPaths.comments.status(commentId), {
    status,
  })
}
