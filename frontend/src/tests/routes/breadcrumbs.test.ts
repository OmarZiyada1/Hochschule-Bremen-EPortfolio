import { describe, expect, it } from "vitest"

import { breadcrumbTrail } from "@/routes/breadcrumbs"

/**
 * Der Brotkrumenpfad wird aus der Route abgeleitet (KAN-80). Geprueft wird
 * die reine Funktion und nicht das gerenderte Band: die Zusagen betreffen
 * den Navigationsbaum, und Uebersetzung und Darstellung liegen woanders
 * (Skill frontend-modul, Abschnitt 3).
 */
describe("breadcrumbTrail", () => {
  function keys(pathname: string, options = {}) {
    return breadcrumbTrail(pathname, options).map(
      (crumb) => crumb.label ?? crumb.labelKey
    )
  }

  it("gibt der Startseite eine einzige Ebene", () => {
    expect(keys("/")).toEqual(["common.nav.home"])
  })

  it("leitet die Ebenen aus der Route ab, nicht aus der Seite", () => {
    expect(keys("/projects")).toEqual([
      "common.nav.home",
      "common.nav.projects",
    ])
    expect(keys("/my-portfolio/profile")).toEqual([
      "common.nav.home",
      "common.nav.myPortfolio",
      "portfolio.profile.breadcrumb",
    ])
  })

  /*
   * Die Administrationsseite und „Meine Reviews" hatten bis KAN-80 gar kein
   * Band: jede Seite baute es selbst, und dort hatte es niemand gebaut.
   */
  it("fuehrt auch die Administrationsseite und ihre Unterseiten", () => {
    expect(keys("/administration")).toEqual([
      "common.nav.home",
      "common.nav.administration",
    ])
    expect(keys("/administration/top10/audit")).toEqual([
      "common.nav.home",
      "common.nav.administration",
      "administration.nav.top10",
      "administration.top10.nav.audit",
    ])
    expect(keys("/reviews")).toEqual(["common.nav.home", "common.nav.reviews"])
  })

  it("setzt den Namen der Seite als letzte Ebene", () => {
    expect(keys("/projects/p-1", { title: "Campus-Garten" })).toEqual([
      "common.nav.home",
      "common.nav.projects",
      "Campus-Garten",
    ])
  })

  it("faellt ohne Namen auf den Platzhalter der Route zurueck", () => {
    expect(keys("/projects/p-1")).toEqual([
      "common.nav.home",
      "common.nav.projects",
      "project.detail.breadcrumb",
    ])
  })

  /*
   * Der Kern von Punkt 10: dieselbe Route, ein anderer Weg dorthin. Ohne die
   * Herkunft stuende ueber jedem Projekt „Startseite, Projekte", auch wenn
   * man aus der Projektverwaltung kam.
   */
  it("nimmt die Kette der Herkunft statt der Elternkette", () => {
    expect(
      keys("/projects/p-1", {
        title: "Campus-Garten",
        from: "/administration/projects",
      })
    ).toEqual([
      "common.nav.home",
      "common.nav.administration",
      "administration.nav.projects",
      "Campus-Garten",
    ])
  })

  it("behaelt den Suchteil der Herkunft im Ziel der Ebene", () => {
    const trail = breadcrumbTrail("/projects/p-1", {
      from: "/projects?page=3&faculty=f-4",
    })

    expect(trail.at(-2)?.to).toBe("/projects?page=3&faculty=f-4")
  })

  it("ignoriert eine Herkunft ausserhalb des Navigationsbaums", () => {
    expect(keys("/projects/p-1", { from: "/etwas-fremdes" })).toEqual([
      "common.nav.home",
      "common.nav.projects",
      "project.detail.breadcrumb",
    ])
  })

  /* „new" ist keine Projekt-ID, hier so wenig wie im Routenbaum. */
  it("liest /projects/new nicht als Projekt", () => {
    expect(keys("/projects/new")).toEqual([
      "common.nav.home",
      "common.nav.myPortfolio",
      "common.nav.newProject",
    ])
  })

  it("gibt fuer eine unbekannte Route kein Band aus", () => {
    expect(breadcrumbTrail("/gibt-es-nicht")).toEqual([])
  })

  /*
   * Ein Elternknoten mit Platzhalter braucht die IDs des Kindes; fehlt eine,
   * bleibt die Ebene ohne Ziel, statt auf /projects/:projectId zu zeigen.
   */
  it("fuellt die Platzhalter der Elternebenen aus der Adresse", () => {
    const trail = breadcrumbTrail("/projects/p-1/review")

    expect(trail.map((crumb) => crumb.to)).toEqual(["/", "/reviews", undefined])
  })
})
