import { useMutation, useQueryClient } from "@tanstack/react-query"

import { deleteProject, withdrawProject } from "@/api/queries/projects"

/**
 * Die beiden Kartenaktionen unter "My Portfolio" (KAN-69): Zurueckziehen
 * (§4.1, seit Contract v50) und Loeschen im Entwurf (§6.1). Die
 * Mutationsfunktionen kommen aus der Fabrik api/queries/projects.ts.
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
