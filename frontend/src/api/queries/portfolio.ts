import { queryOptions } from "@tanstack/react-query"

import { api } from "@/api/client"
import { apiPaths } from "@/api/endpoints"
import type {
  OwnPortfolioResponse,
  PortfolioResponse,
  PortfolioUpdateRequest,
} from "@/api/types"

/**
 * queryOptions-Fabrik der Ressource Portfolio (Skill frontend-modul,
 * Abschnitt 2): Pfad, Response-Typ und Query-Key je Serveroperation an
 * genau einer Stelle, die Pfade aus api/endpoints.ts. Die Feature-Hooks
 * unter features/portfolio/hooks konsumieren die Fabrik und kennen weder
 * Pfade noch api.*.
 */
export const portfolioQueries = {
  /**
   * GET /api/portfolio/me (§6.1): Biografie, Avatar und mayEditPortfolio
   * der angemeldeten Person. Fehlt die Portfolio-Zeile, antwortet der
   * Server 200 mit leeren Feldern und keinen 404 (§3.2.1); die Ansicht
   * zeigt dann das leere Formular und keine Fehlerseite.
   *
   * Name, Rolle und private E-Mail stehen bewusst nicht in dieser Antwort:
   * sie gehoeren zum User und kommen aus dem Auth-Kontext beziehungsweise
   * GET /api/auth/me.
   */
  me: () =>
    queryOptions({
      queryKey: ["portfolio", "me"] as const,
      queryFn: () => api.get<OwnPortfolioResponse>(apiPaths.portfolio.me),
    }),

  /**
   * GET /api/portfolios/{userId} (§6.1): das oeffentliche Profil einer
   * beliebigen Person, auch ohne Anmeldung. Eine unbekannte ID ergibt 404
   * RESOURCE_NOT_FOUND; die Projektliste enthaelt ausschliesslich
   * veroeffentlichte Projekte dieser Person und ist nicht paginiert (§3.2).
   */
  publicProfile: (userId: string) =>
    queryOptions({
      queryKey: ["portfolio", "public", userId] as const,
      queryFn: () =>
        api.get<PortfolioResponse>(apiPaths.portfolio.publicProfile(userId)),
    }),
}

/**
 * PUT /api/portfolio/me (§6.1): ersetzt Biografie und Avatar durch den
 * Inhalt des Bodys. Ein weggelassenes Feld leert den bisherigen Wert, das
 * ist die Bedeutung von PUT (§6.3); das Formular schickt deshalb immer
 * beide Felder. Existiert noch keine Portfolio-Zeile, legt der Aufruf sie
 * an (§3.2.1).
 */
export function updateOwnPortfolio(
  body: PortfolioUpdateRequest
): Promise<OwnPortfolioResponse> {
  return api.put<OwnPortfolioResponse>(apiPaths.portfolio.me, body)
}
