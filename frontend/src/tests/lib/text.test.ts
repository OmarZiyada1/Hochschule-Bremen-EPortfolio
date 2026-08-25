import { describe, expect, it } from "vitest"

import { isTruncated, truncate, TITLE_TRUNCATE_LENGTH } from "@/lib/text"

/**
 * Kuerzung langer Projekttitel in Tabellen und im Brotkrumenpfad (KAN-80).
 */
describe("truncate", () => {
  it("laesst kurze Texte unveraendert", () => {
    expect(truncate("Campus-Garten")).toBe("Campus-Garten")
    expect(isTruncated("Campus-Garten")).toBe(false)
  })

  it("laesst einen Text auf der Grenze unveraendert", () => {
    const exact = "a".repeat(TITLE_TRUNCATE_LENGTH)

    expect(truncate(exact)).toBe(exact)
    expect(isTruncated(exact)).toBe(false)
  })

  it("kuerzt ab einem Zeichen darueber und haengt das Auslassungszeichen an", () => {
    const long = "a".repeat(TITLE_TRUNCATE_LENGTH + 1)

    expect(truncate(long)).toBe(`${"a".repeat(TITLE_TRUNCATE_LENGTH)}…`)
    expect(isTruncated(long)).toBe(true)
  })

  it("kuerzt nach Zeichen und nicht nach Woertern", () => {
    expect(truncate("Nachhaltige Mobilitaetskonzepte")).toBe(
      "Nachhaltige Mobilita…"
    )
  })

  /* Ohne trimEnd stuende ein Leerzeichen vor dem Auslassungszeichen. */
  it("laesst kein Leerzeichen vor dem Auslassungszeichen stehen", () => {
    expect(truncate("Nachhaltige Mobilit aetskonzepte")).toBe(
      "Nachhaltige Mobilit…"
    )
  })

  it("nimmt eine eigene Grenze an", () => {
    expect(truncate("Campus-Garten", 6)).toBe("Campus…")
    expect(isTruncated("Campus-Garten", 6)).toBe(true)
  })
})
