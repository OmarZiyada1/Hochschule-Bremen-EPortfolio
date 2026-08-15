import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderWithProviders } from "@/tests/render"

import { Pill, type PillTone } from "@/components/common/Pill"

const tones: PillTone[] = ["neutral", "info", "success", "warning", "danger"]

describe("Pill", () => {
  it.each(tones)("traegt fuer %s ein eigenes Farbpaar", (tone) => {
    renderWithProviders(<Pill tone={tone}>Beispiel</Pill>)

    const pill = screen.getByText("Beispiel")
    const expected =
      tone === "neutral"
        ? ["bg-badge-neutral-bg", "text-badge-neutral-fg"]
        : [`bg-pill-${tone}-bg`, `text-pill-${tone}-fg`]

    /* Geprueft wird das Paar und nicht nur die Flaeche: ein Ton, der sich
       die Schriftfarbe von muted-foreground borgt, sieht fast gleich aus
       und verliert die geprüfte Kontrastzusage. */
    for (const className of expected) {
      expect(pill).toHaveClass(className)
    }
  })

  it("ist ohne Angabe neutral", () => {
    renderWithProviders(<Pill>Beispiel</Pill>)

    expect(screen.getByText("Beispiel")).toHaveClass("bg-badge-neutral-bg")
  })
})
