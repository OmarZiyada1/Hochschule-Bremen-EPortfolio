import { useQuery } from "@tanstack/react-query"

import { projectQueries } from "@/api/queries/projects"

/**
 * Projektliste aus GET /projects. Pfad, Typ und Key liegen in der Fabrik
 * (Skill frontend-modul, Abschnitt 2); dieser Hook benennt nur die
 * Fachlichkeit fuer die Seite.
 */
export function useProjectList() {
  return useQuery(projectQueries.list())
}
