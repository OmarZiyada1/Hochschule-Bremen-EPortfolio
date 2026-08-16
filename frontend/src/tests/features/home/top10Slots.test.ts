import { describe, expect, it } from "vitest"

import { top10Slots } from "@/features/home/top10Slots"

/**
 * Randfaelle der Platzbelegung (Ticket KAN-31, §3.11): position ist der
 * Platz, nie der Index; was ausserhalb von 1 bis 10 liegt oder keine
 * position traegt, verrueckt die Liste nicht. Die Luecken- und Leerfaelle
 * der sichtbaren Seite prueft HomePage.test.tsx.
 */
describe("top10Slots", () => {
  it("verwirft Eintraege ohne oder mit unzulaessiger position", () => {
    const slots = top10Slots([
      { position: 0, project: { title: "Zu klein" } },
      { position: 11, project: { title: "Zu gross" } },
      { project: { title: "Ohne Platz" } },
      { position: 2, project: { title: "Gueltig" } },
    ])

    expect(slots).toHaveLength(10)
    expect(slots[1].entry?.project?.title).toBe("Gueltig")
    expect(
      slots.filter((slot) => slot.entry !== undefined)
    ).toHaveLength(1)
  })

  it("fuellt ueber position, nicht ueber die Reihenfolge der Antwort", () => {
    const slots = top10Slots([
      { position: 7, project: { title: "Sieben" } },
      { position: 1, project: { title: "Eins" } },
    ])

    expect(slots[0].entry?.project?.title).toBe("Eins")
    expect(slots[6].entry?.project?.title).toBe("Sieben")
    expect(slots[1].entry).toBeUndefined()
  })
})
