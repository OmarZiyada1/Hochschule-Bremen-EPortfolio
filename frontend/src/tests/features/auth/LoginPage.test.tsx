import { HttpResponse, http } from "msw"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"

import { endSession, getAuthState } from "@/api/auth/authStore"
import LoginPage from "@/features/auth/LoginPage"
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

  async function fillAndSubmit(email: string, password: string) {
    const user = userEvent.setup()
    if (email !== "") {
      await user.type(screen.getByLabelText("E-Mail-Adresse"), email)
    }
    if (password !== "") {
      await user.type(screen.getByLabelText("Passwort"), password)
    }
    await user.click(screen.getByRole("button", { name: "Anmelden" }))
  }

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
      await screen.findByText("Bitte geben Sie eine gültige E-Mail-Adresse ein.")
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
      await screen.findByRole("heading", { level: 1, name: "Projektbibliothek" })
    ).toBeInTheDocument()
    expect(screen.getByTestId("pathname")).toHaveTextContent("/projects")
    expect(
      await screen.findByText("Campus-Garten an der Werderstraße")
    ).toBeInTheDocument()
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
