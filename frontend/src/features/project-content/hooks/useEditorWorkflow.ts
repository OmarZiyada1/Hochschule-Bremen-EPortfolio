import { useMutation, useQueryClient } from "@tanstack/react-query"

import { submitProject, withdrawProject } from "@/api/queries/projects"

/**
 * Die beiden Workflow-Aktionen der Editor-Kopfzeile: Einreichen und
 * Zurueckziehen (Contract 4.1).
 *
 * <p><strong>Ueber {@code useMutation} und nicht von Hand.</strong> Der
 * Skill {@code frontend-modul} verlangt es ("Lesen ueber useQuery, Schreiben
 * ueber useMutation"), und es hat einen greifbaren Grund: nur so wird der
 * Cache aufgeraeumt. Die eigene Projektliste unter „Mein Portfolio" haengt
 * am Schluessel {@code ["projects"]}; ohne Invalidierung stuende dort nach
 * dem Einreichen weiter „Entwurf", bis der Cache von selbst altert.
 *
 * <p><strong>Invalidiert wird ueber {@code onSettled}</strong>, nicht nur
 * bei Erfolg. Gerade der Fehlerfall heisst, dass die Ansicht einen
 * veralteten Status zeigt: ein 409
 * {@code PROJECT_STATUS_TRANSITION_INVALID} entsteht genau dann, wenn
 * jemand anders den Status schon geaendert hat. Dieselbe Ueberlegung wie in
 * {@code useProjectActions} (Befund aus dem Review zu KAN-69).
 *
 * <p><strong>Kein {@code retry}.</strong> Beide Aktionen sind
 * Statuswechsel; ein zweiter Versuch nach einem 409 traefe denselben
 * Zustand erneut, und nach einem 400 {@code PROJECT_INCOMPLETE} fehlten
 * weiterhin dieselben Felder. TanStack Query wiederholt Mutationen ohnehin
 * nicht von sich aus; die Angabe steht hier, damit es nicht von einer
 * kuenftigen Voreinstellung abhaengt.
 */

export function useSubmitProject(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => submitProject(projectId),
    retry: false,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  })
}

export function useWithdrawFromEditor(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => withdrawProject(projectId),
    retry: false,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  })
}
