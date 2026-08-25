import { queryOptions } from "@tanstack/react-query"

import { api } from "@/api/client"
import { apiPaths } from "@/api/endpoints"
import type { PageResponse } from "@/api/page"
import type {
  NominationStatus,
  NominationTier,
  Top10AuditEntryResponse,
  Top10EntryResponse,
  Top10NominationResponse,
} from "@/api/types"

/**
 * queryOptions-Fabrik der Ressource Top-10 (§3.11, §6.1): GET /api/top10
 * ist PUBLIC und liefert eine blanke, geordnete Liste ohne PageResponse mit
 * hoechstens zehn Eintraegen, ausschliesslich zu veroeffentlichten
 * Projekten (§3.11.1).
 *
 * position ist der Platz zwischen 1 und 10 und nicht der Index im Array:
 * unbesetzte Plaetze fehlen in der Antwort, die Darstellung legt zehn
 * Plaetze an und fuellt sie ueber position (Ticket KAN-31).
 */
export const top10Queries = {
  list: () =>
    queryOptions({
      queryKey: ["top10"] as const,
      queryFn: () => api.get<Top10EntryResponse[]>(apiPaths.top10.list),
    }),

  /**
   * Die eigenen Nominierungen der Redaktion (§6.1, seit Contract v68,
   * KAN-37), neueste zuerst und ohne Paginierung.
   *
   * <p><strong>nominatedBy=me ist fest verdrahtet</strong> und kein
   * Parameter dieser Fabrik: der Wert ist der Zuschnitt der Ressource, und
   * der Server laesst ohnehin keinen anderen zu (400 VALIDATION_FAILED).
   * Den vollstaendigen Spiegel fuehrt GET /api/admin/top10-nominations; er
   * steht seit KAN-40 als eigene Fabrik in {@link top10AdminQueries}.
   *
   * <p>Der optionale Filter status grenzt auf einen Stand ein (§2.8) und
   * steht deshalb im Key: sonst zeigte ein Wechsel das Ergebnis des vorigen
   * Filters.
   */
  nominations: (params: { status?: NominationStatus } = {}) =>
    queryOptions({
      queryKey: ["top10", "nominations", params] as const,
      queryFn: () =>
        api.get<Top10NominationResponse[]>(apiPaths.top10.nominations, {
          query: { nominatedBy: "me", status: params.status },
        }),
    }),
}

/**
 * POST /top10-nominations/{id}/withdraw (§3.11.1, §6.1, seit Contract v70),
 * ohne Koerper, ergibt <strong>200</strong> mit der zurueckgezogenen
 * Nominierung.
 *
 * <p><strong>Zwei Reichweiten, ein Aufruf.</strong> Die nominierende Person
 * zieht ihren eigenen Vorschlag zurueck, solange er PENDING ist; die
 * Administration jeden, auch einen bereits angenommenen. Welcher Fall
 * vorliegt, entscheidet der Server; die Oberflaeche blendet die Handlung nur
 * dort ein, wo sie nach demselben Massstab greifen kann (siehe
 * nominationWithdrawable).
 *
 * <p>Sichtbar zu behandeln ist ein 409 NOMINATION_ALREADY_DECIDED: der Stand
 * hat sich seit dem letzten Laden geaendert. Kein zweiter Versuch, er
 * scheiterte mit derselben Begruendung.
 */
export function withdrawNomination(
  nominationId: string
): Promise<Top10NominationResponse> {
  return api.post<Top10NominationResponse>(
    apiPaths.top10.withdrawNomination(nominationId)
  )
}

/**
 * POST /projects/{id}/top10-nomination (§3.11.1, §6.1), ergibt
 * <strong>201</strong>.
 *
 * <p><strong>Der Koerper traegt seit Contract v68 die Stufe</strong> und
 * keinen Platz mehr (§2.13): wer nominiert, kennt die uebrige Liste nicht,
 * und ueber den Platz entscheidet die Administration beim Annehmen. Die
 * Stufe bindet sie dabei nicht.
 *
 * <p>Sichtbar zu behandeln sind zwei 409er, beide ohne zweiten Versuch:
 * PROJECT_NOT_PUBLISHED, wenn das Projekt den Status inzwischen verlassen
 * hat, und RESOURCE_IN_USE, wenn es bereits in der Top-10 steht oder schon
 * eine offene Nominierung traegt (§3.11.1).
 */
