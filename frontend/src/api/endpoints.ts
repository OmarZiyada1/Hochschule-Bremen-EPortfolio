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
    /*
     * Der Inhalt des Projekts (§6.1, KAN-36). GET liest die Blockliste, PUT
     * ersetzt sie vollstaendig und antwortet mit { version, blocks }.
     *
     * Bewusst ein eigener Pfad neben detail: Metadaten und Inhalt bleiben
     * getrennt (§6.1), im Server wie im Client. Ein gemeinsamer Endpoint
     * machte aus jedem Tastenanschlag im Editor eine Metadatenaenderung.
     */
    blocks: (projectId: string) => `/api/projects/${projectId}/blocks`,
    /*
     * Einreichen (§4.1, §6.1). Die Gegenrichtung ist withdraw; beide sind
     * Statuswechsel und stehen deshalb hier und nicht unter einem
     * gemeinsamen "workflow"-Schluessel: der Pfad ist die Aktion.
     */
    submit: (projectId: string) => `/api/projects/${projectId}/submit`,
    /*
     * Zurueckziehen der eigenen Einreichung (§4.1, seit Contract v50,
     * KAN-69). Geloescht wird dagegen ueber detail: DELETE /projects/{id}
     * hat keinen eigenen Pfad.
     */
    withdraw: (projectId: string) => `/api/projects/${projectId}/withdraw`,
    /*
     * Reaktion setzen (POST) und entfernen (DELETE), beide idempotent und
     * beide mit 200 { count } (§6.1, §3.10). Ein Pfad fuer zwei Methoden:
     * die Reaktion der anfragenden Person ist eine Ressource, die es je
     * Projekt einmal gibt. Eingetragen mit KAN-32.
     */
    reaction: (projectId: string) => `/api/projects/${projectId}/reaction`,
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
    /*
     * Auslieferung einer Datei (§6.1). Es gibt keine zweite Adresse:
     * weder Containername noch Endpoint noch Speicherschluessel erscheinen
     * in einer Antwort (§3.15.1), der Client kennt allein diesen Pfad.
     * Eingetragen mit KAN-10, wo der Read-Only-Renderer ihn fuer Bild,
     * Galerie, Audio, Video und Dokument braucht; er setzt keine URL selbst
     * zusammen (Frontend-Regel 3).
     */
    detail: (fileId: string) => `/api/files/${fileId}`,
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
    /*
     * Module (§3.9, KAN-35). Kommt spaeter als die uebrigen vier, weil erst
     * das Metadatenformular ein Feld dafuer hat: die Filter-Seitenleiste der
     * Projektbibliothek fuehrt bewusst keine Modul-Gruppe (KAN-64).
     */
    modules: "/api/modules",
  },
  /*
   * Personensuche fuer Auswahlfelder (§6.1, KAN-44), eingetragen mit ihrem
   * ersten Verwender: Redaktionszuweisung und Projektmitglieder im
   * Metadatenformular (KAN-35).
   *
   * Bewusst nicht unter masterData: das sind Stammdaten, die die
   * Administration pflegt. Dies ist eine Suche ueber Konten, und sie
   * verlangt eine Anmeldung (§5, Zeile „Auswahlliste der Redakteur:innen
   * lesen"). Die Antwort fuehrt ausschliesslich id, firstName und
   * lastName; hsbEmail steht allein in der Admin-Nutzerverwaltung (§3.1).
   */
  users: {
    lookup: "/api/users/lookup",
  },
  /*
   * Schlagwoerter (§6.1, §3.19, KAN-75). Bewusst neben masterData und
   * nicht darin, obwohl derselbe Controller sie ausliefert: die vier
   * Listen dort sind vollstaendig und werden einmal geladen, diese ist
   * eine Vorschlagsliste, die beim Tippen neu abgefragt wird. Die
   * Nachbarschaft in endpoints.ts suggerierte sonst eine Gleichartigkeit,
   * die es nicht gibt.
   *
   * Der Endpoint kennt zwei Parameter, gesendet wird nur q. limit bleibt
   * bewusst beim Serverstandard von 20: das Auswahlfeld zeigt Vorschlaege
   * und keine Gesamtliste, und wer mehr sehen will, tippt.
   */
  tags: {
    list: "/api/tags",
  },
} as const
