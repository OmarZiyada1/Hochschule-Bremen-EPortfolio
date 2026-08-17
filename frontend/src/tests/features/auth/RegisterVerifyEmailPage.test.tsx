import { HttpResponse, http } from "msw"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"

import RegisterVerifyEmailPage from "@/features/auth/RegisterVerifyEmailPage"
import {
  saveRegistrationFlow,
  type RegistrationFlowState,
} from "@/features/auth/registrationFlow"
import i18n from "@/i18n"
import { apiErrorResponse } from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { AppUnderTest, LocationProbe } from "@/tests/routes/helpers"

/**
 * Bestaetigung der privaten E-Mail (KAN-33, Template "Registrierung 2"):
 * Schrittzustand aus dem sessionStorage (Reload-Fall), Weiterleitung
 * allein nach dem Feld status der verify-Antwort, eine Meldung fuer jeden
 * Code-Fehler, Wartehinweis fuer das Rate-Limit an beiden Aufrufen.
 */
describe("RegisterVerifyEmailPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
  })

  const flow: RegistrationFlowState = {
    email: "lena@example.org",
    hsbEmail: "lmueller@stud.hs-bremen.de",
    emailVerified: false,
    hsbEmailVerified: false,
    status: "REGISTRATION_PENDING",
  }

  async function typeCodeAndSubmit(code: string) {
    const user = userEvent.setup()
    await user.type(
      screen.getByLabelText("Sechsstelliger Bestätigungscode"),
      code
    )
    await user.click(screen.getByRole("button", { name: "Code bestätigen" }))
  }

  it("leitet ohne Schrittzustand zur Angaben-Seite um", () => {
    renderWithProviders(
      <>
        <AppUnderTest />
        <LocationProbe />
      </>,
      "/register/verify-email"
    )

    expect(screen.getByTestId("pathname")).toHaveTextContent(
      "/register/details"
    )
  })

  it("zeigt nach einem Reload die Adresse aus dem gemerkten Schrittzustand", () => {
    /* Der sessionStorage ist praepariert wie nach der Registrierung; das
       Rendern entspricht dem Neuladen der Seite (DoD: Schrittzustand
       uebersteht einen Reload). */
    saveRegistrationFlow(flow)
    renderWithProviders(<RegisterVerifyEmailPage />)

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Private E-Mail bestätigen",
      })
    ).toBeInTheDocument()
    expect(screen.getByText("lena@example.org")).toBeInTheDocument()
    /* Countdown nach Template: der Knopf entsteht erst nach Ablauf. */
    expect(
      screen.getByText("Neuen Code in 20s anfordern")
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Zurück" })).toHaveAttribute(
      "href",
      "/register/details"
    )
  })

  it("bleibt vor der Aktiviert-Seite, solange status nicht ACTIVE ist", async () => {
    /* DoD: der Wechsel haengt am Feld status der Antwort, nicht an einem
       lokal mitgezaehlten Schritt. Die Antwort bestaetigt die private
       Adresse, das Konto ist aber noch nicht aktiv. */
    let requestBody: unknown = null
    server.use(
      http.post("*/api/auth/verify", async ({ request }) => {
        requestBody = await request.json()
        return HttpResponse.json({
          emailVerified: true,
          hsbEmailVerified: false,
          status: "REGISTRATION_PENDING",
        })
      })
    )
    saveRegistrationFlow(flow)
    renderWithProviders(
      <>
        <AppUnderTest />
        <LocationProbe />
      </>,
      "/register/verify-email"
    )

    await typeCodeAndSubmit("042317")

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "HSB-E-Mail bestätigen",
      })
    ).toBeInTheDocument()
    expect(screen.getByTestId("pathname")).toHaveTextContent(
      "/register/verify-hsb-email"
    )
    expect(requestBody).toEqual({
      email: "lena@example.org",
      purpose: "PRIVATE_EMAIL",
      code: "042317",
    })
  })

  it("zeigt fuer jeden Code-Fehler dieselbe eine Meldung", async () => {
    /* Ungueltig, abgelaufen, verbraucht und unbekannte Adresse sind
       serverseitig derselbe Fall (Contract 6.1); die Oberflaeche macht
       daraus keine vier Meldungen. */
    server.use(
      http.post("*/api/auth/verify", () =>
        apiErrorResponse(400, "VERIFICATION_CODE_INVALID", "/api/auth/verify")
      )
    )
    saveRegistrationFlow(flow)
    renderWithProviders(<RegisterVerifyEmailPage />)

    await typeCodeAndSubmit("000000")

    expect(
      await screen.findByText(
        "Der Code ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen Code an."
      )
    ).toBeInTheDocument()
  })

  it("zeigt das Rate-Limit der Code-Eingabe als Wartehinweis", async () => {
    /* Seit Contract v23 bremst derselbe Zaehler auch POST /auth/verify;
       der Wartehinweis gehoert deshalb an beide Aufrufe, nicht nur an das
       Nachfordern (Ticket). */
    server.use(
      http.post("*/api/auth/verify", () =>
        apiErrorResponse(
          429,
          "TOO_MANY_LOGIN_ATTEMPTS",
          "/api/auth/verify"
        )
      )
    )
    saveRegistrationFlow(flow)
    renderWithProviders(<RegisterVerifyEmailPage />)

    await typeCodeAndSubmit("042317")

    expect(
      await screen.findByText(
        "Zu viele Fehlversuche. Bitte warten Sie einige Minuten und versuchen Sie es dann erneut."
      )
    ).toBeInTheDocument()
  })
})
