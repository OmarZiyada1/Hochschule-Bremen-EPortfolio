import { describe, expect, it } from "vitest"

import {
  auditQueryOf,
  dayEndIso,
  dayStartIso,
  DEFAULT_NOMINATION_FILTER,
  isIsoDate,
  readAdminTop10AuditState,
  readNominationFilter,
  writeAdminTop10AuditState,
  writeNominationFilter,
} from "@/features/administration/adminTop10Filters"

/**
 * Der Ansichtszustand der Top-10-Verwaltung und ihres Protokolls (Ticket
 * KAN-40, Test 9). Geprueft wird ohne Rendern: was in der Adresse steht,
 * muss ohne Oberflaeche belegbar sein.
 */
describe("adminTop10Filters", () => {
  describe("Statusfilter der Nominierungen", () => {
    /* Klaerungsrunde zu KAN-40: ohne Parameter zeigt die Verwaltung die
       offenen Vorschlaege, wie der Frame es ueberschreibt. */
    it("zeigt ohne Parameter die offenen Vorschlaege", () => {
      expect(readNominationFilter(new URLSearchParams())).toBe(
        DEFAULT_NOMINATION_FILTER
      )
      expect(DEFAULT_NOMINATION_FILTER).toBe("PENDING")
    })

    it("liest die drei uebrigen Staende aus 2.8 und den Sonderwert alle", () => {
      expect(readNominationFilter(new URLSearchParams("status=ACCEPTED"))).toBe(
        "ACCEPTED"
      )
      expect(readNominationFilter(new URLSearchParams("status=WITHDRAWN"))).toBe(
        "WITHDRAWN"
      )
      expect(readNominationFilter(new URLSearchParams("status=all"))).toBe("all")
    })

    /* Ein Fantasiewert endete als 400 VALIDATION_FAILED, obwohl ihn kein
       Bedienelement erzeugen kann. */
    it("faellt bei einem unbekannten Wert auf den Standard zurueck", () => {
      expect(readNominationFilter(new URLSearchParams("status=BUNT"))).toBe(
        DEFAULT_NOMINATION_FILTER
      )
    })

    it("laesst den Standard aus der Adresse weg und schreibt jeden anderen", () => {
      expect(
        writeNominationFilter(new URLSearchParams("status=all"), "PENDING")
          .toString()
      ).toBe("")
      expect(
        writeNominationFilter(new URLSearchParams(), "REJECTED").toString()
      ).toBe("status=REJECTED")
    })
  })

  describe("Zustand der Protokollseite", () => {
    it("liest Zeitraum, Person und Seite", () => {
      const state = readAdminTop10AuditState(
        new URLSearchParams("from=2026-08-01&to=2026-08-25&admin=u-1&page=3")
      )

      expect(state).toEqual({
        from: "2026-08-01",
        to: "2026-08-25",
        admin: "u-1",
        page: 3,
      })
    })

    it("verwirft ein Datum, das es nicht gibt", () => {
      expect(isIsoDate("2026-02-31")).toBe(false)
      expect(isIsoDate("2026-08-01")).toBe(true)
      expect(
        readAdminTop10AuditState(new URLSearchParams("from=2026-02-31")).from
      ).toBeNull()
    })

    it("faellt bei einer unbrauchbaren Seitenzahl auf Seite 1 zurueck", () => {
      expect(readAdminTop10AuditState(new URLSearchParams("page=0")).page).toBe(1)
      expect(
        readAdminTop10AuditState(new URLSearchParams("page=abc")).page
      ).toBe(1)
    })

    /* Die alte Seitenzahl gehoerte zur alten Treffermenge. */
    it("setzt bei jeder Filteraenderung auf Seite 1 zurueck", () => {
      const next = writeAdminTop10AuditState(
        new URLSearchParams("page=4&admin=u-1"),
        { admin: "u-2" }
      )

      expect(next.get("page")).toBeNull()
      expect(next.get("admin")).toBe("u-2")
    })

    it("behaelt die Filter, wenn nur die Seite wechselt", () => {
      const next = writeAdminTop10AuditState(
        new URLSearchParams("from=2026-08-01&admin=u-1"),
        { page: 2 }
      )

      expect(next.get("page")).toBe("2")
      expect(next.get("from")).toBe("2026-08-01")
    })

    it("nimmt einen geleerten Filter aus der Adresse", () => {
      const next = writeAdminTop10AuditState(
        new URLSearchParams("from=2026-08-01&to=2026-08-25&admin=u-1"),
        { from: null, to: null, admin: null }
      )

      expect(next.toString()).toBe("")
    })
  })

  describe("Tagesgrenzen", () => {
    /*
     * Ticket KAN-40, Test 9: der Zeitraumfilter schickt ISO-8601-Zeitpunkte
     * in UTC, und ein Bereich bis zum heutigen Tag schliesst den heutigen
     * Tag ein. Der Server legt keine Zeitzone fest (§6.1), die Grenzen
     * bildet die Oberflaeche in der Zeitzone der lesenden Person; deshalb
     * wird hier gegen die lokale Mitternacht geprueft und nicht gegen eine
     * feste Zeichenkette.
     */
    it("bildet den Beginn des Tages in der Zeitzone der lesenden Person", () => {
      expect(dayStartIso("2026-08-01")).toBe(
        new Date(2026, 7, 1, 0, 0, 0, 0).toISOString()
      )
    })

    it("bildet das Ende als letzte Millisekunde und nicht als naechste Mitternacht", () => {
      expect(dayEndIso("2026-08-25")).toBe(
        new Date(2026, 7, 25, 23, 59, 59, 999).toISOString()
      )
      expect(dayEndIso("2026-08-25")).not.toBe(dayStartIso("2026-08-26"))
    })

    it("schickt beide Grenzen als Zeitpunkt in UTC und die Seite ab 0", () => {
      const query = auditQueryOf({
        from: "2026-08-01",
        to: "2026-08-25",
        admin: "u-1",
        page: 2,
      })

      expect(query.from).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/)
      expect(query.to).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/)
      expect(query.admin).toBe("u-1")
      expect(query.page).toBe(1)
    })

    it("laesst einen nicht gesetzten Filter weg, statt ihn leer zu schicken", () => {
      const query = auditQueryOf({ from: null, to: null, admin: null, page: 1 })

      expect(query.from).toBeUndefined()
      expect(query.to).toBeUndefined()
      expect(query.admin).toBeUndefined()
      expect(query.page).toBe(0)
    })
  })
})
