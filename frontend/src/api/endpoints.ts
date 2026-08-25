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
    /*
     * Die redaktionellen Statuswechsel (§4.1, §6.1, KAN-37). Sie stehen
     * neben submit und withdraw und aus demselben Grund einzeln: der Pfad
     * ist die Aktion. Nur request-revision traegt einen Koerper
     * ({ reason }), die beiden anderen keinen.
     */
    approve: (projectId: string) => `/api/projects/${projectId}/approve`,
    publish: (projectId: string) => `/api/projects/${projectId}/publish`,
    requestRevision: (projectId: string) =>
      `/api/projects/${projectId}/request-revision`,
    /*
     * Kommentare eines Projekts (§6.1, §2.3, KAN-37). GET liest die Liste,
     * POST legt einen Kommentar an. Was in der Liste steht, entscheidet der
     * Server: eine NOTE erscheint fuer die Projektseite gar nicht erst
     * darin, und der Client filtert deshalb nichts nach (Frontend-Regel 3,
     * Skill frontend-api Abschnitt 8).
     *
     * Aendern, Umschalten und Loeschen haengen dagegen an der Kommentar-ID
     * und nicht am Projekt; sie stehen deshalb unter comments.
     */
    comments: (projectId: string) => `/api/projects/${projectId}/comments`,
    /*
     * Nominierung fuer die Top-10 (§3.11.1, §6.1). Der Koerper traegt seit
     * Contract v68 die Stufe ({ proposedTier }) und keinen Platz mehr.
     */
    top10Nomination: (projectId: string) =>
      `/api/projects/${projectId}/top10-nomination`,
    /*
     * Die eigene Redaktionszuweisung abgeben (§4.1, §6.1, seit Contract
     * v68). Der Selbstbezug steht im Pfad und nicht als Parameter, wie bei
     * portfolio.me: eine fremde Zuweisung aendert allein die Administration
     * ueber PUT /projects/{id}/editors, und den Pfad gibt es hier deshalb
     * gar nicht erst.
     */
    editorSelf: (projectId: string) => `/api/projects/${projectId}/editors/me`,
    /*
     * Die Redaktionszuweisung eines fremden Projekts umverteilen (§6.1,
     * KAN-38). Ausschliesslich ADMIN, dafuer jederzeit und unabhaengig vom
     * Status; die Autor:in aendert dieselbe Liste ueber detail (PUT
     * /projects/{id}) und nur in DRAFT und REVISION.
     *
     * Der Plural steht neben editorSelf und nicht darunter: dies ist die
     * ganze Liste, jenes die eigene Zeile darin.
     */
    editors: (projectId: string) => `/api/projects/${projectId}/editors`,
  },
  /*
   * Die Administrationsseite (§6.1, Abschnitt „Administration (ADMIN)",
   * KAN-38). Eingetragen mit ihren ersten Verwendern: dashboard mit der
   * Startansicht, bulkStatus mit dem Sammel-Statuswechsel der
   * Projektverwaltung. Die uebrigen Admin-Pfade (Nutzerverwaltung,
   * Stammdaten, Top-10) entstehen mit KAN-39 und KAN-40, nicht auf Vorrat.
   *
   * Bewusst ein eigener Schluessel und nicht unter projects: was hier steht,
   * ist ausschliesslich fuer ADMIN erreichbar, und die Filterkette behandelt
   * /api/admin/** als geschlossenen Bereich (§5).
   */
  admin: {
    dashboard: "/api/admin/dashboard",
    /*
     * Sammel-Statuswechsel, Body { projectIds, action, reason? }, Antwort 200
     * mit einer Ergebniszeile je angefragter ID (§6.1, seit Contract v17,
     * Koerper seit v32). Ein eigener Endpoint und keine Folge von
     * Einzelaufrufen: nur so bleiben Teilerfolge unterscheidbar.
     */
    bulkStatus: "/api/admin/projects/status",
  },
  /*
   * Ein einzelner Kommentar (§6.1, §2.4, KAN-37). Bewusst neben projects und
   * nicht darin, obwohl derselbe Controller sie ausliefert: adressiert ist
   * der Kommentar, nicht das Projekt.
   *
   * detail traegt zwei Methoden: DELETE loescht den Kommentar (§6.1,
   * Autor:in und ADMIN). PATCH aendert seinen Text und bekommt seinen
   * Verwender erst, wenn die Oberflaeche das Aendern anbietet; der Pfad ist
   * derselbe.
   */
  comments: {
    status: (commentId: string) => `/api/comments/${commentId}/status`,
    detail: (commentId: string) => `/api/comments/${commentId}`,
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
    /*
     * Die eigenen Nominierungen der Redaktion (§6.1, seit Contract v68,
     * KAN-37). Der Parameter nominatedBy ist Pflicht und laesst allein
     * "me" zu; er ist der Zuschnitt der Ressource und kein Filter. Den
     * vollstaendigen Spiegel fuehrt GET /api/admin/top10-nominations, und
     * der bleibt der Administrationsseite vorbehalten (KAN-40).
     */
    nominations: "/api/top10-nominations",
    /*
     * Zurueckziehen einer Nominierung (§6.1, seit Contract v70, KAN-37).
     * Derselbe Pfad wie oben, deshalb steht er hier und nicht unter admin:
     * zurueckziehen darf in erster Linie die nominierende Person selbst,
     * die Administration zusaetzlich jeden Vorschlag. Ohne Koerper.
     */
    withdrawNomination: (nominationId: string) =>
      `/api/top10-nominations/${nominationId}/withdraw`,
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
