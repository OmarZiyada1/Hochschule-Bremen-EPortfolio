import { describe, expect, it } from "vitest"

import { ALL_STATUSES } from "@/features/portfolio/ownProjectStatus"
import {
  readReviewState,
  REVIEW_STATUSES,
  writeReviewState,
} from "@/features/reviews/reviewFilters"

/**
 * Der Ansichtszustand von „Meine Reviews" als reine Funktionen (KAN-37).
 * Sie tragen die Zusage aus dem Ticket, dass Suche, Status, Filter und
 * Seite in der Adresse stehen und einen Neuaufbau der Seite ueberstehen.
 */
describe("reviewFilters", () => {
  describe("REVIEW_STATUSES", () => {
    it("fuehrt die vier Status des Templates ohne DRAFT", () => {
      /* Ein Entwurf erscheint in editor=me gar nicht erst: die Redaktion
         liest nicht veroeffentlichte Projekte erst ab SUBMITTED (§5
         Fussnote 11). Ein Segment, das zuverlaessig nichts findet, waere
         ein Ziel ohne Zweck. */
      expect(REVIEW_STATUSES).toEqual([
        "SUBMITTED",
        "APPROVED",
        "PUBLISHED",
        "REVISION",
      ])
    })
  })

  describe("readReviewState", () => {
    it("liest alle Werte aus der Adresse", () => {
      const state = readReviewState(
        new URLSearchParams(
          "q=Robo&status=APPROVED&studyProgram=sp-1&semester=se-1&module=m-1&page=3"
        )
      )

      expect(state).toEqual({
        q: "Robo",
        status: "APPROVED",
        studyProgram: "sp-1",
        semester: "se-1",
        module: "m-1",
        page: 3,
      })
    })

    it("faellt ohne Parameter auf den Grundzustand zurueck", () => {
      expect(readReviewState(new URLSearchParams())).toEqual({
        q: "",
        status: ALL_STATUSES,
        studyProgram: null,
        semester: null,
        module: null,
        page: 1,
      })
    })

    it("behandelt einen unbekannten Status als Alle", () => {
      /* Ein von Hand geschriebener Fantasiestatus endete am Server als 400,
         obwohl ihn kein Segment erzeugen kann. */
      const state = readReviewState(new URLSearchParams("status=ERFUNDEN"))
      expect(state.status).toBe(ALL_STATUSES)
    })

    it("behandelt eine unbrauchbare Seitenzahl als Seite 1", () => {
      expect(readReviewState(new URLSearchParams("page=abc")).page).toBe(1)
      expect(readReviewState(new URLSearchParams("page=0")).page).toBe(1)
      expect(readReviewState(new URLSearchParams("page=-2")).page).toBe(1)
    })
  })

  describe("writeReviewState", () => {
    it("setzt einen Wert und laesst die uebrigen stehen", () => {
      const next = writeReviewState(new URLSearchParams("q=Robo"), {
        status: "SUBMITTED",
      })

      expect(next.get("q")).toBe("Robo")
      expect(next.get("status")).toBe("SUBMITTED")
    })

    it("entfernt den Parameter beim Grundzustand statt ihn zu setzen", () => {
      const next = writeReviewState(
        new URLSearchParams("q=Robo&status=SUBMITTED&module=m-1"),
        { q: "", status: ALL_STATUSES, module: null }
      )

      expect(next.has("q")).toBe(false)
      expect(next.has("status")).toBe(false)
      expect(next.has("module")).toBe(false)
    })

    it("setzt bei jeder Aenderung ausser der Seite auf Seite 1 zurueck", () => {
      /* Die alte Seitenzahl gehoerte zur alten Treffermenge. */
      const filtered = writeReviewState(new URLSearchParams("page=4"), {
        semester: "se-1",
      })
      expect(filtered.has("page")).toBe(false)

      const paged = writeReviewState(new URLSearchParams("q=Robo"), { page: 3 })
      expect(paged.get("page")).toBe("3")
      expect(paged.get("q")).toBe("Robo")
    })

    it("schreibt Seite 1 nicht in die Adresse", () => {
      const next = writeReviewState(new URLSearchParams("page=4"), { page: 1 })
      expect(next.has("page")).toBe(false)
    })

    it("ueberlebt den Weg hin und zurueck", () => {
      /* Die Zusage aus dem Ticket: der Ansichtszustand uebersteht einen
         Neuaufbau der Seite, weil er vollstaendig in der Adresse steht. */
      const written = writeReviewState(new URLSearchParams(), {
        q: "Robo",
        status: "REVISION",
        studyProgram: "sp-1",
        semester: "se-1",
        module: "m-1",
      })
      const withPage = writeReviewState(written, { page: 2 })

      expect(readReviewState(withPage)).toEqual({
        q: "Robo",
        status: "REVISION",
        studyProgram: "sp-1",
        semester: "se-1",
        module: "m-1",
        page: 2,
      })
    })
  })
})
