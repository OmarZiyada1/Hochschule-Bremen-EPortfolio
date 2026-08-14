import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderWithProviders } from "@/test/render"

import { Top10Card } from "./Top10Card"

const author = { firstName: "Mira", lastName: "Beispiel" }

describe("Top10Card", () => {
  it("zeigt den Platz sichtbar zweistellig und vorgelesen als Satz", () => {
    renderWithProviders(
      <Top10Card position={6} title="Campus-Garten" author={author} />
    )

    expect(screen.getByText("06")).toBeVisible()
    expect(screen.getByText("Platz 6")).toBeInTheDocument()
  })

  it("nimmt den Platz aus position und nicht aus der Reihenfolge", () => {
    /* Die Top-10 hat Luecken: wird Platz 4 zurueckgezogen, folgt auf 3 die
       5. Eine Kachel, die ihre Nummer aus dem Index zoege, zeigte dann
       ueberall falsche Plaetze (§3.11). */
    renderWithProviders(<Top10Card position={10} title="Campus-Garten" />)

    expect(screen.getByText("10")).toBeVisible()
    expect(screen.getByText("Platz 10")).toBeInTheDocument()
  })

  it("zeigt in der grossen Variante Studiengang, Titel und Autor", () => {
    renderWithProviders(
      <Top10Card
        position={1}
        title="Campus-Garten"
        author={author}
        studyProgram={{ name: "Medieninformatik" }}
        href="/projects/1"
      />
    )

    expect(screen.getByText("Medieninformatik")).toBeVisible()
    expect(
      screen.getByRole("heading", { level: 3, name: "Campus-Garten" })
    ).toBeVisible()
    expect(screen.getByRole("link", { name: "Campus-Garten" })).toHaveAttribute(
      "href",
      "/projects/1"
    )
    expect(screen.getByText("Mira Beispiel")).toBeVisible()
  })

  it("laesst in der kleinen Variante den Studiengang weg", () => {
    renderWithProviders(
      <Top10Card
        variant="compact"
        position={7}
        title="Campus-Garten"
        author={author}
        studyProgram={{ name: "Medieninformatik" }}
      />
    )

    expect(
      screen.getByRole("heading", { level: 3, name: "Campus-Garten" })
    ).toBeVisible()
    expect(screen.queryByText("Medieninformatik")).not.toBeInTheDocument()
  })
})
