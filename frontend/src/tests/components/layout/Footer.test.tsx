import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderWithProviders } from "@/tests/render"

import { Footer } from "@/components/layout/Footer"

describe("Footer", () => {
  it("zeigt Bildmarke, Beschreibung und beide Linkspalten", () => {
    renderWithProviders(<Footer />)

    expect(screen.getByText("Hochschule Bremen")).toBeVisible()
    expect(
      screen.getByRole("navigation", { name: "Plattform" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("navigation", { name: "Rechtliches" })
    ).toBeInTheDocument()

    for (const label of [
      "Projektbibliothek",
      "Studiengänge",
      "Häufige Fragen",
      "Impressum",
      "Datenschutz",
      "Barrierefreiheit",
    ]) {
      expect(screen.getByRole("link", { name: label })).toBeVisible()
    }
  })

  it("setzt das Jahr zur Laufzeit und nicht als festen Text", () => {
    /* Eine feste Jahreszahl ist am 1. Januar still falsch. */
    renderWithProviders(<Footer />)

    expect(
      screen.getByText(new RegExp(`© ${new Date().getFullYear()}\\b`))
    ).toBeVisible()
  })
})
