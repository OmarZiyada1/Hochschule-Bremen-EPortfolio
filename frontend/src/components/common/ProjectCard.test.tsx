import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderWithProviders } from "@/test/render"

import { ProjectCard } from "./ProjectCard"

const faculty = { name: "Fakultät 4", abbreviation: "FK4" }
const author = { firstName: "Mira", lastName: "Beispiel" }

describe("ProjectCard", () => {
  it("zeigt Cover, Projektart, Fakultaet, Autor, Teaser, Semester und Reaktionen", () => {
    renderWithProviders(
      <ProjectCard
        title="Campus-Garten"
        summary="Ein offener Lernort hinter dem AB-Gebäude."
        projectType="THESIS"
        faculty={faculty}
        author={author}
        semester="SoSe 2026"
        reactionCount={142}
        href="/projects/1"
      />
    )

    expect(
      screen.getByRole("heading", { level: 3, name: "Campus-Garten" })
    ).toBeVisible()
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

  it("zeigt das Fakultaetskuerzel mit dem vollen Namen als Erklaerung", () => {
    renderWithProviders(<ProjectCard title="Campus-Garten" faculty={faculty} />)

    expect(screen.getByText("FK4")).toHaveAttribute("title", "Fakultät 4")
  })

  it("faellt ohne Kuerzel auf den ausgeschriebenen Namen zurueck", () => {
    renderWithProviders(
      <ProjectCard title="Campus-Garten" faculty={{ name: "Fakultät 4" }} />
    )

    expect(screen.getByText("Fakultät 4")).toBeVisible()
  })

  it("zeigt ohne Coverbild den Platzhalter statt eines leeren Bildes", () => {
    const { container } = renderWithProviders(
      <ProjectCard title="Campus-Garten" />
    )

    expect(container.querySelector("img")).toBeNull()
  })

  it("zeigt mit Coverbild ein Bild ohne eigenen Namen", () => {
    const { container } = renderWithProviders(
      <ProjectCard title="Campus-Garten" coverImageUrl="/cover.webp" />
    )

    const image = container.querySelector("img")
    expect(image).toHaveAttribute("src", "/cover.webp")
    /* Der Titel steht daneben; ein zweiter Name am Bild waere eine
       Dopplung fuer alle, die vorlesen lassen. */
    expect(image).toHaveAttribute("alt", "")
  })

  it("kommt ohne Status, Link und optionale Felder aus", () => {
    renderWithProviders(<ProjectCard title="Campus-Garten" />)

    expect(
      screen.getByRole("heading", { level: 3, name: "Campus-Garten" })
    ).toBeVisible()
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
    expect(screen.queryByText("Veröffentlicht")).not.toBeInTheDocument()
  })

  it("zeigt den Status nur, wenn die Seite ihn mitgibt", () => {
    renderWithProviders(<ProjectCard title="Campus-Garten" status="DRAFT" />)

    expect(screen.getByText("Entwurf")).toBeVisible()
  })
})
