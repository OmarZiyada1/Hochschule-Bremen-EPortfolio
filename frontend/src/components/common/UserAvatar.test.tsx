import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderWithProviders } from "@/test/render"

import { UserAvatar } from "./UserAvatar"

describe("UserAvatar", () => {
  it("bildet die Initialen aus beiden Namensteilen", () => {
    renderWithProviders(
      <UserAvatar
        person={{ firstName: "Mira", lastName: "Beispiel" }}
        labelled
      />
    )

    expect(screen.getByText("MB")).toBeVisible()
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
