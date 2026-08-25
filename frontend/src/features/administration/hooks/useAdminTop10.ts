import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  acceptNomination,
  rejectNomination,
  setTop10Order,
  top10AdminQueries,
  top10Queries,
  type Top10AuditParams,
} from "@/api/queries/top10"
import type { NominationStatus } from "@/api/types"

/**
 * Die Query- und Mutation-Hooks der Top-10-Verwaltung (§3.11, §3.17, §6.1;
 * KAN-40). Sie kennen weder Pfade noch {@code api.*}: beides steht in den
 * Fabriken unter {@code src/api/queries/} (Skill frontend-modul, Abschnitt 2).
 *
 * <p><strong>Eine Aenderung trifft immer mehrere Listen.</strong> Wer eine
 * Nominierung annimmt, aendert deren Stand, belegt einen Platz <em>und</em>
 * schreibt eine Protokollzeile; wer die Reihenfolge speichert, schliesst
 * nebenbei offene Nominierungen ab (§3.11.1 Regel 5). Invalidiert wird
 * deshalb der ganze Ast {@code ["top10"]} und nicht eine Auswahl daraus:
 * eine Aufzaehlung einzelner Schluessel waere genau die Stelle, an der beim
 * naechsten Endpoint einer fehlt.
 */

/**
 * Der gemeinsame Praefix aller Top-10-Abfragen, aus der Fabrik gebildet
 * statt als Literal danebengeschrieben (Skill frontend-modul, Abschnitt 2).
 * Er trifft die oeffentliche Liste, die Nominierungen der Redaktion, den
 * Spiegel der Administration und das Protokoll.
 */
function top10Key() {
  return top10Queries.list().queryKey
}

/**
 * Die aktuell besetzten Plaetze aus {@code GET /api/top10}.
 *
 * <p>Es gibt bewusst keine eigene Admin-Sicht darauf: die Liste ist PUBLIC
 * und vollstaendig, und was die Verwaltung zusaetzlich braucht, ist keine
 * andere Antwort, sondern nur die Moeglichkeit zu schreiben.
 */
export function useTop10Entries() {
  return useQuery(top10Queries.list())
}

/**
 * Der vollstaendige Spiegel der Nominierungen (§6.1).
 *
 * @param status Ein Stand aus §2.8, oder {@code undefined} fuer alle vier.
 */
export function useAdminNominations(status: NominationStatus | undefined) {
  return useQuery(top10AdminQueries.nominations({ status }))
}

/**
 * Eine Seite des Aenderungsprotokolls (§3.17, §6.6).
 *
 * <p>{@code keepPreviousData} haelt die vorige Seite stehen, waehrend die
 * naechste laedt: ohne sie klappte die Liste beim Blaettern auf null Zeilen
 * zusammen und die Seite spraenge nach oben. Dieselbe Wahl wie in der
 * Projektbibliothek.
 */
export function useTop10Audit(params: Top10AuditParams) {
  return useQuery({
    ...top10AdminQueries.audit(params),
    placeholderData: keepPreviousData,
  })
}

/**
 * Eine Nominierung annehmen, POST
 * /api/admin/top10-nominations/{id}/accept (200).
 *
 * <p>Der Platz kommt aus dem Dialog und ist Pflicht; die vorgeschlagene
 * Stufe bindet ihn nicht (§2.13). Ein belegter Platz wird nicht geraeumt,
 * sondern ergibt 409 {@code RESOURCE_IN_USE}: die Auswahl bietet deshalb nur
 * freie Plaetze an und behandelt den Fehler trotzdem sichtbar, weil zwei
 * Personen gleichzeitig arbeiten koennen.
 */
export function useAcceptNomination() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (variables: { nominationId: string; position: number }) =>
      acceptNomination(variables.nominationId, variables.position),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: top10Key() })
    },
  })
}

/**
 * Eine Nominierung ablehnen, POST
 * /api/admin/top10-nominations/{id}/reject (200), ohne Koerper.
 *
 * <p>Ablehnen verlangt kein {@code PUBLISHED}: ein Vorschlag zu einem
 * inzwischen zurueckgezogenen Projekt laesst sich abraeumen, statt offen
 * stehen zu bleiben (§3.11.1).
 */
export function useRejectNomination() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (nominationId: string) => rejectNomination(nominationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: top10Key() })
    },
  })
}

/**
 * Die Reihenfolge speichern, PUT /api/admin/top10 (200).
 *
 * <p><strong>Ein Aufruf je ausdruecklicher Handlung, nicht je Klick.</strong>
 * Geschickt wird die vollstaendige, geordnete Liste; ein Klick auf „nach
 * oben" allein schickt nichts. Sonst entstuende je Klick ein Schreibvorgang
 * und je Schreibvorgang eine Protokollzeile (§3.17), und der Verlauf einer
 * einzigen Umsortierung waere zwanzig Zeilen lang.
 *
 * <p><strong>Kein zweiter Versuch.</strong> Ein 409
 * {@code PROJECT_NOT_PUBLISHED} und ein 400 {@code VALIDATION_FAILED} haetten
 * beim Wiederholen dieselbe Begruendung; TanStack Query wiederholt
 * Mutationen ohnehin nicht (Frontend-Regel 4).
 */
export function useSaveTop10Order() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (projectIds: string[]) => setTop10Order(projectIds),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: top10Key() })
    },
  })
}
