import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Route, Routes } from "react-router-dom"
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

  /* Punkt 4 aus KAN-80: Namen sind ueberall Wege zu einer Person. Ohne ID
     bleibt es beim Text, etwa in der Komponentenschau. */
  it("verlinkt die Autor:in auf ihr Portfolio, sobald die ID mitkommt", () => {
    renderRow(
      <ProjectTableRow
        title="Campus-Garten"
        author={{ id: "u-1", firstName: "Mira", lastName: "Beispiel" }}
        href="/projects/1"
      />
    )

    expect(screen.getByRole("link", { name: "Mira Beispiel" })).toHaveAttribute(
      "href",
      "/portfolios/u-1"
    )
  })

  /*
   * Punkt 2 aus KAN-80: sieben Spalten und ein ausgeschriebener Titel
   * ergaben eine Tabelle breiter als das Fenster. Sichtbar bleibt der
   * Anfang, der zugaengliche Name bleibt vollstaendig.
   */
  it("kuerzt einen langen Titel und behaelt ihn als zugaenglichen Namen", () => {
    const long = "Nachhaltige Mobilitaetskonzepte fuer die Innenstadt"
    renderRow(<ProjectTableRow title={long} href="/projects/1" />)

    const link = screen.getByRole("link", { name: long })
    expect(link).toHaveTextContent("Nachhaltige Mobilita…")
    expect(link).toHaveAttribute("title", long)
  })

  /*
   * Punkt 3 aus KAN-80: die ganze Zeile fuehrt ins Projekt. Der Titel bleibt
   * der echte Link fuer Tastatur und Mittelklick.
   */
  it("oeffnet das Projekt bei einem Klick irgendwo in der Zeile", async () => {
    renderWithProviders(
      <Routes>
        <Route
          path="/"
          element={
            <Table>
              <TableBody>
                <ProjectTableRow
                  title="Campus-Garten"
                  semester="SoSe 2026"
                  href="/projects/1"
                />
              </TableBody>
            </Table>
          }
        />
        <Route path="/projects/1" element={<p>Projektseite</p>} />
      </Routes>
    )

    /* Geklickt wird die Semesterzelle, also weit weg vom Titel-Link. */
    await userEvent.click(screen.getByText("SoSe 2026"))
    expect(await screen.findByText("Projektseite")).toBeInTheDocument()
  })

  it("laesst einen Klick auf eine Handlung in der Zeile in Ruhe", async () => {
    let pressed = false
    renderRow(
      <ProjectTableRow
        title="Campus-Garten"
        href="/projects/1"
        actions={
          <button type="button" onClick={() => (pressed = true)}>
            Aktion
          </button>
        }
      />
    )

    await userEvent.click(screen.getByRole("button", { name: "Aktion" }))
    expect(pressed).toBe(true)
  })
})
