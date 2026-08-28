import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderWithProviders } from "@/tests/render"

import { KpiTile } from "@/components/common/KpiTile"

describe("KpiTile", () => {
  it("zeigt Kennzahl und Beschriftung", () => {
    renderWithProviders(
      <KpiTile value={128} label="Veröffentlichte Projekte" />
    )
    expect(screen.getByText("128")).toBeVisible()
    expect(screen.getByText("Veröffentlichte Projekte")).toBeVisible()
  })

  it("zeigt Symbol und Veraenderung, wenn es sie gibt", () => {
    renderWithProviders(
      <KpiTile
        value={128}
        label="Projekte gesamt"
        icon={<svg data-testid="demo-icon" />}
        trend="+12 diesen Monat"
      />
    )

    expect(screen.getByText("+12 diesen Monat")).toBeVisible()
    expect(screen.getByTestId("demo-icon")).toBeInTheDocument()
  })

  it("kommt ohne beide aus, weil nicht jede Kennzahl eine Vergleichsperiode hat", () => {
    renderWithProviders(<KpiTile value={5} label="Beteiligte Fakultäten" />)

    expect(screen.queryByText(/diesen Monat/)).not.toBeInTheDocument()
  })

  it("zeigt die Variante plain ohne Kartenflaeche (CTA-Sektion, KAN-31)", () => {
    const { container } = renderWithProviders(
      <KpiTile variant="plain" value="1.200" label="Arbeiten" />
    )

    expect(screen.getByText("1.200")).toBeInTheDocument()
    expect(screen.getByText("Arbeiten")).toBeInTheDocument()
    /* Keine Card-Primitive darunter: die CTA-Sektion fuehrt die Zahl frei
       auf der Flaeche, nicht als Kachel. */
    expect(container.querySelector('[data-slot="card"]')).toBeNull()
  })

  /*
   * Vorgabe zur Nacharbeit: Dashboard und „Meine Reviews" tragen dieselbe
   * Kachel, und sie besteht immer aus Symbol, Zahl und Wort.
   */
  it("zeigt die Variante tile gerahmt und ohne eigene Kartenflaeche", () => {
    const { container } = renderWithProviders(
      <KpiTile
        variant="tile"
        value="12"
        label="Entwurf"
        icon={<svg data-testid="tile-icon" />}
      />
    )

    expect(screen.getByText("12")).toBeVisible()
    expect(screen.getByText("Entwurf")).toBeVisible()
    expect(screen.getByTestId("tile-icon")).toBeInTheDocument()
    /* Innerhalb einer Karte gibt es keine zweite: die Reihe steht im
       Dashboard bereits auf einer. */
    expect(container.querySelector('[data-slot="card"]')).toBeNull()
  })

  it("gibt jeder Kennzahl denselben Textton", () => {
    /* Vorgabe zur Nacharbeit: die Dashboard-Kacheln trugen Toene aus der
       Diagrammpalette und sahen damit anders aus als dieselben Kacheln in
       „Meine Reviews". Eine Farbe von aussen gibt es nicht mehr. */
    renderWithProviders(
      <KpiTile variant="tile" value="7" label="Eingereicht" />
    )

    const value = screen.getByText("7")
    expect(value).toHaveClass("text-accent-foreground")
    expect(value.getAttribute("style")).toBeNull()
  })
})
