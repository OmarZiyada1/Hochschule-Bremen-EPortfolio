import { describe, expect, it } from "vitest"

import { ADMIN_NAV, isAdminNavActive } from "@/features/administration/adminNav"

/**
 * Die Seitennavigation der Administrationsseite (KAN-38) als reine
 * Funktionen: die Eintraege selbst und die Frage, welcher gerade der aktuelle
 * ist.
 */
describe("adminNav", () => {
  it("fuehrt die acht Eintraege der Figma-Komponente in ihrer Reihenfolge", () => {
    /* Sieben, nicht sechs: „Semester" ist am 17.08.2026 zwischen Kategorien
       und Studienstruktur dazugekommen. Auch die Position von „Top 10"
       stammt aus dem Frame und nicht aus der aelteren Ticketfassung.
       Der achte ist „Support" (KAN-85), am Ende und hinter
       „Studienstruktur" wie im Frame Admin · Support. */
    expect(ADMIN_NAV.map((entry) => entry.to)).toEqual([
      "/administration",
      "/administration/projects",
      "/administration/top10",
      "/administration/users",
      "/administration/categories",
      "/administration/semesters",
      "/administration/study-structure",
      "/administration/support",
    ])
  })

  it("markiert die Startansicht nur auf ihrem eigenen Pfad", () => {
    const dashboard = ADMIN_NAV[0]

    expect(isAdminNavActive(dashboard, "/administration")).toBe(true)
    /* Ihr Pfad ist Praefix jedes anderen Eintrags; mit einem blossen
       startsWith waere sie ueberall zugleich markiert. */
    expect(isAdminNavActive(dashboard, "/administration/projects")).toBe(false)
    expect(isAdminNavActive(dashboard, "/administration/top10/audit")).toBe(
      false
    )
  })

  it("haelt einen Eintrag auch auf seiner Unterseite markiert", () => {
    const top10 = ADMIN_NAV.find(
      (entry) => entry.to === "/administration/top10"
    )!

    expect(isAdminNavActive(top10, "/administration/top10")).toBe(true)
    /* Das Aenderungsprotokoll bekommt keinen eigenen Eintrag, es gehoert zur
       Top-10-Verwaltung (KAN-40). */
    expect(isAdminNavActive(top10, "/administration/top10/audit")).toBe(true)
    expect(isAdminNavActive(top10, "/administration/users")).toBe(false)
  })
})
