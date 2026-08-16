import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it } from "vitest"

import i18n from "@/i18n"
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

  it("zeigt einem Admin-Konto die Administration und keine Projektanlage", async () => {
    const user = userEvent.setup()
    signInAs("ADMIN")
    renderWithProviders(<AppUnderTest />, "/")

    expect(
      screen.getByRole("link", { name: "Administration" })
    ).toBeInTheDocument()
    /* Contract 5, Fussnote 10: keine Projektanlage und keine eigene
       Projektliste fuer ADMIN. */
    expect(
      screen.queryByRole("link", { name: "Neues Projekt" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: "Mein Portfolio" })
    ).not.toBeInTheDocument()

    /* Das Nutzermenue folgt dem Template: Rollenbeschriftung, Administration
       und Abmelden, kein Portfolio-Eintrag fuer ADMIN. */
    await user.click(screen.getByRole("button", { name: /Mira Beispiel/ }))
    expect(
      await screen.findByRole("menuitem", { name: "Administration" })
    ).toBeInTheDocument()
    expect(screen.getByText("Admin")).toBeInTheDocument()
    expect(
      screen.queryByRole("menuitem", { name: "Mein Portfolio" })
    ).not.toBeInTheDocument()
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