export function nominateProject(
  projectId: string,
  proposedTier: NominationTier
): Promise<Top10NominationResponse> {
  return api.post<Top10NominationResponse>(
    apiPaths.projects.top10Nomination(projectId),
    { proposedTier }
  )
}

/**
 * Die Parameter der Protokollseite (§6.1, §6.6). Alle optional; was fehlt,
 * schraenkt nicht ein.
 *
 * <p><strong>from und to sind Zeitpunkte, keine Tage</strong> (§1): ISO-8601
 * in UTC, etwa {@code 2026-08-01T00:00:00Z}, und beide Grenzen sind
 * eingeschlossen. Der Server legt keine Zeitzone fest; die Tagesgrenzen
 * eines gewaehlten Datums bildet die Oberflaeche in der Zeitzone der
 * lesenden Person.
 *
 * <p>page ist 0-basiert wie im Seitenformat. Die Adresse zaehlt ab 1,
 * umgerechnet wird beim Zusammenbauen der Parameter: der Typ beschreibt den
 * Request und nicht die Oberflaeche.
 */
export interface Top10AuditParams {
  from?: string
  to?: string
  admin?: string
  page?: number
}

/**
 * queryOptions-Fabriken der Top-10-Verwaltung (§6.1, Abschnitt
 * „Administration (ADMIN)", KAN-40).
 *
 * <p><strong>Hier und nicht in admin.ts</strong>, obwohl beide Endpoints
 * unter {@code /api/admin/} liegen: der Zuschnitt ist die Ressource, und die
 * Ressource ist die Top-10. Die Fabriken teilen sich mit den oeffentlichen
 * den Schluesselpraefix {@code ["top10"]}, und das ist der eigentliche
 * Grund. Jede Aenderung an der Kuratierung verschiebt mehrere dieser Listen
 * zugleich: eine angenommene Nominierung aendert den Stand des Vorschlags,
 * belegt einen Platz <em>und</em> schreibt eine Protokollzeile. Mit einem
 * gemeinsamen Praefix laedt ein einziges {@code invalidateQueries} alle drei
 * nach, statt drei Schluessel von Hand aufzuzaehlen und beim vierten einen
 * zu vergessen.
 */
export const top10AdminQueries = {
  /**
   * Der vollstaendige Spiegel der Nominierungen (§6.1), neueste zuerst.
   *
   * <p><strong>Eine blanke Liste, kein PageResponse.</strong> Der Endpoint
   * paginiert nicht; die Zahl der Vorschlaege ist durch §3.11.1 Regel 2
   * ohnehin begrenzt, weil je Projekt hoechstens einer offen sein kann.
   *
   * <p>Der Filter steht im Schluessel: sonst zeigte ein Wechsel das Ergebnis
   * des vorigen Filters. Ohne ihn liefert der Server alle vier Staende aus
   * §2.8, einschliesslich WITHDRAWN.
   */
  nominations: (params: { status?: NominationStatus } = {}) =>
    queryOptions({
      queryKey: ["top10", "admin", "nominations", params] as const,
      queryFn: () =>
        api.get<Top10NominationResponse[]>(apiPaths.admin.top10Nominations, {
          query: { status: params.status },
        }),
    }),

  /**
   * Das Aenderungsprotokoll (§3.17, §6.6), paginiert.
   *
   * <p><strong>Ohne sort bleibt es beim Serverstandard</strong>, also
   * {@code timestamp,desc} (§6.6). Die Oberflaeche bietet keine Sortierung
   * an und schickt deshalb auch keine: sortierbar waere ohnehin allein
   * {@code timestamp}, jedes andere Feld ergaebe 400 VALIDATION_FAILED.
   *
   * <p>Alle Zeilen eines {@code PUT /admin/top10} tragen denselben
   * Zeitpunkt (§3.17); den Gleichstand bricht serverseitig {@code id,asc},
   * damit beim Blaettern keine Zeile doppelt und keine gar nicht erscheint.
   */
  audit: (params: Top10AuditParams = {}) =>
    queryOptions({
      queryKey: ["top10", "admin", "audit", params] as const,
      queryFn: () =>
        api.get<PageResponse<Top10AuditEntryResponse>>(
          apiPaths.admin.top10Audit,
          {
            query: {
              from: params.from,
              to: params.to,
              admin: params.admin,
              page: params.page,
            },
          }
        ),
    }),
}

