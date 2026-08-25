import { describe, expect, it } from "vitest"

import {
  AVATAR_GROUP_GAP_REM,
  AVATAR_SIZES,
  fannedGroupWidthRem,
  type UserAvatarSize,
} from "@/lib/avatarSize"

const SIZES = Object.keys(AVATAR_SIZES) as UserAvatarSize[]

/**
 * Die Masstabelle der Avatare und die daraus gerechnete Breite einer
 * aufgefaecherten Gruppe (KAN-80).
 */
describe("AVATAR_SIZES", () => {
  /*
   * box und rem sagen dasselbe in zwei Sprachen. Laufen sie auseinander,
   * reserviert die Gruppe Platz fuer eine Groesse, die es nicht mehr gibt,
   * und die Kachel springt beim Hovern wieder. Ohne diesen Test faellt das
   * niemandem auf: es gibt weder einen Compilerfehler noch eine Lint-Warnung.
   */
  it("haelt die Tailwind-Klasse und den Zahlwert deckungsgleich", () => {
    for (const size of SIZES) {
      const { box, rem } = AVATAR_SIZES[size]
      const step = Number.parseInt(box.replace("size-", ""), 10)

      /* Tailwinds Skala: eine Stufe sind 0,25rem. */
      expect(step * 0.25, `${size}: ${box} passt nicht zu ${rem}rem`).toBe(rem)
    }
  })

  it("fuehrt genau die vier Stufen mit Fundstelle im Template", () => {
    expect(SIZES.sort()).toEqual(["lg", "md", "sm", "xl"])
  })
})

describe("fannedGroupWidthRem", () => {
  it("rechnet Gesicht plus Abstand je Person", () => {
    expect(fannedGroupWidthRem(3, "sm")).toBe(
      3 * (AVATAR_SIZES.sm.rem + AVATAR_GROUP_GAP_REM)
    )
  })

  it("waechst mit der Zahl der Personen", () => {
    expect(fannedGroupWidthRem(5, "sm")).toBeGreaterThan(
      fannedGroupWidthRem(3, "sm")
    )
  })

  /* Eine leere Gruppe gibt es nicht; die Formel darf trotzdem nicht in den
     negativen Bereich laufen und damit ein min-width erzeugen, das nichts
     bedeutet. */
  it("ist bei null Personen null", () => {
    expect(fannedGroupWidthRem(0, "sm")).toBe(0)
  })
})
