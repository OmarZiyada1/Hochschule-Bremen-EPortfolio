import { screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderWithProviders } from "@/test/render"

import TokenGalleryPage from "./TokenGalleryPage"
import {
  buttonIconSizeNames,
  buttonSizeNames,
  buttonVariantNames,
  flattenColorTokens,
  radiusTokens,
  typographyRoles,
} from "./tokenCatalog"

const colorTokens = flattenColorTokens()

describe("Katalog der Tokenschicht", () => {
  it("fuehrt die 70 Semantic-Rollen (55 vor dem Figma-Abgleich, dazu sieben fuer Cover und Kopfleiste und acht fuer die Pillentoene)", () => {
    expect(colorTokens).toHaveLength(70)
    expect(new Set(colorTokens).size).toBe(70)
  })

  it("fuehrt die sechs Radius-Stufen", () => {
    expect(radiusTokens).toHaveLength(6)
  })
})

describe("TokenGalleryPage", () => {
  it("zeigt jede Semantic-Rolle mit ihrem Namen", () => {
    renderWithProviders(<TokenGalleryPage />)

    for (const token of colorTokens) {
      expect(
        screen.getByText(`--${token}`),
        `${token} fehlt auf der Pruefflaeche`
      ).toBeInTheDocument()
    }
  })

  it("zeigt jede Radius-Stufe und jede Schriftrolle", () => {
    renderWithProviders(<TokenGalleryPage />)

    for (const token of radiusTokens) {
      expect(screen.getByText(`--${token}`)).toBeInTheDocument()
    }

    for (const role of typographyRoles) {
      expect(screen.getByText(`.${role}`)).toBeInTheDocument()
    }
  })

  it("zeigt die Schriftrollen mit umbrechendem Beispieltext", () => {
    renderWithProviders(<TokenGalleryPage />)

    const samples = screen.getAllByText(/Das Portfolio dokumentiert/)

    expect(samples).toHaveLength(typographyRoles.length)
    for (const sample of samples) {
      /* Der Beispieltext haengt an der Rollen-Klasse; eine zu enge
         Zeilenhoehe waere an einer eigenen kurzen Zeile nicht zu sehen. */
      expect(sample.textContent!.length).toBeGreaterThan(80)
    }
  })

  it("zeigt die erzeugte Primitive in allen Varianten und Groessen", () => {
    renderWithProviders(<TokenGalleryPage />)

    const variants = within(screen.getByRole("group", { name: "Varianten" }))
    for (const variant of buttonVariantNames) {
      expect(
        variants.getByRole("button", { name: variant })
      ).toBeInTheDocument()
    }

    const sizes = within(screen.getByRole("group", { name: "Größen" }))
    for (const size of buttonSizeNames) {
      expect(sizes.getByRole("button", { name: size })).toBeInTheDocument()
    }

    for (const size of buttonIconSizeNames) {
      expect(
        sizes.getByRole("button", { name: `Schaltfläche ${size}` })
      ).toBeInTheDocument()
    }
  })
})
