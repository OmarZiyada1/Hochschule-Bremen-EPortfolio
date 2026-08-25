import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it } from "vitest"

import type { CategoryResponse } from "@/api/types"
import AdminCategoryListPage from "@/features/administration/AdminCategoryListPage"
import i18n from "@/i18n"
import { apiErrorResponse, currentUserHandler } from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { signInAs } from "@/tests/routes/helpers"

const ARCHITEKTUR: CategoryResponse = { id: "c-1", name: "Architektur" }
const INFORMATIK: CategoryResponse = { id: "c-2", name: "Informatik" }

function baseHandlers(categories: CategoryResponse[] = []) {
  return [
    currentUserHandler({ role: "ADMIN" }),
    http.get("*/api/categories", () => HttpResponse.json(categories)),
  ]
}

/**
 * Die Kategorienpflege (Ticket KAN-39): alphabetische Baender, Anlegen,
 * Umbenennen, Zusammenfuehren und die Loeschsperre aus §6.1.
 */
describe("AdminCategoryListPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
    signInAs("ADMIN")
  })

  it("gruppiert die Liste in die Baender des Frames", async () => {
    server.use(...baseHandlers([ARCHITEKTUR, INFORMATIK]))

    renderWithProviders(<AdminCategoryListPage />, "/administration/categories")

    expect(
      await screen.findByRole("button", { name: /A – C \(1\)/ })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /G – I \(1\)/ })
    ).toBeInTheDocument()
    expect(screen.getByText("Architektur")).toBeInTheDocument()
  })

  it("zeigt keine Spalte mit einer Projektzahl", async () => {
    server.use(...baseHandlers([ARCHITEKTUR]))

    renderWithProviders(<AdminCategoryListPage />, "/administration/categories")

    /*
     * CategoryResponse fuehrt nur id und name (§3.6); kein Endpoint liefert
     * eine Projektzahl je Kategorie. Eine Spalte dafuer waere eine Attrappe
     * (Frontend-Regel 10).
     */
    const row = (await screen.findByText("Architektur")).closest("li")
    expect(within(row!).queryByText(/Projekte?$/)).not.toBeInTheDocument()
  })

  it("legt eine Kategorie ueber das Feld an", async () => {
    const bodies: unknown[] = []
    server.use(
      ...baseHandlers([]),
      http.post("*/api/admin/categories", async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json({ id: "c-9", name: "Bionik" }, { status: 201 })
      })
    )

    const user = userEvent.setup()
    renderWithProviders(<AdminCategoryListPage />, "/administration/categories")

    await user.type(
      await screen.findByLabelText("Name der neuen Kategorie"),
      "Bionik"
    )
    await user.click(screen.getByRole("button", { name: "Kategorie anlegen" }))

    await waitFor(() => expect(bodies).toEqual([{ name: "Bionik" }]))
  })

  it("legt einen bereits vergebenen Namen an sein Feld", async () => {
    server.use(
      ...baseHandlers([]),
      http.post("*/api/admin/categories", () =>
        apiErrorResponse(409, "RESOURCE_IN_USE", "/api/admin/categories")
      )
    )

    const user = userEvent.setup()
    renderWithProviders(<AdminCategoryListPage />, "/administration/categories")

    const field = await screen.findByLabelText("Name der neuen Kategorie")
    await user.type(field, "Architektur")
    await user.click(screen.getByRole("button", { name: "Kategorie anlegen" }))

    expect(
      await screen.findByText(i18n.t("administration.masterData.nameInUse"))
    ).toBeInTheDocument()
    expect(field).toHaveAttribute("aria-invalid", "true")
  })

  it("zeigt die Loeschsperre einer referenzierten Kategorie mit Begruendung", async () => {
    server.use(
      ...baseHandlers([ARCHITEKTUR]),
      http.delete("*/api/admin/categories/:id", () =>
        apiErrorResponse(409, "RESOURCE_IN_USE", "/api/admin/categories/c-1")
      )
    )

    const user = userEvent.setup()
    renderWithProviders(<AdminCategoryListPage />, "/administration/categories")

    await screen.findByText("Architektur")
    await user.click(
      screen.getByRole("button", { name: "Aktionen für Architektur" })
    )
    await user.click(await screen.findByRole("menuitem", { name: /Löschen/ }))

    const confirm = await screen.findByRole("alertdialog")
    /* Die Rueckfrage nennt vorher, was im Weg stehen kann (§6.1). */
    expect(confirm).toHaveTextContent("Zusammenführen")
    await user.click(
      within(confirm).getByRole("button", { name: "Endgültig löschen" })
    )

    /*
     * Der 409 beim Loeschen meint etwas anderes als derselbe Code am Feld:
     * hier haengen noch Projekte an der Zeile. Die Meldung nennt genau das
     * (DoD von KAN-39) und steht sichtbar ueber der Liste sowie noch einmal
     * in der Live-Region am Seitenende (SC 4.1.3).
     */
    const messages = await screen.findAllByText(
      i18n.t("administration.categories.deleteBlocked", {
        name: "Architektur",
      })
    )
    expect(messages[0]).toBeVisible()
  })

  it("fuehrt zwei Kategorien zusammen und schickt die Zielkategorie mit", async () => {
    const bodies: unknown[] = []
    server.use(
      ...baseHandlers([ARCHITEKTUR, INFORMATIK]),
      http.post("*/api/admin/categories/:id/merge", async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json(INFORMATIK)
      })
    )

    const user = userEvent.setup()
    renderWithProviders(<AdminCategoryListPage />, "/administration/categories")

    await screen.findByText("Architektur")
    await user.click(
      screen.getByRole("button", { name: "Aktionen für Architektur" })
    )
    await user.click(
      await screen.findByRole("menuitem", { name: /Zusammenführen/ })
    )

    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByLabelText("Zielkategorie"))
    /* Die Quelle steht in der Auswahl nicht zur Wahl: Quelle gleich Ziel
       ergaebe 400 (§6.1). */
    expect(
      screen.queryByRole("option", { name: "Architektur" })
    ).not.toBeInTheDocument()
    await user.click(await screen.findByRole("option", { name: "Informatik" }))
    await user.click(
      within(dialog).getByRole("button", { name: "Zusammenführen" })
    )

    await waitFor(() => expect(bodies).toEqual([{ targetCategoryId: "c-2" }]))
  })

  it("legt einen 400 des Zusammenfuehrens an das Auswahlfeld", async () => {
    server.use(
      ...baseHandlers([ARCHITEKTUR, INFORMATIK]),
      http.post("*/api/admin/categories/:id/merge", () =>
        apiErrorResponse(
          400,
          "VALIDATION_FAILED",
          "/api/admin/categories/c-1/merge",
          "targetCategoryId: Unter dieser ID gibt es keine Kategorie."
        )
      )
    )

    const user = userEvent.setup()
    renderWithProviders(<AdminCategoryListPage />, "/administration/categories")

    await screen.findByText("Architektur")
    await user.click(
      screen.getByRole("button", { name: "Aktionen für Architektur" })
    )
    await user.click(
      await screen.findByRole("menuitem", { name: /Zusammenführen/ })
    )

    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByLabelText("Zielkategorie"))
    await user.click(await screen.findByRole("option", { name: "Informatik" }))
    await user.click(
      within(dialog).getByRole("button", { name: "Zusammenführen" })
    )

    /* §6.2 nennt das Feld im Format „feld: Text"; die Meldung gehoert
       deshalb an das Auswahlfeld und nicht an den Kopf des Dialogs. */
    expect(
      await within(dialog).findByText(
        "Unter dieser ID gibt es keine Kategorie."
      )
    ).toBeInTheDocument()
    expect(within(dialog).getByLabelText("Zielkategorie")).toHaveAttribute(
      "aria-invalid",
      "true"
    )
  })

  it("zeigt den Leerzustand ohne Suchfeld", async () => {
    server.use(...baseHandlers([]))

    renderWithProviders(<AdminCategoryListPage />, "/administration/categories")

    expect(
      await screen.findByRole("heading", {
        name: "Noch keine Kategorie angelegt",
      })
    ).toBeInTheDocument()
    /* Im Leerzustand gaebe es nichts zu durchsuchen, und der Frame zeigt
       dort nur das Anlegefeld. */
    expect(
      screen.queryByLabelText("Kategorien durchsuchen")
    ).not.toBeInTheDocument()
  })

  it("liest den Suchbegriff aus der Adresse", async () => {
    server.use(...baseHandlers([ARCHITEKTUR, INFORMATIK]))

    renderWithProviders(
      <AdminCategoryListPage />,
      "/administration/categories?q=infor"
    )

    /* Der Suchbegriff steht in der Adresse und nicht in useState: ein
       Ergebnis ist sonst weder teilbar noch uebersteht es den
       Zurueck-Knopf. */
    expect(await screen.findByText("Informatik")).toBeInTheDocument()
    expect(screen.queryByText("Architektur")).not.toBeInTheDocument()
    expect(screen.getByLabelText("Kategorien durchsuchen")).toHaveValue("infor")
  })

  it("zeigt eine Fehlerantwort sichtbar und nicht als leere Flaeche", async () => {
    server.use(
      currentUserHandler({ role: "ADMIN" }),
      http.get("*/api/categories", () =>
        apiErrorResponse(500, "INTERNAL_ERROR", "/api/categories")
      )
    )

    renderWithProviders(<AdminCategoryListPage />, "/administration/categories")

    expect(
      await screen.findByText(i18n.t("apiError.INTERNAL_ERROR"))
    ).toBeInTheDocument()
  })
})
