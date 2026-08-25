import { describe, expect, it } from "vitest"

import type { Top10EntryResponse } from "@/api/types"
import {
  addProject,
  buildSlots,
  canMoveDown,
  canMoveUp,
  clearSlot,
  containsProject,
  freePositions,
  hasOrderChanged,
  isFull,
  moveSlot,
  orderedProjectIds,
  slotSignature,
  suggestedPositionFor,
  TOP10_SLOT_COUNT,
} from "@/features/administration/top10Slots"
import { projectCard, top10Entry } from "@/tests/fixtures"

function entry(position: number, id: string): Top10EntryResponse {
  return top10Entry({ position, project: projectCard({ id, title: id }) })
}

/**
 * Die Plaetze der Top-10 als reine Funktionen (Ticket KAN-40, Test 3 bis 5).
 * Geprueft wird ohne Rendern: die Reihenfolge ist die Aussage dieser
 * Ansicht, und sie muss ohne Oberflaeche belegbar sein.
 */
describe("top10Slots", () => {
  describe("buildSlots", () => {
    it("legt immer zehn Zellen an, auch fuer eine leere Liste", () => {
      expect(buildSlots([])).toHaveLength(TOP10_SLOT_COUNT)
      expect(buildSlots([]).every((slot) => slot === null)).toBe(true)
    })

    /*
     * §3.11.1: Plaetze sind Plaetze und keine dichte Rangfolge. Ein Projekt,
     * das PUBLISHED verlaesst, raeumt seinen Platz, und die uebrigen ruecken
     * nicht nach. Einsortiert wird deshalb ueber position und nie ueber den
     * Index in der Antwort.
     */
    it("sortiert ueber position und laesst eine Luecke stehen", () => {
      const slots = buildSlots([entry(1, "a"), entry(4, "d")])

      expect(slots[0]?.project.id).toBe("a")
      expect(slots[1]).toBeNull()
      expect(slots[2]).toBeNull()
      expect(slots[3]?.project.id).toBe("d")
    })

    it("uebergeht einen Platz ausserhalb von 1 bis 10, statt ihn zu raten", () => {
      expect(buildSlots([entry(11, "x")]).every((slot) => slot === null)).toBe(
        true
      )
    })
  })

  describe("Umsortieren", () => {
    const slots = buildSlots([entry(1, "a"), entry(2, "b"), entry(3, "c")])

    /* Ticket KAN-40, Test 3: erste Zeile nach oben und letzte Zeile nach
       unten sind wirkungslos und im Bedienelement gesperrt. */
    it("sperrt den ersten besetzten Platz nach oben", () => {
      expect(canMoveUp(slots, 0)).toBe(false)
      expect(moveSlot(slots, 0, "up")).toBe(slots)
    })

    it("sperrt den letzten besetzten Platz nach unten", () => {
      expect(canMoveDown(slots, 2)).toBe(false)
      expect(moveSlot(slots, 2, "down")).toBe(slots)
    })

    it("tauscht zwei benachbarte Eintraege und laesst das Original unberuehrt", () => {
      const moved = moveSlot(slots, 1, "up")

      expect(orderedProjectIds(moved)).toEqual(["b", "a", "c"])
      expect(orderedProjectIds(slots)).toEqual(["a", "b", "c"])
    })

    /*
     * Freie Plaetze werden uebersprungen: getauscht werden immer zwei
     * Projekte, und die Luecke bleibt, wo sie ist. Ein Tausch mit einer
     * leeren Zelle verschoebe nur sie und aenderte an der gespeicherten
     * Reihenfolge nichts, weil PUT /admin/top10 dicht durchnummeriert.
     */
    it("ueberspringt eine Luecke und laesst sie an ihrem Platz", () => {
      const withGap = buildSlots([entry(1, "a"), entry(4, "d")])
      const moved = moveSlot(withGap, 3, "up")

      expect(moved[0]?.project.id).toBe("d")
      expect(moved[3]?.project.id).toBe("a")
      expect(moved[1]).toBeNull()
      expect(moved[2]).toBeNull()
    })

    it("meldet einen leeren Platz als nicht verschiebbar", () => {
      const withGap = buildSlots([entry(1, "a"), entry(4, "d")])

      expect(canMoveUp(withGap, 1)).toBe(false)
      expect(canMoveDown(withGap, 1)).toBe(false)
    })
  })

  describe("Aufnehmen und Raeumen", () => {
    it("setzt ein Projekt auf den ersten freien Platz", () => {
      const slots = buildSlots([entry(1, "a"), entry(3, "c")])
      const next = addProject(slots, projectCard({ id: "neu" }))

      expect(next[1]?.project.id).toBe("neu")
      expect(orderedProjectIds(next)).toEqual(["a", "neu", "c"])
    })

    /* Ticket KAN-40, Test 5: ein elfter Eintrag ist nicht anlegbar. */
    it("nimmt bei zehn belegten Plaetzen kein weiteres Projekt auf", () => {
      const full = buildSlots(
        Array.from({ length: TOP10_SLOT_COUNT }, (_, index) =>
          entry(index + 1, `p${index}`)
        )
      )

      expect(isFull(full)).toBe(true)
      expect(addProject(full, projectCard({ id: "elf" }))).toBe(full)
      expect(orderedProjectIds(addProject(full, projectCard({ id: "elf" }))))
        .toHaveLength(TOP10_SLOT_COUNT)
    })

    /* Ein doppelter Eintrag ergaebe serverseitig 400 VALIDATION_FAILED. */
    it("nimmt ein bereits gesetztes Projekt nicht ein zweites Mal auf", () => {
      const slots = buildSlots([entry(1, "a")])

      expect(containsProject(slots, "a")).toBe(true)
      expect(addProject(slots, projectCard({ id: "a" }))).toBe(slots)
    })

    it("hinterlaesst beim Raeumen eine Luecke, ohne nachzuruecken", () => {
      const slots = buildSlots([entry(1, "a"), entry(2, "b"), entry(3, "c")])
      const next = clearSlot(slots, 1)

      expect(next[1]).toBeNull()
      expect(next[2]?.project.id).toBe("c")
      expect(orderedProjectIds(next)).toEqual(["a", "c"])
    })
  })

  describe("orderedProjectIds", () => {
    /*
     * §3.11.1 Regel 3: die Reihenfolge ist der Array-Index, freie Plaetze
     * fallen weg. Der Server nummeriert danach lueckenlos ab 1 durch.
     */
    it("laesst freie Plaetze weg und behaelt die Reihenfolge", () => {
      const slots = buildSlots([entry(2, "b"), entry(5, "e"), entry(9, "i")])

      expect(orderedProjectIds(slots)).toEqual(["b", "e", "i"])
    })
  })

  describe("hasOrderChanged", () => {
    const original = buildSlots([entry(1, "a"), entry(2, "b")])

    it("meldet den unveraenderten Stand als unveraendert", () => {
      expect(hasOrderChanged(original, original)).toBe(false)
    })

    it("meldet eine getauschte Reihenfolge als veraendert", () => {
      expect(hasOrderChanged(moveSlot(original, 1, "up"), original)).toBe(true)
    })

    it("meldet einen geraeumten Platz als veraendert", () => {
      expect(hasOrderChanged(clearSlot(original, 0), original)).toBe(true)
    })

    /*
     * Eine bloss verschobene Luecke aendert am Ergebnis von PUT
     * /admin/top10 nichts: „Reihenfolge speichern" bleibt deshalb gesperrt
     * und verspricht keine Aenderung, die keine waere.
     */
    it("meldet eine bloss verschobene Luecke als unveraendert", () => {
      const withGap = buildSlots([entry(1, "a"), entry(3, "c")])
      const same = buildSlots([entry(1, "a"), entry(2, "c")])

      expect(hasOrderChanged(same, withGap)).toBe(false)
    })
  })

  describe("freePositions und suggestedPositionFor", () => {
    it("nennt die unbesetzten Plaetze aufsteigend", () => {
      const slots = buildSlots([entry(1, "a"), entry(3, "c")])

      expect(freePositions(slots)).toEqual([2, 4, 5, 6, 7, 8, 9, 10])
    })

    /*
     * §2.13: TOP_1 meint Platz 1, TOP_5 die Plaetze 2 bis 5, TOP_10 die
     * Plaetze 6 bis 10. Die Stufe bereitet die Entscheidung vor und bindet
     * sie nicht; der Server prueft den Zusammenhang nicht.
     */
    it("belegt mit dem ersten freien Platz im Bereich der Stufe vor", () => {
      expect(suggestedPositionFor("TOP_1", [1, 2, 3])).toBe(1)
      expect(suggestedPositionFor("TOP_5", [1, 3, 4])).toBe(3)
      expect(suggestedPositionFor("TOP_10", [2, 7, 8])).toBe(7)
    })

    it("belegt nichts vor, wenn im Bereich der Stufe kein Platz frei ist", () => {
      expect(suggestedPositionFor("TOP_1", [2, 3, 4])).toBeNull()
      expect(suggestedPositionFor("TOP_10", [1, 2])).toBeNull()
    })
  })

  describe("slotSignature", () => {
    it("unterscheidet zwei Staende mit derselben Menge in anderer Ordnung", () => {
      const a = slotSignature([entry(1, "a"), entry(2, "b")])
      const b = slotSignature([entry(1, "b"), entry(2, "a")])

      expect(a).not.toBe(b)
    })

    it("bleibt fuer denselben Stand gleich", () => {
      expect(slotSignature([entry(1, "a")])).toBe(slotSignature([entry(1, "a")]))
    })
  })
})
