import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderWithProviders } from "@/test/render"

import { KpiTile } from "./KpiTile"

describe("KpiTile", () => {
  it("zeigt Kennzahl und Beschriftung", () => {
    renderWithProviders(<KpiTile value={128} label="Veröffentlichte Projekte" />)
    expect(screen.getByText("128")).toBeVisible()
    expect(screen.getByText("Veröffentlichte Projekte")).toBeVisible()
  })
})
