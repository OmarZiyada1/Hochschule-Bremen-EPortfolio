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
})
