import { queryOptions } from "@tanstack/react-query"

import { api } from "@/api/client"
import { apiPaths } from "@/api/endpoints"
import type { PageResponse } from "@/api/page"
import type {
  SupportRequestCategory,
  SupportRequestCreateRequest,
  SupportRequestResponse,
  SupportRequestStatus,
} from "@/api/types"

/**
 * Pfad, Response-Typ und Query-Key des Support-Moduls an genau einer Stelle
 * (§6.1, Abschnitt „Support", KAN-85). Die Hooks daneben kennen weder Pfade
 * noch {@code api.*} (Skill frontend-modul, Abschnitt 2).
 *
 * <p><strong>Eine Datei fuer beide Seiten der Ressource.</strong> Das
 * oeffentliche Absenden und die Verwaltung teilen sich dieselbe Zeile in der
 * Datenbank; sie zu trennen hiesse, denselben Typ zweimal zu fuehren. Der
 * Zugriff unterscheidet sich trotzdem: {@link submitSupportRequest} laeuft
 * ohne Token, alles Uebrige verlangt ADMIN (§5).
 */

/**
 * Die Parameter der Anfragenliste (§6.1, §6.6). Alle optional; was fehlt,
 * schraenkt nicht ein.
 *
 * <p><strong>Kein {@code sort}.</strong> Der Endpoint kennt keinen: die
 * Reihenfolge ist fest {@code createdAt} absteigend, weil ein Eingangsbuch von
 * hinten gelesen wird (§6.6). Ein mitgeschickter Wert wuerde verworfen, und ein
 * Feld hier waere die Zusage einer Wahl, die es nicht gibt.
 *
 * <p>{@code page} ist 0-basiert wie im Seitenformat; die Adresse der Seite
 * zaehlt ab 1 und wird beim Zusammenbauen umgerechnet, nicht hier.
 */
export interface SupportRequestListParams {
  status?: SupportRequestStatus
  category?: SupportRequestCategory
  page?: number
  size?: number
}

export const supportQueries = {
  /**
   * Die paginierte Liste der Administration (§6.6).
   *
   * <p>Der Key traegt alle Parameter: ohne sie zeigte die Liste nach einem
   * Filterwechsel das Ergebnis des vorigen Filters.
   *
   * <p><strong>Dieselbe Fabrik traegt die Zaehlung „N offen".</strong> Sie ist
   * kein eigener Endpoint und keine Kennzahl des Dashboards, sondern derselbe
   * Aufruf mit {@code status: "OPEN"} und {@code size: 1}, aus dem der Client
   * {@code totalElements} liest (§6.1). Ein eigenes Feld in der Antwort haette
   * ein Format neben §6.6 erzeugt; entschieden in der Klaerungsrunde zu
   * KAN-85.
   */
  list: (params: SupportRequestListParams = {}) =>
    queryOptions({
      queryKey: ["admin", "support", params] as const,
      queryFn: () =>
        api.get<PageResponse<SupportRequestResponse>>(
          apiPaths.admin.supportRequests,
          {
            query: {
              status: params.status,
              category: params.category,
              page: params.page,
              size: params.size,
            },
          }
        ),
    }),
}

/**
 * Der Query-Key des ganzen Astes, fuer das Invalidieren nach einer Aenderung.
 *
 * <p>Eine Aenderung trifft immer mindestens zwei Abfragen: die angezeigte Seite
 * und die Zaehlung „N offen". Invalidiert wird deshalb der Ast und nicht eine
 * Auswahl daraus; eine Aufzaehlung der betroffenen Keys waere beim naechsten
 * Filter unvollstaendig.
 */
export function supportRequestsKey() {
  return ["admin", "support"] as const
}

/**
 * {@code POST /api/support} (§6.1): das oeffentliche Kontaktformular.
 *
 * <p><strong>201 ohne Koerper</strong>, deshalb {@code Promise<void>}. Die
 * absendende Person hat auf ihre eigene Anfrage keinen lesenden Zugriff (§5);
 * eine Kennung in der Antwort waere eine Adresse ohne Ressource.
 *
 * <p><strong>Der Aufruf laeuft ohne Token, traegt aber eines mit, wenn eines
 * da ist.</strong> Das entscheidet der zentrale Client von selbst; hier ist
 * nichts zu tun. Der Server vermerkt das Konto dann in
 * {@code submittedByUserId} (§3.20), belaesst {@code name} und {@code email}
 * aber bei den Werten aus dem Formular.
 *
 * <p>Das Feld {@code website} gehoert zum Koerper und wird immer mitgeschickt,
 * leer. Es ist die Falle gegen automatisierte Einsendungen (§6.1); ein
 * Weglassen an dieser Stelle machte sie wirkungslos, weil ein Programm den
 * Koerper ohnehin selbst zusammensetzt und das Formular es dann als einziges
 * Feld nicht traegt.
 */
export function submitSupportRequest(
  request: SupportRequestCreateRequest
): Promise<void> {
  return api.post<void>(apiPaths.support.submit, request)
}

/**
 * {@code PATCH /api/admin/support/{id}} (§6.1, §2.15): setzt den
 * Bearbeitungsstand und antwortet mit der geaenderten Anfrage.
 *
 * <p>Ein nicht erlaubter Uebergang ergibt <strong>409</strong>
 * {@code SUPPORT_STATUS_TRANSITION_INVALID}, und dazu zaehlt auch der Wechsel
 * auf den bereits stehenden Wert. Die Oberflaeche bietet je Stand nur die
 * erlaubten Schaltflaechen an; behandelt wird der Fehler trotzdem, weil zwei
 * Personen gleichzeitig arbeiten koennen.
 */
export function updateSupportRequestStatus(
  supportRequestId: string,
  status: SupportRequestStatus
): Promise<SupportRequestResponse> {
  return api.patch<SupportRequestResponse>(
    apiPaths.admin.supportRequest(supportRequestId),
    { status }
  )
}

/**
 * {@code DELETE /api/admin/support/{id}} (§6.1): entfernt die Anfrage
 * endgueltig, Antwort 204.
 *
 * <p>Kein Soft-Delete und kein Archivzustand: {@code RESOLVED} ist der
 * Abschluss, geloescht wird, was gar nicht bleiben soll (§2.15). Deshalb fragt
 * die Oberflaeche vorher nach.
 */
export function deleteSupportRequest(supportRequestId: string): Promise<void> {
  return api.delete<void>(apiPaths.admin.supportRequest(supportRequestId))
}
