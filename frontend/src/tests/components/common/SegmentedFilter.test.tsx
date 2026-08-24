import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { SegmentedFilter } from "@/components/common/SegmentedFilter"
import { renderWithProviders } from "@/tests/render"

const OPTIONS = [
  { value: "all", label: "Alle" },
  { value: "open", label: "Offen" },
  { value: "done", label: "Erledigt" },
] as const

function render(value: "all" | "open" | "done" = "open", onChange = vi.fn()) {
  renderWithProviders(
    <SegmentedFilter
      label="Nach Stand filtern"
      options={[...OPTIONS]}
      value={value}
      onValueChange={onChange}
      fallback="all"
    />
  )
  return onChange
}

describe("SegmentedFilter", () => {
  it("traegt einen Gruppennamen, weil sichtbar keine Ueberschrift darueber steht", () => {
    render()
    expect(
      screen.getByRole("group", { name: "Nach Stand filtern" })
    ).toBeVisible()
  })

  it("meldet den gewaehlten Wert", async () => {
    const onChange = render("all")
    await userEvent.click(screen.getByRole("button", { name: "Erledigt" }))
    expect(onChange).toHaveBeenCalledWith("done")
  })

  it("faellt auf den Ersatzwert, wenn das aktive Segment abgewaehlt wird", async () => {
    /* Base UI hebt den Druck auf, wenn das aktive Segment erneut betaetigt
       wird; die Liste ist dann leer. Ein Filter ohne jeden Wert ist kein
       Zustand einer Seite dieses Projekts. */
    const onChange = render("open")
    await userEvent.click(screen.getByRole("button", { name: "Offen" }))
    expect(onChange).toHaveBeenCalledWith("all")
  })

  it("setzt den Radius mit dem Modifikator der erzeugten Datei", () => {
    /*
     * Die Falle: toggle-group.tsx haengt bei spacing={0} an jedes Segment ein
     * group-data-[spacing=0]/toggle-group:rounded-none. Ein blankes
     * rounded-control liegt fuer tailwind-merge in einer anderen Gruppe,
     * bleibt also daneben stehen, und in der Kaskade gewinnt der
     * zusammengesetzte Selektor. Sichtbar war das an der eckigen aktiven
     * Flaeche; weder Typecheck noch Lint faellt darauf herein.
     */
    render()
    const segment = screen.getByRole("button", { name: "Offen" })

    expect(segment).toHaveClass(
      "group-data-[spacing=0]/toggle-group:rounded-control"
    )
    expect(segment).not.toHaveClass(
      "group-data-[spacing=0]/toggle-group:rounded-none"
    )
    /* Dasselbe fuer das Innenmass, aus demselben Grund. */
    expect(segment).toHaveClass("group-data-[spacing=0]/toggle-group:px-4")
    expect(segment).not.toHaveClass("group-data-[spacing=0]/toggle-group:px-2")
  })

  it("haelt die aeussere Leiste einen Radius groesser als das Segment", () => {
    /* 12 minus die 4px des Innenabstands ergibt 8: die aktive Flaeche sitzt
       konzentrisch in der Leiste. */
    render()
    const group = screen.getByRole("group", { name: "Nach Stand filtern" })
    expect(group).toHaveClass("rounded-card")
    expect(group).toHaveClass("p-1")
    expect(screen.getByRole("button", { name: "Offen" })).toHaveClass(
      "rounded-control"
    )
  })
})
