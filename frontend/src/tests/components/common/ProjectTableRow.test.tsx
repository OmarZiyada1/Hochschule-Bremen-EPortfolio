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
   * KAN-83: Jeder Texteintrag ist auf zwanzig Zeichen Breite geklemmt, aber
   * nicht mehr geschnitten. Sichtbarer Text und Name des Links sind wieder
   * dieselbe Zeichenkette (SC 2.5.3).
   */
  it("klemmt einen langen Titel, ohne ihn aus dem Link zu nehmen", () => {
    const long = "Nachhaltige Mobilitaetskonzepte fuer die Innenstadt"
    renderRow(<ProjectTableRow title={long} href="/projects/1" />)

    const link = screen.getByRole("link", { name: long })
    expect(link.textContent).toBe(long)
    expect(link).toHaveClass("max-w-[20ch]", "truncate")
  })

  /*
   * Die Klemmung gilt in jeder Spalte und nicht nur im Titel. Autor:in,
   * Studiengang, Semester und Fach koennen die Tabelle genauso aufziehen.
   */
  it("klemmt auch Autor:in, Studiengang, Semester und Fach", () => {
    renderRow(
      <ProjectTableRow
        title="Campus-Garten"
        author={{
          firstName: "Maximiliane",
          lastName: "Beispielhausen-Wolter",
        }}
        studyProgram={reference({
          name: "Internationaler Studiengang Medieninformatik",
          abbreviation: null,
        })}
        semester="Wintersemester 2025/2026"
        module={reference({
          name: "Interaktive Systeme und Schnittstellen",
          abbreviation: null,
        })}
      />
    )

    for (const full of [
      "Maximiliane Beispielhausen-Wolter",
      "Internationaler Studiengang Medieninformatik",
      "Wintersemester 2025/2026",
      "Interaktive Systeme und Schnittstellen",
    ]) {
      /* Genau einmal im Dokument und in voller Laenge: Es gibt keinen
         sr-only-Zwilling mehr neben einer gekappten Anzeige, sondern nur noch
         den einen Text, der schmaler dargestellt wird. */
      const entry = screen.getByText(full)
      expect(entry).toHaveClass("max-w-[20ch]", "truncate")
      expect(entry).not.toHaveClass("sr-only")
    }
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
