import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderWithProviders } from "@/tests/render"

import HomePage from "@/features/home/HomePage"

/* Der Moduswechsel sitzt seit KAN-7 in der NavBar des Anwendungsrahmens;
   seine Tests liegen bei AppLayout und NavBar. */
describe("HomePage", () => {
  it("zeigt den Seitentitel als einzige Ueberschrift erster Ebene", () => {
    renderWithProviders(<HomePage />)

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "E-Portfolio Hochschule Bremen",
      })
    ).toBeInTheDocument()
  })

  it("fuehrt im Entwicklungs-Build zur Pruefflaeche der Tokenschicht", () => {
    renderWithProviders(<HomePage />)

    expect(
      screen.getByRole("link", { name: "Zur Tokenschicht" })
    ).toHaveAttribute("href", "/dev/tokens")
  })

  it("fuehrt im Entwicklungs-Build zur Komponentenbibliothek", () => {
    renderWithProviders(<HomePage />)

    expect(
      screen.getByRole("link", { name: "Zur Komponentenbibliothek" })
    ).toHaveAttribute("href", "/dev/components")
  })
})
