import { queryOptions } from "@tanstack/react-query"

import { api } from "@/api/client"
import { apiPaths } from "@/api/endpoints"
import type {
  DashboardResponse,
  ProjectBulkStatusRequest,
  ProjectBulkStatusResponse,
} from "@/api/types"

/**
 * queryOptions-Fabrik der Administrationsseite (§6.1, Abschnitt
 * „Administration (ADMIN)", KAN-38): Pfad, Response-Typ und Query-Key stehen
 * hier an genau einer Stelle, die Pfade selbst in api/endpoints.ts.
 *
 * <p>Eine eigene Datei neben projects.ts, obwohl beide Ansichten der
 * Administrationsseite Projekte zeigen: der Zuschnitt ist die Ressource.
 * {@code /api/admin/**} ist ein geschlossener Bereich der Filterkette (§5),
 * und die Projektverwaltung liest bewusst dieselbe Projektliste wie alle
 * anderen, nur ohne festen Statusfilter. Sie steht deshalb weiter unter
 * {@code projectQueries}, hier steht allein, was es nur fuer ADMIN gibt.
 */
export const adminQueries = {
  /**
   * Die Kennzahlen der Startansicht (§6.1).
   *
   * <p><strong>Bestandsgroessen, kein Verlauf.</strong> Alle Zahlen gelten
   * zum Zeitpunkt des Aufrufs; §6.1 sieht keine Zeitreihe vor, eine Kachel
   * mit Trendpfeil haette also keine Datenquelle.
   *
   * <p><strong>Jede Aufschluesselung ist vollstaendig.</strong> Der Server
   * fuellt fehlende Enum-Werte mit 0 auf (Contract v26), und seit v76 gilt
   * dasselbe fuer die Fakultaeten. Die Oberflaeche fuehrt die Wertelisten
   * aus §2 deshalb nicht ein zweites Mal und deutet einen fehlenden
   * Schluessel nicht als Null: er waere ein Fehler.
   *
   * <p>Der Key traegt keine Parameter, weil der Endpoint keine kennt.
   */
  dashboard: () =>
    queryOptions({
      queryKey: ["admin", "dashboard"] as const,
      queryFn: () => api.get<DashboardResponse>(apiPaths.admin.dashboard),
    }),
}

/**
 * POST /api/admin/projects/status (§6.1, seit Contract v17, Koerper seit
 * v32): fuehrt fuer jedes Projekt der Auswahl denselben Uebergang aus.
 *
 * <p><strong>Die Antwort ist 200 mit einer Ergebnisliste, kein
 * Sammelerfolg.</strong> Je angefragter ID steht genau eine Zeile darin, in
 * der Reihenfolge des Bodys; ein Projekt, das nach §4.1 gerade nicht
 * uebergehen darf, traegt seinen Fehlercode in seiner Zeile und blockiert
 * die uebrigen nicht. Die Oberflaeche stellt genau diese Liste dar, statt
 * einen Gesamterfolg zu behaupten.
 *
 * <p><strong>reason ist an die Aktion gebunden.</strong> Pflicht bei
 * {@code request-revision}, weil der Text je Projekt ein eigener
 * CHANGE_REQUEST-Kommentar wird und die Autor:in sonst ohne Arbeitsauftrag
 * bliebe; bei {@code publish} unzulaessig und nicht bloss wirkungslos. Ein
 * Verstoss ergibt <strong>400</strong> {@code VALIDATION_FAILED} fuer die
 * ganze Anfrage und keine Ergebnisliste. Das zod-Schema des Dialogs prueft
 * dieselbe Bedingung vorab; verbindlich bleibt der Server.
 */
export function changeProjectStatusInBulk(
  request: ProjectBulkStatusRequest
): Promise<ProjectBulkStatusResponse> {
  return api.post<ProjectBulkStatusResponse>(apiPaths.admin.bulkStatus, request)
}
