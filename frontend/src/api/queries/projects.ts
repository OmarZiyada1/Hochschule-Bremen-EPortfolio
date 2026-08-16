import { queryOptions } from "@tanstack/react-query"

import { api } from "@/api/client"
import { apiPaths } from "@/api/endpoints"
import type { PageResponse } from "@/api/page"
import type { ProjectCardResponse } from "@/api/types"

/**
 * queryOptions-Fabrik der Ressource Projekte (Skill frontend-modul,
 * Abschnitt 2): Pfad, Response-Typ und Query-Key stehen hier an genau einer
 * Stelle. Feature-Hooks konsumieren die Fabrik und kennen weder Pfade noch
 * api.*; invalidiert wird ueber die Keys der Fabrik. Die Pfade selbst
 * kommen aus api/endpoints.ts (Review zu KAN-8).
 *
 * Die Projektbibliothek zeigt fuer alle Rollen ausschliesslich
 * Veroeffentlichtes (Klaerungsrunde im Review zu KAN-8, Contract v42):
 * der Filter status=PUBLISHED ist hier fest verdrahtet und fuer die
 * Nutzer:innen nicht waehlbar. Eigene Entwuerfe erscheinen spaeter unter
 * "Mein Portfolio" (KAN-34), Reviews ueber editor=me (KAN-37), die
 * Administrationsseite ueber ihre eigenen Ansichten (KAN-38). Die
 * Sichtbarkeitsschranke selbst liegt im Server (§5); der Filter engt nur
 * weiter ein, aufweichen kann er nichts.
 *
 * Filter, Suche und Paginierung kommen mit KAN-31; ihre Parameter wandern
 * dann in Signatur und Query-Key von list, der Statusfilter bleibt fest.
 */
export const projectQueries = {
  list: () =>
    queryOptions({
      queryKey: ["projects", { status: "PUBLISHED" }] as const,
      queryFn: () =>
        api.get<PageResponse<ProjectCardResponse>>(apiPaths.projects.list, {
          query: { status: "PUBLISHED" },
        }),
    }),
}
