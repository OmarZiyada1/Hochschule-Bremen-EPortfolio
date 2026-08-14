import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderWithProviders } from "@/test/render"

import ComponentGalleryPage from "./ComponentGalleryPage"

describe("ComponentGalleryPage", () => {
  it("zeigt den Seitentitel als einzige Ueberschrift erster Ebene", () => {
    renderWithProviders(<ComponentGalleryPage />)

    expect(
      screen.getAllByRole("heading", { level: 1 })
    ).toHaveLength(1)
    expect(
      screen.getByRole("heading", { level: 1, name: "Komponentenbibliothek" })
    ).toBeInTheDocument()
  })

  it("zeigt jede Gruppe der Bibliothek als Ueberschrift zweiter Ebene", () => {
    renderWithProviders(<ComponentGalleryPage />)

    for (const group of [
      "Formularelemente",
      "Schaltflächen und Umschalter",
      "Überlagerungen",
      "Navigation",
      "Datenanzeige",
      "Domänenkomponenten",
    ]) {
      expect(
        screen.getByRole("heading", { level: 2, name: group })
      ).toBeInTheDocument()
    }
  })

  it("zeigt Primitiven und Domaenenkomponenten auf derselben Flaeche", () => {
    renderWithProviders(<ComponentGalleryPage />)

    /* Stichprobe je Herkunft: eine erzeugte Primitive (Badge-Variante),
       eine Domaenenkomponente (StatusBadge mit uebersetzter Anzeige). */
    expect(screen.getByText("secondary")).toBeInTheDocument()
    expect(screen.getAllByText("Veröffentlicht").length).toBeGreaterThan(0)
  })
})
