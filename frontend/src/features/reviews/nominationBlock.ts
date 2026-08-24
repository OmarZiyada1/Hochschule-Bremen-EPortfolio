import type { ProjectCardResponse } from "@/api/types"

/**
 * Der Grund, aus dem eine Nominierung gerade nicht geht, oder {@code null},
 * wenn sie geht (§3.11.1; KAN-37).
 *
 * <p>Eine reine Funktion neben dem Zeilenmenue, damit sie ohne Rendern
 * pruefbar ist (Skill frontend-modul, Abschnitt 3) und damit die
 * Komponentendatei ausschliesslich Komponenten ausfuehrt (Lint
 * react-refresh/only-export-components).
 *
 * <p>Sie bildet §3.11.1 ab und ersetzt es nicht: verbindlich bleibt der
 * Server, der dieselben Faelle mit 409 {@code PROJECT_NOT_PUBLISHED}
 * beziehungsweise 409 {@code RESOURCE_IN_USE} beantwortet. Die Oberflaeche
 * kennt nur den Stand des letzten Ladevorgangs.
 */
export function nominationBlockReason(
  project: ProjectCardResponse,
  inTop10: boolean,
  alreadyNominated: boolean
): "notPublished" | "inTop10" | "nominated" | null {
  if (project.status !== "PUBLISHED") {
    return "notPublished"
  }
  if (inTop10) {
    return "inTop10"
  }
  if (alreadyNominated) {
    return "nominated"
  }
  return null
}
