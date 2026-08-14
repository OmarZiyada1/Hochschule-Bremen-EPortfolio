import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Button } from "@/components/ui/button"
import { renderWithProviders } from "@/test/render"

import { EmptyState } from "./EmptyState"

describe("EmptyState", () => {
  it("zeigt Erklaerung und Handlung", () => {
    renderWithProviders(
      <EmptyState
        title="Keine Projekte gefunden"
        description="Für die gewählten Filter gibt es keine Treffer."
        action={<Button>Filter zurücksetzen</Button>}
      />
    )
    expect(screen.getByText("Keine Projekte gefunden")).toBeVisible()
    expect(
      screen.getByText("Für die gewählten Filter gibt es keine Treffer.")
    ).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Filter zurücksetzen" })
    ).toBeVisible()
  })

  /*
   * Ueber die Rolle geprueft, nicht ueber den Text: EmptyTitle rendert wie
   * jede Title-Primitive ein div. Vor dem Review zu KAN-29 war der Titel
   * damit fuer die Sprungnavigation unsichtbar, und getByText hat das
   * anstandslos durchgewinkt.
   */
  it("fuehrt den Titel als Ueberschrift, voreingestellt auf Ebene 2", () => {
    renderWithProviders(<EmptyState title="Keine Projekte gefunden" />)

    expect(
      screen.getByRole("heading", { level: 2, name: "Keine Projekte gefunden" })
    ).toBeVisible()
  })

  it("nimmt die Ebene der Seite darum herum an", () => {
    renderWithProviders(
      <EmptyState title="Keine Projekte gefunden" headingLevel={3} />
    )

    expect(
      screen.getByRole("heading", { level: 3, name: "Keine Projekte gefunden" })
    ).toBeVisible()
  })
})
