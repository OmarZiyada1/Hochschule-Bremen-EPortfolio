import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ProjectMetaSidebar } from "@/features/projects/components/ProjectMetaSidebar"
import { person, projectDetail, reference } from "@/tests/fixtures"
import { renderWithProviders } from "@/tests/render"

/*
 * Dieselbe Komponente traegt die Projektinformationen auf der oeffentlichen
 * Detailseite und im Editor, aber sie behandelt fehlende Werte verschieden:
 * dort entfaellt die Zeile, hier bleibt sie mit einem Strich stehen. Die
 * Feldliste ist damit im Editor immer gleich lang und springt nicht, sobald
 * eine Angabe dazukommt. Ein Strich ist dabei kein Pflichthinweis: die
 * sieben Pflichtangaben des Einreichens (§3.3) stehen im Metadatenformular.
 */

/** Der Wert, der unter dieser Beschriftung steht. */
function valueUnder(label: string): string {
  const term = screen.getByText(label)
  const value = term.nextElementSibling
  return value?.textContent ?? ""
}

describe("ProjectMetaSidebar", () => {
  it("laesst leere Felder auf der oeffentlichen Seite weg", () => {
    renderWithProviders(<ProjectMetaSidebar project={projectDetail()} />)

    expect(screen.queryByText("Studiengang")).not.toBeInTheDocument()
    expect(screen.queryByText("Semester")).not.toBeInTheDocument()
    expect(screen.queryByText("Fach / Modul")).not.toBeInTheDocument()
  })

  it("zeigt an einem Entwurf jedes Feld, leere mit einem Strich", () => {
    renderWithProviders(
      <ProjectMetaSidebar project={projectDetail({ status: "DRAFT" })} />
    )

    for (const label of [
      "Projekttyp",
      "Fakultät",
      "Studiengang",
      "Abschluss",
      "Semester",
      "Kategorie",
      "Fach / Modul",
      "Tags",
    ]) {
      expect(screen.getByText(label), label).toBeInTheDocument()
      /* Sichtbar der Strich, vorgelesen der Satz dahinter. */
      expect(valueUnder(label), label).toBe("-Keine Angabe")
    }
  })

  it("nennt gesetzte Werte weiterhin, auch neben leeren Feldern", () => {
    renderWithProviders(
      <ProjectMetaSidebar
        project={projectDetail({
          status: "DRAFT",
          semester: reference({ name: "WiSe 2025/26" }),
          author: person({ firstName: "Dev", lastName: "Studierende" }),
        })}
      />
    )

    expect(valueUnder("Semester")).toBe("WiSe 2025/26")
    expect(valueUnder("Projektmitglieder")).toBe("Dev Studierende")
    expect(valueUnder("Studiengang")).toBe("-Keine Angabe")
  })

  it("laesst die Redaktion weg, solange sie nicht sichtbar ist", () => {
    /* null heisst „nicht sichtbar", nicht „keine zugewiesen"; ein Strich
       behauptete das Zweite (§3.3). */
    renderWithProviders(
      <ProjectMetaSidebar
        project={projectDetail({ status: "DRAFT", editors: null })}
      />
    )
    expect(screen.queryByText("Redakteur:innen")).not.toBeInTheDocument()

    renderWithProviders(
      <ProjectMetaSidebar
        project={projectDetail({ status: "DRAFT", editors: [] })}
      />
    )
    expect(screen.getByText("Redakteur:innen")).toBeInTheDocument()
  })

  it("entscheidet am Status und nicht am Ort, ob Luecken sichtbar sind", () => {
    /*
     * Bis dahin setzte allein der Editor einen Schalter dafuer, und dieselbe
     * Angabe war dort eine Luecke und auf der Detailseite gar nicht da. Wer
     * einen Entwurf oeffnete, erfuhr an der Stelle, an der es zaehlt, gerade
     * nicht, was zum Einreichen noch fehlt. Ein nicht veroeffentlichtes
     * Projekt sieht ohnehin nur, wer beteiligt ist oder es prueft (§5).
     */
    for (const status of [
      "DRAFT",
      "SUBMITTED",
      "APPROVED",
      "REVISION",
    ] as const) {
      const { unmount } = renderWithProviders(
        <ProjectMetaSidebar project={projectDetail({ status })} />
      )
      expect(screen.getByText("Studiengang"), status).toBeInTheDocument()
      expect(valueUnder("Studiengang"), status).toBe("-Keine Angabe")
      unmount()
    }

    renderWithProviders(
      <ProjectMetaSidebar project={projectDetail({ status: "PUBLISHED" })} />
    )
    expect(screen.queryByText("Studiengang")).not.toBeInTheDocument()
  })

  it("zeigt kein leeres Veroeffentlichungsdatum", () => {
    /* Kein Metadatum, sondern ein Ergebnis des Zustandsautomaten (§4.1). */
    renderWithProviders(
      <ProjectMetaSidebar
        project={projectDetail({ status: "DRAFT", publishedAt: null })}
      />
    )
    expect(screen.queryByText("Veröffentlicht")).not.toBeInTheDocument()
  })
})
