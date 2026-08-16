import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderWithProviders } from "@/tests/render"

import { ProjectCard } from "@/components/common/ProjectCard"

const faculty = { name: "Fakultät 4", abbreviation: "FK4" }
const author = { firstName: "Mira", lastName: "Beispiel" }

describe("ProjectCard", () => {
  it("zeigt Cover, Projektart, Fakultaet, Autor, Teaser, Semester und Reaktionen", () => {
    renderWithProviders(
      <ProjectCard
        project={{
          id: "1",
          title: "Campus-Garten",
          summary: "Ein offener Lernort hinter dem AB-Gebäude.",
          projectType: "THESIS",
          faculty,
          author,
          semester: "SoSe 2026",
          reactionCount: 142,
        }}
      />
    )

    expect(
      screen.getByRole("heading", { level: 3, name: "Campus-Garten" })
    ).toBeVisible()
    /* Der Link entsteht aus project.id; die Kachel kennt genau ein Ziel,
       die Detailseite. */
    expect(screen.getByRole("link", { name: "Campus-Garten" })).toHaveAttribute(
      "href",
      "/projects/1"
    )
    expect(screen.getByText("Thesis")).toBeVisible()
    expect(screen.getByText("Mira Beispiel")).toBeVisible()
    expect(
      screen.getByText("Ein offener Lernort hinter dem AB-Gebäude.")
    ).toBeVisible()
    expect(screen.getByText("SoSe 2026")).toBeVisible()

    /* Die Zahl steht sichtbar knapp da, vorgelesen wird der ganze Satz.
       Ohne ihn zaehlt die Kachel etwas, das niemand benennt. */
    expect(screen.getByText("142")).toBeVisible()
    expect(screen.getByText("142 Reaktionen")).toBeInTheDocument()
  })

  it("zeigt das Fakultaetskuerzel und sagt den vollen Namen an", () => {
    renderWithProviders(
      <ProjectCard project={{ title: "Campus-Garten", faculty }} />
    )

    /* Sichtbar das Kuerzel, vorgelesen der volle Name. Beides ueber die
       Erreichbarkeit geprueft und nicht ueber ein title-Attribut: das
       erreicht weder Tastatur noch Touch und wird an einem span meist gar
       nicht vorgelesen. */
    expect(screen.getByText("FK4")).toHaveAttribute("aria-hidden", "true")

    const full = screen.getByText("Fakultät 4")
    expect(full).toHaveClass("sr-only")
    expect(full.closest("[aria-hidden]")).toBeNull()
  })

  it("faellt ohne Kuerzel auf den ausgeschriebenen Namen zurueck", () => {
    renderWithProviders(
      <ProjectCard
        project={{ title: "Campus-Garten", faculty: { name: "Fakultät 4" } }}
      />
    )

    expect(screen.getByText("Fakultät 4")).toBeVisible()
  })

  it("zeigt ohne Coverbild den Platzhalter statt eines leeren Bildes", () => {
    const { container } = renderWithProviders(
      <ProjectCard project={{ title: "Campus-Garten" }} />
    )

    expect(container.querySelector("img")).toBeNull()
  })

  it("zeigt mit Coverbild ein Bild ohne eigenen Namen", () => {
    const { container } = renderWithProviders(
      <ProjectCard
        project={{ title: "Campus-Garten", coverImageUrl: "/cover.webp" }}
      />
    )

    const image = container.querySelector("img")
    expect(image).toHaveAttribute("src", "/cover.webp")
    /* Der Titel steht daneben; ein zweiter Name am Bild waere eine
       Dopplung fuer alle, die vorlesen lassen. */
    expect(image).toHaveAttribute("alt", "")
  })

  it("kommt ohne id, Status und optionale Felder aus", () => {
    renderWithProviders(<ProjectCard project={{ title: "Campus-Garten" }} />)

    expect(
      screen.getByRole("heading", { level: 3, name: "Campus-Garten" })
    ).toBeVisible()
    /* Ohne id gibt es kein Linkziel, also auch keinen Link. */
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
    expect(screen.queryByText("Veröffentlicht")).not.toBeInTheDocument()
  })

  it("zeigt den Status nur, wenn die Seite showStatus setzt", () => {
    const project = { title: "Campus-Garten", status: "DRAFT" } as const

    const { unmount } = renderWithProviders(
      <ProjectCard project={project} showStatus />
    )
    expect(screen.getByText("Entwurf")).toBeVisible()
    unmount()

    /* Ohne showStatus bleibt das Badge weg, auch wenn die Antwort einen
       Status traegt: ob er etwas unterscheidet, weiss nur die Seite (§5). */
    renderWithProviders(<ProjectCard project={project} />)
    expect(screen.queryByText("Entwurf")).not.toBeInTheDocument()
  })
})
