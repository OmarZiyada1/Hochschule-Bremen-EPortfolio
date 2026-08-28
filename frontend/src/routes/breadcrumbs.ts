import { matchPath } from "react-router-dom"

/**
 * Eine Ebene des Brotkrumenpfades, noch unuebersetzt.
 *
 * <p>Entweder {@code labelKey} (ein i18n-Schluessel) oder {@code label} (ein
 * fertiger Text wie ein Projekttitel). Uebersetzt wird erst in
 * {@code AppBreadcrumb}; so bleibt diese Datei eine reine Funktion und ohne
 * Rendern pruefbar (Skill frontend-modul, Abschnitt 3).
 */
export interface CrumbSpec {
  labelKey?: string
  label?: string
  to?: string
  /**
   * Darf diese Ebene gekuerzt werden (KAN-80)?
   *
   * <p>Nur der Name einer Sache: ein Projekttitel, ein Personenname. Die
   * Beschriftungen aus dem Baum werden nie gekuerzt, sie sind kurz gewaehlt
   * und ein abgeschnittenes „Barrierefreiheit" waere ein Fehler und keine
   * Platzersparnis. Aus demselben Grund bleibt auch der Schritt
   * „Einreichen: Pflichtangaben" ganz: er ist eine Beschriftung und kein
   * Name.
   */
  truncatable?: boolean
}

/**
 * Ein Knoten des Navigationsbaums: Routenmuster, Beschriftung, Elternebene.
 *
 * <p>Der Baum steht hier und nicht im Routenbaum aus {@code routes/index.tsx}:
 * dort geht es um Zustaendigkeiten (welche Komponente, welche Rollenschranke),
 * hier um Hierarchie. Beides faellt nicht zusammen. {@code /projects/:id/review}
 * liegt im Routenbaum neben {@code /reviews}, gehoert im Pfad aber darunter,
 * und die Administrationsseite ist eine verschachtelte Layout-Route, deren
 * Kinder alle dieselbe Elternebene haben.
 */
interface RouteNode {
  /** Muster wie im Routenbaum (KAN-7), mit {@code :param}-Platzhaltern. */
  path: string
  /**
   * i18n-Schluessel der Beschriftung.
   *
   * <p>Bei Seiten mit eigenem Namen (Projektdetail, Review, fremdes
   * Portfolio) ist er nur der Platzhalter, solange der Name noch laedt; die
   * Seite reicht ihn dann als {@code title} nach.
   */
  labelKey: string
  /** Elternebene; fehlt nur bei der Startseite. */
  parent?: string
  /**
   * Traegt die Seite den Namen einer Sache (Projekttitel, Personenname)?
   * Dann ist {@code labelKey} nur der Platzhalter, solange er laedt, und die
   * Ebene darf gekuerzt werden.
   */
  named?: true
}

/**
 * Der Navigationsbaum der Seiten im Anwendungsrahmen.
 *
 * <p><strong>Die Reihenfolge entscheidet.</strong> Gesucht wird der erste
 * Treffer, deshalb stehen die spezielleren Muster vorn: {@code /projects/new}
 * vor {@code /projects/:projectId}, sonst gaelte „new" als Projekt-ID, genau
 * wie im Routenbaum.
 *
 * <p><strong>Der Editor steht mit im Baum, obwohl er kein Band zeigt.</strong>
 * Er liegt ausserhalb des Anwendungsrahmens und fuehrt eine eigene Kopfzeile
 * (KAN-36). Als Station <em>vor</em> der Metadatenseite wird er trotzdem
 * gebraucht: Wer dort auf „Einreichen" geht, soll den Weg zurueck sehen.
 */
