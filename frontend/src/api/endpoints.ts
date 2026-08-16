/**
 * Alle API-Pfade des Frontends an genau einer Stelle (Review zu KAN-8).
 *
 * Query-Fabriken und der Auth-Kontext nennen Pfade nur ueber diese
 * Konstanten, nie als Literal: aendert sich ein Pfad im Contract (§6.1),
 * gibt es genau eine Fundstelle.
 *
 * Parametrisierte Pfade stehen als Funktionen daneben; detail nimmt die
 * Projekt-ID entgegen und traegt die Detailseite aus KAN-32.
 */
export const apiPaths = {
  auth: {
    login: "/api/auth/login",
    logout: "/api/auth/logout",
    me: "/api/auth/me",
  },
  projects: {
    list: "/api/projects",
    detail: (projectId: string) => `/api/projects/${projectId}`,
  },
} as const
