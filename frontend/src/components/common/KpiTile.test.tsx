import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderWithProviders } from "@/test/render"

import { KpiTile } from "./KpiTile"

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
})
