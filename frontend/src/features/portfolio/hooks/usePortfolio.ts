import { useQuery } from "@tanstack/react-query"

import { portfolioQueries } from "@/api/queries/portfolio"
import {
  projectQueries,
  type OwnProjectListParams,
} from "@/api/queries/projects"

/**
 * Lesende Hooks der drei Portfolio-Ansichten (KAN-34). Pfad, Typ und Key
 * liegen in den Fabriken unter api/queries (Skill frontend-modul,
 * Abschnitt 2); diese Hooks benennen nur die Fachlichkeit.
 */

/**
 * Das eigene Profil. Fehlt die Portfolio-Zeile, ist die Antwort 200 mit
 * leeren Feldern (§3.2.1): kein Fehlerfall, den die Ansicht behandeln
 * muesste.
 *
 * enabled bleibt dem Aufrufer ueberlassen, weil der Anwendungsrahmen die
 * Abfrage fuer den Avatar in der Kopfleiste braucht und dort auch nicht
 * angemeldete Personen vorbeikommen; ohne Token ergaebe der Aufruf 401.
 */
export function useOwnPortfolio(enabled = true) {
  return useQuery({ ...portfolioQueries.me(), enabled })
}

/**
 * Das oeffentliche Profil einer Person. Eine unbekannte ID ergibt 404
 * RESOURCE_NOT_FOUND, und genau das zeigt die Seite auch an.
 */
export function usePublicPortfolio(userId: string) {
  return useQuery(portfolioQueries.publicProfile(userId))
}

/**
 * Die eigenen Projekte, gefiltert ueber author und optional status.
 *
 * enabled bleibt der Seite ueberlassen: unter "My Portfolio" fragt ein
 * Admin-Konto die Liste gar nicht erst ab, weil §5 (Fussnote 10) ihm keine
 * eigenen Projekte zugesteht und das Template dort keine Liste fuehrt.
 */
export function useOwnProjects(params: OwnProjectListParams, enabled = true) {
  return useQuery({ ...projectQueries.mine(params), enabled })
}
