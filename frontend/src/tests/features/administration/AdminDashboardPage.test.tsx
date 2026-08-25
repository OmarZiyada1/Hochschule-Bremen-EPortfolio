import { screen, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it } from "vitest"

import type { DashboardResponse } from "@/api/types"
import AdminDashboardPage from "@/features/administration/AdminDashboardPage"
import i18n from "@/i18n"
import { reference } from "@/tests/fixtures"
import { apiErrorResponse, currentUserHandler } from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { signInAs } from "@/tests/routes/helpers"

/**
 * Eine vollstaendige Antwort von {@code GET /api/admin/dashboard} (§6.1).
 * Jede Aufschluesselung traegt alle Werte ihres Enums, auch die mit 0: genau
 * das sagt der Contract seit v26 zu, und die Oberflaeche verlaesst sich
 * darauf.
 */
function dashboard(overrides: Partial<DashboardResponse> = {}) {
  return {
    projectsByStatus: {
      DRAFT: 2,
      SUBMITTED: 3,
      APPROVED: 3,
      PUBLISHED: 40,
      REVISION: 1,
    },
    projectsByFaculty: [
      {
        faculty: reference({
          id: "f-1",
          name: "Wirtschaft",
          abbreviation: "F1",
        }),
        count: 6,
      },
      {
        faculty: reference({
          id: "f-2",
          name: "Architektur",
          abbreviation: "F2",
        }),
        count: 0,
      },
    ],
    usersTotal: 9,
    usersByRole: { STUDENT: 4, EDITOR: 4, ADMIN: 1 },
    usersByStatus: { REGISTRATION_PENDING: 0, ACTIVE: 8, DEACTIVATED: 1 },
    openNominations: 5,
    blocksByType: {},
    ...overrides,
  } satisfies DashboardResponse
}

function baseHandlers(response = dashboard()) {
  return [
    currentUserHandler({ role: "ADMIN" }),
    http.get("*/api/admin/dashboard", () => HttpResponse.json(response)),
  ]
}

/**
 * Die Startansicht der Administrationsseite (Ticket KAN-38): Kennzahlen zum
 * Bestand, die Nutzerstatistik und die Verteilung je Fakultaet.
 */
describe("AdminDashboardPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
    signInAs("ADMIN")
  })

  it("zeigt die Projektzahlen je Status und die gerechnete Summe", async () => {
    server.use(...baseHandlers())

    renderWithProviders(<AdminDashboardPage />, "/administration")

    /* Die Summe steht nicht in der Antwort: §6.1 kennt keine Gesamtzahl.
       49 = 2 + 3 + 3 + 40 + 1. */
    expect(await screen.findByText("49")).toBeInTheDocument()
    expect(screen.getByText("40")).toBeInTheDocument()
    expect(screen.getByText("Veröffentlicht")).toBeInTheDocument()
    expect(screen.getByText("Überarbeitung")).toBeInTheDocument()
  })

  it("zeigt einen Status ohne Projekte als 0 und nicht als Luecke", async () => {
    server.use(
      ...baseHandlers(
        dashboard({
          projectsByStatus: {
            DRAFT: 0,
            SUBMITTED: 0,
            APPROVED: 0,
            PUBLISHED: 0,
            REVISION: 0,
          },
        })
      )
    )

    renderWithProviders(<AdminDashboardPage />, "/administration")

    const draft = await screen.findByText("Entwurf")
    /* Die Kachel traegt Zahl und Beschriftung; die 0 gehoert dazu. */
    expect(draft.closest("div")).toHaveTextContent("0")
  })

  it("zeigt Nutzerzahlen, Kontostatus und die offenen Vorschlaege", async () => {
    server.use(...baseHandlers())

    renderWithProviders(<AdminDashboardPage />, "/administration")

    expect(await screen.findByText("Alle Nutzer:innen")).toBeInTheDocument()
    /* Rollen im Plural: die Zeile zaehlt Konten. */
    expect(screen.getByText("Admins")).toBeInTheDocument()
    expect(screen.getByText("Redakteur:innen")).toBeInTheDocument()
    /* Die drei Kontostatus und die offenen Vorschlaege zeichnet der Frame
       nicht; sie stehen laut Klaerungsrunde zu KAN-38 trotzdem hier. */
    expect(screen.getByText("Deaktiviert")).toBeInTheDocument()
    expect(screen.getByText("Registrierung offen")).toBeInTheDocument()

    const nominations = screen.getByRole("link", {
      name: "Offene Top-10-Vorschläge",
    })
    expect(nominations).toHaveAttribute("href", "/administration/top10")
  })

  it("fuehrt jede Fakultaet, auch die ohne Projekte", async () => {
    server.use(...baseHandlers())

    renderWithProviders(<AdminDashboardPage />, "/administration")

    /* Die Grafik selbst ist aria-hidden; zugaenglich ist die Tabelle
       daneben. Genau sie wird geprueft, denn sie traegt die Aussage. */
    const table = await screen.findByRole("table", {
      name: "Projekte je Fakultät",
    })
    expect(within(table).getByText("F1, Wirtschaft")).toBeInTheDocument()
    const zero = within(table).getByText("F2, Architektur").closest("tr")
    expect(zero).not.toBeNull()
    expect(within(zero!).getByText("0")).toBeInTheDocument()
  })

  it("zeigt eine Fehlerantwort sichtbar und nicht als leere Flaeche", async () => {
    server.use(
      currentUserHandler({ role: "ADMIN" }),
      http.get("*/api/admin/dashboard", () =>
        apiErrorResponse(403, "NO_PERMISSION", "/api/admin/dashboard")
      )
    )

    renderWithProviders(<AdminDashboardPage />, "/administration")

    expect(
      await screen.findByText(i18n.t("apiError.NO_PERMISSION"))
    ).toBeInTheDocument()

    /* Fehler und Leere sind zwei Zustaende: die Karten entstehen gar nicht
       erst, statt sechs leere Kacheln und „keine Fakultaeten hinterlegt" zu
       zeigen, also eine Aussage ueber einen Bestand ohne Antwort. */
    expect(
      screen.queryByText(i18n.t("administration.dashboard.faculties.empty"))
    ).toBeNull()
    expect(
      screen.queryByText(i18n.t("administration.dashboard.projects.title"))
    ).toBeNull()
  })
})
