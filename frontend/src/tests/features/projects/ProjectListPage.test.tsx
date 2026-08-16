import { HttpResponse, http } from "msw"
import { screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { getAuthState } from "@/api/auth/authStore"
import { setAuthNavigate } from "@/api/auth/redirect"
import ProjectListPage from "@/features/projects/ProjectListPage"
import i18n from "@/i18n"
import { apiErrorResponse } from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { signInAs } from "@/tests/routes/helpers"

function pageOf(content: unknown[], totalElements = content.length) {
  return {
    content,
    page: 0,
    size: 20,
    totalElements,
    totalPages: totalElements === 0 ? 0 : 1,
  }
}

/**
 * Projektliste des Durchstichs (Ticket KAN-8): die drei Zustaende Laden,
 * Leere und Fehler, die sichtbare 401-Reaktion und der fest verdrahtete
 * Filter status=PUBLISHED (Klaerungsrunde im Review zu KAN-8, Contract v42).
 */
describe("ProjectListPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
  })

  it("zeigt echte Daten aus PageResponse, ohne Status-Badge", async () => {
    server.use(
      http.get("*/api/projects", () =>
        HttpResponse.json(
          pageOf([
            {
              id: "10000000-0000-0000-0000-000000000001",
              title: "Campus-Garten an der Werderstraße",
              summary: "Freifläche als offener Lernort.",
              status: "PUBLISHED",
              semester: "SoSe 2026",
              reactionCount: 3,
              author: { firstName: "Mira", lastName: "Beispiel" },
            },
            {
              id: "10000000-0000-0000-0000-000000000002",
              title: "Barrierefreie Navigation im Hochschulportal",
              status: "PUBLISHED",
            },
          ])
        )
      )
    )
    const { container } = renderWithProviders(<ProjectListPage />)

    /* Ladezustand in der Form des Ergebnisses, kein Spinner. */
    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0)

    /* Kacheltitel als h2 direkt unter dem Seiten-h1, kein Sprung auf h3
       (SC 1.3.1); nachgewiesen ueber die Rolle, nicht den Text. */
    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Campus-Garten an der Werderstraße",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Barrierefreie Navigation im Hochschulportal",
      })
    ).toBeInTheDocument()
    expect(screen.getByText("2 Projekte")).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { level: 1, name: "Projektbibliothek" })
    ).toBeInTheDocument()
    /* Die Bibliothek zeigt nur PUBLISHED; ein Badge unterschiede nichts
       und bleibt deshalb weg. */
    expect(screen.queryByText("Veröffentlicht")).not.toBeInTheDocument()
  })

  it("fragt fest mit status=PUBLISHED ab, auch angemeldet ohne Badge", async () => {
    signInAs("STUDENT")
    let requestedStatus: string | null = null
    server.use(
      http.get("*/api/projects", ({ request }) => {
        requestedStatus = new URL(request.url).searchParams.get("status")
        return HttpResponse.json(
          pageOf([
            {
              id: "10000000-0000-0000-0000-000000000003",
              title: "Veröffentlichtes Projekt",
              status: "PUBLISHED",
            },
          ])
        )
      })
    )
    renderWithProviders(<ProjectListPage />)

    expect(
      await screen.findByText("Veröffentlichtes Projekt")
    ).toBeInTheDocument()
    /* Der Filter ist in der Query-Fabrik fest verdrahtet und nicht
       waehlbar: eigene Entwuerfe gehoeren in "Mein Portfolio" (KAN-34),
       nicht in die oeffentliche Bibliothek. */
    expect(requestedStatus).toBe("PUBLISHED")
    expect(screen.queryByText("Veröffentlicht")).not.toBeInTheDocument()
  })

  it("zeigt den Leerzustand statt einer leeren Flaeche", async () => {
    server.use(
      http.get("*/api/projects", () => HttpResponse.json(pageOf([])))
    )
    renderWithProviders(<ProjectListPage />)

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Keine Projekte vorhanden",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText("Sobald Projekte veröffentlicht sind, erscheinen sie hier.")
    ).toBeInTheDocument()
  })

  it("macht eine Fehlerantwort aus dem 6.2-Envelope sichtbar", async () => {
    server.use(
      http.get("*/api/projects", () =>
        apiErrorResponse(500, "INTERNAL_ERROR", "/api/projects")
      )
    )
    renderWithProviders(<ProjectListPage />)

    expect(
      await screen.findByText(
        "Etwas ist schiefgelaufen. Bitte versuchen Sie es später erneut."
      )
    ).toBeInTheDocument()
  })

  it("401 beendet die Sitzung sichtbar und fuehrt zum Login", async () => {
    signInAs("STUDENT")
    const navigate = vi.fn()
    setAuthNavigate(navigate)
    server.use(
      http.get("*/api/projects", () =>
        apiErrorResponse(401, "TOKEN_EXPIRED", "/api/projects")
      )
    )
    renderWithProviders(<ProjectListPage />)

    /* Nie eine leere Seite: die Meldung erscheint auf der Liste, waehrend
       die zentrale Reaktion aus KAN-30 Sitzung und Ziel umsetzt. */
    expect(
      await screen.findByText(
        "Die Sitzung ist abgelaufen. Bitte melden Sie sich erneut an."
      )
    ).toBeInTheDocument()
    expect(navigate).toHaveBeenCalledWith("/login")
    expect(getAuthState().session).toBeNull()
    expect(getAuthState().sessionNotice).toBe("TOKEN_EXPIRED")
  })
})
