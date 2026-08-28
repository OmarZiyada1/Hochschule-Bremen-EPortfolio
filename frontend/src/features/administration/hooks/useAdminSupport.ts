import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"

import {
  deleteSupportRequest,
  supportQueries,
  supportRequestsKey,
  updateSupportRequestStatus,
  type SupportRequestListParams,
} from "@/api/queries/support"
import type { SupportRequestStatus } from "@/api/types"

/**
 * Die Query- und Mutation-Hooks der Support-Verwaltung (§6.1, §2.15; KAN-85).
 * Sie kennen weder Pfade noch {@code api.*}: beides steht in
 * {@code api/queries/support.ts} (Skill frontend-modul, Abschnitt 2).
 *
 * <p><strong>Jede Aenderung trifft mehr als die angezeigte Seite.</strong> Ein
 * Statuswechsel verschiebt die Zaehlung „N offen", ein Loeschen verschiebt
 * zusaetzlich die Seitengrenzen. Invalidiert wird deshalb der ganze Ast
 * {@code ["admin", "support"]} und nicht eine Auswahl daraus; den Key liefert
 * die Fabrik, er wird nie von Hand nachgebaut.
 */

/**
 * Die paginierte Liste (§6.6), mit den Filtern {@code status} und
 * {@code category}.
 *
 * <p>{@code keepPreviousData} haelt die vorige Seite stehen, waehrend die
 * naechste laedt: ohne das springt die Liste beim Blaettern und beim
 * Filterwechsel auf einen leeren Zustand und wieder zurueck, und der Fokus
 * verliert seinen Anker.
 */
export function useSupportRequests(params: SupportRequestListParams) {
  return useQuery({
    ...supportQueries.list(params),
    placeholderData: keepPreviousData,
  })
}

/**
 * Die Zaehlung „N offen" im Kopfbereich (§6.1).
 *
 * <p><strong>Ein eigener Aufruf und kein Feld der Antwort.</strong> Gezaehlt
 * werden alle offenen Anfragen, nicht die der angezeigten Seite; die Zahl aus
 * {@code content.length} zu bilden waere ab der zweiten Seite falsch. Der
 * Aufruf holt deshalb {@code status=OPEN} mit {@code size=1} und liest
 * {@code totalElements}. Ein Zusatzfeld in der Antwort haette ein Format neben
 * §6.6 erzeugt, entschieden in der Klaerungsrunde zu KAN-85.
 *
 * <p>Er teilt sich den Ast mit der Liste und wird deshalb von denselben
 * Mutationen mit invalidiert.
 */
export function useOpenSupportRequestCount() {
  return useQuery({
    ...supportQueries.list({ status: "OPEN", size: 1 }),
    select: (page) => page.totalElements,
  })
}

/**
 * Bearbeitungsstand setzen, {@code PATCH /api/admin/support/{id}} (200).
 *
 * <p>Ein nicht erlaubter Uebergang ergibt 409
 * {@code SUPPORT_STATUS_TRANSITION_INVALID} (§2.15). Die Oberflaeche bietet je
 * Stand nur die erlaubten Schaltflaechen an und behandelt den Fehler trotzdem
 * sichtbar: zwei Personen koennen gleichzeitig an derselben Liste arbeiten.
 */
export function useUpdateSupportRequestStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (variables: { id: string; status: SupportRequestStatus }) =>
      updateSupportRequestStatus(variables.id, variables.status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: supportRequestsKey() })
    },
  })
}

/**
 * Anfrage loeschen, {@code DELETE /api/admin/support/{id}} (204).
 *
 * <p>Endgueltig, ohne Archivzustand (§2.15); die Rueckfrage steht deshalb in
 * der Oberflaeche und nicht hier.
 */
export function useDeleteSupportRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteSupportRequest(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: supportRequestsKey() })
    },
  })
}