const ROUTE_TREE: readonly RouteNode[] = [
  { path: "/", labelKey: "common.nav.home" },

  {
    path: "/projects/new",
    labelKey: "common.nav.newProject",
    parent: "/my-portfolio",
  },
  {
    path: "/projects/:projectId/metadata",
    labelKey: "project.metadata.breadcrumb",
    parent: "/my-portfolio",
  },
  {
    path: "/projects/:projectId/editor",
    labelKey: "project.metadata.breadcrumbEditor",
    parent: "/my-portfolio",
  },
  {
    path: "/projects/:projectId/review",
    labelKey: "review.detail.breadcrumb",
    parent: "/reviews",
    named: true,
  },
  {
    path: "/projects/:projectId",
    labelKey: "project.detail.breadcrumb",
    parent: "/projects",
    named: true,
  },
  { path: "/projects", labelKey: "common.nav.projects", parent: "/" },

  {
    path: "/portfolios/:userId",
    labelKey: "portfolio.breadcrumb",
    parent: "/",
  },
  {
    path: "/my-portfolio/profile",
    labelKey: "portfolio.profile.breadcrumb",
    parent: "/my-portfolio",
  },
  { path: "/my-portfolio", labelKey: "common.nav.myPortfolio", parent: "/" },

  { path: "/reviews", labelKey: "common.nav.reviews", parent: "/" },

  /*
   * Das oeffentliche Kontaktformular (KAN-85). Es haengt unter der
   * Startseite und nicht unter einem Bereich: es ist von ueberall
   * erreichbar, aus der Fusszeile wie aus dem Nutzermenue, und gehoert
   * keiner Rolle.
   */
  { path: "/support", labelKey: "common.nav.support", parent: "/" },

  {
    path: "/administration/projects",
    labelKey: "administration.nav.projects",
    parent: "/administration",
  },
  {
    path: "/administration/users",
    labelKey: "administration.nav.users",
    parent: "/administration",
  },
  {
    path: "/administration/categories",
    labelKey: "administration.nav.categories",
    parent: "/administration",
  },
  {
    path: "/administration/semesters",
    labelKey: "administration.nav.semesters",
    parent: "/administration",
  },
  {
    path: "/administration/study-structure",
    labelKey: "administration.nav.studyStructure",
    parent: "/administration",
  },

  {
    path: "/administration/support",
    labelKey: "administration.nav.support",
    parent: "/administration",
  },
  {
    path: "/administration/top10/audit",
    labelKey: "administration.top10.nav.audit",
    parent: "/administration/top10",
  },
  {
    path: "/administration/top10",
    labelKey: "administration.nav.top10",
    parent: "/administration",
  },
  {
    path: "/administration",
    labelKey: "common.nav.administration",
    parent: "/",
  },

  { path: "/imprint", labelKey: "placeholder.title.imprint", parent: "/" },
  { path: "/privacy", labelKey: "placeholder.title.privacy", parent: "/" },
  {
    path: "/accessibility",
    labelKey: "placeholder.title.accessibility",
    parent: "/",
  },
]

/** Der erste Knoten, dessen Muster auf diesen Pfad passt. */
function nodeFor(pathname: string): RouteNode | undefined {
  return ROUTE_TREE.find((node) => matchPath(node.path, pathname) !== null)
}

/**
 * Der Pfad eines Knotens, mit den Werten der aktuellen Adresse gefuellt.
 *
 * <p>Ein Elternknoten kann Platzhalter tragen ({@code /projects/:projectId} als
 * Elternebene) und braucht dann die IDs des Kindes. Fehlt eine, bleibt der
 * Knoten ohne Ziel und steht als nicht anklickbare Ebene da; ein Link auf
 * {@code /projects/:projectId} fuehrte ins Leere.
 */
function resolvePath(
  path: string,
  params: Readonly<Record<string, string | undefined>>
): string | undefined {
  let complete = true
  const filled = path.replace(/:([A-Za-z0-9_]+)/g, (_, name: string) => {
    const value = params[name]
    if (value === undefined) {
      complete = false
      return ""
    }
    return value
  })
  return complete ? filled : undefined
}

/**
 * Die Kette von der Startseite bis zu diesem Knoten, ohne den Knoten selbst.
 *
 * <p>Laeuft am {@code parent} entlang nach oben und dreht am Ende um. Der
 * Zaehler ist eine Reissleine gegen einen versehentlichen Ring im Baum
 * ({@code a → b → a}); ohne ihn haengt die Anwendung, statt einen falschen
 * Pfad zu zeigen.
 */
