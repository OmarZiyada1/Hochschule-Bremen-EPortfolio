import { queryOptions } from "@tanstack/react-query"

import { api } from "@/api/client"
import { apiPaths } from "@/api/endpoints"
import type { TagResponse } from "@/api/types"

/**
 * queryOptions-Fabrik der Schlagwoerter (§3.19, §6.1, KAN-75): GET
 * /api/tags ist PUBLIC und liefert die gebraeuchlichsten Woerter samt
 * Verwendungszahl, sortiert nach Haeufigkeit und ohne PageResponse.
 *
 * Eigene Datei neben masterData.ts, obwohl derselbe Controller antwortet.
 * Die vier Listen dort sind vollstaendig, klein und einmal geladen; diese
 * ist eine Vorschlagsliste mit Parametern, deren Ergebnis sich mit jedem
 * getippten Zeichen aendert. Beides in einer Fabrik zu fuehren hiesse, den
 * Kommentar dort ("ein Nachladen gibt es nicht") falsch werden zu lassen.
 *
 * Der Suchbegriff gehoert in den queryKey und nicht in den Hook darum:
 * React Query haelt so je Begriff einen eigenen Eintrag, das Zurueckgehen
 * auf einen frueheren Begriff kostet keinen zweiten Request, und ein spaet
 * eintreffendes Ergebnis kann kein neueres ueberschreiben.
 */
export const tagQueries = {
  /**
   * @param query Filter auf den Namen, ohne Ruecksicht auf Gross- und
   *   Kleinschreibung und an beliebiger Stelle im Wort. Leer laesst ihn weg
   *   und liefert die haeufigsten Schlagwoerter.
   */
  suggestions: (query = "") =>
    queryOptions({
      queryKey: ["tags", { q: query }] as const,
      queryFn: () => {
        const search = new URLSearchParams()
        if (query !== "") {
          search.set("q", query)
        }
        const suffix = search.size === 0 ? "" : `?${search}`
        return api.get<TagResponse[]>(`${apiPaths.tags.list}${suffix}`)
      },
    }),
}
