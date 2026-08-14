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

  /*
   * Befund aus dem Review zu KAN-29: beide Auslassungszeichen trugen ihren
   * uebersetzten sr-only-Text in einem Element mit aria-hidden. Das nimmt den
   * ganzen Teilbaum aus dem Accessibility-Baum, die Uebersetzung lief ins
   * Leere, und getByText hat sie trotzdem gefunden: im DOM stand sie ja.
   * Deshalb wird hier nicht die Existenz geprueft, sondern die Erreichbarkeit.
   * Dieselbe Zeile gehoert an jeden neuen sr-only-Text.
   */
  it("laesst die uebersetzten sr-only-Texte auch ankuendigen", () => {
    renderWithProviders(<ComponentGalleryPage />)

    for (const text of ["Weitere Seiten", "Weitere Ebenen"]) {
      expect(screen.getByText(text).closest("[aria-hidden]")).toBeNull()
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
