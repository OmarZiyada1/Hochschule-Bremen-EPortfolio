import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { renderWithProviders } from "@/tests/render"

import { SearchInput } from "@/components/common/SearchInput"

describe("SearchInput", () => {
  it("hat ein verbundenes Label und meldet Eingaben", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    renderWithProviders(<SearchInput value="" onValueChange={onValueChange} />)

    const input = screen.getByRole("searchbox", { name: "Suche" })
    expect(input).toBeVisible()

    await user.type(input, "a")
    expect(onValueChange).toHaveBeenCalledWith("a")
  })

  it("uebernimmt eine eigene Beschriftung", () => {
    renderWithProviders(
      <SearchInput value="" onValueChange={() => {}} label="Projektsuche" />
    )
    expect(
      screen.getByRole("searchbox", { name: "Projektsuche" })
    ).toBeVisible()
  })

  it("behaelt das Label auch dann, wenn es optisch versteckt ist", () => {
    /* Figma zeigt das Feld nur mit Platzhalter. Ein Platzhalter ist kein
       Label: er verschwindet beim Tippen. labelHidden versteckt deshalb
       nur die Darstellung, nie die Verbindung. */
    renderWithProviders(
      <SearchInput value="" onValueChange={() => {}} labelHidden />
    )

    const input = screen.getByRole("searchbox", { name: "Suche" })
    expect(input).toBeVisible()
    expect(screen.getByText("Suche")).toHaveClass("sr-only")
  })
})
