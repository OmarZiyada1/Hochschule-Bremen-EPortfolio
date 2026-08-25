import { describe, expect, it } from "vitest"

import {
  ADMIN_PROJECT_STATUSES,
  readAdminProjectState,
  writeAdminProjectState,
} from "@/features/administration/adminProjectFilters"
import { ALL_STATUSES } from "@/features/portfolio/ownProjectStatus"

/**
 * Der Ansichtszustand der Projektverwaltung (KAN-38) als reine Funktionen:
 * lesen aus der Adresse, schreiben in die Adresse.
 */
describe("adminProjectFilters", () => {
  it("bietet alle fuenf Status an, Entwuerfe eingeschlossen", () => {
    /* Anders als „Meine Reviews": die Redaktion sieht Entwuerfe gar nicht
       erst (§5 Fussnote 11), die Administration sieht alles. */
    expect([...ADMIN_PROJECT_STATUSES]).toEqual([
      "DRAFT",
      "SUBMITTED",
      "APPROVED",
      "PUBLISHED",
      "REVISION",
    ])
  })

  it("liest den Grundzustand aus einer leeren Adresse", () => {
    expect(readAdminProjectState(new URLSearchParams())).toEqual({
      q: "",
      status: ALL_STATUSES,
      studyProgram: null,
      semester: null,
      module: null,
      page: 1,
    })
  })

  it("liest Suche, Status, Filter und Seite", () => {
    const state = readAdminProjectState(
      new URLSearchParams(
        "q=Robo&status=DRAFT&studyProgram=sp-1&semester=se-1&module=m-1&page=3"
      )
    )

    expect(state).toEqual({
      q: "Robo",
      status: "DRAFT",
      studyProgram: "sp-1",
      semester: "se-1",
      module: "m-1",
      page: 3,
    })
  })

  it("faellt bei einem unbekannten Status auf Alle zurueck", () => {
    /* Ein von Hand geschriebener Fantasiewert endete am Server als 400,
       obwohl ihn kein Segment erzeugen kann. */
    const state = readAdminProjectState(new URLSearchParams("status=BOGUS"))

    expect(state.status).toBe(ALL_STATUSES)
  })

  it("faellt bei einer unbrauchbaren Seitenzahl auf 1 zurueck", () => {
    expect(readAdminProjectState(new URLSearchParams("page=0")).page).toBe(1)
    expect(readAdminProjectState(new URLSearchParams("page=abc")).page).toBe(1)
  })

  it("laesst eine unbekannte Filter-ID stehen", () => {
    /* Eine unbekannte ID ist laut Contract ein gueltiger Filter mit leerem
       Ergebnis und kein Fehler. */
    const state = readAdminProjectState(
      new URLSearchParams("studyProgram=gibt-es-nicht")
    )

    expect(state.studyProgram).toBe("gibt-es-nicht")
  })

  it("entfernt den Parameter, wenn der Grundzustand gewaehlt wird", () => {
    const before = new URLSearchParams("q=Robo&status=DRAFT&studyProgram=sp-1")

    const after = writeAdminProjectState(before, {
      q: "",
      status: ALL_STATUSES,
      studyProgram: null,
    })

    expect(after.toString()).toBe("")
  })

  it("setzt beim Filterwechsel auf Seite 1 zurueck", () => {
    /* Die alte Seitenzahl gehoerte zur alten Treffermenge. */
    const before = new URLSearchParams("page=4")

    const after = writeAdminProjectState(before, { status: "DRAFT" })

    expect(after.get("page")).toBeNull()
    expect(after.get("status")).toBe("DRAFT")
  })

  it("behaelt die uebrigen Werte beim Seitenwechsel", () => {
    const before = new URLSearchParams("q=Robo&status=DRAFT")

    const after = writeAdminProjectState(before, { page: 2 })

    expect(after.get("page")).toBe("2")
    expect(after.get("q")).toBe("Robo")
    expect(after.get("status")).toBe("DRAFT")
  })

  it("schreibt Seite 1 nicht in die Adresse", () => {
    const after = writeAdminProjectState(new URLSearchParams("page=5"), {
      page: 1,
    })

    expect(after.get("page")).toBeNull()
  })
})
