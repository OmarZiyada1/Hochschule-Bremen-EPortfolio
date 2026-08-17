import { HttpResponse, http } from "msw"
import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"

import { endSession, getAuthState } from "@/api/auth/authStore"
import LoginPage from "@/features/auth/LoginPage"
import { readRegistrationFlow } from "@/features/auth/registrationFlow"
import i18n from "@/i18n"
import { apiErrorResponse } from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { AppUnderTest, LocationProbe } from "@/tests/routes/helpers"

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

  it("fuehrt nach erfolgreicher Anmeldung zur Projektliste mit echten Daten", async () => {
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
      http.get("*/api/projects", () =>
        HttpResponse.json({
          content: [
            {
              id: "10000000-0000-0000-0000-000000000001",
              title: "Campus-Garten an der Werderstraße",
              status: "PUBLISHED",
            },
          ],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
        })
      )
    )
    renderWithProviders(
      <>
        <AppUnderTest />
        <LocationProbe />
      </>,
      "/login"
    )

    await fillAndSubmit("mira.beispiel@example.org", "test1234")

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Studentische Projekte",
      })
    ).toBeInTheDocument()
    expect(screen.getByTestId("pathname")).toHaveTextContent("/projects")
    expect(
      await screen.findByText("Campus-Garten an der Werderstraße")
    ).toBeInTheDocument()
  })

  it("kehrt nach der Anmeldung zur urspruenglich angefragten Route zurueck", async () => {
    /* Klaerungsrunde KAN-33: wer von einer geschuetzten Route zum Login
       umgeleitet wurde, landet nach dem Erfolg wieder dort, nicht auf der
       Projektliste. */
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
      )
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
      await screen.findByRole("heading", { level: 1, name: "Mein Portfolio" })
    ).toBeInTheDocument()
    expect(screen.getByTestId("pathname")).toHaveTextContent("/my-portfolio")
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
