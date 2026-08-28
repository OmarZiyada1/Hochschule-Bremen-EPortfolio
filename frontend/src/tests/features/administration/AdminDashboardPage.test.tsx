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
        /* Zwei Plaetze belegt, drei Projekte angenommen: eines davon hat
           seinen Platz wieder verloren (Contract v82). */
        inTop10: 2,
        accepted: 3,
      },
      {
        faculty: reference({
          id: "f-2",
          name: "Architektur",
          abbreviation: "F2",
        }),
        count: 0,
        inTop10: 0,
        accepted: 0,
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
    /* Die Kachel traegt Zahl und Beschriftung; die 0 gehoert dazu. Zwei
       Ebenen hoch, weil die Beschriftung seit der Vereinheitlichung in
       einer eigenen Spalte neben der Zahl steht (KpiTile). */
    expect(draft.closest("div")?.parentElement).toHaveTextContent("0")
  })

  it("zeigt Nutzerzahlen, Kontostatus und die offenen Vorschlaege", async () => {
    server.use(...baseHandlers())

    renderWithProviders(<AdminDashboardPage />, "/administration")

    /* Die beiden Diagramme sind aria-hidden; zugaenglich ist die Tabelle
       daneben, und genau sie traegt die Aussage (KAN-80). */
    const table = await screen.findByRole("table", {
      name: "Konten nach Rolle und Kontostatus",
    })
    /* Rollen im Plural: gezaehlt werden Konten. */
    expect(within(table).getByText("Admins")).toBeInTheDocument()
    expect(within(table).getByText("Redakteur:innen")).toBeInTheDocument()
    /* Die drei Kontostatus und die offenen Vorschlaege zeichnet der Frame
       nicht; sie stehen laut Klaerungsrunde zu KAN-38 trotzdem hier. */
    expect(within(table).getByText("Deaktiviert")).toBeInTheDocument()
    expect(within(table).getByText("Registrierung offen")).toBeInTheDocument()

    /* Die Gesamtzahl steht in der Mitte des Rings und in der Tabelle. */
    const total = within(table).getByText("Alle Nutzer:innen").closest("tr")
    expect(total).not.toBeNull()
    expect(within(total!).getByText("9")).toBeInTheDocument()

    /*
     * Ziffer und Beschriftung liegen in einem einzigen Link, und sein Name
     * traegt die Zahl im richtigen Numerus: sichtbar steht „5" ueber
     * „Offene Top-10-Vorschläge", vorgelesen wird ein ganzer Satz.
     */
    const nominations = screen.getByRole("link", {
      name: "5 offene Top-10-Vorschläge",
    })
    expect(nominations).toHaveAttribute("href", "/administration/top10")

    /* Solange etwas offen ist, steht ein Punkt vor der Ziffer, und beide
       tragen die Signalfarbe. */
    const value = within(nominations).getByText("5")
    expect(value).toHaveClass("text-primary")
    const dot = value.querySelector("span")
    expect(dot).not.toBeNull()

    /* Der Punkt pulsiert langsam (Vorgabe zur Nacharbeit), damit offener
       Handlungsbedarf im ruhigen Seitenkopf auffaellt. Die Bewegung ist
       Zugabe und nie die Aussage: die Zahl daneben sagt dasselbe, und wer
       weniger Bewegung eingestellt hat, sieht einen ruhenden Punkt. */
    expect(dot).toHaveClass("animate-pulse-slow")
    expect(dot).toHaveClass("motion-reduce:animate-none")

    /*
     * KAN-83: die Zahl steht im Seitenkopf neben der Ueberschrift und nicht
     * mehr in der Karte „Nutzerstatistik". Sie ist der einzige
     * Handlungsbedarf, den diese Seite zeigt, und zwischen Ring, Kuchen und
     * Tabelle sah sie niemand, ohne zu scrollen. Geprueft wird die
     * Nachbarschaft zur Ueberschrift und nicht eine Bildschirmposition: die
     * traegt der Test nicht.
     */
    const title = screen.getByRole("heading", { level: 1, name: "Dashboard" })
    const pageHeader = title.closest("header")
    expect(pageHeader).not.toBeNull()
    expect(pageHeader!.contains(nominations)).toBe(true)
    expect(within(pageHeader!).getByText("5")).toBeInTheDocument()

    const heading = screen.getByRole("heading", {
      level: 2,
      name: "Nutzerstatistik",
    })
    const card = heading.closest("[data-slot=card]")
    expect(card).not.toBeNull()
    expect(card!.contains(nominations)).toBe(false)
  })

  /*
   * Bei null offenen Vorschlaegen wird nichts ausgeblendet: „nichts offen"
   * ist selbst eine Auskunft, und eine Zeile, die kommt und geht, laesst den
   * Seitenkopf springen. Sie verliert nur die Signalfarbe und den Punkt.
   */
  it("zeigt keine offenen Vorschlaege im ruhigen Ton und ohne Signalpunkt", async () => {
    server.use(...baseHandlers(dashboard({ openNominations: 0 })))

    renderWithProviders(<AdminDashboardPage />, "/administration")

    const nominations = await screen.findByRole("link", {
      name: "0 offene Top-10-Vorschläge",
    })
    expect(nominations).toHaveAttribute("href", "/administration/top10")

    const value = within(nominations).getByText("0")
    expect(value).toHaveClass("text-muted-foreground")
    expect(value).not.toHaveClass("text-primary")
    /* Der Punkt ist ein eigenes, leeres Element vor der Ziffer; ohne Anlass
       entsteht er gar nicht erst. */
    expect(value.querySelector("span")).toBeNull()
  })

  /*
   * Punkt 8 aus KAN-80: der Balken je Fakultaet ist gestapelt. Die drei
   * Abschnitte rechnet die Oberflaeche aus zwei Rohzahlen des Servers, weil
   * inTop10 und accepted sich in beide Richtungen ueberschneiden koennen.
   */
  it("schluesselt die Kuratierung je Fakultaet auf", async () => {
    server.use(...baseHandlers())

    renderWithProviders(<AdminDashboardPage />, "/administration")

    const table = await screen.findByRole("table", {
      name: "Projekte je Fakultät",
    })
    const row = within(table).getByText("F1, Wirtschaft").closest("tr")
    expect(row).not.toBeNull()

    const cells = within(row!).getAllByRole("cell")
    /* Bestand 6, davon 2 mit Platz und 1 ehemals in der Top 10 (3 minus 2). */
    expect(cells.map((cell) => cell.textContent)).toEqual(["6", "2", "1"])

    /* Vorgabe zur Nacharbeit: die dritte Spalte heisst „Ehemals Top 10" und
       nicht mehr „Angenommen, ohne Platz". Die alte Beschriftung nannte den
       Vorgang, die neue das, was man vor sich hat. */
    expect(
      within(table).getByRole("columnheader", { name: "Ehemals Top 10" })
    ).toBeInTheDocument()
  })

  it("erzeugt keinen negativen Abschnitt, wenn ein Platz ohne Nominierung entstand", async () => {
    server.use(
      ...baseHandlers(
        dashboard({
          projectsByFaculty: [
            {
              faculty: reference({
                id: "f-1",
                name: "Wirtschaft",
                abbreviation: "F1",
              }),
              count: 4,
              /* Die Administration kann ein Projekt ohne Nominierung
                 aufnehmen; dann ist accepted kleiner als inTop10. */
              inTop10: 3,
              accepted: 1,
            },
          ],
        })
      )
    )

    renderWithProviders(<AdminDashboardPage />, "/administration")

    const table = await screen.findByRole("table", {
      name: "Projekte je Fakultät",
    })
    const row = within(table).getByText("F1, Wirtschaft").closest("tr")
    const cells = within(row!).getAllByRole("cell")
    expect(cells.map((cell) => cell.textContent)).toEqual(["4", "3", "0"])
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
    /* Seit KAN-80 traegt die Zeile drei Zahlen; bei einer Fakultaet ohne
       Projekte stehen alle drei auf 0 statt zu fehlen. */
    expect(
      within(zero!)
        .getAllByRole("cell")
        .map((cell) => cell.textContent)
    ).toEqual(["0", "0", "0"])
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
