import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it } from "vitest"

import AdminTop10AuditPage from "@/features/administration/AdminTop10AuditPage"
import i18n from "@/i18n"
import { person, top10AuditEntry } from "@/tests/fixtures"
import { apiErrorResponse, currentUserHandler } from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { signInAs } from "@/tests/routes/helpers"

const ADDED = top10AuditEntry({
  id: "ta-add",
  action: "ADDED",
  previousPosition: null,
  newPosition: 8,
  project: { id: "p-9", title: "PortLogix" },
})

const REORDERED = top10AuditEntry({
  id: "ta-move",
  action: "REORDERED",
  previousPosition: 3,
  newPosition: 1,
  project: { id: "p-1", title: "SmartCampus" },
})

/* §3.17: ein geloeschtes Projekt hinterlaesst eine Zeile ohne Verweis. */
const REMOVED_DELETED = top10AuditEntry({
  id: "ta-del",
  action: "REMOVED",
  previousPosition: 6,
  newPosition: null,
  project: null,
  admin: person({ firstName: "Anna", lastName: "Fischer" }),
})

function auditHandler(
  entries = [REORDERED, ADDED, REMOVED_DELETED],
  onRequest?: (url: URL) => void
) {
  return http.get("*/api/admin/top10-audit", ({ request }) => {
    onRequest?.(new URL(request.url))
    return HttpResponse.json({
      content: entries,
      page: 0,
      size: 20,
      totalElements: entries.length,
      totalPages: 1,
    })
  })
}

function render(route = "/administration/top10/audit") {
  return renderWithProviders(<AdminTop10AuditPage />, route)
}

/**
 * Das Top-10-Aenderungsprotokoll (Ticket KAN-40, Tests 8 und 9).
 */
