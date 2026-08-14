import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderWithProviders } from "@/test/render"

import { Footer } from "./Footer"

describe("Footer", () => {
  it("zeigt Projektname und statische Links", () => {
    renderWithProviders(<Footer />)

    expect(screen.getByText("E-Portfolio Hochschule Bremen")).toBeVisible()
    const nav = screen.getByRole("navigation", { name: "Fußzeile" })
    expect(nav).toBeInTheDocument()
    for (const label of ["Impressum", "Datenschutz", "Kontakt"]) {
      expect(screen.getByRole("link", { name: label })).toBeVisible()
    }
  })
})
