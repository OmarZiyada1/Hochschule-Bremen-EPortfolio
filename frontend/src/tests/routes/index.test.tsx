import { HttpResponse, http } from "msw"
import { screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import { setPasswordChangeRequired } from "@/api/auth/authStore"
import i18n from "@/i18n"
import {
  dashboardHandler,
  emptyProjectsHandler,
  ownPortfolioHandler,
  projectBlocksHandler,
  projectDetailHandler,
  top10AdminHandlers,
} from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { AppUnderTest, LocationProbe, signInAs } from "@/tests/routes/helpers"

/**
 * Zugriffsschutz und Auffangrouten des Routenbaums (Ticket KAN-7, Umfang 2
 * bis 4), je Zugriffsebene ueber die sichtbare Oberflaeche. Was die
 * Navigation je Ebene anbietet, prueft AppLayout.test.tsx; hier geht es um
 * den direkten Aufruf der Routen.
 */
/**
 * /projects/new legt seit KAN-35 sofort ein Projekt an und leitet auf dessen
 * Metadatenseite weiter. Hier zaehlt nur, dass die Route erreichbar ist; die
 * Antwort bleibt deshalb liegen, ohne dass ihr jemand folgt.
 */
function createProjectHandler() {
  return http.post("*/api/projects", () =>
    HttpResponse.json({}, { status: 201 })
  )
}

describe("Routenbaum", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
  })

  it("oeffentliche Ebene: die Startseite steht ohne Anmeldung im Rahmen", () => {
    /* Die fachliche Startseite (KAN-31) zieht Top-10, Projektzahl und
       Stammdaten; hier zaehlt nur, dass die Route ohne Anmeldung im Rahmen
       steht, deshalb antworten alle vier Quellen leer. */
    server.use(
      http.get("*/api/top10", () => HttpResponse.json([])),
      http.get("*/api/projects", () =>
        HttpResponse.json({
          content: [],
          page: 0,
          size: 1,
          totalElements: 0,
          totalPages: 0,
        })
      ),
      http.get("*/api/faculties", () => HttpResponse.json([])),
      http.get("*/api/study-programs", () => HttpResponse.json([]))
    )
    renderWithProviders(<AppUnderTest />, "/")

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Studentische Innovation sichtbar machen.",
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
    /* Seit KAN-35 steht dort das Metadatenformular; die Seitenueberschrift
       heisst nach Template "Projekt-Metadaten", auch beim Anlegen. */
    server.use(ownPortfolioHandler(), createProjectHandler())
    signInAs("EDITOR")
    renderWithProviders(<AppUnderTest />, "/projects/new")

    expect(
      screen.getByRole("heading", { level: 1, name: "Projekt-Metadaten" })
    ).toBeInTheDocument()
  })

  it("EDITOR erreicht /my-portfolio", () => {
    /* Die Seite zieht Profil und eigene Projekte (KAN-34); hier zaehlt nur,
       dass die Route erreichbar ist, deshalb antworten beide leer. Der
       Seitentitel heisst nach Template "My Portfolio", waehrend die
       Navigation "Mein Portfolio" fuehrt. */
    server.use(ownPortfolioHandler(), emptyProjectsHandler())
    signInAs("EDITOR")
    renderWithProviders(<AppUnderTest />, "/my-portfolio")

    expect(
      screen.getByRole("heading", { level: 1, name: "My Portfolio" })
    ).toBeInTheDocument()
  })

  it("EDITOR erreicht den Editor", async () => {
    signInAs("EDITOR")
    /* Bloecke vor dem Detail: sonst faengt das Muster /projects/:projectId
       den laengeren Pfad zuerst ab. */
    server.use(
      ownPortfolioHandler(),
      projectBlocksHandler(),
      projectDetailHandler({ title: "Beitrag im Entwurf", status: "DRAFT" })
    )
    renderWithProviders(
      <AppUnderTest />,
      "/projects/1f9d7a10-0000-0000-0000-000000000000/editor"
    )

    /* findBy, weil die Route nachgeladen wird (React.lazy) und die Seite
       erst nach zwei Abrufen steht. Die einzige h1 ist der Projekttitel
       (§3.3); der Editor gibt selbst keine aus. */
    expect(
      await screen.findByRole(
        "heading",
        { level: 1, name: "Beitrag im Entwurf" },
        /* Der Editor-Chunk zieht das ganze ProseMirror-Buendel nach, und
           im vollstaendigen Lauf teilen sich alle Dateien den Rechner. Die
           Standardgrenze von einer Sekunde reicht dafuer bei weitem nicht. */
        { timeout: 60000 }
      )
    ).toBeInTheDocument()
    /* Die Grenze am findByRole allein genuegt nicht: der Testfall selbst
       endet sonst nach der Standardsekunde von Vitest, waehrend das Warten
       noch laeuft. Aufgefallen, als der Editor-Chunk mit KAN-36 groesser
       wurde. */

    /* Der Editor liegt ausserhalb des Anwendungsrahmens: seine Kopfzeile
       ist der EditorHeader, NavBar und Footer entfallen. Kennzeichen des
       Rahmens sind Sprunglink, Hauptnavigation und contentinfo. */
    expect(
      screen.queryByRole("link", { name: "Zum Inhalt springen" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("navigation", { name: "Hauptnavigation" })
    ).not.toBeInTheDocument()
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument()
  }, 60000)

  it("Editor ohne Anmeldung fuehrt sichtbar zum Login", () => {
    /* Die Rollenschranke wirkt auch nach dem Umzug der Route aus dem
       Anwendungsrahmen; die uebrigen RequireRole-Tests laufen alle gegen
       Instanzen unter dem AppLayout und fingen einen Wegfall hier nicht. */
    renderWithProviders(
      <>
        <AppUnderTest />
        <LocationProbe />
      </>,
      "/projects/1f9d7a10-0000-0000-0000-000000000000/editor"
    )

    expect(
      screen.getByRole("heading", { level: 1, name: "Anmelden" })
    ).toBeInTheDocument()
    expect(screen.getByTestId("pathname")).toHaveTextContent("/login")
  })

  it("ADMIN: direkter Aufruf des Editors endet in einer sichtbaren Meldung", () => {
    signInAs("ADMIN")
    renderWithProviders(
      <AppUnderTest />,
      "/projects/1f9d7a10-0000-0000-0000-000000000000/editor"
    )

    /* Contract 5, Fussnote 10: ein Admin-Konto bearbeitet keine eigenen
       Projekte. Die Meldung erscheint im Rahmen des EditorLayout und
       damit in einer main-Landmarke, auch ohne NavBar und Footer. */
    expect(
      screen.getByRole("heading", { level: 1, name: "Kein Zugriff" })
    ).toBeInTheDocument()
    expect(screen.getByRole("main")).toBeInTheDocument()
    expect(
      screen.queryByRole("navigation", { name: "Hauptnavigation" })
    ).not.toBeInTheDocument()
  })

  it("EDITOR erreicht die Redaktionsebene", () => {
    signInAs("EDITOR")
    /* „Meine Reviews" (KAN-37) zieht Liste, vier Kennzahlen, die eigenen
       Nominierungen, die Top-10 und drei Optionslisten; hier zaehlt nur,
       dass die Route im Rahmen steht, deshalb antworten alle leer. */
    server.use(
      http.get("*/api/projects", () =>
        HttpResponse.json({
          content: [],
          page: 0,
          size: 20,
          totalElements: 0,
          totalPages: 0,
        })
      ),
      http.get("*/api/top10-nominations", () => HttpResponse.json([])),
      http.get("*/api/top10", () => HttpResponse.json([])),
      http.get("*/api/study-programs", () => HttpResponse.json([])),
      http.get("*/api/semesters", () => HttpResponse.json([])),
      http.get("*/api/modules", () => HttpResponse.json([]))
    )
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

  it("ADMIN erreicht /my-portfolio/profile weiterhin", async () => {
    server.use(ownPortfolioHandler())
    signInAs("ADMIN")
    renderWithProviders(<AppUnderTest />, "/my-portfolio/profile")

    /* Contract 5, Zeile "Eigenes Portfolio bearbeiten": das eigene Profil
       pflegt jede angemeldete Rolle, auch ADMIN. */
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Profil bearbeiten",
      })
    ).toBeInTheDocument()
  })

  it("ADMIN erreicht die Administrationsseite und das Top-10-Protokoll", async () => {
    signInAs("ADMIN")
    server.use(dashboardHandler())
    const { unmount } = renderWithProviders(<AppUnderTest />, "/administration")
    /* Seit KAN-38 ist die Index-Route die echte Startansicht und kein
       Platzhalter mehr. Sie kommt als eigener Chunk (AdministrationRoute),
       deshalb findBy und nicht getBy; im vollstaendigen Lauf dauert das
       Aufloesen des dynamischen Imports laenger als die voreingestellte
       Sekunde, im Einzellauf nicht. */
    expect(
      await screen.findByRole(
        "heading",
        { level: 1, name: "Dashboard" },
        { timeout: 10_000 }
      )
    ).toBeInTheDocument()
    unmount()

    /* Seit KAN-40 steht auch hier die echte Seite. Ueberschrift und
       Untertitel sind dieselben wie in der Verwaltung, so zeigt es der
       Frame „Admin · Top 10 Protokoll"; unterschieden wird ueber die
       Leiste darunter. */
    server.use(...top10AdminHandlers())
    renderWithProviders(<AppUnderTest />, "/administration/top10/audit")
    expect(
      await screen.findByRole(
        "heading",
        { level: 1, name: "Top 10 Verwaltung" },
        { timeout: 10_000 }
      )
    ).toBeInTheDocument()
    /* Innerhalb der Bereichsleiste gesucht: seit KAN-80 nennt auch die
       letzte Ebene des Brotkrumenpfades das Protokoll, und die traegt als
       aktuelle Seite ebenfalls role="link" und aria-current. */
    const sectionNav = screen.getByRole("navigation", {
      name: "Bereiche der Top 10",
    })
    expect(
      within(sectionNav).getByRole("link", { name: "Protokoll" })
    ).toHaveAttribute("aria-current", "page")
  })

  it("zeigt die Seitennavigation auf jeder Seite der Administration", async () => {
    signInAs("ADMIN")
    renderWithProviders(<AppUnderTest />, "/administration/categories")

    /* Der Rahmen liegt ueber allen Admin-Routen, auch ueber denen, die noch
       einen Platzhalter tragen: sonst waere die Navigation von dort aus
       nicht erreichbar (KAN-38). */
    const nav = await screen.findByRole("navigation", {
      name: "Administrationsseite",
    })
    expect(within(nav).getByRole("link", { name: "Semester" })).toHaveAttribute(
      "href",
      "/administration/semesters"
    )
    expect(
      within(nav).getByRole("link", { name: "Top 10" })
    ).toBeInTheDocument()
  })

  it("fuehrt die Projektverwaltung als eigene Route", async () => {
    signInAs("ADMIN")
    server.use(
      http.get("*/api/projects", () =>
        HttpResponse.json({
          content: [],
          page: 0,
          size: 20,
          totalElements: 0,
          totalPages: 0,
        })
      ),
      http.get("*/api/study-programs", () => HttpResponse.json([])),
      http.get("*/api/semesters", () => HttpResponse.json([])),
      http.get("*/api/modules", () => HttpResponse.json([]))
    )
    renderWithProviders(<AppUnderTest />, "/administration/projects")

    expect(
      await screen.findByRole(
        "heading",
        { level: 1, name: "Projekte" },
        { timeout: 10_000 }
      )
    ).toBeInTheDocument()
  })

  it("liest /projects/new nicht als Projekt-ID", () => {
    server.use(ownPortfolioHandler(), createProjectHandler())
    signInAs("STUDENT")
    renderWithProviders(<AppUnderTest />, "/projects/new")

    expect(
      screen.getByRole("heading", { level: 1, name: "Projekt-Metadaten" })
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
        name: "Persönliche Angaben",
      })
    ).toBeInTheDocument()
    expect(screen.getByTestId("pathname")).toHaveTextContent(
      "/register/details"
    )
  })

  it("zeigt die Passwort-Seiten ohne NavBar und Footer", () => {
    /* Klaerungsrunde KAN-33: die drei Passwort-Seiten haben kein eigenes
       Template und folgen dem rahmenlosen Kartenstil der Auth-Seiten. */
    const { unmount } = renderWithProviders(
      <AppUnderTest />,
      "/forgot-password"
    )
    expect(
      screen.getByRole("heading", { level: 1, name: "Passwort vergessen" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("navigation", { name: "Hauptnavigation" })
    ).not.toBeInTheDocument()
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument()
    unmount()

    renderWithProviders(<AppUnderTest />, "/reset-password")
    expect(
      screen.getByRole("heading", { level: 1, name: "Passwort zurücksetzen" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("navigation", { name: "Hauptnavigation" })
    ).not.toBeInTheDocument()
  })

  it("fuehrt bei gesetztem Passwortzwang jede geschuetzte Route auf die Passwortseite", () => {
    /* Contract 6.7, DoD KAN-33: das Gate im Server antwortete ohnehin mit
       403; der Wrapper erspart den sichtbaren Fehlschlag und leitet um. */
    signInAs("STUDENT")
    setPasswordChangeRequired(true)
    renderWithProviders(
      <>
        <AppUnderTest />
        <LocationProbe />
      </>,
      "/my-portfolio"
    )

    expect(
      screen.getByRole("heading", { level: 1, name: "Passwort ändern" })
    ).toBeInTheDocument()
    expect(screen.getByTestId("pathname")).toHaveTextContent("/change-password")
  })

  it("zeigt Anmeldung und Registrierung ohne NavBar und Footer", () => {
    /* Die Templates blenden beide dort aus (Review zu KAN-8); die fruehere
       Festlegung aus der Klaerungsrunde zu KAN-7 ist ueberholt. Kennzeichen
       des Rahmens sind Sprunglink und Hauptnavigation. */
    const { unmount } = renderWithProviders(<AppUnderTest />, "/login")
    expect(
      screen.getByRole("heading", { level: 1, name: "Anmelden" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: "Zum Inhalt springen" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("navigation", { name: "Hauptnavigation" })
    ).not.toBeInTheDocument()
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument()
    unmount()

    renderWithProviders(<AppUnderTest />, "/register/details")
    expect(
      screen.queryByRole("navigation", { name: "Hauptnavigation" })
    ).not.toBeInTheDocument()
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
