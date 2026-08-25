import { HttpResponse, http } from "msw"
import { screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import HomePage from "@/features/home/HomePage"
import i18n from "@/i18n"
import { apiErrorResponse } from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"

function pageOf(content: unknown[], totalElements = content.length) {
  return {
    content,
    page: 0,
    size: 1,
    totalElements,
    totalPages: totalElements,
  }
}

function entryAt(position: number, title: string, members: unknown[] = []) {
  return {
    position,
    addedAt: "2026-08-01T12:00:00Z",
    project: {
      id: `10000000-0000-0000-0000-0000000000${String(position).padStart(2, "0")}`,
      title,
      status: "PUBLISHED",
      summary: "Ein Teaser.",
      author: {
        id: "50000000-0000-0000-0000-000000000001",
        firstName: "Lena",
        lastName: "Müller",
      },
      members,
      studyProgram: {
        id: "20000000-0000-0000-0000-000000000001",
        name: "Informatik",
      },
    },
  }
}

/** Ein:e Mitwirkende:r an der Kachel, wie ihn §3.13 seit Contract v78 fuehrt. */
function member(index: number, firstName: string, lastName: string) {
  return {
    userId: `60000000-0000-0000-0000-00000000000${index}`,
    firstName,
    lastName,
    avatarUrl: null,
    projectRole: null,
  }
}

/**
 * Registriert alle vier Antworten, die die Startseite zieht: Top-10,
 * Projektzahl (size=1), Fakultaeten und Studiengaenge. Ohne Handler ist
 * ein Request ein Testfehler (setup.ts), deshalb stubbt jeder Fall alles.
 */
function stubHome({
  top10 = [] as unknown[],
  works = 137,
  faculties = 5,
  programs = 42,
} = {}) {
  server.use(
    http.get("*/api/top10", () => HttpResponse.json(top10)),
    http.get("*/api/projects", () => HttpResponse.json(pageOf([], works))),
    http.get("*/api/faculties", () =>
      HttpResponse.json(
        Array.from({ length: faculties }, (_, index) => ({
          id: `30000000-0000-0000-0000-0000000000${String(index).padStart(2, "0")}`,
          name: `Fakultät ${index + 1}`,
          abbreviation: `FK${index + 1}`,
        }))
      )
    ),
    http.get("*/api/study-programs", () =>
      HttpResponse.json(
        Array.from({ length: programs }, (_, index) => ({
          id: `40000000-0000-0000-0000-0000000000${String(index).padStart(2, "0")}`,
          name: `Studiengang ${index + 1}`,
        }))
      )
    )
  )
}

/**
 * Oeffentliche Startseite (Ticket KAN-31): Hero, Top-10-Sektion mit
 * Luecken- und Leerverhalten ueber position statt Index, Kennzahlen der
 * CTA-Sektion und sichtbare Fehlerbehandlung.
 */
describe("HomePage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
  })

  it("zeigt Hero-Ueberschrift, Sektionsueberschriften und den Sprunglink", async () => {
    stubHome()
    renderWithProviders(<HomePage />)

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Studentische Innovation sichtbar machen.",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: `Top 10 · ${new Date().getFullYear()}`,
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { level: 2, name: "Das war nur der Anfang." })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /Top-10-Projekte entdecken/ })
    ).toHaveAttribute("href", "#top10")
    /* Base UI rendert den Button-als-Link mit role="button" (Registry-
       Fassung aus KAN-29); abgefragt wird die tatsaechliche Rolle. */
    expect(
      await screen.findByRole("button", { name: "Projektbibliothek öffnen" })
    ).toHaveAttribute("href", "/projects")
  })

  it("fuellt die Plaetze ueber position und zeigt Luecken als PLATZ FREI", async () => {
    stubHome({
      top10: [
        entryAt(1, "SmartCampus"),
        entryAt(2, "BremenConnect"),
        entryAt(3, "GreenRoute"),
        entryAt(5, "SecureAuth"),
      ],
    })
    renderWithProviders(<HomePage />)

    /* Platz 1 als Featured-Card mit Teaser und Detail-Link. */
    expect(
      await screen.findByRole("heading", { level: 3, name: "SmartCampus" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /Projekt ansehen/ })
    ).toHaveAttribute("href", "/projects/10000000-0000-0000-0000-000000000001")

    /* Platz 5 rueckt nicht auf Platz 4 nach: die Luecke bleibt frei. */
    expect(
      screen.getByRole("heading", { level: 3, name: "SecureAuth" })
    ).toBeInTheDocument()
    expect(screen.getAllByText("Platz frei")).toHaveLength(6)

    /* Der vorgelesene Platz des freien Slots ist erreichbar, nicht nur im
       DOM vorhanden (Befund aus KAN-29). */
    expect(screen.getByText("Platz 4").closest("[aria-hidden]")).toBeNull()
  })

  /*
   * Die Featured-Card liest sich wie die Kacheln daneben: Studiengang als
   * Vorspann, dann der Titel, dann der Teaser, der ihn fortsetzt, und erst
   * zuletzt, wer daran gearbeitet hat (Nacharbeit an KAN-40). Der Frame
   * 359:13 ordnet anders; die Abweichung ist entschieden und steht im Kopf
   * der Komponente.
   */
  it("ordnet die Featured-Card Studiengang, Titel, Teaser, Personen", async () => {
    stubHome({ top10: [entryAt(1, "SmartCampus")] })
    renderWithProviders(<HomePage />)

    const heading = await screen.findByRole("heading", {
      level: 3,
      name: "SmartCampus",
    })
    const text = heading.closest('[data-slot="card"]')?.textContent ?? ""

    expect(text).toContain("Informatik")
    expect(text.indexOf("Informatik")).toBeLessThan(text.indexOf("SmartCampus"))
    expect(text.indexOf("SmartCampus")).toBeLessThan(text.indexOf("Ein Teaser."))
    expect(text.indexOf("Ein Teaser.")).toBeLessThan(
      text.indexOf("Lena Müller")
    )
  })

  /*
   * Ab zwei Personen tritt die Gruppe an die Stelle des Namens, hier mit
   * vier Beteiligten also drei Gesichter und "+1". Der Satz fuer Hilfsmittel
   * nennt trotzdem jede von ihnen.
   */
  it("zeigt in der Featured-Card ab zwei Personen die Gruppe mit Zaehler", async () => {
    stubHome({
      top10: [
        entryAt(1, "SmartCampus", [
          member(1, "Frederike", "Ahlers"),
          member(2, "Lennart", "Brinkmann"),
          member(3, "Aylin", "Kesici"),
        ]),
      ],
    })
    renderWithProviders(<HomePage />)

    const heading = await screen.findByRole("heading", {
      level: 3,
      name: "SmartCampus",
    })
    const card = heading.closest('[data-slot="card"]') as HTMLElement

    expect(within(card).queryByText("Lena Müller")).not.toBeInTheDocument()
    expect(within(card).getByText("+1")).toBeInTheDocument()
    expect(
      card.querySelectorAll('[data-slot="avatar-group"] [data-slot="avatar"]')
    ).toHaveLength(3)
    expect(within(card).getByText(/^Von /)).toHaveTextContent("Aylin Kesici")
  })

  it("zeigt eine leere Antwort als zehn freie Plaetze, nicht als Fehler", async () => {
    stubHome({ top10: [] })
    renderWithProviders(<HomePage />)

    expect(await screen.findAllByText("Platz frei")).toHaveLength(10)
    expect(
      screen.queryByText(
        "Etwas ist schiefgelaufen. Bitte versuchen Sie es später erneut."
      )
    ).not.toBeInTheDocument()
  })

  it("macht eine Fehlerantwort der Top-10 aus dem 6.2-Envelope sichtbar", async () => {
    stubHome()
    server.use(
      http.get("*/api/top10", () =>
        apiErrorResponse(500, "INTERNAL_ERROR", "/api/top10")
      )
    )
    renderWithProviders(<HomePage />)

    expect(
      await screen.findByText(
        "Etwas ist schiefgelaufen. Bitte versuchen Sie es später erneut."
      )
    ).toBeInTheDocument()
  })

  it("leitet die Kennzahlen clientseitig ab", async () => {
    stubHome({ works: 137, faculties: 5, programs: 42 })
    renderWithProviders(<HomePage />)

    expect(await screen.findByText("137")).toBeInTheDocument()
    expect(screen.getByText("Arbeiten")).toBeInTheDocument()
    expect(screen.getByText("Fakultäten")).toBeInTheDocument()
    expect(screen.getByText("42")).toBeInTheDocument()
    expect(screen.getByText("Studiengänge")).toBeInTheDocument()
  })

  it("fuehrt im Entwicklungs-Build zur Pruefflaeche der Tokenschicht", () => {
    stubHome()
    renderWithProviders(<HomePage />)

    expect(
      screen.getByRole("link", { name: "Zur Tokenschicht" })
    ).toHaveAttribute("href", "/dev/tokens")
  })
})
