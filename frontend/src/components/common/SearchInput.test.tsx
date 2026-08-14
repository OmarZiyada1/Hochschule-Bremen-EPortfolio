import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { renderWithProviders } from "@/test/render"

import { SearchInput } from "./SearchInput"

describe("SearchInput", () => {
  it("hat ein verbundenes Label und meldet Eingaben", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    renderWithProviders(
      <SearchInput value="" onValueChange={onValueChange} />
    )

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
})
