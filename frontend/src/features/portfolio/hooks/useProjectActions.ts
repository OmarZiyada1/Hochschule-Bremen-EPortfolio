import { useMutation, useQueryClient } from "@tanstack/react-query"

import {
  deleteProject,
  leaveProject,
  withdrawProject,
} from "@/api/queries/projects"

/**
 * Die Kartenaktionen unter „Mein Portfolio": Zurueckziehen (§4.1, seit
 * Contract v50), Loeschen im Entwurf (§6.1) und seit KAN-83 das Verlassen
 * eines fremden Projekts, an dem man nur Mitglied ist (§3.13.1, seit
 * Contract v84). Die Mutationsfunktionen kommen aus der Fabrik
 * api/queries/projects.ts.
 *
 * Beide Aktionen aendern den Bestand der eigenen Projektliste, deshalb wird
 * der gesamte "projects"-Ast invalidiert: das trifft die Liste jeder
 * Statusauswahl ("mine" mit jedem params-Wert) und die Bibliothek gleich
 * mit, statt die Keys einzeln nachzubauen.
 *
 * Invalidiert wird ueber onSettled und nicht nur bei Erfolg: gerade der
 * Fehlerfall (409, weil die Redaktion schneller entschieden hat) heisst,
 * dass die Karte einen veralteten Status zeigt. Nach dem Neuladen steht
 * dort der echte Zustand samt der dann passenden Handlung (Befund aus dem
 * Review zu KAN-69).
 */

export function useWithdrawProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: withdrawProject,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteProject,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  })
}

/**
 * Die eigene Projektmitgliedschaft beenden (§3.13.1, seit Contract v84).
 *
 * <p>Derselbe Ast wird invalidiert wie bei den anderen beiden: das Projekt
 * faellt aus „Mein Portfolio" heraus, und aus der Bibliothek verschwindet es
 * ebenfalls, sofern es nicht veroeffentlicht ist.
 */
export function useLeaveProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: leaveProject,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  })
}
