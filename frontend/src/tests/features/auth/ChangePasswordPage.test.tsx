import { HttpResponse, http } from "msw"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"

import { getAuthState, setPasswordChangeRequired } from "@/api/auth/authStore"
import { rememberRequestedRoute } from "@/api/auth/redirect"
import ChangePasswordPage from "@/features/auth/ChangePasswordPage"
import i18n from "@/i18n"
import {
  apiErrorResponse,
  emptyProjectsHandler,
  ownPortfolioHandler,
} from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { AppUnderTest, LocationProbe, signInAs } from "@/tests/routes/helpers"

/**
 * Passwort aendern (KAN-33, Contract 6.7): Anmelde-Guard, Hinweis bei
 * gesetztem Zwang, zod-Regeln, Erfolg setzt das Flag zurueck und kehrt
 * zur urspruenglich angefragten Route zurueck, das falsche aktuelle
 * Passwort landet am Feld.
 */
describe("ChangePasswordPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
  })

  async function fillAndSubmit(current: string, next: string, confirm = next) {
    const user = userEvent.setup()
    await user.type(screen.getByLabelText("Aktuelles Passwort"), current)
    await user.type(
      screen.getByLabelText("Neues Passwort", { exact: true }),
      next
    )
    await user.type(screen.getByLabelText("Neues Passwort bestätigen"), confirm)
    await user.click(screen.getByRole("button", { name: "Passwort ändern" }))
  }

  it("fuehrt an allen drei Passwortfeldern einen Sichtbarkeitsschalter (KAN-67)", () => {
    signInAs("STUDENT")
    renderWithProviders(<ChangePasswordPage />)

    expect(
      screen.getAllByRole("button", { name: "Passwort anzeigen" })
    ).toHaveLength(3)
  })

  it("fuehrt ohne Anmeldung sichtbar zum Login", () => {
    renderWithProviders(
      <>
        <AppUnderTest />
        <LocationProbe />
      </>,
      "/change-password"
    )

    expect(screen.getByTestId("pathname")).toHaveTextContent("/login")
  })

  it("zeigt bei gesetztem Zwang den Hinweis und den Weg zur Ruecksetzung", () => {
    signInAs("STUDENT")
    setPasswordChangeRequired(true)
    renderWithProviders(<ChangePasswordPage />)

    expect(
      screen.getByText(
        "Ihr Konto verlangt ein neues Passwort. Bitte vergeben Sie eines, um weiterzuarbeiten."
      )
    ).toBeInTheDocument()
    /* Contract 6.7 nimmt die Ruecksetz-Endpoints genau fuer den Fall vom
       Gate aus, dass jemand das Initialpasswort nicht mehr weiss. */
    expect(
      screen.getByRole("link", { name: "Passwort vergessen?" })
    ).toHaveAttribute("href", "/forgot-password")
  })

  it("beanstandet ein zu kurzes neues Passwort vor dem Absenden", async () => {
    signInAs("STUDENT")
    renderWithProviders(<ChangePasswordPage />)

    await fillAndSubmit("initialpasswort", "zukurz")

    expect(
      await screen.findByText(
        "Das Passwort muss mindestens 12 Zeichen lang sein."
      )
    ).toBeInTheDocument()
  })

  it("setzt bei Erfolg das Flag zurueck und kehrt zur angefragten Route zurueck", async () => {
    server.use(
      http.put("*/api/auth/password", () =>
        HttpResponse.json(null, { status: 200 })
      ),
      /* Ziel der Rueckkehr ist seit KAN-34 die echte Seite "My Portfolio";
         sie zieht Profil und eigene Projekte, beides hier leer. */
      ownPortfolioHandler(),
      emptyProjectsHandler()
    )
    signInAs("STUDENT")
    setPasswordChangeRequired(true)
    /* So hinterlaesst der Routen-Wrapper die Route, die vor der Umleitung
       hierher angefragt war. */
    rememberRequestedRoute("/my-portfolio")
    renderWithProviders(
      <>
        <AppUnderTest />
        <LocationProbe />
      </>,
      "/change-password"
    )

    await fillAndSubmit("initialpasswort", "neueszwoelflanges")

    expect(
      await screen.findByRole("heading", { level: 1, name: "My Portfolio" })
    ).toBeInTheDocument()
    expect(screen.getByTestId("pathname")).toHaveTextContent("/my-portfolio")
    expect(getAuthState().session?.passwordChangeRequired).toBe(false)
  })

  it("legt das falsche aktuelle Passwort an sein Feld", async () => {
    server.use(
      http.put("*/api/auth/password", () =>
        apiErrorResponse(401, "LOGIN_FAILED", "/api/auth/password")
      )
    )
    signInAs("STUDENT")
    renderWithProviders(<ChangePasswordPage />)

    await fillAndSubmit("falsch", "neueszwoelflanges")

    expect(
      await screen.findByText("Das aktuelle Passwort ist falsch.")
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Aktuelles Passwort")).toHaveAttribute(
      "aria-invalid",
      "true"
    )
  })
})
