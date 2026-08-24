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

  it("setzt die Hoehe mit dem Modifikator der erzeugten Datei", () => {
    /*
     * Die Falle: select.tsx fuehrt seine Hoehe ausschliesslich als
     * data-[size=default]:h-8, und data-size steht immer am Element. Ein
     * blankes h-11 liegt fuer tailwind-merge in einer anderen Gruppe, bleibt
     * also daneben stehen, und in der Kaskade gewinnt der Attributselektor
     * mit (0,2,0) gegen (0,1,0). Das Feld blieb dadurch 32px hoch, waehrend
     * SearchInput daneben auf 44px stand. Weder Typecheck noch Lint faellt
     * darauf herein, nur das Auge.
     */
    renderWithProviders(
      <FilterSelect
        label="Fakultät"
        options={[]}
        value={null}
        onValueChange={() => {}}
      />
    )

    const trigger = screen.getByLabelText("Fakultät")
    expect(trigger).toHaveClass("data-[size=default]:h-11")
    expect(trigger).not.toHaveClass("data-[size=default]:h-8")
  })

  it("blendet die Beschriftung auf Wunsch nur optisch aus", () => {
    /* Entfernt wird sie nie: ohne sie waere das Feld fuer einen
       Screenreader unbeschriftet (SC 1.3.1, SC 3.3.2). */
    renderWithProviders(
      <FilterSelect
        label="Studiengang filtern"
        labelHidden
        options={[]}
        value={null}
        onValueChange={() => {}}
      />
    )

    expect(screen.getByLabelText("Studiengang filtern")).toBeVisible()
    expect(screen.getByText("Studiengang filtern")).toHaveClass("sr-only")
  })
})