/**
 * POST /api/admin/top10-nominations/{id}/accept (§3.11.1, §6.1), ergibt
 * <strong>200</strong> mit der entschiedenen Nominierung.
 *
 * <p><strong>Der Platz kommt aus dem Koerper und nirgendwo sonst.</strong>
 * Die vorgeschlagene Stufe (§2.13) bereitet die Entscheidung vor, bindet sie
 * aber nicht: der Server prueft nicht, ob der vergebene Platz in den Bereich
 * der Stufe faellt. Nebenbei schreibt der Aufruf den Platz in
 * {@code proposedPosition} der Nominierung (seit Contract v69).
 *
 * <p>Sichtbar zu behandeln, jeweils ohne zweiten Versuch: 409
 * {@code RESOURCE_IN_USE}, wenn der Platz belegt ist (er wird nicht
 * geraeumt), 409 {@code PROJECT_NOT_PUBLISHED}, wenn das Projekt den Status
 * verlassen hat, und 409 {@code NOMINATION_ALREADY_DECIDED} bei einem
 * zweiten Klick oder einem zweiten Tab.
 */
export function acceptNomination(
  nominationId: string,
  position: number
): Promise<Top10NominationResponse> {
  return api.post<Top10NominationResponse>(
    apiPaths.admin.top10NominationAccept(nominationId),
    { position }
  )
}

/**
 * POST /api/admin/top10-nominations/{id}/reject (§3.11.1, §6.1), ohne
 * Koerper, ergibt <strong>200</strong>.
 *
 * <p>Ablehnen verlangt kein {@code PUBLISHED}: nur die Aufnahme tut das. Ein
 * Vorschlag zu einem inzwischen zurueckgezogenen Projekt laesst sich also
 * abraeumen, statt offen stehen zu bleiben. Der einzige sichtbar zu
 * behandelnde Fehler ist 409 {@code NOMINATION_ALREADY_DECIDED}.
 */
export function rejectNomination(
  nominationId: string
): Promise<Top10NominationResponse> {
  return api.post<Top10NominationResponse>(
    apiPaths.admin.top10NominationReject(nominationId)
  )
}

/**
 * PUT /api/admin/top10 (§3.11.1 Regel 3, §6.1), ergibt <strong>200</strong>
 * mit der neuen Liste.
 *
 * <p><strong>Der Array-Index ist der Platz.</strong> Das erste Element steht
 * auf Platz 1; einen eigenen position-Parameter gibt es bewusst nicht, weil
 * Reihenfolge und ausdrueckliche Platzangabe einander widersprechen
 * koennten.
 *
 * <p><strong>{@code null} heisst „Platz frei"</strong> (seit Contract v78,
 * KAN-40). {@code [A, null, C]} setzt A auf 1 und C auf 3 und laesst 2
 * unbesetzt; eine Liste ohne {@code null} nummeriert der Server weiterhin
 * lueckenlos ab 1 durch. Damit laesst sich ein Projekt aus der Liste nehmen,
 * ohne die darunterliegenden mitzuziehen, und genau das war bis v77 nicht
 * moeglich. Nachlaufende {@code null} schneidet der Server ab; die
 * Oberflaeche tut es schon vorher ({@code placementPayload}).
 *
 * <p><strong>Der Aufruf ersetzt.</strong> Was nicht genannt ist, faellt
 * heraus; eine leere Liste leert die Top-10.
 *
 * <p><strong>Er schliesst offene Nominierungen ab.</strong> Nimmt die
 * Administration ein Projekt unmittelbar auf, gehen dessen PENDING-Vorschlaege
 * auf ACCEPTED, allerdings ohne {@code proposedPosition}. Die
 * Nominierungsliste ist danach also neu zu laden.
 *
 * <p>Sichtbar zu behandeln: 400 {@code VALIDATION_FAILED} bei mehr als zehn
 * Eintraegen, einem doppelt genannten Projekt, einer unbekannten ID oder
 * einem nicht veroeffentlichten Projekt, und 409
 * {@code PROJECT_NOT_PUBLISHED}, wenn ein genanntes Projekt PUBLISHED
 * inzwischen verlassen hat.
 */
export function setTop10Order(
  projectIds: readonly (string | null)[]
): Promise<Top10EntryResponse[]> {
  return api.put<Top10EntryResponse[]>(apiPaths.admin.top10, { projectIds })
}
