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
  placementPayload,
  placeProjectAt,
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

    /*
     * Ein Klick ist genau ein Platz. Was an der Ziffer abzulesen ist, soll
     * auch geschehen: von Platz 2 nach unten fuehrt auf Platz 3, nicht auf
     * den naechsten besetzten. Gesperrt ist deshalb nur der Rand der Liste,
     * also Platz 1 nach oben und Platz 10 nach unten.
     */
    it("sperrt Platz 1 nach oben", () => {
      expect(canMoveUp(slots, 0)).toBe(false)
      expect(moveSlot(slots, 0, "up")).toBe(slots)
    })

    it("sperrt Platz 10 nach unten", () => {
      const full = buildSlots(
        Array.from({ length: TOP10_SLOT_COUNT }, (_, index) =>
          entry(index + 1, `p${index}`)
        )
      )

      expect(canMoveDown(full, TOP10_SLOT_COUNT - 1)).toBe(false)
      expect(moveSlot(full, TOP10_SLOT_COUNT - 1, "down")).toBe(full)
    })

    it("tauscht zwei benachbarte Eintraege und laesst das Original unberuehrt", () => {
      const moved = moveSlot(slots, 1, "up")

      expect(orderedProjectIds(moved)).toEqual(["b", "a", "c"])
      expect(orderedProjectIds(slots)).toEqual(["a", "b", "c"])
    })

    /*
     * Der Nachbar darf leer sein: dann rueckt das Projekt einen Platz weiter
     * und laesst seinen alten frei. Getauscht wird die Zelle, nicht das
     * Projekt mit dem naechsten Projekt.
     */
    it("rueckt in einen freien Nachbarplatz und laesst den alten frei", () => {
      const withGap = buildSlots([entry(1, "a"), entry(4, "d")])
      const moved = moveSlot(withGap, 3, "up")

      expect(moved[2]?.project.id).toBe("d")
      expect(moved[3]).toBeNull()
      /* Kein Sprung ueber die Luecke hinweg: a bleibt auf Platz 1. */
      expect(moved[0]?.project.id).toBe("a")
      expect(moved[1]).toBeNull()
    })

    it("laesst einen Eintrag ueber mehrere Klicks Platz fuer Platz wandern", () => {
      const withGap = buildSlots([entry(1, "a"), entry(4, "d")])
      const einmal = moveSlot(withGap, 3, "up")
      const zweimal = moveSlot(einmal, 2, "up")

      expect(zweimal[1]?.project.id).toBe("d")
      /* Erst der dritte Klick trifft auf a und tauscht die beiden. */
      const dreimal = moveSlot(zweimal, 1, "up")
      expect(orderedProjectIds(dreimal)).toEqual(["d", "a"])
    })

    it("erlaubt den Zug auch am ersten besetzten Platz, solange darueber ein Platz liegt", () => {
      const withGap = buildSlots([entry(3, "c")])

      expect(canMoveUp(withGap, 2)).toBe(true)
      expect(moveSlot(withGap, 2, "up")[1]?.project.id).toBe("c")
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
      expect(
        orderedProjectIds(addProject(full, projectCard({ id: "elf" })))
      ).toHaveLength(TOP10_SLOT_COUNT)
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

    /*
     * Nacharbeit an KAN-87: Der Aufnahme-Dialog der Projektverwaltung sieht
     * die Liste nicht und laesst den Platz deshalb waehlen. addProject nimmt
     * dagegen immer den ersten freien; beide Wege stehen nebeneinander.
     */
    it("setzt ein Projekt auf den gewaehlten Platz und laesst die Luecken davor", () => {
      const slots = buildSlots([entry(1, "a")])
      const next = placeProjectAt(slots, projectCard({ id: "neu" }), 4)

      expect(next[3]?.project.id).toBe("neu")
      expect(next[1]).toBeNull()
      expect(next[2]).toBeNull()
      /* Der Index ist der Platz, auch ueber die Luecke hinweg (§3.11.1
         Regel 3, seit Contract v78). */
      expect(placementPayload(next)).toEqual(["a", null, null, "neu"])
    })

    it("setzt nichts auf einen belegten Platz", () => {
      const slots = buildSlots([entry(1, "a"), entry(2, "b")])

      expect(placeProjectAt(slots, projectCard({ id: "neu" }), 2)).toBe(slots)
    })

    it("nimmt ein bereits gesetztes Projekt auch hier nicht doppelt auf", () => {
      const slots = buildSlots([entry(1, "a")])

      expect(placeProjectAt(slots, projectCard({ id: "a" }), 5)).toBe(slots)
    })

    it("laesst einen Platz ausserhalb von 1 bis 10 unbeachtet", () => {
      const slots = buildSlots([])

      expect(placeProjectAt(slots, projectCard({ id: "neu" }), 0)).toBe(slots)
      expect(placeProjectAt(slots, projectCard({ id: "neu" }), 11)).toBe(slots)
    })

    /* Ein frisch gesetztes Projekt ist noch nicht aufgenommen: einen
       Zeitpunkt zu erfinden hiesse, eine Angabe zu behaupten, die erst der
       Server vergibt (§3.11). */
    it("laesst addedAt am neuen Eintrag leer", () => {
      const next = placeProjectAt(buildSlots([]), projectCard({ id: "neu" }), 3)

      expect(next[2]?.addedAt).toBeNull()
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
     * Seit Contract v78 ist der Ort einer Luecke Teil der Nutzlast: eine
     * verschobene Luecke ist deshalb sehr wohl eine Aenderung. Bis v77 war
     * sie es nicht, weil der Server ohnehin dicht durchnummerierte.
     */
    it("meldet eine verschobene Luecke als veraendert", () => {
      const withGap = buildSlots([entry(1, "a"), entry(3, "c")])
      const anders = buildSlots([entry(1, "a"), entry(2, "c")])

      expect(hasOrderChanged(anders, withGap)).toBe(true)
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

  describe("placementPayload", () => {
    /*
     * Contract v78: der Index ist der Platz, null heisst „Platz frei".
     * Damit laesst sich genau das ablegen, was die Oberflaeche zeigt.
     */
    it("traegt den freien Platz als null mit", () => {
      const slots = buildSlots([entry(1, "a"), entry(3, "c")])

      expect(placementPayload(slots)).toEqual(["a", null, "c"])
    })

    it("schneidet nachlaufende freie Plaetze ab", () => {
      const slots = buildSlots([entry(1, "a"), entry(2, "b")])

      /* Zehn Zellen, aber nur zwei belegt: acht null am Ende waeren
         bedeutungslos, der Server schneidet sie ohnehin ab. */
      expect(placementPayload(slots)).toEqual(["a", "b"])
    })

    it("laesst fuehrende und mittlere freie Plaetze stehen", () => {
      const slots = buildSlots([entry(2, "b"), entry(5, "e")])

      expect(placementPayload(slots)).toEqual([null, "b", null, null, "e"])
    })

    it("liefert fuer eine leere Liste eine leere Nutzlast", () => {
      expect(placementPayload(buildSlots([]))).toEqual([])
    })

    /*
     * Der eigentliche Gewinn von v78: ein Zug in einen freien Platz ist
     * jetzt eine echte Aenderung und kein Zug ins Leere.
     */
    it("unterscheidet einen Zug in einen freien Platz vom Ausgangsstand", () => {
      const slots = buildSlots([entry(1, "a"), entry(4, "d")])
      const moved = moveSlot(slots, 3, "up")

      expect(placementPayload(slots)).toEqual(["a", null, null, "d"])
      expect(placementPayload(moved)).toEqual(["a", null, "d"])
      expect(hasOrderChanged(moved, slots)).toBe(true)
    })
  })
})
