import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it } from "vitest"

import type { AdminUserResponse } from "@/api/types"
import AdminUserListPage from "@/features/administration/AdminUserListPage"
import i18n from "@/i18n"
import { adminUser } from "@/tests/fixtures"
import { apiErrorResponse, currentUserHandler } from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { signInAs } from "@/tests/routes/helpers"

/** Die ID, die {@code signInAs} in die Sitzung legt. */
const OWN_ID = "00000000-0000-0000-0000-000000000001"

const LENA = adminUser()
const SELF = adminUser({
  id: OWN_ID,
  firstName: "Mira",
  lastName: "Beispiel",
  email: "mira.beispiel@example.org",
  hsbEmail: "mira.beispiel@stud.hs-bremen.de",
  role: "ADMIN",
})

function pageOf(content: AdminUserResponse[], totalElements = content.length) {
  return {
    content,
    page: 0,
    size: 20,
    totalElements,
    totalPages: totalElements === 0 ? 0 : Math.ceil(totalElements / 20),
  }
}

function baseHandlers(
  options: {
    users?: AdminUserResponse[]
    onRequest?: (url: URL) => void
  } = {}
) {
  const users = options.users ?? []
  return [
    currentUserHandler({ id: OWN_ID, role: "ADMIN" }),
    http.get("*/api/admin/users", ({ request }) => {
      options.onRequest?.(new URL(request.url))
      return HttpResponse.json(pageOf(users))
    }),
  ]
}

/**
 * Die Nutzerverwaltung (Ticket KAN-39): Spalten nach
 * {@code AdminUserResponse}, Filter in der Adresse, die Zeilenaktionen und
 * der Dialog „Konto anlegen".
 */
