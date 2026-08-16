import { HttpResponse, http } from "msw"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { getAuthState } from "@/api/auth/authStore"
import { setAuthNavigate } from "@/api/auth/redirect"
import ProjectListPage from "@/features/projects/ProjectListPage"
import i18n from "@/i18n"
import { apiErrorResponse } from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { signInAs } from "@/tests/routes/helpers"

function pageOf(
  content: unknown[],
  totalElements = content.length,
  page = 0,
  size = 20
) {
  return {
    content,
    page,
    size,
    totalElements,
    totalPages: totalElements === 0 ? 0 : Math.ceil(totalElements / size),
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
              semester: { id: "s-1", name: "SoSe 2026" },
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
    expect(
      screen.getByText("2 studentische Projekte gefunden")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { level: 1, name: "Studentische Projekte" })
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

  it("liest Suche und Seite aus der URL und uebersteht so einen Reload", async () => {
    const requests: URLSearchParams[] = []
    server.use(
      http.get("*/api/projects", ({ request }) => {
        requests.push(new URL(request.url).searchParams)
        return HttpResponse.json(
          pageOf(
            [
              {
                id: "10000000-0000-0000-0000-000000000004",
                title: "Campus-Garten an der Werderstraße",
                status: "PUBLISHED",
              },
            ],
            21,
            1
          )
        )
      })
    )
    renderWithProviders(<ProjectListPage />, "/projects?q=garten&page=2")

    await screen.findByText("Campus-Garten an der Werderstraße")
    /* Die URL ist der einzige Zustand: q geht unveraendert in den Request,
       die sichtbare Seite 2 wird zur 0-basierten Seite 1 (§6.6), status
       bleibt fest verdrahtet. */
    const requested = requests.at(-1)
    expect(requested?.get("q")).toBe("garten")
    expect(requested?.get("page")).toBe("1")
    expect(requested?.get("status")).toBe("PUBLISHED")
    /* Das Suchfeld zeigt den URL-Zustand an. */
    expect(screen.getByRole("searchbox")).toHaveValue("garten")
  })

  it("entprellt die Suche und schreibt sie als q in URL und Request", async () => {
    const requestedQ: (string | null)[] = []
    server.use(
      http.get("*/api/projects", ({ request }) => {
        requestedQ.push(new URL(request.url).searchParams.get("q"))
        return HttpResponse.json(pageOf([]))
      })
    )
    renderWithProviders(<ProjectListPage />)
    await screen.findByRole("searchbox")

    await userEvent.type(screen.getByRole("searchbox"), "garten")

    await waitFor(
      () => {
        expect(requestedQ).toContain("garten")
      },
      { timeout: 2000 }
    )
    /* Kein Request je Tastenanschlag: zwischen leerem Start und fertigem
       Begriff liegen keine Teilbegriffe fuer jeden Buchstaben. */
    expect(requestedQ.filter((value) => value !== null && value !== "garten"))
      .toHaveLength(0)
  })

  it("blaettert ueber die Paginierung und fragt die naechste Seite an", async () => {
    const requestedPages: (string | null)[] = []
    server.use(
      http.get("*/api/projects", ({ request }) => {
        const url = new URL(request.url)
        requestedPages.push(url.searchParams.get("page"))
        return HttpResponse.json(
          pageOf(
            [
              {
                id: "10000000-0000-0000-0000-000000000005",
                title: "Barrierefreie Navigation im Hochschulportal",
                status: "PUBLISHED",
              },
            ],
            40,
            url.searchParams.get("page") === "1" ? 1 : 0
          )
        )
      })
    )
    renderWithProviders(<ProjectListPage />)

    await screen.findByText("Barrierefreie Navigation im Hochschulportal")
    expect(
      screen.getByRole("navigation", { name: "Seitennummerierung" })
    ).toBeInTheDocument()

    /* Base UI rendert die Anker der Paginierung mit role="button"
       (Registry-Fassung aus KAN-29); abgefragt wird die tatsaechliche
       Rolle. */
    await userEvent.click(
      screen.getByRole("button", { name: "Zur nächsten Seite" })
    )

    await waitFor(() => {
      expect(requestedPages).toContain("1")
    })
  })

  it("zeigt die Filtergruppen als Kommt-bald-Hinweis ohne Bedienelemente", async () => {
    server.use(
      http.get("*/api/projects", () => HttpResponse.json(pageOf([])))
    )
    renderWithProviders(<ProjectListPage />)

    expect(
      screen.getByRole("heading", { level: 2, name: "Filter" })
    ).toBeInTheDocument()
    expect(
      screen.getByText("Die Filtergruppen entstehen mit dem Ticket KAN-64.")
    ).toBeInTheDocument()
    for (const group of [
      "Fakultät/Institution",
      "Studiengang",
      "Abschluss",
      "Semester",
      "Projekttyp",
      "Kategorie",
    ]) {
      expect(screen.getByText(group)).toBeInTheDocument()
    }
    /* Kein Bedienelement, das nichts tut (DoD KAN-31): keine Checkboxen,
       keine Aufklappknoepfe. */
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
  })

  it("bietet bei einer Seite jenseits von totalPages den Weg zur letzten Seite", async () => {
    server.use(
      http.get("*/api/projects", ({ request }) =>
        HttpResponse.json(
          /* Seite 99 existiert nicht: leerer Inhalt, aber 40 Treffer auf
             zwei Seiten. Ein veralteter geteilter Link ist hier das
             Kernszenario. */
          new URL(request.url).searchParams.get("page") === null
            ? pageOf(
                [
                  {
                    id: "10000000-0000-0000-0000-000000000006",
                    title: "Campus-Garten an der Werderstraße",
                    status: "PUBLISHED",
                  },
                ],
                40
              )
            : pageOf([], 40, 98)
        )
      )
    )
    renderWithProviders(<ProjectListPage />, "/projects?page=99")

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Diese Seite gibt es nicht mehr",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Zur letzten Seite" })
    ).toHaveAttribute("href", "/projects?page=2")
  })

  it("reicht einen sort-Parameter aus der URL nicht an den Server weiter", async () => {
    const requests: URLSearchParams[] = []
    server.use(
      http.get("*/api/projects", ({ request }) => {
        requests.push(new URL(request.url).searchParams)
        return HttpResponse.json(pageOf([]))
      })
    )
    renderWithProviders(<ProjectListPage />, "/projects?sort=passwortHash,asc")

    await screen.findByRole("heading", {
      level: 2,
      name: "Keine Projekte vorhanden",
    })
    /* Die Bibliothek bietet kein Sortier-Element an (Entscheidung zu
       KAN-31): es gilt der Server-Standard updatedAt,desc, und eine von
       Hand geschriebene URL kann kein Feld ausserhalb der Positivliste
       (§6.6) zum Server durchreichen. */
    expect(requests.at(-1)?.get("sort")).toBeNull()
  })

  it("nennt eine leere Treffermenge bei aktiver Suche Keine Treffer", async () => {
    server.use(
      http.get("*/api/projects", () => HttpResponse.json(pageOf([])))
    )
    renderWithProviders(<ProjectListPage />, "/projects?q=unbekannt")

    expect(
      await screen.findByRole("heading", { level: 2, name: "Keine Treffer" })
    ).toBeInTheDocument()
  })
})
