import { screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import i18n from "@/i18n"
import { renderWithProviders } from "@/tests/render"
import { AppUnderTest, LocationProbe, signInAs } from "@/tests/routes/helpers"

/**
 * Zugriffsschutz und Auffangrouten des Routenbaums (Ticket KAN-7, Umfang 2
 * bis 4), je Zugriffsebene ueber die sichtbare Oberflaeche. Was die
 * Navigation je Ebene anbietet, prueft AppLayout.test.tsx; hier geht es um
 * den direkten Aufruf der Routen.
 */
describe("Routenbaum", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
  })

  it("oeffentliche Ebene: die Startseite steht ohne Anmeldung im Rahmen", () => {
    renderWithProviders(<AppUnderTest />, "/")

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "E-Portfolio Hochschule Bremen",
      })
    ).toBeInTheDocument()
  })

  it("geschuetzte Route ohne Anmeldung fuehrt sichtbar zum Login", () => {
    renderWithProviders(
      <>
        <AppUnderTest />
        <LocationProbe />
      </>,
      "/my-portfolio"
    )

    expect(
      screen.getByRole("heading", { level: 1, name: "Anmelden" })
    ).toBeInTheDocument()
    expect(screen.getByTestId("pathname")).toHaveTextContent("/login")
  })

  it("studentisches Konto: /administration endet in einer sichtbaren Meldung", () => {
    signInAs("STUDENT")
    renderWithProviders(<AppUnderTest />, "/administration")

    expect(
      screen.getByRole("heading", { level: 1, name: "Kein Zugriff" })
    ).toBeInTheDocument()
  })

  it("EDITOR erreicht /projects/new", () => {
    signInAs("EDITOR")
    renderWithProviders(<AppUnderTest />, "/projects/new")

    expect(
      screen.getByRole("heading", { level: 1, name: "Neues Projekt" })
    ).toBeInTheDocument()
  })

  it("EDITOR erreicht /my-portfolio", () => {
    signInAs("EDITOR")
    renderWithProviders(<AppUnderTest />, "/my-portfolio")

    expect(
      screen.getByRole("heading", { level: 1, name: "Mein Portfolio" })
    ).toBeInTheDocument()
  })

  it("EDITOR erreicht den Editor", () => {
    signInAs("EDITOR")
    renderWithProviders(
      <AppUnderTest />,
      "/projects/1f9d7a10-0000-0000-0000-000000000000/editor"
    )

    expect(
      screen.getByRole("heading", { level: 1, name: "Editor" })
    ).toBeInTheDocument()
  })

  it("EDITOR erreicht die Redaktionsebene", () => {
    signInAs("EDITOR")
    renderWithProviders(<AppUnderTest />, "/reviews")

    expect(
      screen.getByRole("heading", { level: 1, name: "Meine Reviews" })
    ).toBeInTheDocument()
  })

  it("studentisches Konto: /reviews endet in einer sichtbaren Meldung", () => {
    signInAs("STUDENT")
    renderWithProviders(<AppUnderTest />, "/reviews")

    expect(
      screen.getByRole("heading", { level: 1, name: "Kein Zugriff" })
    ).toBeInTheDocument()
  })

  it("ADMIN: direkter Aufruf von /projects/new endet in einer sichtbaren Meldung", () => {
    signInAs("ADMIN")
    renderWithProviders(<AppUnderTest />, "/projects/new")

    /* Contract 5, Fussnote 10: ein Admin-Konto legt keine Projekte an,
       POST /projects antwortet ihm mit 403. Das Routing zeigt dieselbe
       Grenze sichtbar, statt eine Seite anzubieten, deren Absenden nur
       scheitern kann. */
    expect(
      screen.getByRole("heading", { level: 1, name: "Kein Zugriff" })
    ).toBeInTheDocument()
  })

  it("ADMIN erreicht /my-portfolio/profile weiterhin", () => {
    signInAs("ADMIN")
    renderWithProviders(<AppUnderTest />, "/my-portfolio/profile")

    /* Contract 5, Zeile "Eigenes Portfolio bearbeiten": das eigene Profil
       pflegt jede angemeldete Rolle, auch ADMIN. */
    expect(
      screen.getByRole("heading", { level: 1, name: "Profil bearbeiten" })
    ).toBeInTheDocument()
  })

  it("ADMIN erreicht die Administrationsseite und das Top-10-Protokoll", () => {
    signInAs("ADMIN")
    const { unmount } = renderWithProviders(<AppUnderTest />, "/administration")
    expect(
      screen.getByRole("heading", { level: 1, name: "Administrationsseite" })
    ).toBeInTheDocument()
    unmount()

    renderWithProviders(<AppUnderTest />, "/administration/top10/audit")
    expect(
      screen.getByRole("heading", { level: 1, name: "Top-10-Protokoll" })
    ).toBeInTheDocument()
  })

  it("liest /projects/new nicht als Projekt-ID", () => {
    signInAs("STUDENT")
    renderWithProviders(<AppUnderTest />, "/projects/new")

    expect(
      screen.getByRole("heading", { level: 1, name: "Neues Projekt" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Projektdetail" })
    ).not.toBeInTheDocument()
  })

  it("leitet /register sichtbar auf /register/details um", () => {
    /* Erster Schritt sind die Angaben: die Rollenauswahl ist mit
       Contract v41 entfallen (KAN-63). */
    renderWithProviders(
      <>
        <AppUnderTest />
        <LocationProbe />
      </>,
      "/register"
    )

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Registrierung: Persönliche Angaben",
      })
    ).toBeInTheDocument()
    expect(screen.getByTestId("pathname")).toHaveTextContent(
      "/register/details"
    )
  })

  it("faengt eine unbekannte URL mit der 404-Seite ausserhalb des Rahmens ab", () => {
    renderWithProviders(<AppUnderTest />, "/this-page-does-not-exist")

    expect(
      screen.getByRole("heading", { level: 1, name: "Seite nicht gefunden" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Zurück zur Startseite" })
    ).toHaveAttribute("href", "/")
    /* Das 404-Template fuehrt keine NavBar und statt des Anwendungs-Footers
       nur die einzeilige Fusszeile (Klaerungsrunde KAN-7); kennzeichnend
       fuer den Rahmen ist sein Sprunglink. */
    expect(
      screen.queryByRole("link", { name: "Zum Inhalt springen" })
    ).not.toBeInTheDocument()
    expect(screen.getByText("Hochschule Bremen · E-Portfolio")).toBeVisible()
  })

  it("gibt den statischen Fussbereich-Zielen eine Seite", () => {
    /* Klaerungsrunde KAN-7: die drei rechtlichen Seiten haben Routen,
       damit kein Footer-Link auf der 404-Seite endet. */
    for (const [path, title] of [
      ["/imprint", "Impressum"],
      ["/privacy", "Datenschutz"],
      ["/accessibility", "Barrierefreiheit"],
    ] as const) {
      const { unmount } = renderWithProviders(<AppUnderTest />, path)
      expect(
        screen.getByRole("heading", { level: 1, name: title })
      ).toBeInTheDocument()
      unmount()
    }
  })

  it("zeigt die /dev-Prueffflaechen ausserhalb des Anwendungsrahmens", () => {
    /* Nur im Entwicklungs-Build vorhanden (import.meta.env.DEV, im
       Testlauf true); ausserhalb der Layout-Route, damit der Rahmen die
       Flaechen nicht ueberlagert. Kennzeichen des Rahmens ist sein
       Sprunglink: die Prueffflaechen fuehren eigene header-Elemente und
       zeigen NavBar und Footer als Demos, banner und contentinfo taugen
       hier deshalb nicht als Nachweis. */
    const { unmount } = renderWithProviders(<AppUnderTest />, "/dev/tokens")
    expect(
      screen.getByRole("heading", { level: 1, name: "Tokenschicht" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: "Zum Inhalt springen" })
    ).not.toBeInTheDocument()
    unmount()

    renderWithProviders(<AppUnderTest />, "/dev/components")
    expect(
      screen.getByRole("heading", { level: 1, name: "Komponentenbibliothek" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: "Zum Inhalt springen" })
    ).not.toBeInTheDocument()
  })
})
