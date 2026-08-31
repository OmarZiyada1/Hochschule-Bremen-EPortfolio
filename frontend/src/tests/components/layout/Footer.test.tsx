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
      "Hilfe & Dokumentation",
      "Impressum",
      "Datenschutz",
      "Barrierefreiheit",
    ]) {
      expect(screen.getByRole("link", { name: label })).toBeVisible()
    }

    /* /study-programs und /faq sind mit der Klaerungsrunde zu KAN-7
       entfallen: hinter ihnen steht weder Template noch Ticket, und ein
       Link auf die 404-Seite waere eine Attrappe. */
    expect(
      screen.queryByRole("link", { name: "Studiengänge" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: "Häufige Fragen" })
    ).not.toBeInTheDocument()
  })

  /* Der zweite Einstieg in die Hilfeseite (KAN-93). Der erste ist das
     Fragezeichen in der Kopfleiste, und das traegt keine Beschriftung. */
  it("fuehrt zur Hilfeseite", () => {
    renderWithProviders(<Footer />)

    expect(
      screen.getByRole("link", { name: "Hilfe & Dokumentation" })
    ).toHaveAttribute("href", "/help")
  })

  it("setzt das Jahr zur Laufzeit und nicht als festen Text", () => {
    /* Eine feste Jahreszahl ist am 1. Januar still falsch. */
    renderWithProviders(<Footer />)

    expect(
      screen.getByText(new RegExp(`© ${new Date().getFullYear()}\\b`))
    ).toBeVisible()
  })
})
