import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderWithProviders } from "@/tests/render"

import { UserAvatar } from "@/components/common/UserAvatar"

describe("UserAvatar", () => {
  it("bildet die Initialen aus beiden Namensteilen", () => {
    renderWithProviders(
      <UserAvatar person={{ firstName: "Mira", lastName: "Beispiel" }} />
    )

    expect(screen.getByText("MB")).toBeVisible()
  })

  /*
   * Ueber die Erreichbarkeit geprueft, nicht ueber den Text: die Initialen
   * stehen im DOM und getByText findet sie auch dann, wenn ein aria-hidden
   * darueber liegt. Vor dem Review zu KAN-29 sagte labelled deshalb "MB"
   * statt "Mira Beispiel", ohne dass ein Test es bemerkte.
   */
  it("sagt mit labelled den Namen an, nicht die Initialen", () => {
    renderWithProviders(
      <UserAvatar
        person={{ firstName: "Mira", lastName: "Beispiel" }}
        labelled
      />
    )

    const name = screen.getByText("Mira Beispiel")
    expect(name).toHaveClass("sr-only")
    expect(name.closest("[aria-hidden]")).toBeNull()
    expect(screen.getByText("MB").closest("[aria-hidden]")).not.toBeNull()
  })

  it("bleibt ohne labelled aus dem Vorlesen heraus", () => {
    const { container } = renderWithProviders(
      <UserAvatar person={{ firstName: "Mira", lastName: "Beispiel" }} />
    )

    expect(container.querySelector("[data-slot=avatar]")).toHaveAttribute(
      "aria-hidden",
      "true"
    )
  })

  it("nutzt die Markenflaeche und den Kartenradius statt der Kreisform", () => {
    /* Beide Eingriffe sind im Ticket entschieden (Foundation 7) und stehen
       nur hier, damit sie nicht an jeder Aufrufstelle erneut auftauchen. */
    const { container } = renderWithProviders(
      <UserAvatar person={{ firstName: "Mira", lastName: "Beispiel" }} />
    )

    expect(container.querySelector("[data-slot=avatar]")).toHaveClass(
      "rounded-card"
    )
    expect(container.querySelector("[data-slot=avatar-fallback]")).toHaveClass(
      "bg-surface-brand"
    )
  })
})
