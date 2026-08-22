import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { renderWithProviders } from "@/tests/render"

import { FilterSelect } from "@/components/common/FilterSelect"

describe("FilterSelect", () => {
  it("hat ein verbundenes Label und zeigt ohne Wert die Alle-Option", () => {
    renderWithProviders(
      <FilterSelect
        label="Fakultät"
        options={[{ value: "4", label: "Fakultät 4" }]}
        value={null}
        onValueChange={() => {}}
      />
    )
    const trigger = screen.getByLabelText("Fakultät")
    expect(trigger).toBeVisible()
    expect(trigger).toHaveTextContent("Alle")
  })

  it("meldet die gewaehlte Option", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    renderWithProviders(
      <FilterSelect
        label="Fakultät"
        options={[{ value: "4", label: "Fakultät 4" }]}
        value={null}
        onValueChange={onValueChange}
      />
    )

    await user.click(screen.getByLabelText("Fakultät"))
    await user.click(await screen.findByRole("option", { name: "Fakultät 4" }))
    expect(onValueChange).toHaveBeenCalledWith("4")
  })
})