function ancestorsOf(
  node: RouteNode,
  params: Readonly<Record<string, string | undefined>>
): CrumbSpec[] {
  const chain: CrumbSpec[] = []
  let current = node.parent
  for (
    let guard = 0;
    current !== undefined && guard < ROUTE_TREE.length;
    guard++
  ) {
    const parent = nodeFor(current)
    if (parent === undefined) {
      break
    }
    chain.push({
      labelKey: parent.labelKey,
      to: resolvePath(parent.path, params),
    })
    current = parent.parent
  }
  return chain.reverse()
}

/**
 * Der Brotkrumenpfad zur aktuellen Adresse (KAN-80).
 *
 * <p><strong>Abgeleitet, nicht je Seite geschrieben.</strong> Bis KAN-80 baute
 * jede Seite ihr Band selbst zusammen; die Administrationsseite und „Meine
 * Reviews" hatten deshalb gar keines, und wer eine Ebene umbenannte, musste
 * jede Fundstelle einzeln finden. Der Pfad kommt jetzt aus dem Baum oben.
 *
 * <p><strong>Die Herkunft schlaegt den Baum.</strong> Ein Projekt ist dieselbe
 * Route, ob es aus der Bibliothek, aus dem eigenen Portfolio oder aus der
 * Projektverwaltung geoeffnet wurde. Der Baum allein zeigte deshalb immer
 * „Startseite &rsaquo; Projekte &rsaquo; Titel", auch wenn man aus der
 * Administration kam, und der Weg zurueck fuehrte woanders hin als der Weg
 * hin. Die verlinkenden Ansichten geben deshalb ihre eigene Adresse als
 * {@code from} mit (Router-State, siehe {@code useBreadcrumbOrigin}); ist sie
 * da, ersetzt ihre Kette die Elternkette aus dem Baum. Fehlt sie, etwa bei
 * einem geteilten Link, bleibt es beim Baum.
 *
 * <p>Die Adresse in {@code from} wird dabei vollstaendig uebernommen,
 * einschliesslich Suchparametern: Der Weg zurueck in die Bibliothek fuehrt
 * damit auf dieselbe Seite und dieselbe Filterauswahl, aus der man kam.
 *
 * @param pathname aktuelle Adresse ohne Suchteil
 * @param options  Feinheiten der aktuellen Seite:
 *                 {@code title} ersetzt die Beschriftung der letzten Ebene
 *                 (Projekttitel statt „Projekt"), {@code from} die Herkunft.
 */
export function breadcrumbTrail(
  pathname: string,
  options: { title?: string | null; from?: string | null } = {}
): CrumbSpec[] {
  const node = nodeFor(pathname)
  if (node === undefined) {
    return []
  }

  const match = matchPath(node.path, pathname)
  const params = match?.params ?? {}

  /* Der eigene Name der Seite schlaegt den Schluessel aus dem Baum: der
     Projekttitel steht dort, wo sonst nur „Projekt" stuende. Solange er noch
     laedt, bleibt es beim Schluessel, damit die letzte Ebene nicht leer ist. */
  const self: CrumbSpec = options.title
    ? { label: options.title, truncatable: node.named }
    : { labelKey: node.labelKey }

  /* Die Startseite ist ihr eigener Pfad und bekommt kein Band mit einer
     einzigen Ebene. */
  if (node.parent === undefined) {
    return [self]
  }

  const origin = originTrail(options.from)
  return [...(origin ?? ancestorsOf(node, params)), self]
}

/**
 * Die Kette der Herkunftsadresse, sie selbst als letzte Ebene eingeschlossen.
 *
 * <p>{@code undefined}, wenn keine Herkunft mitkam oder sie auf keine bekannte
 * Route zeigt; dann greift der Baum. Eine Herkunft auf derselben Seite wird
 * ebenfalls verworfen: sie entstuende beim Neuladen einer Detailseite und
 * ergaebe eine Ebene, die auf sich selbst zeigt.
 */
function originTrail(from: string | null | undefined): CrumbSpec[] | undefined {
  if (!from) {
    return undefined
  }
  const [originPath] = from.split("?")
  const node = nodeFor(originPath)
  if (node === undefined) {
    return undefined
  }
  const params = matchPath(node.path, originPath)?.params ?? {}
  return [...ancestorsOf(node, params), { labelKey: node.labelKey, to: from }]
}