describe("AdminUserListPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
    signInAs("ADMIN")
  })

  it("zeigt beide Adressen, Rolle, Status und den Anlegezeitpunkt", async () => {
    server.use(...baseHandlers({ users: [LENA] }))

    renderWithProviders(<AdminUserListPage />, "/administration/users")

    const row = (await screen.findByText("Lena Mueller")).closest("tr")
    expect(row).not.toBeNull()
    /* Die Nutzerverwaltung ist der einzige Ort, an dem die HSB-Adresse
       fremder Konten erscheint (§3.1). */
    expect(
      within(row!).getByText("lena.mueller@stud.hs-bremen.de")
    ).toBeInTheDocument()
    expect(
      within(row!).getByText("lena.mueller@example.org")
    ).toBeInTheDocument()
    expect(within(row!).getByText("Studierende:r")).toBeInTheDocument()
    expect(within(row!).getByText("Aktiv")).toBeInTheDocument()
    expect(within(row!).getByText("14.03.2026")).toBeInTheDocument()
  })

  it("markiert ein Konto mit offenem Passwortwechsel", async () => {
    server.use(
      ...baseHandlers({ users: [adminUser({ passwordChangeRequired: true })] })
    )

    renderWithProviders(<AdminUserListPage />, "/administration/users")

    const row = (await screen.findByText("Lena Mueller")).closest("tr")
    expect(within(row!).getByText("Passwortwechsel offen")).toBeInTheDocument()
  })

  it("uebernimmt Suche, Rolle, Status und Seite aus der Adresse", async () => {
    const requests: URL[] = []
    server.use(
      ...baseHandlers({
        users: [LENA],
        onRequest: (url) => requests.push(url),
      })
    )

    renderWithProviders(
      <AdminUserListPage />,
      "/administration/users?q=Lena&role=STUDENT&status=ACTIVE&page=2"
    )

    await screen.findByText("Lena Mueller")
    const last = requests.at(-1)!
    expect(last.searchParams.get("q")).toBe("Lena")
    expect(last.searchParams.get("role")).toBe("STUDENT")
    expect(last.searchParams.get("status")).toBe("ACTIVE")
    /* Die Adresse zaehlt ab 1, der Server ab 0 (§6.6). */
    expect(last.searchParams.get("page")).toBe("1")
    /* Ohne Sortierfeld bleibt es beim Serverstandard; ein unbekanntes
       ergaebe 400 VALIDATION_FAILED. */
    expect(last.searchParams.get("sort")).toBeNull()
  })

  it("zeigt den Leerzustand und unterscheidet ihn von einem gesetzten Filter", async () => {
    server.use(...baseHandlers({ users: [] }))

    const { unmount } = renderWithProviders(
      <AdminUserListPage />,
      "/administration/users"
    )
    expect(
      await screen.findByRole("heading", { name: "Keine Konten" })
    ).toBeInTheDocument()
    expect(
      screen.getByText(i18n.t("administration.users.empty.description"))
    ).toBeInTheDocument()
    unmount()

    renderWithProviders(<AdminUserListPage />, "/administration/users?q=xyz")
    await screen.findByRole("heading", { name: "Keine Konten" })
    expect(
      screen.getByText(i18n.t("administration.users.empty.filtered"))
    ).toBeInTheDocument()
  })

  it("zeigt eine Fehlerantwort sichtbar und nicht als leere Flaeche", async () => {
    server.use(
      currentUserHandler({ id: OWN_ID, role: "ADMIN" }),
      http.get("*/api/admin/users", () =>
        apiErrorResponse(403, "NO_PERMISSION", "/api/admin/users")
      )
    )

    renderWithProviders(<AdminUserListPage />, "/administration/users")

    expect(
      await screen.findByText(i18n.t("apiError.NO_PERMISSION"))
    ).toBeInTheDocument()
  })

  it("blendet Rolle und Status in der eigenen Zeile aus, laesst aber das Zuruecksetzen stehen", async () => {
    server.use(...baseHandlers({ users: [SELF] }))

    const user = userEvent.setup()
    renderWithProviders(<AdminUserListPage />, "/administration/users")

    await screen.findByText("Mira Beispiel")
    await user.click(
      screen.getByRole("button", { name: "Aktionen für Mira Beispiel" })
    )

    /* PATCH und DELETE auf die eigene ID ergeben 400 VALIDATION_FAILED
       (Contract v26): beides wirkt beim naechsten Request und liesse sich
       danach nicht mehr zuruecknehmen. */
    expect(
      screen.queryByRole("menuitem", { name: /Rolle ändern/ })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("menuitem", { name: /Konto deaktivieren/ })
    ).not.toBeInTheDocument()
    /* Die Zuruecksetzung prueft das Zielkonto nicht und funktioniert auch
       am eigenen (Contract v35). */
    expect(
      await screen.findByRole("menuitem", { name: /Passwort zurücksetzen/ })
    ).toBeInTheDocument()
  })

  it("deaktiviert ein Konto ueber DELETE und meldet es an", async () => {
    const calls: string[] = []
    server.use(
      ...baseHandlers({ users: [LENA] }),
      http.delete("*/api/admin/users/:id", ({ params }) => {
        calls.push(String(params.id))
        return new HttpResponse(null, { status: 204 })
      })
    )

    const user = userEvent.setup()
    renderWithProviders(<AdminUserListPage />, "/administration/users")

    await screen.findByText("Lena Mueller")
    await user.click(
      screen.getByRole("button", { name: "Aktionen für Lena Mueller" })
    )
    await user.click(
      await screen.findByRole("menuitem", { name: /Konto deaktivieren/ })
    )

    const dialog = await screen.findByRole("alertdialog")
    /* Die Rueckfrage sagt, dass nichts geloescht wird und die Sperre sofort
       greift (§6.1, §6.5). */
    expect(dialog).toHaveTextContent("Gelöscht wird nichts")
    await user.click(
      within(dialog).getByRole("button", { name: "Konto deaktivieren" })
    )

    await waitFor(() => expect(calls).toEqual(["au-1"]))
    expect(
      await screen.findByText("„Lena Mueller“ wurde deaktiviert.")
    ).toBeInTheDocument()
  })

  it("aendert die Rolle ueber PATCH und nennt die sofortige Wirkung", async () => {
    const bodies: unknown[] = []
    server.use(
      ...baseHandlers({ users: [LENA] }),
      http.patch("*/api/admin/users/:id", async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json(adminUser({ role: "EDITOR" }))
      })
    )

    const user = userEvent.setup()
    renderWithProviders(<AdminUserListPage />, "/administration/users")

    await screen.findByText("Lena Mueller")
    await user.click(
      screen.getByRole("button", { name: "Aktionen für Lena Mueller" })
    )
    await user.click(
      await screen.findByRole("menuitem", { name: /Rolle ändern/ })
    )

    const dialog = await screen.findByRole("dialog")
    /* Die Aenderung greift beim naechsten Request, auch bei bestehender
       Anmeldung (§6.5); das steht im Dialog. */
    expect(dialog).toHaveTextContent("wirkt sofort")

    await user.click(within(dialog).getByLabelText("Rolle"))
    await user.click(
      await screen.findByRole("option", { name: "Redakteur:in" })
    )
    await user.click(
      within(dialog).getByRole("button", { name: "Rolle ändern" })
    )

    await waitFor(() => expect(bodies).toEqual([{ role: "EDITOR" }]))
    expect(
      await screen.findByText(
        "„Lena Mueller“ hat jetzt die Rolle Redakteur:in."
      )
    ).toBeInTheDocument()
  })

  it("legt ein Konto mit genau den sechs Feldern des Contracts an", async () => {
    const bodies: Record<string, unknown>[] = []
    server.use(
      ...baseHandlers({ users: [] }),
      http.post("*/api/admin/users", async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>
        bodies.push(body)
        return HttpResponse.json(adminUser({ role: "ADMIN" }), { status: 201 })
      })
    )

    const user = userEvent.setup()
    renderWithProviders(<AdminUserListPage />, "/administration/users")

    await user.click(screen.getByRole("button", { name: /Konto anlegen/ }))
    const dialog = await screen.findByRole("dialog")

    await user.type(within(dialog).getByLabelText("Vorname"), "Erika")
    await user.type(within(dialog).getByLabelText("Nachname"), "Musterfrau")
    await user.type(
      within(dialog).getByLabelText("Private E-Mail"),
      "erika@example.org"
    )
    await user.type(
      within(dialog).getByLabelText("HSB-E-Mail"),
      "emusterfrau@stud.hs-bremen.de"
    )
    await user.click(within(dialog).getByLabelText("Rolle"))
    await user.click(
      await screen.findByRole("option", { name: /Administration/ })
    )

    /* Der Client erzeugt das Passwort, der Server nimmt es nur entgegen
       (Contract v27). */
    await user.click(
      within(dialog).getByRole("button", { name: "Passwort erzeugen" })
    )
    await user.click(
      within(dialog).getByRole("button", { name: "Konto anlegen" })
    )

    await waitFor(() => expect(bodies).toHaveLength(1))
    expect(Object.keys(bodies[0]).sort()).toEqual([
      "email",
      "firstName",
      "hsbEmail",
      "lastName",
      "password",
      "role",
    ])
    expect(bodies[0].role).toBe("ADMIN")
    expect(String(bodies[0].password).length).toBeGreaterThanOrEqual(12)

    /* Zustand 4: der Koerper wird durch die Zusammenfassung ersetzt. */
    expect(
      await within(dialog).findByRole("button", {
        name: /Zugangsdaten kopieren/,
      })
    ).toBeInTheDocument()
  })

  it("zeigt den Hinweis zur Rolle ADMIN erst mit ihrer Wahl", async () => {
    server.use(...baseHandlers({ users: [] }))

    const user = userEvent.setup()
    renderWithProviders(<AdminUserListPage />, "/administration/users")

    await user.click(screen.getByRole("button", { name: /Konto anlegen/ }))
    const dialog = await screen.findByRole("dialog")
    const hint = i18n.t("administration.users.create.adminHint")
    expect(within(dialog).queryByText(hint)).not.toBeInTheDocument()

    await user.click(within(dialog).getByLabelText("Rolle"))
    await user.click(
      await screen.findByRole("option", { name: /Administration/ })
    )

    expect(await within(dialog).findByText(hint)).toBeInTheDocument()
  })

  it("fragt vor dem Verwerfen eines begonnenen Formulars zurueck", async () => {
    server.use(...baseHandlers({ users: [] }))

    const user = userEvent.setup()
    renderWithProviders(<AdminUserListPage />, "/administration/users")

    await user.click(screen.getByRole("button", { name: /Konto anlegen/ }))
    const dialog = await screen.findByRole("dialog")
    await user.type(within(dialog).getByLabelText("Vorname"), "Erika")

    await user.click(within(dialog).getByRole("button", { name: "Abbrechen" }))

    /* Sechs ausgefuellte Felder und ein erzeugtes Initialpasswort gehen
       nicht ohne Rueckfrage verloren. */
    const confirm = await screen.findByRole("alertdialog")
    await user.click(
      within(confirm).getByRole("button", { name: "Weiter bearbeiten" })
    )
    expect(within(dialog).getByLabelText("Vorname")).toHaveValue("Erika")

    await user.click(within(dialog).getByRole("button", { name: "Abbrechen" }))
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Verwerfen",
      })
    )
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
  })

  it("legt eine bereits vergebene Adresse an ihr Feld und nicht in eine Leiste", async () => {
    server.use(
      ...baseHandlers({ users: [] }),
      http.post("*/api/admin/users", () =>
        apiErrorResponse(
          409,
          "RESOURCE_IN_USE",
          "/api/admin/users",
          "email: Diese E-Mail-Adresse ist bereits vergeben."
        )
      )
    )

    const user = userEvent.setup()
    renderWithProviders(<AdminUserListPage />, "/administration/users")

    await user.click(screen.getByRole("button", { name: /Konto anlegen/ }))
    const dialog = await screen.findByRole("dialog")
    await user.type(within(dialog).getByLabelText("Vorname"), "Erika")
    await user.type(within(dialog).getByLabelText("Nachname"), "Musterfrau")
    await user.type(
      within(dialog).getByLabelText("Private E-Mail"),
      "erika@example.org"
    )
    await user.type(
      within(dialog).getByLabelText("HSB-E-Mail"),
      "emusterfrau@stud.hs-bremen.de"
    )
    await user.click(within(dialog).getByLabelText("Rolle"))
    await user.click(await screen.findByRole("option", { name: /Studierende/ }))
    await user.click(
      within(dialog).getByRole("button", { name: "Passwort erzeugen" })
    )
    await user.click(
      within(dialog).getByRole("button", { name: "Konto anlegen" })
    )

    /* §6.2 nennt das Feld im Format „feld: Text"; die Meldung gehoert
       deshalb an das Feld und nicht an den Kopf des Dialogs. */
    const field = await within(dialog).findByLabelText("Private E-Mail")
    expect(field).toHaveAttribute("aria-invalid", "true")
    expect(
      within(dialog).getByText("Diese E-Mail-Adresse ist bereits vergeben.")
    ).toBeInTheDocument()
  })

  it("setzt das Passwort zurueck und zeigt das erzeugte Initialpasswort", async () => {
    const calls: string[] = []
    server.use(
      ...baseHandlers({ users: [LENA] }),
      http.post("*/api/admin/users/:id/reset-password", ({ params }) => {
        calls.push(String(params.id))
        return HttpResponse.json({ initialPassword: "Xk7pQm2rTv9wZs4b" })
      })
    )

    const user = userEvent.setup()
    renderWithProviders(<AdminUserListPage />, "/administration/users")

    await screen.findByText("Lena Mueller")
    await user.click(
      screen.getByRole("button", { name: "Aktionen für Lena Mueller" })
    )
    await user.click(
      await screen.findByRole("menuitem", { name: /Passwort zurücksetzen/ })
    )

    const dialog = await screen.findByRole("alertdialog")
    await user.click(
      within(dialog).getByRole("button", { name: "Passwort zurücksetzen" })
    )

    await waitFor(() => expect(calls).toEqual(["au-1"]))
    /*
     * Hier erzeugt der Server, anders als beim Anlegen (Contract v27, v35).
     * Das Ergebnis steht in genau dieser einen Antwort und muss deshalb
     * lesbar dastehen, nicht nur in der Zwischenablage (§6.7).
     */
    expect(
      await within(dialog).findByText("Xk7pQm2rTv9wZs4b")
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole("button", { name: /Kopieren/ })
    ).toBeInTheDocument()
  })

  it("zeigt einen Fehlschlag der Zuruecksetzung im Dialog", async () => {
    server.use(
      ...baseHandlers({ users: [LENA] }),
      http.post("*/api/admin/users/:id/reset-password", () =>
        apiErrorResponse(
          403,
          "NO_PERMISSION",
          "/api/admin/users/au-1/reset-password"
        )
      )
    )

    const user = userEvent.setup()
    renderWithProviders(<AdminUserListPage />, "/administration/users")

    await screen.findByText("Lena Mueller")
    await user.click(
      screen.getByRole("button", { name: "Aktionen für Lena Mueller" })
    )
    await user.click(
      await screen.findByRole("menuitem", { name: /Passwort zurücksetzen/ })
    )

    const dialog = await screen.findByRole("alertdialog")
    await user.click(
      within(dialog).getByRole("button", { name: "Passwort zurücksetzen" })
    )

    /* Der Dialog bleibt stehen und bedienbar; kein Passwort erscheint. */
    expect(
      await within(dialog).findByText(i18n.t("apiError.NO_PERMISSION"))
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole("button", { name: "Passwort zurücksetzen" })
    ).toBeEnabled()
  })

  it("zeigt einen 404 der Detailansicht als Meldung", async () => {
    server.use(
      ...baseHandlers({ users: [LENA] }),
      http.get("*/api/admin/users/:id", () =>
        apiErrorResponse(404, "RESOURCE_NOT_FOUND", "/api/admin/users/au-1")
      )
    )

    const user = userEvent.setup()
    renderWithProviders(<AdminUserListPage />, "/administration/users")

    await screen.findByText("Lena Mueller")
    await user.click(
      screen.getByRole("button", { name: "Aktionen für Lena Mueller" })
    )
    await user.click(await screen.findByRole("menuitem", { name: /Details/ }))

    const dialog = await screen.findByRole("dialog")
    /* Ein Konto, das inzwischen nicht mehr da ist, endet nicht in einer
       leeren Flaeche (§6.1). */
    expect(
      await within(dialog).findByText(i18n.t("apiError.RESOURCE_NOT_FOUND"))
    ).toBeInTheDocument()
  })

  it("legt einen 400 des Rollenwechsels an das Auswahlfeld", async () => {
    server.use(
      ...baseHandlers({ users: [LENA] }),
      http.patch("*/api/admin/users/:id", () =>
        apiErrorResponse(
          400,
          "VALIDATION_FAILED",
          "/api/admin/users/au-1",
          "role: Die eigene Rolle laesst sich nicht aendern."
        )
      )
    )

    const user = userEvent.setup()
    renderWithProviders(<AdminUserListPage />, "/administration/users")

    await screen.findByText("Lena Mueller")
    await user.click(
      screen.getByRole("button", { name: "Aktionen für Lena Mueller" })
    )
    await user.click(
      await screen.findByRole("menuitem", { name: /Rolle ändern/ })
    )

    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByLabelText("Rolle"))
    await user.click(await screen.findByRole("option", { name: "Admin" }))
    await user.click(
      within(dialog).getByRole("button", { name: "Rolle ändern" })
    )

    /* §6.2 nennt das Feld im Format „feld: Text"; die Meldung gehoert
       deshalb an das Feld und nicht an den Kopf des Dialogs. */
    expect(
      await within(dialog).findByText(
        "Die eigene Rolle laesst sich nicht aendern."
      )
    ).toBeInTheDocument()
  })

  it("liest fuer die Detailansicht das einzelne Konto nach", async () => {
    server.use(
      ...baseHandlers({ users: [LENA] }),
      http.get("*/api/admin/users/:id", () =>
        HttpResponse.json(adminUser({ passwordChangeRequired: true }))
      )
    )

    const user = userEvent.setup()
    renderWithProviders(<AdminUserListPage />, "/administration/users")

    await screen.findByText("Lena Mueller")
    await user.click(
      screen.getByRole("button", { name: "Aktionen für Lena Mueller" })
    )
    await user.click(await screen.findByRole("menuitem", { name: /Details/ }))

    const dialog = await screen.findByRole("dialog")
    /* Drei Felder, die keine Tabellenspalte traegt (§3.1). */
    expect(
      await within(dialog).findByText("Private E-Mail bestätigt")
    ).toBeInTheDocument()
    expect(within(dialog).getByText("Zuletzt geändert")).toBeInTheDocument()
  })
})
