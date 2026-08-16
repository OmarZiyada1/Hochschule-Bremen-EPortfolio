import { queryOptions } from "@tanstack/react-query"

import { api } from "@/api/client"
import { apiPaths } from "@/api/endpoints"
import type { Top10EntryResponse } from "@/api/types"

/**
 * queryOptions-Fabrik der Ressource Top-10 (§3.11, §6.1): GET /api/top10
 * ist PUBLIC und liefert eine blanke, geordnete Liste ohne PageResponse mit
 * hoechstens zehn Eintraegen, ausschliesslich zu veroeffentlichten
 * Projekten (§3.11.1).
 *
 * position ist der Platz zwischen 1 und 10 und nicht der Index im Array:
 * unbesetzte Plaetze fehlen in der Antwort, die Darstellung legt zehn
 * Plaetze an und fuellt sie ueber position (Ticket KAN-31).
 */
export const top10Queries = {
  list: () =>
    queryOptions({
      queryKey: ["top10"] as const,
      queryFn: () => api.get<Top10EntryResponse[]>(apiPaths.top10.list),
    }),
}
