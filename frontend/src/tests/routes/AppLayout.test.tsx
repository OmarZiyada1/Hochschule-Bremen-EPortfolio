import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it } from "vitest"

import i18n from "@/i18n"
import { ownPortfolioHandler } from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { AppUnderTest, LocationProbe, signInAs } from "@/tests/routes/helpers"

/**
 * Anwendungsrahmen und rollenabhaengige Navigation (Ticket KAN-7, Umfang 1
 * und 5). Den direkten Aufruf der Routen prueft index.test.tsx.
 */
describe("AppLayout", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
  })

  /*
   * Der Avatar haengt am Portfolio und nicht am User (§3.2): UserResponse
   * fuehrt ihn nicht, der Rahmen holt ihn deshalb ueber
   * GET /api/portfolio/me. Ohne diese Verdrahtung blieb es in der
   * Kopfleiste dauerhaft bei den Initialen, auch wenn ein Bild hinterlegt
   * war (KAN-34).
   *
   * Geprueft wird der Abruf, nicht das gerenderte img: Base UI haengt das
   * Bild erst nach dem Laden ein, und in jsdom laedt nie eines. Dass eine
   * gesetzte Adresse als Bild erscheint, ist Sache der Primitive.
   */
  it("holt das Profilbild der Kopfleiste aus dem eigenen Portfolio", async () => {
    let requestedWithToken: string | null = null
    server.use(
      http.get("*/api/portfolio/me", ({ request }) => {
        requestedWithToken = request.headers.get("Authorization")
        return HttpResponse.json({
          avatarUrl: "/api/files/aaaa0000-0000-4000-8000-000000000001",
        })
      })
    )
    signInAs("STUDENT")
    renderWithProviders(<AppUnderTest />, "/")

    await waitFor(() => expect(requestedWithToken).toBe("Bearer test-token"))
  })

  it("fragt ohne Anmeldung kein Profil ab", async () => {
    /* Ohne Token ergaebe der Aufruf einen sicheren 401; die Abfrage bleibt
       deshalb abgeschaltet, statt ihn zu provozieren. */
    let requested = false
    server.use(
      http.get("*/api/portfolio/me", () => {
        requested = true
        return HttpResponse.json({})
      })
    )
    renderWithProviders(<AppUnderTest />, "/")

    expect(
      await screen.findByRole("link", { name: "Anmelden" })
    ).toBeInTheDocument()
    expect(requested).toBe(false)
  })

  it("bleibt ohne hinterlegtes Bild bei den Initialen", async () => {
    /* §3.2.1: ein Konto ohne Portfolio-Zeile antwortet 200 mit leeren
       Feldern. Das ist kein Fehlerfall der Kopfleiste. */
    server.use(ownPortfolioHandler({}))
    signInAs("STUDENT")
    renderWithProviders(<AppUnderTest />, "/")

    expect(await screen.findByText("MB")).toBeInTheDocument()
  })

  it("stellt Kopfbereich, Inhalt und Fussbereich als Landmarken", () => {
    renderWithProviders(<AppUnderTest />, "/")

    expect(screen.getByRole("banner")).toBeInTheDocument()
    expect(screen.getByRole("main")).toBeInTheDocument()
    expect(screen.getByRole("contentinfo")).toBeInTheDocument()
  })

  it("macht den Sprunglink zum ersten Tabstopp und zeigt ihn im Fokus", async () => {
    const user = userEvent.setup()
    renderWithProviders(<AppUnderTest />, "/")

    const skipLink = screen.getByRole("link", { name: "Zum Inhalt springen" })
    expect(skipLink).toHaveAttribute("href", "#content")

    /* Erster Tab landet auf dem Sprunglink, noch vor Marke und
       Navigation (SC 2.4.1). */
    await user.tab()
    expect(skipLink).toHaveFocus()
  })

  it("zeigt nicht angemeldet allein die Anmeldung", () => {
    renderWithProviders(<AppUnderTest />, "/")

    expect(screen.getByRole("link", { name: "Anmelden" })).toBeInTheDocument()
    /* Nach Template kein eigener Registrieren-Button (Review KAN-8); der
       Weg fuehrt ueber den Link auf der Login-Seite. */
    expect(
      screen.queryByRole("link", { name: "Registrieren" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: "Mein Portfolio" })
    ).not.toBeInTheDocument()
  })

  it("zeigt einem studentischen Konto den eigenen Bereich, keine Administration", async () => {
    const user = userEvent.setup()
    signInAs("STUDENT")
    renderWithProviders(<AppUnderTest />, "/")

    expect(
      screen.getByRole("link", { name: "Mein Portfolio" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: "Administration" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: "Meine Reviews" })
    ).not.toBeInTheDocument()

    /* "Neues Projekt" liegt nach Template im Nutzermenue, nicht in der
       Leiste (Review KAN-8). */
    expect(
      screen.queryByRole("link", { name: "Neues Projekt" })
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Mira Beispiel/ }))
    expect(
      await screen.findByRole("menuitem", { name: "Neues Projekt" })
    ).toHaveAttribute("href", "/projects/new")
    expect(screen.getByText("Studierende:r")).toBeInTheDocument()
  })

  it("zeigt einer Redakteur:in Reviews und eigenen Bereich zusammen", () => {
    signInAs("EDITOR")
    renderWithProviders(<AppUnderTest />, "/")

    /* Die Ebenen schliessen einander nicht aus (Ticket KAN-7, Umfang 5):
       Redakteur:innen verfassen selbst und pruefen zugewiesene Projekte. */
    expect(
      screen.getByRole("link", { name: "Meine Reviews" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Mein Portfolio" })
    ).toBeInTheDocument()
  })

  it("zeigt einem Admin-Konto die Administration und dazu Reviews und Portfolio", async () => {
    const user = userEvent.setup()
    signInAs("ADMIN")
    renderWithProviders(<AppUnderTest />, "/")

    expect(
      screen.getByRole("link", { name: "Administration" })
    ).toBeInTheDocument()
    /* Seit KAN-82 ist ADMIN die Obermenge: die Leiste fuehrt zusaetzlich,
       was ein Konto mit EDITOR fuehrt. Bis dahin stand hier das Gegenteil,
       mit Verweis auf Fussnote 10. */
    expect(
      screen.getByRole("link", { name: "Meine Reviews" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Mein Portfolio" })
    ).toBeInTheDocument()

    /* "Neues Projekt" bleibt auch fuer ADMIN ein Punkt des Nutzermenues und
       kein Leisteneintrag: die Aufteilung folgt dem Template, nicht der
       Rolle. */
    expect(
      screen.queryByRole("link", { name: "Neues Projekt" })
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Mira Beispiel/ }))
    expect(
      await screen.findByRole("menuitem", { name: "Administration" })
    ).toBeInTheDocument()
    expect(screen.getByText("Admin")).toBeInTheDocument()
    expect(
      screen.getByRole("menuitem", { name: "Mein Portfolio" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("menuitem", { name: "Neues Projekt" })
    ).toBeInTheDocument()
  })

  it("meldet ab und kehrt zur oeffentlichen Startseite zurueck", async () => {
    server.use(
      http.post(
        "*/api/auth/logout",
        () => new HttpResponse(null, { status: 204 })
      )
    )
    const user = userEvent.setup()
    signInAs("STUDENT")
    renderWithProviders(
      <>
        <AppUnderTest />
        <LocationProbe />
      </>,
      "/my-portfolio"
    )

    await user.click(screen.getByRole("button", { name: /Mira Beispiel/ }))
    await user.click(await screen.findByText("Abmelden"))

    /* Zurueck auf der Startseite und sichtbar abgemeldet: bliebe die
       Anwendung auf der geschuetzten Route, spraenge der Wrapper sofort
       zum Login, was nach einer gewollten Abmeldung irritiert. */
    expect(
      await screen.findByRole("link", { name: "Anmelden" })
    ).toBeInTheDocument()
    expect(screen.getByTestId("pathname")).toHaveTextContent("/")
  })
})
