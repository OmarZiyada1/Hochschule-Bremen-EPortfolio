import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderWithProviders } from "@/tests/render"

import { Top10Card } from "@/components/common/Top10Card"
import { reference } from "@/tests/fixtures"

const author = { firstName: "Mira", lastName: "Beispiel" }

describe("Top10Card", () => {
  /*
   * Beide Varianten komponieren die Card-Primitive, statt ihre Flaeche
   * nachzubauen (Frontend-Regel 11). Vor dem Review zu KAN-29 schrieb die
   * Kachel "rounded-card border bg-card" von Hand und stand damit neben
   * einer ProjectCard mit anderem Eckradius und anderer Kante.
   */
  it.each(["feature", "compact"] as const)(
    "baut die Flaeche der Variante %s aus der Card-Primitive",
    (variant) => {
      const { container } = renderWithProviders(
        <Top10Card position={1} title="Campus-Garten" variant={variant} />
      )

      expect(container.querySelector("[data-slot=card]")).not.toBeNull()
    }
  )

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
        studyProgram={reference({
          name: "Medieninformatik",
          abbreviation: null,
        })}
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
        studyProgram={reference({
          name: "Medieninformatik",
          abbreviation: null,
        })}
      />
    )

    expect(
      screen.getByRole("heading", { level: 3, name: "Campus-Garten" })
    ).toBeVisible()
    expect(screen.queryByText("Medieninformatik")).not.toBeInTheDocument()
  })

  it("laesst das Titelbild ueber resolveApiUrl laufen", () => {
    /* Die Adresse landet im src eines img und laeuft nie durch request();
       ohne resolveApiUrl laedt bei gesetztem VITE_API_BASE_URL kein
       einziges Titelbild der Startseite. ProjectCard und ProfileCard
       machen es an derselben Stelle richtig, diese Kachel tat es nicht
       (Befund aus KAN-36). */
    const { container } = renderWithProviders(
      <Top10Card
        position={1}
        title="Campus-Garten"
        coverImageUrl="/api/files/11111111-1111-4111-8111-111111111111"
      />
    )

    const src = container.querySelector("img")?.getAttribute("src") ?? ""
    expect(
      src.endsWith("/api/files/11111111-1111-4111-8111-111111111111")
    ).toBe(true)
  })
})
