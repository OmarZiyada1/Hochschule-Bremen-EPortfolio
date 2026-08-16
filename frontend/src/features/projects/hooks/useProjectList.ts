import { useQuery } from "@tanstack/react-query"

import {
  projectQueries,
  type ProjectListParams,
} from "@/api/queries/projects"

/**
 * Projektliste aus GET /projects. Pfad, Typ und Key liegen in der Fabrik
 * (Skill frontend-modul, Abschnitt 2); dieser Hook benennt nur die
 * Fachlichkeit fuer die Seite. Suche und Seite kommen aus der URL der
 * Bibliothek (KAN-31) und laufen unveraendert in den Query-Key.
 */
export function useProjectList(params: ProjectListParams = {}) {
  return useQuery(projectQueries.list(params))
}
