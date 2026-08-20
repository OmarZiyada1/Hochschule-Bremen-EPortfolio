import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Table, TableBody } from "@/components/ui/table"
import { renderWithProviders } from "@/tests/render"

import { ProjectTableRow } from "@/components/common/ProjectTableRow"
import { reference } from "@/tests/fixtures"

function renderRow(row: React.ReactNode) {
  return renderWithProviders(
    <Table>
      <TableBody>{row}</TableBody>
    </Table>
  )
}

describe("ProjectTableRow", () => {
  it("zeigt Titel, Autor, Studiengang, Semester und Status", () => {
    renderRow(
      <ProjectTableRow
        title="Campus-Garten"
        author={{ firstName: "Mira", lastName: "Beispiel" }}
        studyProgram={reference({
          name: "Medieninformatik",
          abbreviation: null,
        })}
        semester="SoSe 2026"
        status="PUBLISHED"
        href="/projects/1"
      />
    )

    expect(screen.getByRole("link", { name: "Campus-Garten" })).toHaveAttribute(
      "href",
      "/projects/1"
    )
    expect(screen.getByText("Mira Beispiel")).toBeVisible()
    expect(screen.getByText("Medieninformatik")).toBeVisible()
    expect(screen.getByText("SoSe 2026")).toBeVisible()
    expect(screen.getByText("Veröffentlicht")).toBeVisible()
  })

  it("kommt mit den nullable Feldern des Contracts aus", () => {
    /* Im DRAFT duerfen Studiengang und Semester fehlen (§3.3). Die Zeile
       muss dann leere Zellen zeigen und nicht abstuerzen. */
    renderRow(<ProjectTableRow title="Campus-Garten" />)

    expect(screen.getByText("Campus-Garten")).toBeVisible()
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })
})
