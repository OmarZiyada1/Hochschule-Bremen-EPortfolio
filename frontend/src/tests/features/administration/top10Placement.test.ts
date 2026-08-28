import { describe, expect, it } from "vitest"

import type { ProjectStatus } from "@/api/types"
import { top10PlacementBlockReason } from "@/features/administration/top10Placement"

/**
 * Die Sperrgruende der unmittelbaren Aufnahme in die Top-10 (§3.11, §3.11.1;
 * Nacharbeit an KAN-87) als reine Funktion, ohne Rendern geprueft.
 *
 * <p>Der Unterschied zum Nominieren ist die Aussage dieses Tests: ein offener
 * Vorschlag sperrt die Aufnahme <em>nicht</em>. §3.11.1 Regel 2 verbietet den
 * zweiten Vorschlag zu einem Projekt, nicht seine Aufnahme; wird es
 * aufgenommen, gilt der offene Vorschlag laut §6.1 damit als angenommen.
 */
describe("top10PlacementBlockReason", () => {
  it("laesst ein veroeffentlichtes Projekt bei freiem Platz durch", () => {
    expect(
      top10PlacementBlockReason({ status: "PUBLISHED" }, false, false)
    ).toBeNull()
  })

  it("sperrt jeden Status ausser PUBLISHED", () => {
    const others: ProjectStatus[] = [
      "DRAFT",
      "SUBMITTED",
      "APPROVED",
      "REVISION",
    ]
    for (const status of others) {
      expect(top10PlacementBlockReason({ status }, false, false)).toBe(
        "notPublished"
      )
    }
  })

  it("sperrt ein Projekt, das bereits einen Platz belegt", () => {
    expect(
      top10PlacementBlockReason({ status: "PUBLISHED" }, true, false)
    ).toBe("inTop10")
  })

  it("sperrt, wenn alle zehn Plaetze vergeben sind", () => {
    expect(
      top10PlacementBlockReason({ status: "PUBLISHED" }, false, true)
    ).toBe("listFull")
  })

  /*
   * Die Reihenfolge der Pruefungen ist eine Zusage und keine Nebensache: der
   * genaueste Grund gewinnt. Ein unveroeffentlichtes Projekt in einer vollen
   * Liste meldet „nicht veroeffentlicht", denn das bleibt auch dann wahr,
   * wenn ein Platz frei wird.
   */
  it("nennt bei mehreren Gruenden den genauesten zuerst", () => {
    expect(top10PlacementBlockReason({ status: "DRAFT" }, true, true)).toBe(
      "notPublished"
    )
    expect(top10PlacementBlockReason({ status: "PUBLISHED" }, true, true)).toBe(
      "inTop10"
    )
  })
})
