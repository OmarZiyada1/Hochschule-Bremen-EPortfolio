import { describe, expect, it } from "vitest"

import {
  ALL_STATUSES,
  OWN_PROJECT_STATUSES,
  readStatusFilter,
  statusQueryValue,
  writeStatusFilter,
} from "@/features/portfolio/ownProjectStatus"

/**
 * Der Statusfilter aus "My Portfolio" (KAN-34) ohne Rendern: Reihenfolge
 * nach Template, Lesen und Schreiben der URL, Uebersetzung in den
 * Query-Parameter.
 */
describe("ownProjectStatus", () => {
  it("fuehrt die fuenf Status aus Contract 2.2 in der Reihenfolge des Templates", () => {
    expect(OWN_PROJECT_STATUSES).toEqual([
      "DRAFT",
      "SUBMITTED",
      "APPROVED",
      "PUBLISHED",
      "REVISION",
    ])
  })

  it("liest einen gueltigen Status aus der URL", () => {
    expect(readStatusFilter(new URLSearchParams("status=SUBMITTED"))).toBe(
      "SUBMITTED"
    )
  })

  it("faellt ohne Parameter auf Alle zurueck", () => {
    expect(readStatusFilter(new URLSearchParams())).toBe(ALL_STATUSES)
  })

  it("faellt bei einem unbekannten Wert auf Alle zurueck", () => {
    /* Ein von Hand geschriebener Fantasiestatus endete am Server als 400,
       obwohl ihn kein Knopf erzeugen kann. */
    expect(readStatusFilter(new URLSearchParams("status=ERFUNDEN"))).toBe(
      ALL_STATUSES
    )
  })

  it("schreibt einen Status in die URL und laesst andere Parameter stehen", () => {
    const next = writeStatusFilter(new URLSearchParams("page=2"), "DRAFT")
    expect(next.get("status")).toBe("DRAFT")
    expect(next.get("page")).toBe("2")
  })

  it("entfernt den Parameter bei Alle, statt status=all zu hinterlassen", () => {
    const next = writeStatusFilter(
      new URLSearchParams("status=DRAFT"),
      ALL_STATUSES
    )
    expect(next.has("status")).toBe(false)
  })

  it("uebersetzt Alle in undefined fuer die Query-Fabrik", () => {
    expect(statusQueryValue(ALL_STATUSES)).toBeUndefined()
    expect(statusQueryValue("PUBLISHED")).toBe("PUBLISHED")
  })
})
