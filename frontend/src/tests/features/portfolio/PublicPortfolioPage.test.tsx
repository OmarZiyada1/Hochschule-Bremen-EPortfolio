import { HttpResponse, http } from "msw"
import { screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import i18n from "@/i18n"
import { apiErrorResponse } from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { AppUnderTest } from "@/tests/routes/helpers"

const USER_ID = "7c1e0000-0000-4000-8000-000000000009"
const PATH = `/portfolios/${USER_ID}`

const PROFILE = {
  user: {
    id: USER_ID,
    firstName: "Lena",
    lastName: "Müller",
    email: "lena.mueller@example.org",
  },
  biography: "Studierende an der Hochschule Bremen im Studiengang Informatik.",
  avatarUrl: "/api/files/aaaa0000-0000-4000-8000-000000000001",
  projects: [
    {
      id: "22222222-0000-4000-8000-000000000001",
      title: "SmartCampus",
      summary: "Ein verteiltes Sensornetzwerk mit Edge-Inferenz.",
      status: "PUBLISHED",
      author: { firstName: "Lena", lastName: "Müller" },
      semester: {
        id: "5e000000-0000-4000-8000-000000000001",
        name: "WiSe 2025/26",
      },
    },
  ],
}

/**
 * Das oeffentliche Profil (KAN-34): erreichbar ohne Anmeldung, mit der
 * privaten E-Mail als Kontaktweg (§3.2), ohne HSB-Adresse (§3.1) und ohne
 * Rollen-Badge, weil §6.1 fuer diesen Endpoint kein role fuehrt
 * (Entscheidung aus der Klaerungsrunde).
 */
describe("PublicPortfolioPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
  })

  it("zeigt ohne Anmeldung Profil und veroeffentlichte Arbeiten", async () => {
    server.use(
      http.get(`*/api/portfolios/${USER_ID}`, () => HttpResponse.json(PROFILE))
    )
    renderWithProviders(<AppUnderTest />, PATH)

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Portfolio von Lena Müller",
      })
    ).toBeVisible()
    expect(
      screen.getByRole("heading", { level: 2, name: "SmartCampus" })
    ).toBeVisible()
    /* §3.2: die private Adresse gehoert bewusst ins oeffentliche Profil,
       weil ein Portfolio ohne Rueckkanal seinen Zweck nur halb erfuellt. */
    expect(screen.getByText("lena.mueller@example.org")).toBeVisible()
  })

  it("zeigt keine HSB-Adresse, auch wenn der Server eine mitschickte", async () => {
    /* §3.1: hsbEmail verlaesst den Server nur ueber AdminUserResponse.
       Taucht sie hier auf, ist das ein Backend-Fehler; die Oberflaeche
       stellt sie in keinem Fall dar. */
    server.use(
      http.get(`*/api/portfolios/${USER_ID}`, () =>
        HttpResponse.json({
          ...PROFILE,
          user: { ...PROFILE.user, hsbEmail: "lena@stud.hs-bremen.de" },
        })
      )
    )
    renderWithProviders(<AppUnderTest />, PATH)

    await screen.findByText("lena.mueller@example.org")
    expect(screen.queryByText("lena@stud.hs-bremen.de")).not.toBeInTheDocument()
  })

  it("zeigt keinen Rollen-Badge, weil die Antwort keine Rolle fuehrt", async () => {
    server.use(
      http.get(`*/api/portfolios/${USER_ID}`, () => HttpResponse.json(PROFILE))
    )
    renderWithProviders(<AppUnderTest />, PATH)

    await screen.findByText("lena.mueller@example.org")
    for (const label of ["Studierende:r", "Redakteur:in", "Admin"]) {
      expect(screen.queryByText(label)).not.toBeInTheDocument()
    }
  })

  it("zeigt den Leerzustand, wenn nichts veroeffentlicht ist", async () => {
    server.use(
      http.get(`*/api/portfolios/${USER_ID}`, () =>
        HttpResponse.json({ ...PROFILE, projects: [] })
      )
    )
    renderWithProviders(<AppUnderTest />, PATH)

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Noch nichts veröffentlicht",
      })
    ).toBeVisible()
  })

  it("macht eine unbekannte Benutzer-ID als eigenen Zustand sichtbar", async () => {
    /* §6.1: unbekannte ID ergibt 404 RESOURCE_NOT_FOUND. Kein roher
       Statuscode und keine leere Seite. */
    server.use(
      http.get(`*/api/portfolios/${USER_ID}`, () =>
        apiErrorResponse(
          404,
          "RESOURCE_NOT_FOUND",
          `/api/portfolios/${USER_ID}`
        )
      )
    )
    renderWithProviders(<AppUnderTest />, PATH)

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Profil nicht gefunden",
      })
    ).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Zur Projektbibliothek" })
    ).toBeVisible()
  })

  it("macht eine sonstige Fehlerantwort als Meldung sichtbar", async () => {
    server.use(
      http.get(`*/api/portfolios/${USER_ID}`, () =>
        apiErrorResponse(500, "INTERNAL_ERROR", `/api/portfolios/${USER_ID}`)
      )
    )
    renderWithProviders(<AppUnderTest />, PATH)

    expect(
      await screen.findByText(
        "Etwas ist schiefgelaufen. Bitte versuchen Sie es später erneut."
      )
    ).toBeVisible()
  })
})
