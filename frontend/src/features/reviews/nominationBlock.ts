import type { ProjectStatus } from "@/api/types"

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
 *
 * <p><strong>Sie nimmt zwei Felder der Antwort und nicht die ganze
 * Kachel</strong> (seit KAN-87). Nominiert wird inzwischen aus drei
 * Ansichten, und zwei davon halten eine {@code ProjectDetailResponse} statt
 * einer {@code ProjectCardResponse}; eine Ueberladung fuer beide
 * Antworttypen waere derselbe Code zweimal.
 *
 * <p><strong>{@code hasOpenNomination} kommt seit Contract v90 vom
 * Server</strong> (§3.11). Es ist {@code true}, sobald zu diesem Projekt ein
 * Vorschlag offen ist, gleich von wem: §3.11.1 Regel 2 gilt je Projekt und
 * nicht je Person. {@code null} heisst „darf ich nicht sehen" und sperrt
 * deshalb nicht; ein Bedienelement zum Nominieren gibt es fuer diese Rollen
 * ohnehin nicht.
 */
export function nominationBlockReason(
  project: { status: ProjectStatus; hasOpenNomination?: boolean | null },
  inTop10: boolean
): "notPublished" | "inTop10" | "nominated" | null {
  if (project.status !== "PUBLISHED") {
    return "notPublished"
  }
  if (inTop10) {
    return "inTop10"
  }
  if (project.hasOpenNomination === true) {
    return "nominated"
  }
  return null
}
