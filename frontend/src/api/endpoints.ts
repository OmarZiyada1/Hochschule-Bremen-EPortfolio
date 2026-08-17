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
    /*
     * Registrierung, Verifizierung und die drei Passwort-Flows (§6.1,
     * §6.7), eingetragen mit ihrem ersten Verwender KAN-33.
     */
    register: "/api/auth/register",
    verify: "/api/auth/verify",
    verifyResend: "/api/auth/verify/resend",
    password: "/api/auth/password",
    forgotPassword: "/api/auth/forgot-password",
    resetPassword: "/api/auth/reset-password",
  },
  projects: {
    list: "/api/projects",
    detail: (projectId: string) => `/api/projects/${projectId}`,
  },
  /*
   * Portfolio (§6.1, §3.2), eingetragen mit KAN-34. Die beiden Pfade
   * unterscheiden sich nur im Plural, und das ist Absicht: portfolios/{id}
   * adressiert eine Ressource aus einer Sammlung, portfolio/me diejenige,
   * die es je angemeldeter Person genau einmal gibt.
   */
  portfolio: {
    me: "/api/portfolio/me",
    publicProfile: (userId: string) => `/api/portfolios/${userId}`,
  },
  /*
   * Datei-Modul (§3.15, KAN-23). Ein Upload ohne projectId ist per
   * Definition ein Avatar; einen eigenen Avatar-Endpoint gibt es nicht.
   */
  files: {
    upload: "/api/files",
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