describe("AdminTop10AuditPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
    signInAs("ADMIN")
  })

  /* Ticket KAN-40, Test 8. */
  it("zeigt alle drei Aktionsarten aus 2.12 mit ihrem Platzwechsel", async () => {
    server.use(currentUserHandler({ role: "ADMIN" }), auditHandler())

    render()

    expect(await screen.findByText("Umsortiert")).toBeInTheDocument()
    expect(screen.getByText("Hinzugefügt")).toBeInTheDocument()
    expect(screen.getByText("Entfernt")).toBeInTheDocument()

    expect(screen.getByText("Von Platz 3 auf Platz 1")).toBeInTheDocument()
    expect(screen.getByText("Auf Platz 8")).toBeInTheDocument()
    expect(screen.getByText("Von Platz 6")).toBeInTheDocument()
  })

  /* Ticket KAN-40, Test 8: eine Zeile ohne Projektbezug. */
  it("zeigt eine Zeile ohne Projekt als „Projekt gelöscht“ und verlinkt sie nicht", async () => {
    server.use(
      currentUserHandler({ role: "ADMIN" }),
      auditHandler([REMOVED_DELETED])
    )

    render()

    const deleted = await screen.findByText("Projekt gelöscht")
    expect(deleted).toBeInTheDocument()
    expect(deleted.closest("a")).toBeNull()
    /* Die Zeile bleibt trotzdem vollstaendig lesbar: Zeitpunkt, Person,
       Aktion und Platz stehen weiter da (§3.17). */
    expect(screen.getByText("von Anna Fischer")).toBeInTheDocument()
    expect(screen.getByText("Von Platz 6")).toBeInTheDocument()
  })

  /* Ticket KAN-40, Test 8: das Protokoll ist unveraenderlich (§3.17). */
  it("bietet weder Bearbeiten noch Loeschen an", async () => {
    server.use(currentUserHandler({ role: "ADMIN" }), auditHandler())

    render()

    await screen.findByText("Umsortiert")
    for (const label of [/bearbeiten/i, /löschen/i, /entfernen/i]) {
      expect(screen.queryByRole("button", { name: label })).not.toBeInTheDocument()
    }
  })

  it("verlinkt ein vorhandenes Projekt auf seine Detailseite", async () => {
    server.use(currentUserHandler({ role: "ADMIN" }), auditHandler([REORDERED]))

    render()

    expect(await screen.findByRole("link", { name: "SmartCampus" })).toHaveAttribute(
      "href",
      "/projects/p-1"
    )
  })

  /* Ticket KAN-40, Test 9. */
  it("schickt den Zeitraum als ISO-8601-Zeitpunkte in UTC", async () => {
    const urls: URL[] = []
    server.use(
      currentUserHandler({ role: "ADMIN" }),
      auditHandler([REORDERED], (url) => urls.push(url))
    )

    render("/administration/top10/audit?from=2026-08-01&to=2026-08-25")

    await waitFor(() => expect(urls).not.toHaveLength(0))
    const params = urls[urls.length - 1].searchParams

    /* Zeitpunkte nach §1, nicht Tagesdaten. */
    expect(params.get("from")).toBe(
      new Date(2026, 7, 1, 0, 0, 0, 0).toISOString()
    )
    /* Beide Grenzen eingeschlossen: der letzte Tag zaehlt vollstaendig
       mit, bis zur letzten Millisekunde. */
    expect(params.get("to")).toBe(
      new Date(2026, 7, 25, 23, 59, 59, 999).toISOString()
    )
  })

  /* Ticket KAN-40, Test 9: ein Bereich bis heute schliesst heute ein. */
  it("schliesst den heutigen Tag ein, wenn der Bereich bis heute reicht", async () => {
    const urls: URL[] = []
    const today = new Date()
    const iso = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-")

    server.use(
      currentUserHandler({ role: "ADMIN" }),
      auditHandler([REORDERED], (url) => urls.push(url))
    )

    render(`/administration/top10/audit?to=${iso}`)

    await waitFor(() => expect(urls).not.toHaveLength(0))
    const to = urls[urls.length - 1].searchParams.get("to")
    expect(to).not.toBeNull()
    expect(new Date(to as string).getTime()).toBeGreaterThan(today.getTime())
  })

  /* Ticket KAN-40, Test 7, zweite Haelfte. */
  it("beanstandet einen umgekehrten Zeitraum im Formular, ohne ihn zu schicken", async () => {
    const user = userEvent.setup()
    const urls: URL[] = []
    server.use(
      currentUserHandler({ role: "ADMIN" }),
      auditHandler([REORDERED], (url) => urls.push(url))
    )

    render()

    await screen.findByText("Umsortiert")
    const before = urls.length

    await user.type(screen.getByLabelText("Von"), "2026-08-25")
    await user.type(screen.getByLabelText("Bis"), "2026-08-01")
    await user.click(screen.getByRole("button", { name: "Zeitraum anwenden" }))

    expect(
      await screen.findByText("Das Ende darf nicht vor dem Anfang liegen.")
    ).toBeInTheDocument()
    /* Kein Request: der 400 des Servers waere hier kein Erkenntnisgewinn,
       sondern nur ein Umweg (§6.1). */
    expect(urls).toHaveLength(before)
  })

  it("behandelt einen 400 des Servers sichtbar und nicht als leeres Ergebnis", async () => {
    server.use(
      currentUserHandler({ role: "ADMIN" }),
      http.get("*/api/admin/top10-audit", () =>
        apiErrorResponse(
          400,
          "VALIDATION_FAILED",
          "/api/admin/top10-audit",
          "Egal welcher Text hier steht."
        )
      )
    )

    render("/administration/top10/audit?from=2026-08-25&to=2026-08-01")

    expect(
      await screen.findByText(i18n.t("apiError.VALIDATION_FAILED"))
    ).toBeInTheDocument()
    expect(screen.queryByText("Kein Eintrag")).not.toBeInTheDocument()
  })

  it("zeigt den Leerzustand und unterscheidet gefiltert von ungefiltert", async () => {
    server.use(currentUserHandler({ role: "ADMIN" }), auditHandler([]))

    const { unmount } = render()
    expect(
      await screen.findByText("An der Top 10 ist bisher nichts geändert worden.")
    ).toBeInTheDocument()
    unmount()

    render("/administration/top10/audit?from=2026-08-01")
    expect(
      await screen.findByText(/In diesem Zeitraum ist nichts geändert worden/)
    ).toBeInTheDocument()
  })

  it("fuehrt beide Bereiche als Leiste und markiert das Protokoll", async () => {
    server.use(currentUserHandler({ role: "ADMIN" }), auditHandler())

    render()

    const nav = await screen.findByRole("navigation", {
      name: "Bereiche der Top 10",
    })
    expect(within(nav).getByRole("link", { name: "Verwaltung" })).toHaveAttribute(
      "href",
      "/administration/top10"
    )
    expect(within(nav).getByRole("link", { name: "Protokoll" })).toHaveAttribute(
      "aria-current",
      "page"
    )
  })
})
