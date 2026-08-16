import { keepPreviousData, queryOptions } from "@tanstack/react-query"

import { api } from "@/api/client"
import { apiPaths } from "@/api/endpoints"
import type { PageResponse } from "@/api/page"
import type { ProjectCardResponse } from "@/api/types"

/**
 * Parameter der Projektliste (KAN-31). Alles optional: ohne Angaben gilt
 * serverseitig Seite 0, Groesse 20 und die Sortierung updatedAt,desc
 * (§6.6). Es gibt bewusst keinen sort-Parameter: die Bibliothek bietet
 * kein Sortier-Element an (Entscheidung zu KAN-31, wie im Template), und
 * ein Eintrag ohne Verwender entstuende auf Vorrat. Die Filterparameter
 * aus §6.1 (faculty, category, ...) folgen mit KAN-64, wenn sie
 * mehrwertig sind.
 */
export interface ProjectListParams {
  /** Suchbegriff q, durchsucht Titel und Kurzbeschreibung (§6.1). */
  q?: string
  /** Seite, 0-basiert (§6.6). */
  page?: number
  /** Seitengroesse; serverseitig auf 100 gedeckelt und still gekappt (§6.6). */
  size?: number
}

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
 * Suche und Seite stehen seit KAN-31 in der Signatur und damit im
 * Query-Key: ein Wechsel zeigt nie das Ergebnis des vorigen Aufrufs.
 * placeholderData laesst beim Blaettern die vorige Seite stehen, statt das
 * Grid auf Skelette zurueckzuwerfen; beim ersten Laden greift weiterhin
 * isPending.
 */
export const projectQueries = {
  list: (params: ProjectListParams = {}) =>
    queryOptions({
      queryKey: ["projects", { status: "PUBLISHED", ...params }] as const,
      queryFn: () =>
        api.get<PageResponse<ProjectCardResponse>>(apiPaths.projects.list, {
          query: { status: "PUBLISHED", ...params },
        }),
      placeholderData: keepPreviousData,
    }),
}
