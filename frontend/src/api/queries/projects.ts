import { keepPreviousData, queryOptions } from "@tanstack/react-query"

import { api } from "@/api/client"
import { apiPaths } from "@/api/endpoints"
import type { PageResponse } from "@/api/page"
import type {
  Degree,
  ProjectCardResponse,
  ProjectDetailResponse,
  ProjectStatus,
  ProjectType,
} from "@/api/types"

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
  /** Suchbegriff q, durchsucht Titel, Kurzbeschreibung und die Namen der Autor:in (§6.1, seit v47). */
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
 * Parameter der eigenen Projektliste unter "My Portfolio" (KAN-34).
 * Weggelassener status heisst "Alle".
 */
export interface OwnProjectListParams {
  /** ID der Autor:in; bei "My Portfolio" die eigene aus dem Auth-Kontext. */
  authorId: string
  /** Projektstatus (§2.2), oder undefined fuer den Filterwert "Alle". */
  status?: ProjectStatus
}

/** Serverseitiges Maximum aus §6.6; darueber kappt der Server still. */
const OWN_PROJECTS_PAGE_SIZE = 100

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

  /**
   * Die eigenen Projekte fuer "My Portfolio" (KAN-34), gefiltert ueber
   * author (§6.1).
   *
   * <p><strong>author nimmt eine UUID, keinen Sonderwert.</strong> Nur
   * editor kennt "me"; author verlangt die ID, die der Auth-Kontext ohnehin
   * fuehrt. Der Aufrufer reicht sie durch, statt dass diese Fabrik den
   * Sitzungszustand kennt.
   *
   * <p>Ohne status kommen alle Status, die §5 fuer die anfragende Person
   * durchlaesst; das ist der Filterwert "Alle". Der Statusfilter engt nur
   * weiter ein: die Sichtbarkeitsregel des Servers steht immer mit UND
   * davor, ein fremder Entwurf wird dadurch nicht sichtbar.
   *
   * <p>size ist auf das serverseitige Maximum gesetzt, weil das Template
   * "My Portfolio" bewusst keine Seitennummerierung fuehrt: die Menge ist
   * von der Sache her klein. Ueber 100 eigenen Projekten waere eine
   * Paginierung nachzuruesten; der Server kappt still auf 100 (§6.6).
   */
  mine: (params: OwnProjectListParams) =>
    queryOptions({
      queryKey: ["projects", "mine", params] as const,
      queryFn: () =>
        api.get<PageResponse<ProjectCardResponse>>(apiPaths.projects.list, {
          query: {
            author: params.authorId,
            status: params.status,
            size: OWN_PROJECTS_PAGE_SIZE,
          },
        }),
    }),
}

/**
 * POST /projects/{id}/withdraw (§4.1, seit Contract v50, KAN-69): die
 * Autor:in holt die eigene Einreichung aus SUBMITTED nach DRAFT zurueck.
 * Aus jedem anderen Status antwortet der Server 409
 * PROJECT_STATUS_TRANSITION_INVALID.
 */
export function withdrawProject(
  projectId: string
): Promise<ProjectDetailResponse> {
  return api.post<ProjectDetailResponse>(apiPaths.projects.withdraw(projectId))
}

/**
 * DELETE /projects/{id} (§6.1): Autor:in nur im Entwurf, Admin jederzeit,
 * ergibt 204. Bloecke und Dateien fallen serverseitig per Cascade mit.
 */
export function deleteProject(projectId: string): Promise<void> {
  return api.delete<void>(apiPaths.projects.detail(projectId))
}
