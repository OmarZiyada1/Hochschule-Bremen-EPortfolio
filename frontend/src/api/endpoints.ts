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
  top10: {
    list: "/api/top10",
  },
  /*
   * Stammdaten (§6.1, Backend-Modul masterdata): vollstaendige Listen ohne
   * Paginierung. Eingetragen mit ihrem ersten Verwender: faculties und
   * studyPrograms mit den Kennzahlen der Startseite (KAN-31), categories
   * und semesters mit der Filter-Seitenleiste (KAN-64).
   */
  masterData: {
    faculties: "/api/faculties",
    studyPrograms: "/api/study-programs",
    categories: "/api/categories",
    semesters: "/api/semesters",
  },
} as const
