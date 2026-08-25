import { screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { projectCard, reference } from "@/tests/fixtures"
import { fileBlobHandler } from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"

import { ProjectCard } from "@/components/common/ProjectCard"

const faculty = reference({ name: "Fakultät 4", abbreviation: "FK4" })

describe("ProjectCard", () => {
  /*
   * Das Autorenbild kommt seit Contract v49 an der Kachel mit (§6.1); vorher
   * fuehrte PersonResponse nur Name und ID. Dass ein gesetztes avatarUrl als
   * Bild erscheint, laesst sich hier nicht pruefen: Base UI haengt das Bild
   * erst nach dem Laden ein, und in jsdom laedt keines. Belegt ist die
   * Auslieferung des Feldes im Backend (PortfolioIntegrationTest), die
   * Weitergabe der Stufe in UserAvatar.test.tsx. Geprueft wird hier der
   * Rueckfall, den die Oberflaeche selbst verantwortet.
   */
  it("kommt ohne hinterlegtes Bild mit den Initialen aus", () => {
    renderWithProviders(<ProjectCard project={projectCard()} />)

    expect(screen.getByText("MB")).toBeInTheDocument()
  })

  it("zeigt Cover, Projektart, Fakultaet, Autor, Teaser, Semester und Reaktionen", () => {
    renderWithProviders(
      <ProjectCard
        project={projectCard({
          summary: "Ein offener Lernort hinter dem AB-Gebäude.",
          projectType: "THESIS",
          faculty,
          semester: reference({
            id: "s-1",
            name: "SoSe 2026",
            abbreviation: null,
          }),
          reactionCount: 142,
        })}
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

  /*
   * Punkt 1 aus KAN-80: das Fakultaetsbadge ist weg. Fakultaet und
   * Studiengang standen nebeneinander und sagten dieselbe Einordnung zweimal,
   * nur unterschiedlich grob; die genauere Angabe bleibt.
   */
  it("zeigt kein Fakultaetskuerzel mehr auf dem Cover", () => {
    renderWithProviders(<ProjectCard project={projectCard({ faculty })} />)

    expect(screen.queryByText("FK4")).not.toBeInTheDocument()
    expect(screen.queryByText("Fakultät 4")).not.toBeInTheDocument()
  })

  it("faellt ohne Kuerzel auf den ausgeschriebenen Studiengang zurueck", () => {
    renderWithProviders(
      <ProjectCard
        project={projectCard({
          studyProgram: reference({
            id: "sp-1",
            name: "Medieninformatik",
            abbreviation: null,
          }),
        })}
      />
    )

    expect(screen.getByText("Medieninformatik")).toBeVisible()
  })

  it("zeigt ohne Coverbild den Platzhalter statt eines leeren Bildes", () => {
    const { container } = renderWithProviders(
      <ProjectCard project={projectCard()} />
    )

    expect(container.querySelector("img")).toBeNull()
  })

  it("zeigt mit Coverbild ein Bild ohne eigenen Namen", () => {
    const { container } = renderWithProviders(
      <ProjectCard
        project={projectCard({
          coverImageUrl: "/cover.webp",
          status: "PUBLISHED",
        })}
      />
    )

    /* Ueber resolveApiUrl und nicht als nackter Pfad: die Adresse landet im
       src eines img und laeuft nie durch request(), sie muss die Basis-URL
       also selbst tragen. */
    const image = container.querySelector("img")
    expect(image?.getAttribute("src")?.endsWith("/cover.webp")).toBe(true)
    /* Der Titel steht daneben; ein zweiter Name am Bild waere eine
       Dopplung fuer alle, die vorlesen lassen. */
    expect(image).toHaveAttribute("alt", "")
  })

  it("holt das Coverbild eines Entwurfs mit Token", async () => {
    /* Die Datei ist erst bei PUBLISHED oeffentlich (§3.15, §5); ohne den
       angemeldeten Weg antwortet der Server mit 401 und die Kachel zeigt
       einen leeren Rahmen (Befund aus KAN-36). */
    server.use(fileBlobHandler())
    const { container } = renderWithProviders(
      <ProjectCard
        project={projectCard({
          coverImageUrl: "/api/files/8f14e45f-ceea-467a-9c9e-1f1e3a3d4b5c",
          status: "DRAFT",
        })}
      />
    )

    await waitFor(() =>
      expect(container.querySelector("img")?.getAttribute("src")).toMatch(
        /^blob:/
      )
    )
  })

  it("kommt ohne die nullbaren Felder aus", () => {
    /* Ein Entwurf traegt weder Teaser noch Fakultaet noch Semester (§3.3).
       Die Kachel laesst die Stellen dann leer, statt etwas zu erfinden.
       Titel, id, Autor:in und Reaktionszahl kommen dagegen immer mit, seit
       KAN-76 sagt der Typ das auch. */
    renderWithProviders(<ProjectCard project={projectCard()} />)

    expect(
      screen.getByRole("heading", { level: 3, name: "Campus-Garten" })
    ).toBeVisible()
    expect(screen.getByRole("link", { name: "Campus-Garten" })).toHaveAttribute(
      "href",
      "/projects/1"
    )
    expect(screen.queryByText("Fakultät 4")).not.toBeInTheDocument()
    expect(screen.queryByText("Veröffentlicht")).not.toBeInTheDocument()
  })

  /*
   * Punkt 1 aus KAN-80: das Studiengangskuerzel steht oben links auf der
   * Coverflaeche, dort wo bis dahin die Fakultaet stand. Es laeuft
   * zweispurig: sichtbar die Kurzform, vorgelesen der volle Name. Beides
   * ueber die Erreichbarkeit geprueft und nicht ueber ein title-Attribut:
   * das erreicht weder Tastatur noch Touch und wird an einem span meist gar
   * nicht vorgelesen.
   */
  it("zeigt das Studiengangskuerzel auf dem Cover", () => {
    renderWithProviders(
      <ProjectCard
        project={projectCard({
          faculty,
          studyProgram: reference({
            id: "sp-1",
            name: "Medieninformatik",
            abbreviation: "MIN",
          }),
        })}
      />
    )

    expect(screen.getByText("MIN")).toHaveAttribute("aria-hidden", "true")

    const full = screen.getByText("Medieninformatik")
    expect(full).toHaveClass("sr-only")
    expect(full.closest("[aria-hidden]")).toBeNull()
  })

  /*
   * Punkt 3 aus KAN-80: die ganze Kachel fuehrt ins Projekt. Die Flaeche ist
   * ein echter Link, damit Mittelklick und „in neuem Tab oeffnen"
   * weiterhin funktionieren; fuer Hilfsmittel bleibt sie unsichtbar, sonst
   * gaebe es je Kachel zwei Tabstopps auf dasselbe Ziel.
   */
  it("legt eine Klickflaeche ueber die ganze Kachel", () => {
    const { container } = renderWithProviders(
      <ProjectCard project={projectCard()} />
    )

    const overlay = container.querySelector('a[aria-hidden="true"]')
    expect(overlay).toHaveAttribute("href", "/projects/1")
    expect(overlay).toHaveAttribute("tabindex", "-1")
    /* Genau ein Tabstopp auf das Projekt: der Titel. Die Personenzeile
       fuehrt daneben auf das Portfolio und zaehlt nicht mit. */
    expect(screen.getAllByRole("link", { name: "Campus-Garten" })).toHaveLength(
      1
    )
  })

  it("zeigt den Status nur, wenn die Seite showStatus setzt", () => {
    const project = projectCard({ status: "DRAFT" })

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
