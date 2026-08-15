import { queryOptions } from "@tanstack/react-query"

import { api } from "@/api/client"
import type { PageResponse } from "@/api/page"
import type { ProjectCardResponse } from "@/api/types"

/**
 * queryOptions-Fabrik der Ressource Projekte (Skill frontend-modul,
 * Abschnitt 2): Pfad, Response-Typ und Query-Key stehen hier an genau einer
 * Stelle. Feature-Hooks konsumieren die Fabrik und kennen weder Pfade noch
 * api.*; invalidiert wird ueber die Keys der Fabrik.
 *
 * Mit KAN-8 gibt es nur die Liste ohne Parameter: der Durchstich zeigt die
 * erste Seite in der Standardsortierung updatedAt,desc (Contract 6.6). Wer
 * was sieht, entscheidet der Server (§5), der Client filtert nicht nach.
 * Filter, Suche und Paginierung kommen mit KAN-31; ihre Parameter wandern
 * dann in Signatur und Query-Key von list.
 */
export const projectQueries = {
  list: () =>
    queryOptions({
      queryKey: ["projects"] as const,
      queryFn: () =>
        api.get<PageResponse<ProjectCardResponse>>("/api/projects"),
    }),
}
