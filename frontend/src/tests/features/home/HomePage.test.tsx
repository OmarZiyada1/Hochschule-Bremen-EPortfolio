import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { renderWithProviders } from "@/tests/render"

import HomePage from "@/features/home/HomePage"

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

  it("wechselt den Modus ohne Neuladen und benennt die Gegenrichtung", async () => {
    const user = userEvent.setup()
    renderWithProviders(<HomePage />)

    const toggle = screen.getByRole("button", {
      name: "Dunklen Modus einschalten",
    })
    expect(document.documentElement).not.toHaveClass("dark")

    await user.click(toggle)

    expect(document.documentElement).toHaveClass("dark")
    expect(
      screen.getByRole("button", { name: "Hellen Modus einschalten" })
    ).toBeInTheDocument()
  })

  it("merkt sich die Wahl", async () => {
    const user = userEvent.setup()
    renderWithProviders(<HomePage />)

    await user.click(
      screen.getByRole("button", { name: "Dunklen Modus einschalten" })
    )

    expect(window.localStorage.getItem("theme")).toBe("dark")
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
