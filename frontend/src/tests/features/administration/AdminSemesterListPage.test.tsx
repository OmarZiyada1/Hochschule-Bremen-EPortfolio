import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it } from "vitest"

import type { SemesterResponse } from "@/api/types"
import AdminSemesterListPage from "@/features/administration/AdminSemesterListPage"
import i18n from "@/i18n"
import { apiErrorResponse, currentUserHandler } from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { signInAs } from "@/tests/routes/helpers"

const WISE: SemesterResponse = {
  id: "se-1",
  name: "WiSe 2025/26",
  active: true,
  sortOrder: 1,
}
const SOSE: SemesterResponse = {
  id: "se-2",
  name: "SoSe 2025",
  active: false,
  sortOrder: 2,
}

function baseHandlers(semesters: SemesterResponse[] = []) {
  return [
    currentUserHandler({ role: "ADMIN" }),
    http.get("*/api/semesters", () => HttpResponse.json(semesters)),
  ]
}

/**
 * Die Semesterpflege (Ticket KAN-39, Backend KAN-65): Umschalter je Zeile,
 * die beiden Pfeile, Anlegen und die Loeschsperre aus §3.18.
 */
describe("AdminSemesterListPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
    signInAs("ADMIN")
  })

  it("zaehlt Semester und auswaehlbare getrennt", async () => {
    server.use(...baseHandlers([WISE, SOSE]))

    renderWithProviders(<AdminSemesterListPage />, "/administration/semesters")

    /* „Nur aktive Semester stehen beim Erstellen eines Projekts zur
       Auswahl" (§3.18): die Kopfzeile nennt beide Zahlen. */
    expect(
      await screen.findByText("2 Semester · 1 auswählbar")
    ).toBeInTheDocument()
  })

  it("zeigt den Status als Umschalter mit dem Statuswort als Beschriftung", async () => {
    server.use(...baseHandlers([WISE, SOSE]))

    renderWithProviders(<AdminSemesterListPage />, "/administration/semesters")

    const active = await screen.findByRole("switch", {
      name: "WiSe 2025/26 Aktiv",
    })
    expect(active).toBeChecked()
    expect(
      screen.getByRole("switch", { name: "SoSe 2025 Inaktiv" })
    ).not.toBeChecked()
  })

  it("schaltet ueber PATCH mit active und nicht ueber einen eigenen Endpoint", async () => {
    const bodies: unknown[] = []
    server.use(
      ...baseHandlers([WISE]),
      http.patch("*/api/admin/semesters/:id", async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json({ ...WISE, active: false })
      })
    )

    const user = userEvent.setup()
    renderWithProviders(<AdminSemesterListPage />, "/administration/semesters")

    await user.click(
      await screen.findByRole("switch", { name: "WiSe 2025/26 Aktiv" })
    )

    await waitFor(() => expect(bodies).toEqual([{ active: false }]))
    expect(
      await screen.findByText("„WiSe 2025/26“ steht nicht mehr zur Auswahl.")
    ).toBeInTheDocument()
  })

  it("sperrt die Pfeile am oberen und unteren Rand", async () => {
    server.use(...baseHandlers([WISE, SOSE]))

    renderWithProviders(<AdminSemesterListPage />, "/administration/semesters")

    expect(
      await screen.findByRole("button", { name: "Nach oben, WiSe 2025/26" })
    ).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Nach unten, WiSe 2025/26" })
    ).toBeEnabled()
    expect(
      screen.getByRole("button", { name: "Nach unten, SoSe 2025" })
    ).toBeDisabled()
  })

  it("uebernimmt die neue Reihenfolge aus der Antwort des Servers", async () => {
    const bodies: unknown[] = []
    /* Der Server ist die Wahrheit ueber die Reihenfolge: der Handler dreht
       sie wie der echte Endpoint, damit auch das Nachladen sie zeigt. */
    let order: SemesterResponse[] = [WISE, SOSE]
    server.use(
      currentUserHandler({ role: "ADMIN" }),
      http.get("*/api/semesters", () => HttpResponse.json(order)),
      http.post("*/api/admin/semesters/:id/move", async ({ request }) => {
        bodies.push(await request.json())
        /* Die Antwort ist die vollstaendige neue Reihenfolge, nicht die eine
           verschobene Zeile (§6.1). */
        order = [
          { ...SOSE, sortOrder: 1 },
          { ...WISE, sortOrder: 2 },
        ]
        return HttpResponse.json(order)
      })
    )

    const user = userEvent.setup()
    renderWithProviders(<AdminSemesterListPage />, "/administration/semesters")

    await user.click(
      await screen.findByRole("button", { name: "Nach unten, WiSe 2025/26" })
    )

    await waitFor(() => expect(bodies).toEqual([{ direction: "DOWN" }]))
    await waitFor(() => {
      const rows = screen.getAllByRole("row").slice(1)
      expect(rows[0]).toHaveTextContent("SoSe 2025")
    })
  })

  it("benennt ein Semester ueber den Dialog um", async () => {
    const bodies: unknown[] = []
    server.use(
      ...baseHandlers([WISE]),
      http.patch("*/api/admin/semesters/:id", async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json({ ...WISE, name: "WiSe 2026/27" })
      })
    )

    const user = userEvent.setup()
    renderWithProviders(<AdminSemesterListPage />, "/administration/semesters")

    await screen.findByText("WiSe 2025/26")
    await user.click(
      screen.getByRole("button", { name: "Aktionen für WiSe 2025/26" })
    )
    await user.click(
      await screen.findByRole("menuitem", { name: /Umbenennen/ })
    )

    const dialog = await screen.findByRole("dialog")
    const field = within(dialog).getByLabelText("Name des neuen Semesters")
    await user.clear(field)
    await user.type(field, "WiSe 2026/27")
    await user.click(within(dialog).getByRole("button", { name: "Speichern" }))

    await waitFor(() => expect(bodies).toEqual([{ name: "WiSe 2026/27" }]))
  })

  it("zeigt die Loeschsperre eines referenzierten Semesters", async () => {
    server.use(
      ...baseHandlers([WISE]),
      http.delete("*/api/admin/semesters/:id", () =>
        apiErrorResponse(409, "RESOURCE_IN_USE", "/api/admin/semesters/se-1")
      )
    )

    const user = userEvent.setup()
    renderWithProviders(<AdminSemesterListPage />, "/administration/semesters")

    await screen.findByText("WiSe 2025/26")
    await user.click(
      screen.getByRole("button", { name: "Aktionen für WiSe 2025/26" })
    )
    await user.click(await screen.findByRole("menuitem", { name: /Löschen/ }))
    const confirm = await screen.findByRole("alertdialog")
    await user.click(
      within(confirm).getByRole("button", { name: "Endgültig löschen" })
    )

    /* Die Meldung nennt, was im Weg steht, und den Ausweg (DoD von
       KAN-39): deaktivieren statt loeschen. */
    const messages = await screen.findAllByText(
      i18n.t("administration.semesters.deleteBlocked", {
        name: "WiSe 2025/26",
      })
    )
    expect(messages[0]).toBeVisible()
  })

  it("zeigt den Leerzustand aus dem Frame", async () => {
    server.use(...baseHandlers([]))

    renderWithProviders(<AdminSemesterListPage />, "/administration/semesters")

    expect(
      await screen.findByRole("heading", {
        name: "Noch kein Semester angelegt",
      })
    ).toBeInTheDocument()
    expect(
      screen.queryByLabelText("Semester durchsuchen")
    ).not.toBeInTheDocument()
    /* Das Anlegefeld bleibt die einzige Handlung. */
    expect(
      screen.getByLabelText("Name des neuen Semesters")
    ).toBeInTheDocument()
  })

  it("liest den Suchbegriff aus der Adresse", async () => {
    server.use(...baseHandlers([WISE, SOSE]))

    renderWithProviders(
      <AdminSemesterListPage />,
      "/administration/semesters?q=sose"
    )

    expect(await screen.findByText("SoSe 2025")).toBeInTheDocument()
    expect(screen.queryByText("WiSe 2025/26")).not.toBeInTheDocument()
    expect(screen.getByLabelText("Semester durchsuchen")).toHaveValue("sose")
  })

  it("zeigt eine Fehlerantwort sichtbar und nicht als leere Flaeche", async () => {
    server.use(
      currentUserHandler({ role: "ADMIN" }),
      http.get("*/api/semesters", () =>
        apiErrorResponse(500, "INTERNAL_ERROR", "/api/semesters")
      )
    )

    renderWithProviders(<AdminSemesterListPage />, "/administration/semesters")

    expect(
      await screen.findByText(i18n.t("apiError.INTERNAL_ERROR"))
    ).toBeInTheDocument()
  })
})
