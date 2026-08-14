import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderWithProviders } from "@/test/render"

import { ProjectCard } from "./ProjectCard"

describe("ProjectCard", () => {
  it("zeigt Titel, Kurzbeschreibung, Status, Fakultaet und Semester", () => {
    renderWithProviders(
      <ProjectCard
        title="Campus-Garten"
        summary="Ein offener Lernort hinter dem AB-Gebäude."
        status="PUBLISHED"
        faculty="Fakultät 4"
        semester="SoSe 2026"
        href="/projects/1"
      />
    )

    const heading = screen.getByRole("heading", {
      level: 3,
      name: "Campus-Garten",
    })
    expect(heading).toBeVisible()
    expect(
      screen.getByRole("link", { name: "Campus-Garten" })
    ).toHaveAttribute("href", "/projects/1")
    expect(
      screen.getByText("Ein offener Lernort hinter dem AB-Gebäude.")
    ).toBeVisible()
    expect(screen.getByText("Veröffentlicht")).toBeVisible()
    expect(screen.getByText("Fakultät 4")).toBeVisible()
    expect(screen.getByText("SoSe 2026")).toBeVisible()
  })

  it("kommt ohne Status und Link aus", () => {
    renderWithProviders(
      <ProjectCard
        title="Campus-Garten"
        summary="Ein offener Lernort."
        faculty="Fakultät 4"
        semester="SoSe 2026"
      />
    )
    expect(
      screen.getByRole("heading", { level: 3, name: "Campus-Garten" })
    ).toBeVisible()
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
    expect(screen.queryByText("Veröffentlicht")).not.toBeInTheDocument()
  })
})
