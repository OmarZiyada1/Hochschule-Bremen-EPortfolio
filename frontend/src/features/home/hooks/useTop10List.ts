import { useQuery } from "@tanstack/react-query"

import { top10Queries } from "@/api/queries/top10"

/**
 * Kuratierte Top-10 der Startseite aus GET /top10 (§3.11, §6.1). Die
 * Antwort traegt nur besetzte Plaetze; das Auffuellen auf zehn Plaetze ist
 * Sache der Seite, nicht des Hooks.
 */
export function useTop10List() {
  return useQuery(top10Queries.list())
}
