import { HttpResponse, http } from "msw"
import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { act } from "react"
import { Link } from "react-router-dom"
import { beforeEach, describe, expect, it } from "vitest"

import { endSession, getAuthState } from "@/api/auth/authStore"
import type { Role } from "@/api/types"
import LoginPage from "@/features/auth/LoginPage"
import { readRegistrationFlow } from "@/features/auth/registrationFlow"
import i18n from "@/i18n"
import {
  apiErrorResponse,
  dashboardHandler,
  emptyProjectsHandler,
  openSupportCountHandler,
  ownPortfolioHandler,
} from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { AppUnderTest, LocationProbe, signInAs } from "@/tests/routes/helpers"

/**
 * Login-Flow des Durchstichs (Ticket KAN-8): zod-Validierung vor dem
 * Absenden, Serverfehler ueber errorCode, sichtbarer Sitzungshinweis der
 * zentralen 401-Reaktion, und die ganze Kette bis zur Projektliste.
 */
describe("LoginPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
  })

  it("fuehrt am Passwortfeld einen Sichtbarkeitsschalter (KAN-67)", () => {
    renderWithProviders(<LoginPage />)

    expect(
      screen.getAllByRole("button", { name: "Passwort anzeigen" })
    ).toHaveLength(1)
  })

  async function fillAndSubmit(email: string, password: string) {
    const user = userEvent.setup()
    if (email !== "") {
      await user.type(screen.getByLabelText("E-Mail"), email)
    }
    if (password !== "") {
      await user.type(screen.getByLabelText("Passwort"), password)
    }
    await user.click(screen.getByRole("button", { name: "Anmelden" }))
  }

  /**
   * Die Antwort von POST /auth/login fuer die Wege, die ueber den ganzen
   * Routenbaum laufen: dieselbe Person, verschiedene Rollen. Nur so
   * unterscheiden sich gemerkte Route und Rollenziel voneinander.
   */
  function loginHandler(role: Role) {
    return http.post("*/api/auth/login", () =>
      HttpResponse.json({
        token: "test-token",
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        passwordChangeRequired: false,
        user: {
          id: "00000000-0000-0000-0000-000000000001",
          email: "mira.beispiel@example.org",
          firstName: "Mira",
          lastName: "Beispiel",
          role,
          status: "ACTIVE",
        },
      })
    )
  }

  /*
   * Der Aufbau nach der Vorlage "Login (Auth)". Geprueft werden die Teile,
   * die eine Bedeutung tragen und beim Umbauen verlorengehen koennen, nicht
   * das Aussehen: der Weg zurueck, der Weg fuer Externe, und dass das
   * Auswahlfeld "ROLLE (DEMO)" der Vorlage bewusst fehlt.
   */
  it("folgt dem Template mit Brotkrumen, Untertitel und dem Weg fuer Externe", () => {
    renderWithProviders(<LoginPage />)

    const crumbs = screen.getByRole("navigation", { name: "Seitenpfad" })
    expect(
      within(crumbs).getByRole("link", { name: "Startseite" })
    ).toHaveAttribute("href", "/")

    expect(
      screen.getByRole("heading", { level: 1, name: "Anmelden" })
    ).toBeInTheDocument()
    expect(
      screen.getByText("Hochschule Bremen E-Portfolio")
    ).toBeInTheDocument()

    expect(
      screen.getByRole("link", { name: "Jetzt registrieren" })
    ).toHaveAttribute("href", "/register")
    /* Nicht im Figma-Template, aber entschieden (Klaerungsrunde KAN-33):
       ohne diesen Einstieg waere /forgot-password nur per URL erreichbar. */
    expect(
      screen.getByRole("link", { name: "Passwort vergessen?" })
    ).toHaveAttribute("href", "/forgot-password")
    /* Ohne Konto geht es weiter: die Bibliothek ist nach Contract 5 fuer
       PUBLIC lesbar, die Seite darf fuer Externe keine Sackgasse sein. */
    expect(screen.getByRole("link", { name: "Projekte" })).toHaveAttribute(
      "href",
      "/projects"
    )
  })

  it("fuehrt kein Rollenfeld, die Rolle haengt am Konto", () => {
    renderWithProviders(<LoginPage />)

    /* Die Vorlage zeigt ein Auswahlfeld "ROLLE (DEMO)". Es entsteht nicht:
       POST /auth/login kennt nur E-Mail und Passwort (Contract 2.1), ein
       Feld ohne Wirkung waere eine Attrappe (Frontend-Regel 10). */
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Rolle/i)).not.toBeInTheDocument()
  })

  it("validiert Pflichtfelder vor dem Absenden, ohne Request", async () => {
    /* Kein MSW-Handler angemeldet: erreichte ein Request den Server,
       schluege der Test ueber onUnhandledRequest "error" fehl. */
    renderWithProviders(<LoginPage />)

    await fillAndSubmit("", "")

    expect(
      await screen.findByText("Bitte geben Sie Ihre E-Mail-Adresse ein.")
    ).toBeInTheDocument()
    expect(
      screen.getByText("Bitte geben Sie Ihr Passwort ein.")
    ).toBeInTheDocument()
  })

  it("meldet ein ungueltiges E-Mail-Format", async () => {
    renderWithProviders(<LoginPage />)

    await fillAndSubmit("keine-adresse", "geheim")

    expect(
      await screen.findByText(
        "Bitte geben Sie eine gültige E-Mail-Adresse ein."
      )
    ).toBeInTheDocument()
  })

  it.each([
    ["STUDENT", "/my-portfolio"],
    ["EDITOR", "/reviews"],
    ["ADMIN", "/administration"],
  ])(
    "fuehrt %s nach der Anmeldung nach %s (KAN-83)",
    async (role, expectedPath) => {
      /*
       * Bis KAN-83 landete jede Rolle auf der oeffentlichen
       * Projektbibliothek, dem Pauschalziel des Durchstichs aus KAN-8. Das
       * war fuer niemanden der Ort, an dem die eigene Arbeit beginnt.
       */
      server.use(
        http.post("*/api/auth/login", () =>
          HttpResponse.json({
            token: "test-token",
            expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
            passwordChangeRequired: false,
            user: {
              id: "00000000-0000-0000-0000-000000000001",
              email: "mira.beispiel@example.org",
              firstName: "Mira",
              lastName: "Beispiel",
              role,
              status: "ACTIVE",
            },
          })
        ),
        ownPortfolioHandler(),
        emptyProjectsHandler(),
        /* Der Rollenweg fuehrt ADMIN auf die Administrationsseite, und deren
           Seitennavigation zaehlt seit der Nacharbeit die offenen
           Support-Anfragen. Ohne Antwort scheiterte der Test an einem Aufruf,
           um den es hier gar nicht geht. */
        dashboardHandler(),
        openSupportCountHandler()
      )
      renderWithProviders(
        <>
          <AppUnderTest />
          <LocationProbe />
        </>,
        "/login"
      )

      await fillAndSubmit("mira.beispiel@example.org", "test1234")

      await waitFor(() =>
        expect(screen.getByTestId("pathname")).toHaveTextContent(expectedPath)
      )
    }
  )

  it("kehrt nach der Anmeldung zur urspruenglich angefragten Route zurueck", async () => {
    /* Klaerungsrunde KAN-33: wer von einer geschuetzten Route zum Login
       umgeleitet wurde, landet nach dem Erfolg wieder dort. Die gemerkte
       Route behaelt seit KAN-83 auch gegenueber dem neuen Rollenziel den
       Vorrang; ein geteilter Link fuehrt also weiterhin dorthin, wohin er
       zeigt. */
    server.use(
      http.post("*/api/auth/login", () =>
        HttpResponse.json({
          token: "test-token",
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
          passwordChangeRequired: false,
          user: {
            id: "00000000-0000-0000-0000-000000000001",
            email: "mira.beispiel@example.org",
            firstName: "Mira",
            lastName: "Beispiel",
            role: "STUDENT",
            status: "ACTIVE",
          },
        })
      ),
      /* Das Ziel der Umleitung ist seit KAN-34 die echte Seite; sie zieht
         Profil und eigene Projekte, beides hier leer. */
      ownPortfolioHandler(),
      emptyProjectsHandler()
    )
    renderWithProviders(
      <>
        <AppUnderTest />
        <LocationProbe />
      </>,
      "/my-portfolio"
    )
    /* RequireAuth hat zum Login umgeleitet und die Route gemerkt. */
    expect(screen.getByTestId("pathname")).toHaveTextContent("/login")

    await fillAndSubmit("mira.beispiel@example.org", "test1234")

    expect(
      await screen.findByRole("heading", { level: 1, name: "My Portfolio" })
    ).toBeInTheDocument()
    expect(screen.getByTestId("pathname")).toHaveTextContent("/my-portfolio")
  })

  it("laesst nach dem Abmelden wieder das Rollenziel gewinnen", async () => {
    /*
     * Der gemeldete Fall, und er zeigt sich erst in der Kombination:
     * Abmelden fuer sich war gruen, Anmelden fuer sich auch. Beim
     * Abmelden rendern die Routen-Wrapper noch einmal, sehen eine
     * geschuetzte Route ohne Anmeldung und schrieben sie in den
     * Merkzettel aus KAN-33; beim naechsten Anmelden gewann er dann gegen
     * das Rollenziel aus KAN-83, und man landete wieder dort, wo die
     * vorige Sitzung endete.
     *
     * Abgemeldet wird aus "/my-portfolio" mit der Rolle ADMIN: nur wenn
     * gemerkte Route und Rollenziel auseinanderfallen, sagt der Ausgang
     * etwas aus.
     */
    const user = userEvent.setup()
    server.use(
      http.post(
        "*/api/auth/logout",
        () => new HttpResponse(null, { status: 204 })
      ),
      loginHandler("ADMIN"),
      ownPortfolioHandler(),
      emptyProjectsHandler(),
      dashboardHandler(),
      openSupportCountHandler()
    )
    signInAs("ADMIN")
    renderWithProviders(
      <>
        <AppUnderTest />
        <LocationProbe />
      </>,
      "/my-portfolio"
    )

    await user.click(screen.getByRole("button", { name: /Mira Beispiel/ }))
    await user.click(await screen.findByText("Abmelden"))
    /* Genau die Startseite, nicht irgendein Pfad, der einen Schraegstrich
       enthaelt: toHaveTextContent prueft sonst nur auf Teilzeichenkette. */
    await waitFor(() =>
      expect(screen.getByTestId("pathname")).toHaveTextContent(/^\/$/)
    )

    await user.click(screen.getByRole("link", { name: "Anmelden" }))
    await fillAndSubmit("mira.beispiel@example.org", "test1234")

    await waitFor(() =>
      expect(screen.getByTestId("pathname")).toHaveTextContent(
        "/administration"
      )
    )
  })

  it("merkt nach dem Abmelden wieder, wohin ein Link fuehrt", async () => {
    /*
     * Die zweite Haelfte derselben Regel: der Merker gilt fuer das
     * Abmelden und nicht fuer die Zeit danach. Wer sich abmeldet und
     * gleich darauf einem Link auf eine geschuetzte Route folgt, wird
     * nach dem Anmelden dorthin gefuehrt und nicht auf sein Rollenziel
     * (Klaerungsrunde KAN-33). Bliebe der Merker liegen, waere genau
     * dieser Weg zerstoert.
     *
     * Der Link steht im Test, weil die Kopfleiste abgemeldet keinen
     * fuehrt; er steht fuer die geteilte Adresse, um die es in KAN-33
     * geht. Er zeigt bewusst auf dieselbe Route, aus der abgemeldet
     * wurde: der Merker darf keine Route dauerhaft sperren.
     */
    const user = userEvent.setup()
    server.use(
      http.post(
        "*/api/auth/logout",
        () => new HttpResponse(null, { status: 204 })
      ),
      loginHandler("ADMIN"),
      ownPortfolioHandler(),
      emptyProjectsHandler(),
      dashboardHandler(),
      openSupportCountHandler()
    )
    signInAs("ADMIN")
    renderWithProviders(
      <>
        <AppUnderTest />
        <LocationProbe />
        <Link to="/my-portfolio">Geteilter Link</Link>
      </>,
      "/my-portfolio"
    )

    await user.click(screen.getByRole("button", { name: /Mira Beispiel/ }))
    await user.click(await screen.findByText("Abmelden"))
    await waitFor(() =>
      expect(screen.getByTestId("pathname")).toHaveTextContent(/^\/$/)
    )

    await user.click(screen.getByRole("link", { name: "Geteilter Link" }))
    /* RequireAuth hat die Route gemerkt und zum Login umgeleitet. */
    await waitFor(() =>
      expect(screen.getByTestId("pathname")).toHaveTextContent("/login")
    )

    await fillAndSubmit("mira.beispiel@example.org", "test1234")

    await waitFor(() =>
      expect(screen.getByTestId("pathname")).toHaveTextContent("/my-portfolio")
    )
  })

  it("merkt die Route bei einem Sitzungsablauf weiterhin", async () => {
    /*
     * Gegenprobe zum Abmelden: ein Ablauf ist kein Abmelden. Wer
     * herausgeworfen wird, soll nach dem erneuten Anmelden dort
     * weiterarbeiten, wo er war (Klaerungsrunde KAN-33); nur das gewollte
     * Abmelden hinterlaesst nichts.
     */
    server.use(
      loginHandler("ADMIN"),
      ownPortfolioHandler(),
      emptyProjectsHandler()
    )
    signInAs("ADMIN")
    renderWithProviders(
      <>
        <AppUnderTest />
        <LocationProbe />
      </>,
      "/my-portfolio"
    )
    expect(screen.getByTestId("pathname")).toHaveTextContent("/my-portfolio")

    /* So endet die Sitzung, wenn das Token ablaeuft (authStore,
       scheduleExpiry) und wenn die zentrale 401-Reaktion greift. */
    act(() => {
      endSession("TOKEN_EXPIRED")
    })

    await waitFor(() =>
      expect(screen.getByTestId("pathname")).toHaveTextContent("/login")
    )

    await fillAndSubmit("mira.beispiel@example.org", "test1234")

    /* Zurueck an die Arbeit und nicht auf "/administration": die gemerkte
       Route behaelt hier den Vorrang. */
    await waitFor(() =>
      expect(screen.getByTestId("pathname")).toHaveTextContent("/my-portfolio")
    )
  })

  it("zeigt 401 LOGIN_FAILED als Meldung am Formular", async () => {
    server.use(
      http.post("*/api/auth/login", () =>
        apiErrorResponse(401, "LOGIN_FAILED", "/api/auth/login")
      )
    )
    renderWithProviders(<LoginPage />)

    await fillAndSubmit("mira.beispiel@example.org", "falsch")

    expect(
      await screen.findByText(
        "Anmeldung fehlgeschlagen. E-Mail-Adresse oder Passwort ist falsch."
      )
    ).toBeInTheDocument()
  })

  it("legt 400 VALIDATION_FAILED an das betroffene Feld", async () => {
    server.use(
      http.post("*/api/auth/login", () =>
        apiErrorResponse(
          400,
          "VALIDATION_FAILED",
          "/api/auth/login",
          "email: Muss eine gueltige Adresse sein"
        )
      )
    )
    renderWithProviders(<LoginPage />)

    await fillAndSubmit("mira.beispiel@example.org", "test1234")

    expect(
      await screen.findByText("Muss eine gueltige Adresse sein")
    ).toBeInTheDocument()
  })

  it("bietet bei 401 REGISTRATION_NOT_COMPLETED den Wiedereinstieg in die Verifizierung an (KAN-68)", async () => {
    server.use(
      http.post("*/api/auth/login", () =>
        apiErrorResponse(401, "REGISTRATION_NOT_COMPLETED", "/api/auth/login")
      )
    )
    renderWithProviders(
      <>
        <AppUnderTest />
        <LocationProbe />
      </>,
      "/login"
    )

    /* Grossschreibung mit Absicht: der Flow-Zustand muss die Adresse
       kleingeschrieben tragen, wie der Server sie ablegt (Contract 3.1). */
    await fillAndSubmit("Lena@Example.org", "zwoelfzeichenlang")

    expect(
      await screen.findByText(
        "Die Registrierung ist noch nicht abgeschlossen. Bitte bestätigen Sie Ihre E-Mail-Adressen."
      )
    ).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(
      screen.getByRole("button", { name: "Registrierung fortsetzen" })
    )

    /* Der Wiedereinstieg landet bei Schritt 2; die HSB-Adresse bleibt
       leer, weil keine Response sie nennt (Contract 3.1). */
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Private E-Mail bestätigen",
      })
    ).toBeInTheDocument()
    expect(screen.getByTestId("pathname")).toHaveTextContent(
      "/register/verify-email"
    )
    expect(readRegistrationFlow()).toEqual({
      email: "lena@example.org",
      hsbEmail: "",
      emailVerified: false,
      hsbEmailVerified: false,
      status: "REGISTRATION_PENDING",
    })
  })

  it("zeigt 401 ACCOUNT_NOT_ACTIVE ohne Wiedereinstiegsangebot", async () => {
    /* Ein deaktiviertes Konto kann nur die Administration wieder oeffnen;
       ein Wiedereinstieg in die Registrierung waere eine Attrappe. */
    server.use(
      http.post("*/api/auth/login", () =>
        apiErrorResponse(401, "ACCOUNT_NOT_ACTIVE", "/api/auth/login")
      )
    )
    renderWithProviders(<LoginPage />)

    await fillAndSubmit("mira.beispiel@example.org", "test1234")

    /* Der Text nennt seit v48 nur noch die Deaktivierung: der
       Registrierungsfall haengt vollstaendig an REGISTRATION_NOT_COMPLETED
       (Befund des contract-pruefers zu KAN-68). */
    expect(
      await screen.findByText(
        "Dieses Konto ist deaktiviert. Bitte wenden Sie sich an die Administration."
      )
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Registrierung fortsetzen" })
    ).not.toBeInTheDocument()
  })

  it("zeigt den Hinweis der zentralen 401-Reaktion und raeumt ihn ab", async () => {
    /* So hinterlaesst die zentrale Reaktion aus KAN-30 ein abgelaufenes
       Token: Sitzung beendet, Hinweis im Store. Die Seite macht ihn
       sichtbar, statt leer zu bleiben (DoD KAN-8). */
    endSession("TOKEN_EXPIRED")
    renderWithProviders(<LoginPage />)

    expect(
      await screen.findByText(
        "Die Sitzung ist abgelaufen. Bitte melden Sie sich erneut an."
      )
    ).toBeInTheDocument()
    expect(getAuthState().sessionNotice).toBeNull()
  })
})
