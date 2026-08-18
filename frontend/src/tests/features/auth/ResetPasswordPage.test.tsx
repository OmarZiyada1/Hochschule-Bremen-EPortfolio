import { HttpResponse, http } from "msw"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"

import { RESEND_COOLDOWN_SECONDS } from "@/features/auth/hooks/useResendCountdown"
import ResetPasswordPage from "@/features/auth/ResetPasswordPage"
import i18n from "@/i18n"
import { apiErrorResponse } from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { AppUnderTest, LocationProbe } from "@/tests/routes/helpers"

/**
 * Passwort zuruecksetzen (KAN-33, Contract 6.1): Code-Eingabe wie auf den
 * Bestaetigungsseiten, Passwortregel aus 3.1.1, genau eine Meldung fuer
 * jeden fachlichen Fehlschlag, Wartehinweis fuer das Rate-Limit, Erfolg
 * fuehrt zur Anmeldung.
 */
describe("ResetPasswordPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
  })

  it("fuehrt an beiden Passwortfeldern einen Sichtbarkeitsschalter (KAN-67)", () => {
    renderWithProviders(<ResetPasswordPage />)

    expect(
      screen.getAllByRole("button", { name: "Passwort anzeigen" })
    ).toHaveLength(2)
  })

  async function fillAndSubmit(
    overrides: { code?: string; password?: string } = {}
  ) {
    const user = userEvent.setup()
    await user.type(
      screen.getByLabelText("Private E-Mail (Login)"),
      "lena@example.org"
    )
    await user.type(
      screen.getByLabelText("Bestätigungscode"),
      overrides.code ?? "042317"
    )
    await user.type(
      screen.getByLabelText("Neues Passwort", { exact: true }),
      overrides.password ?? "neueszwoelflanges"
    )
    await user.type(
      screen.getByLabelText("Neues Passwort bestätigen"),
      overrides.password ?? "neueszwoelflanges"
    )
    await user.click(
      screen.getByRole("button", { name: "Passwort zurücksetzen" })
    )
    return user
  }

  it("setzt das Passwort und fuehrt zur Anmeldung", async () => {
    let requestBody: unknown = null
    server.use(
      http.post("*/api/auth/reset-password", async ({ request }) => {
        requestBody = await request.json()
        return HttpResponse.json(null, { status: 200 })
      })
    )
    renderWithProviders(
      <>
        <AppUnderTest />
        <LocationProbe />
      </>,
      "/reset-password"
    )

    const user = await fillAndSubmit()

    expect(
      await screen.findByText(
        "Ihr Passwort wurde geändert. Sie können sich jetzt anmelden."
      )
    ).toBeInTheDocument()
    expect(requestBody).toEqual({
      email: "lena@example.org",
      code: "042317",
      newPassword: "neueszwoelflanges",
    })

    await user.click(screen.getByRole("button", { name: "Zur Anmeldung" }))
    expect(screen.getByTestId("pathname")).toHaveTextContent("/login")
  })

  it("zeigt fuer jeden fachlichen Fehlschlag dieselbe eine Meldung", async () => {
    /* Unbekannte Adresse, nicht aktives Konto und falscher Code antworten
       identisch (Contract 6.1, v35); die Oberflaeche schliesst aus dem
       Fehlschlag nichts ueber das Konto. */
    server.use(
      http.post("*/api/auth/reset-password", () =>
        apiErrorResponse(
          400,
          "VERIFICATION_CODE_INVALID",
          "/api/auth/reset-password"
        )
      )
    )
    renderWithProviders(<ResetPasswordPage />)

    await fillAndSubmit()

    expect(
      await screen.findByText(
        "Der Code ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen Code an."
      )
    ).toBeInTheDocument()
  })

  it("beanstandet ein zu kurzes neues Passwort vor dem Absenden", async () => {
    renderWithProviders(<ResetPasswordPage />)

    await fillAndSubmit({ password: "zukurz" })

    expect(
      await screen.findByText(
        "Das Passwort muss mindestens 12 Zeichen lang sein."
      )
    ).toBeInTheDocument()
  })

  it("zeigt das Rate-Limit als Wartehinweis", async () => {
    /* Seit Contract v34 bremst derselbe Zaehler wie bei der Verifizierung
       auch diesen Endpoint; ohne Bremse waere der sechsstellige Code
       durchprobierbar. */
    server.use(
      http.post("*/api/auth/reset-password", () =>
        apiErrorResponse(
          429,
          "TOO_MANY_LOGIN_ATTEMPTS",
          "/api/auth/reset-password"
        )
      )
    )
    renderWithProviders(<ResetPasswordPage />)

    await fillAndSubmit()

    expect(
      await screen.findByText(
        "Zu viele Fehlversuche. Bitte warten Sie einige Minuten und versuchen Sie es dann erneut."
      )
    ).toBeInTheDocument()
  })

  it("haelt den Knopf fuer einen neuen Code bis zum Ablauf der Sperrfrist zurueck", async () => {
    /* KAN-69: ein abgelaufener Code laesst sich hier ersetzen, ohne die
       Seite zu verlassen. Die Sperrfrist laeuft ab dem Betreten. */
    renderWithProviders(<ResetPasswordPage />)

    /* Die laufende Zahl, nicht die 20: unter Last ist die erste Sekunde
       schon vorbei, bevor diese Zeile laeuft. */
    expect(screen.getByText(/Code erneut senden in \d+s/)).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Code erneut senden" })
    ).not.toBeInTheDocument()
  })

  it(
    "fordert nach Ablauf der Frist einen neuen Code fuer die eingetragene Adresse an",
    async () => {
      let forgotBody: Record<string, unknown> | null = null
      server.use(
        http.post("*/api/auth/forgot-password", async ({ request }) => {
          forgotBody = (await request.json()) as Record<string, unknown>
          return new HttpResponse(null, { status: 204 })
        })
      )
      renderWithProviders(<ResetPasswordPage />)

      await userEvent.type(
        screen.getByLabelText("Private E-Mail (Login)"),
        "lena@example.org"
      )

      /*
       * Die Frist wird real abgewartet, nicht mit gestellten Timern
       * uebersprungen: der Countdown plant seinen naechsten Takt in einem
       * Effekt, und Reacts Scheduler haengt selbst an Timern (siehe
       * ProfileEditPage.test).
       */
      const resendButton = await screen.findByRole(
        "button",
        { name: "Code erneut senden" },
        { timeout: (RESEND_COOLDOWN_SECONDS + 5) * 1000 }
      )
      await userEvent.click(resendButton)

      expect(
        await screen.findByText(
          "Ein neuer Code wurde angefordert. Bitte prüfen Sie Ihr Postfach."
        )
      ).toBeVisible()
      expect(forgotBody).toMatchObject({ email: "lena@example.org" })
    },
    (RESEND_COOLDOWN_SECONDS + 20) * 1000
  )
})
