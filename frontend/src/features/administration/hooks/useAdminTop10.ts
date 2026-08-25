import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  acceptNomination,
  rejectNomination,
  setTop10Order,
  top10AdminQueries,
  top10Queries,
  type Top10AuditParams,
} from "@/api/queries/top10"
import type { NominationStatus, Top10EntryResponse } from "@/api/types"
import {
  placementPayload,
  type Top10Slots,
} from "@/features/administration/top10Slots"

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
 * Die Belegung der zehn Plaetze speichern, PUT /api/admin/top10 (200).
 *
 * <p><strong>Jede Handlung speichert sofort.</strong> Es gibt keinen Knopf
 * „Reihenfolge speichern" mehr: Verschieben, Aufnehmen und Entfernen wirken
 * unmittelbar, wie jede andere Verwaltungshandlung des Portals. Der frueher
 * noetige Sammelschritt kam allein daher, dass eine Luecke sich nicht ablegen
 * liess; seit Contract v78 laesst sie sich (Entscheidung zur Nacharbeit an
 * KAN-40).
 *
 * <p><strong>Die Anzeige laeuft dem Server voraus.</strong> Der Zug ist
 * sofort zu sehen, weil {@code onMutate} den vorhergesagten Stand in den
 * Cache legt; scheitert der Aufruf, kommt der vorherige Stand zurueck. Ohne
 * das flackerte die Liste bei jedem Klick durch einen Ladezustand, und ein
 * zweiter Klick traefe eine Liste, die noch die alte Reihenfolge zeigt.
 *
 * <p><strong>Vorhergesagt wird nur, was schon bekannt ist.</strong> Ein eben
 * hinzugefuegtes Projekt hat noch kein {@code addedAt}; einen Zeitpunkt zu
 * erfinden hiesse, eine Angabe zu behaupten, die der Server erst vergibt.
 * In diesem Fall unterbleibt die Vorhersage und die Liste laedt kurz nach.
 *
 * <p><strong>Kein zweiter Versuch.</strong> Ein 409
 * {@code PROJECT_NOT_PUBLISHED} und ein 400 {@code VALIDATION_FAILED} haetten
 * beim Wiederholen dieselbe Begruendung; TanStack Query wiederholt
 * Mutationen ohnehin nicht (Frontend-Regel 4).
 */
export function useSaveTop10Order() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (slots: Top10Slots) => setTop10Order(placementPayload(slots)),

    onMutate: async (slots) => {
      /* Laufende Abfragen abbrechen, sonst ueberschreibt eine Antwort, die
         vor dem Klick losgeschickt wurde, den vorhergesagten Stand wieder. */
      await queryClient.cancelQueries({ queryKey: top10Key() })
      const previous = queryClient.getQueryData<Top10EntryResponse[]>(
        top10Key()
      )

      const predicted = predictEntries(slots)
      if (predicted !== null) {
        queryClient.setQueryData(top10Key(), predicted)
      }
      return { previous }
    },

    onError: (_error, _slots, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(top10Key(), context.previous)
      }
    },

    /* Immer nachladen, auch nach einem Erfolg: der Server entscheidet ueber
       die Plaetze, und mit dem Speichern gehen ausserdem offene
       Nominierungen auf ACCEPTED (§3.11.1 Regel 5) und das Protokoll bekommt
       neue Zeilen. */
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: top10Key() })
    },
  })
}

/**
 * Der Stand, den {@code PUT /admin/top10} fuer diese Belegung liefern wird,
 * oder {@code null}, wenn er sich nicht ohne Erfindung bilden laesst.
 *
 * <p>Der Platz ist der Index der Zelle (§3.11.1 Regel 3, seit v78), der
 * Aufnahmezeitpunkt bleibt der des vorhandenen Eintrags: eine Umsortierung
 * ist keine Aufnahme, und ein mitwanderndes {@code addedAt} hiesse faktisch
 * „zuletzt umsortiert am" (§3.11).
 */
function predictEntries(slots: Top10Slots): Top10EntryResponse[] | null {
  const predicted: Top10EntryResponse[] = []
  for (const [index, slot] of slots.entries()) {
    if (slot === null) {
      continue
    }
    if (slot.addedAt === null) {
      return null
    }
    predicted.push({
      position: index + 1,
      addedAt: slot.addedAt,
      project: slot.project,
    })
  }
  return predicted
}
