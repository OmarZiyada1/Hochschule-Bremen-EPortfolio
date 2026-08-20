import { describe, expect, it } from "vitest"

import { top10Slots } from "@/features/home/top10Slots"
import { projectCard, top10Entry } from "@/tests/fixtures"

/**
 * Randfaelle der Platzbelegung (Ticket KAN-31, §3.11): position ist der
 * Platz, nie der Index; was ausserhalb von 1 bis 10 liegt, verrueckt die
 * Liste nicht. Die Luecken- und Leerfaelle der sichtbaren Seite prueft
 * HomePage.test.tsx.
 *
 * Einen Eintrag ohne position gibt es seit KAN-76 nicht mehr zu pruefen:
 * das Feld ist Pflicht, der Fall waere im Typ nicht mehr darstellbar.
 */
describe("top10Slots", () => {
  it("verwirft Eintraege mit unzulaessiger position", () => {
    const slots = top10Slots([
      top10Entry({ position: 0, project: projectCard({ title: "Zu klein" }) }),
      top10Entry({ position: 11, project: projectCard({ title: "Zu gross" }) }),
      top10Entry({ position: 2, project: projectCard({ title: "Gueltig" }) }),
    ])

    expect(slots).toHaveLength(10)
    expect(slots[1].entry?.project.title).toBe("Gueltig")
    expect(slots.filter((slot) => slot.entry !== undefined)).toHaveLength(1)
  })

  it("fuellt ueber position, nicht ueber die Reihenfolge der Antwort", () => {
    const slots = top10Slots([
      top10Entry({ position: 7, project: projectCard({ title: "Sieben" }) }),
      top10Entry({ position: 1, project: projectCard({ title: "Eins" }) }),
    ])

    expect(slots[0].entry?.project.title).toBe("Eins")
    expect(slots[6].entry?.project.title).toBe("Sieben")
    expect(slots[1].entry).toBeUndefined()
  })
})
