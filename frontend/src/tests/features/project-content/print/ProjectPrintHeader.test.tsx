import { screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import { ProjectPrintHeader } from "@/features/project-content/print/ProjectPrintHeader"
import i18n from "@/i18n"
import { person, projectDetail, reference } from "@/tests/fixtures"
import { renderWithProviders } from "@/tests/render"

/*
 * Der Kopfbereich des Ausdrucks (KAN-41, Test 1 und Abschnitt 2).
 *
 * Geprueft werden Struktur und Text, nicht das Aussehen: Vitest laeuft mit
 * css: false, berechnete Stile gibt es hier nicht. Ob der Ausdruck lesbar
 * ist, sagt die dokumentierte manuelle Abnahme.
 *
 * Der Zeitpunkt kommt als Prop herein. Eine Komponente, die selbst die Uhr
 * liest, laesst sich nicht pruefen, ohne die Zeit zu faelschen.
 */

const PRINTED_AT = new Date("2026-08-25T09:00:00Z")

function full() {
  return projectDetail({
    title: "Campus-Garten",
    summary: "Ein Beet, ein Sensor und viel Geduld.",
    status: "PUBLISHED",
    author: person({ firstName: "Mira", lastName: "Beispiel" }),
    studyProgram: reference({ id: "sp-1", name: "Informatik B. Sc." }),
    semester: reference({ id: "se-1", name: "WiSe 2025/26" }),
  })
}

describe("Der Druckkopf", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
  })

  it("fuehrt Titel, Autor:in, Studiengang, Semester, Status und Datum", () => {
    renderWithProviders(
      <ProjectPrintHeader project={full()} coverUrl={null} now={PRINTED_AT} />
    )

    expect(screen.getByText("Campus-Garten")).toBeInTheDocument()
    expect(screen.getByText("Mira Beispiel")).toBeInTheDocument()
    expect(screen.getByText("Informatik B. Sc.")).toBeInTheDocument()
    expect(screen.getByText("WiSe 2025/26")).toBeInTheDocument()
    /* Der Enum-Wert laeuft unveraendert durch den Code; angezeigt wird die
       Uebersetzung (Frontend-Regel 6). */
    expect(
      screen.getByText(i18n.t("project.status.PUBLISHED"))
    ).toBeInTheDocument()

    /* Jede Angabe steht als Paar aus Beschriftung und Wert. */
    for (const key of [
      "author",
      "studyProgram",
      "semester",
      "status",
      "printedAt",
    ]) {
      expect(
        screen.getByText(i18n.t(`projectContent.print.${key}`))
      ).toBeInTheDocument()
    }
  })

  it("nennt den Zeitpunkt des Ausdrucks maschinenlesbar", () => {
    const { container } = renderWithProviders(
      <ProjectPrintHeader project={full()} coverUrl={null} now={PRINTED_AT} />
    )

    const time = container.querySelector("time")
    expect(time).not.toBeNull()
    expect(time).toHaveAttribute("datetime", PRINTED_AT.toISOString())
    /* Formatiert in der Sprache der Oberflaeche, nicht als ISO-Zeichenkette
       auf dem Blatt. */
    expect(time?.textContent).not.toBe(PRINTED_AT.toISOString())
    expect(time?.textContent?.length).toBeGreaterThan(0)
  })

  it("traegt den Titel als einzige h1", () => {
    renderWithProviders(
      <ProjectPrintHeader project={full()} coverUrl={null} now={PRINTED_AT} />
    )

    const levelOne = screen.getAllByRole("heading", { level: 1 })
    expect(levelOne).toHaveLength(1)
    expect(levelOne[0]).toHaveTextContent("Campus-Garten")
  })

  it("zeigt Titelbild und Abstract, sobald es sie gibt", () => {
    const { container } = renderWithProviders(
      <ProjectPrintHeader
        project={full()}
        coverUrl="blob:cover"
        now={PRINTED_AT}
      />
    )

    const cover = container.querySelector("img")
    expect(cover).toHaveAttribute("src", "blob:cover")
    /* Beiwerk zum Titel daneben, deshalb ein leerer Alternativtext
       (SC 1.1.1). */
    expect(cover).toHaveAttribute("alt", "")
    expect(
      screen.getByText("Ein Beet, ein Sensor und viel Geduld.")
    ).toBeInTheDocument()
  })

  it("laesst jede fehlende Angabe als ganze Zeile weg", () => {
    /* Ein Entwurf hat oft weder Studiengang noch Semester: §3.3 verlangt
       beides erst zum Einreichen. Eine Zeile ohne Wert saehe nach einem
       Fehler aus. */
    const { container } = renderWithProviders(
      <ProjectPrintHeader
        project={projectDetail({
          title: "Entwurf",
          summary: null,
          /* undefined und nicht null: springdoc markiert das Feld als
             optional, nicht als nullable (§3.3). */
          author: undefined,
          studyProgram: null,
          semester: null,
        })}
        coverUrl={null}
        now={PRINTED_AT}
      />
    )

    expect(
      screen.queryByText(i18n.t("projectContent.print.studyProgram"))
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(i18n.t("projectContent.print.semester"))
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(i18n.t("projectContent.print.author"))
    ).not.toBeInTheDocument()
    expect(container.querySelector("img")).toBeNull()

    /* Das Datum bleibt: es ist die einzige Angabe, die nie fehlt. */
    expect(
      screen.getByText(i18n.t("projectContent.print.printedAt"))
    ).toBeInTheDocument()
  })

  it("uebersetzt die Beschriftungen", async () => {
    await i18n.changeLanguage("en")
    renderWithProviders(
      <ProjectPrintHeader project={full()} coverUrl={null} now={PRINTED_AT} />
    )

    /* Seit KAN-104 wie in Projektinformationen und Filtern. */
    expect(screen.getByText("Degree programme")).toBeInTheDocument()
    expect(screen.getByText("Printed on")).toBeInTheDocument()
    await i18n.changeLanguage("de")
  })
})
