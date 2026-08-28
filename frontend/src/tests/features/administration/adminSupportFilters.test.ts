import { describe, expect, it } from "vitest"

import {
  ALL_SUPPORT_STATUSES,
  isSupportStatus,
  readAdminSupportState,
  supportQueryOf,
  SUPPORT_STATUSES,
  writeAdminSupportState,
} from "@/features/administration/adminSupportFilters"

/**
 * Der Ansichtszustand der Support-Verwaltung als reine Funktionen (KAN-85).
 * Geprueft ohne Rendern, wie bei {@code adminUserFilters} (Skill
 * frontend-modul, Abschnitt 3).
 */
describe("adminSupportFilters", () => {
  it("fuehrt die drei Staende aus Contract 2.15 in Ablaufreihenfolge", () => {
    expect(SUPPORT_STATUSES).toEqual(["OPEN", "IN_PROGRESS", "RESOLVED"])
  })

  it("erkennt nur Contract-Werte als Stand", () => {
    expect(isSupportStatus("OPEN")).toBe(true)
    expect(isSupportStatus("ERLEDIGT")).toBe(false)
    expect(isSupportStatus(ALL_SUPPORT_STATUSES)).toBe(false)
  })

  describe("readAdminSupportState", () => {
    it("liest den leeren Zustand als Alle und Seite 1", () => {
      const state = readAdminSupportState(new URLSearchParams())

      expect(state).toEqual({ status: ALL_SUPPORT_STATUSES, page: 1 })
    })

    it("liest Stand und Seite aus der Adresse", () => {
      const state = readAdminSupportState(
        new URLSearchParams("status=RESOLVED&page=3")
      )

      expect(state).toEqual({ status: "RESOLVED", page: 3 })
    })

    /*
     * Ein von Hand geschriebener Fantasiewert ginge sonst als Enum an den
     * Server und endete dort als 400 VALIDATION_FAILED, obwohl ihn kein
     * Bedienelement erzeugen kann.
     */
    it("faellt bei unbekanntem Stand auf Alle zurueck", () => {
      expect(
        readAdminSupportState(new URLSearchParams("status=ERLEDIGT")).status
      ).toBe(ALL_SUPPORT_STATUSES)
    })

    it("faellt bei unbrauchbarer Seitenzahl auf 1 zurueck", () => {
      expect(readAdminSupportState(new URLSearchParams("page=0")).page).toBe(1)
      expect(readAdminSupportState(new URLSearchParams("page=x")).page).toBe(1)
      expect(readAdminSupportState(new URLSearchParams("page=-2")).page).toBe(1)
    })
  })

  describe("writeAdminSupportState", () => {
    it("laesst Alle und Seite 1 aus der Adresse heraus", () => {
      const next = writeAdminSupportState(new URLSearchParams(), {
        status: ALL_SUPPORT_STATUSES,
        page: 1,
      })

      expect(next.toString()).toBe("")
    })

    it("schreibt Stand und Seite", () => {
      const next = writeAdminSupportState(new URLSearchParams(), {
        status: "OPEN",
        page: 2,
      })

      expect(next.get("status")).toBe("OPEN")
      expect(next.get("page")).toBe("2")
    })

    /*
     * Die alte Seitenzahl gehoerte zur alten Treffermenge: nach einem
     * Filterwechsel auf Seite 4 stuende sonst womoeglich nichts mehr.
     */
    it("setzt beim Filterwechsel auf Seite 1 zurueck", () => {
      const next = writeAdminSupportState(
        new URLSearchParams("status=OPEN&page=4"),
        { status: "RESOLVED" }
      )

      expect(next.get("status")).toBe("RESOLVED")
      expect(next.has("page")).toBe(false)
    })

    it("behaelt den Filter beim Blaettern", () => {
      const next = writeAdminSupportState(new URLSearchParams("status=OPEN"), {
        page: 3,
      })

      expect(next.get("status")).toBe("OPEN")
      expect(next.get("page")).toBe("3")
    })
  })

  describe("supportQueryOf", () => {
    /* Die Adresse zaehlt ab 1, der Server ab 0 (Contract 6.6). */
    it("rechnet die Seitenzahl auf die 0-basierte des Servers um", () => {
      expect(supportQueryOf({ status: "OPEN", page: 3 })).toEqual({
        status: "OPEN",
        page: 2,
      })
    })

    it("laesst Alle aus der Anfrage heraus", () => {
      expect(
        supportQueryOf({ status: ALL_SUPPORT_STATUSES, page: 1 })
      ).toEqual({ status: undefined, page: 0 })
    })
  })
})
