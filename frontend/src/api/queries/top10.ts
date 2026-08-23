import { queryOptions } from "@tanstack/react-query"

import { api } from "@/api/client"
import { apiPaths } from "@/api/endpoints"
import type {
  NominationStatus,
  NominationTier,
  Top10EntryResponse,
  Top10NominationResponse,
} from "@/api/types"

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

  /**
   * Die eigenen Nominierungen der Redaktion (§6.1, seit Contract v68,
   * KAN-37), neueste zuerst und ohne Paginierung.
   *
   * <p><strong>nominatedBy=me ist fest verdrahtet</strong> und kein
   * Parameter dieser Fabrik: der Wert ist der Zuschnitt der Ressource, und
   * der Server laesst ohnehin keinen anderen zu (400 VALIDATION_FAILED).
   * Den vollstaendigen Spiegel fuehrt GET /api/admin/top10-nominations und
   * bekommt mit KAN-40 seine eigene Fabrik.
   *
   * <p>Der optionale Filter status grenzt auf einen Stand ein (§2.8) und
   * steht deshalb im Key: sonst zeigte ein Wechsel das Ergebnis des vorigen
   * Filters.
   */
  nominations: (params: { status?: NominationStatus } = {}) =>
    queryOptions({
      queryKey: ["top10", "nominations", params] as const,
      queryFn: () =>
        api.get<Top10NominationResponse[]>(apiPaths.top10.nominations, {
          query: { nominatedBy: "me", status: params.status },
        }),
    }),
}

/**
 * POST /projects/{id}/top10-nomination (§3.11.1, §6.1), ergibt
 * <strong>201</strong>.
 *
 * <p><strong>Der Koerper traegt seit Contract v68 die Stufe</strong> und
 * keinen Platz mehr (§2.13): wer nominiert, kennt die uebrige Liste nicht,
 * und ueber den Platz entscheidet die Administration beim Annehmen. Die
 * Stufe bindet sie dabei nicht.
 *
 * <p>Sichtbar zu behandeln sind zwei 409er, beide ohne zweiten Versuch:
 * PROJECT_NOT_PUBLISHED, wenn das Projekt den Status inzwischen verlassen
 * hat, und RESOURCE_IN_USE, wenn es bereits in der Top-10 steht oder schon
 * eine offene Nominierung traegt (§3.11.1).
 */
export function nominateProject(
  projectId: string,
  proposedTier: NominationTier
): Promise<Top10NominationResponse> {
  return api.post<Top10NominationResponse>(
    apiPaths.projects.top10Nomination(projectId),
    { proposedTier }
  )
}
