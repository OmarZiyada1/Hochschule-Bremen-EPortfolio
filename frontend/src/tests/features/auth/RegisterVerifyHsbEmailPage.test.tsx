import { HttpResponse, http } from "msw"
import { act, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import RegisterVerifyHsbEmailPage from "@/features/auth/RegisterVerifyHsbEmailPage"
import {
  saveRegistrationFlow,
  type RegistrationFlowState,
} from "@/features/auth/registrationFlow"
import i18n from "@/i18n"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { AppUnderTest, LocationProbe } from "@/tests/routes/helpers"

/**
 * Bestaetigung der HSB-E-Mail (KAN-33, Template "Registrierung 3"): der
 * Aufruf traegt die private Adresse als Kennung (DoD), der Wechsel zur
 * Aktiviert-Seite haengt am Feld status der Antwort (DoD), und das
 * Nachfordern laeuft nach Ablauf des Countdowns gegen /verify/resend.
 */
describe("RegisterVerifyHsbEmailPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const flow: RegistrationFlowState = {
    email: "lena@example.org",
    hsbEmail: "lmueller@stud.hs-bremen.de",
    emailVerified: true,
    hsbEmailVerified: false,
    status: "REGISTRATION_PENDING",
  }

  it("zeigt die HSB-Adresse im Versandhinweis, ohne Zurueck-Link", () => {
    saveRegistrationFlow(flow)
    renderWithProviders(<RegisterVerifyHsbEmailPage />)

    expect(
      screen.getByRole("heading", { level: 1, name: "HSB-E-Mail bestätigen" })
    ).toBeInTheDocument()
    expect(
      screen.getByText("lmueller@stud.hs-bremen.de")
    ).toBeInTheDocument()
    /* Das Template fuehrt hier kein "Zurueck" mehr. */
    expect(
      screen.queryByRole("link", { name: "Zurück" })
    ).not.toBeInTheDocument()
    /* Auch keinen Weiterschalter (KAN-68): er gehoert nur an Schritt 2,
       denn hinter Schritt 3 gibt es keinen Schritt zum Ueberspringen. */
    expect(
      screen.queryByRole("button", {
        name: "Diese Adresse ist bereits bestätigt",
      })
    ).not.toBeInTheDocument()
  })

  it("schickt die private Adresse und wechselt bei status ACTIVE zur Aktiviert-Seite", async () => {
    /* DoD-Doppelnachweis: die Kennung ist die private Adresse, nicht die
       HSB-Adresse (sonst 400), und die Aktiviert-Seite haengt am Feld
       status der Antwort. */
    let requestBody: unknown = null
    server.use(
      http.post("*/api/auth/verify", async ({ request }) => {
        requestBody = await request.json()
        return HttpResponse.json({
          emailVerified: true,
          hsbEmailVerified: true,
          status: "ACTIVE",
        })
      })
    )
    saveRegistrationFlow(flow)
    renderWithProviders(
      <>
        <AppUnderTest />
        <LocationProbe />
      </>,
      "/register/verify-hsb-email"
    )

    const user = userEvent.setup()
    await user.type(
      screen.getByLabelText("Sechsstelliger Bestätigungscode"),
      "042317"
    )
    await user.click(screen.getByRole("button", { name: "Code bestätigen" }))

    expect(
      await screen.findByRole("heading", { level: 1, name: "Konto aktiviert" })
    ).toBeInTheDocument()
    expect(screen.getByTestId("pathname")).toHaveTextContent("/register/done")
    expect(requestBody).toEqual({
      email: "lena@example.org",
      purpose: "HSB_EMAIL",
      code: "042317",
    })
  })

  it("fordert nach Ablauf des Countdowns einen neuen Code an", async () => {
    let resendBody: unknown = null
    server.use(
      http.post("*/api/auth/verify/resend", async ({ request }) => {
        resendBody = await request.json()
        return new HttpResponse(null, { status: 204 })
      })
    )
    vi.useFakeTimers()
    saveRegistrationFlow(flow)
    renderWithProviders(<RegisterVerifyHsbEmailPage />)

    expect(
      screen.getByText("Neuen Code in 20s anfordern")
    ).toBeInTheDocument()

    /* 20 Sekunden ablaufen lassen: aus dem Countdown wird der Knopf.
       Sekundenweise, weil jeder Tick den naechsten Timeout erst nach dem
       Re-Render einplant; ein einzelner grosser Sprung feuerte nur den
       ersten. */
    for (let second = 0; second < 20; second++) {
      await act(async () => {
        vi.advanceTimersByTime(1_000)
      })
    }
    /* Klick und Netzwerkantwort laufen ueber echte Timer: MSW und
       userEvent haengen sonst an der stehenden Uhr. */
    vi.useRealTimers()
    const user = userEvent.setup()
    await user.click(
      screen.getByRole("button", { name: "Neuen Code anfordern" })
    )

    expect(
      await screen.findByText(
        "Ein neuer Code wurde angefordert. Bitte prüfen Sie Ihr Postfach."
      )
    ).toBeInTheDocument()
    /* Auch das Nachfordern traegt die private Adresse als Kennung. */
    expect(resendBody).toEqual({
      email: "lena@example.org",
      purpose: "HSB_EMAIL",
    })
    /* Der Countdown beginnt von vorn. */
    expect(
      screen.getByText("Neuen Code in 20s anfordern")
    ).toBeInTheDocument()
  })
})
