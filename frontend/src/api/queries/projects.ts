import { keepPreviousData, queryOptions } from "@tanstack/react-query"

import { api } from "@/api/client"
import { apiPaths } from "@/api/endpoints"
import type { PageResponse } from "@/api/page"
import type { Degree, ProjectCardResponse, ProjectType } from "@/api/types"

/**
 * Parameter der Projektliste (KAN-31, Filter seit KAN-64). Alles optional:
 * ohne Angaben gilt serverseitig Seite 0, Groesse 20 und die Sortierung
 * updatedAt,desc (§6.6). Es gibt bewusst keinen sort-Parameter: die
 * Bibliothek bietet kein Sortier-Element an (Entscheidung zu KAN-31, wie im
 * Template), und ein Eintrag ohne Verwender entstuende auf Vorrat. Aus
 * demselben Grund fehlt der Filter module aus §6.1: die Seitenleiste hat
 * keine Modul-Gruppe.
 *
 * Die Filter sind Arrays, weil die Parameter seit Contract v43 wiederholbar
 * sind (?faculty=a&faculty=b): Werte desselben Parameters ODER-verknuepft,
 * verschiedene Parameter UND-verknuepft. Der Client haengt Arrays als
 * wiederholte Parameter an, genau die Form, die der Contract festschreibt.
 */
export interface ProjectListParams {
  /** Suchbegriff q, durchsucht Titel und Kurzbeschreibung (§6.1). */
  q?: string
  /** Seite, 0-basiert (§6.6). */
  page?: number
  /** Seitengroesse; serverseitig auf 100 gedeckelt und still gekappt (§6.6). */
  size?: number
  /** IDs von Kategorien aus GET /api/categories (§3.6). */
  category?: string[]
  /** IDs von Fakultaeten aus GET /api/faculties (§3.8). */
  faculty?: string[]
  /** IDs von Studiengaengen aus GET /api/study-programs (§3.7). */
  studyProgram?: string[]
  /** Angestrebte Abschluesse (§2.7). */
  degree?: Degree[]
  /** Projekttypen (§2.6). */
  type?: ProjectType[]
  /** IDs von Semestern aus GET /api/semesters (§3.18). */
  semester?: string[]
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
 * Query-Key, die Filterauswahl seit KAN-64: ein Wechsel zeigt nie das
 * Ergebnis des vorigen Aufrufs, und zwei verschiedene Auswahlen teilen
 * sich keinen Cache-Eintrag. placeholderData laesst beim Blaettern die
 * vorige Seite stehen, statt das Grid auf Skelette zurueckzuwerfen; beim
 * ersten Laden greift weiterhin isPending.
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
