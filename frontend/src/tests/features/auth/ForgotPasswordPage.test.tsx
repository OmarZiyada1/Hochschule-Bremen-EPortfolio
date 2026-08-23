import { HttpResponse, http } from "msw"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"

import ForgotPasswordPage from "@/features/auth/ForgotPasswordPage"
import i18n from "@/i18n"
import { apiErrorResponse } from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { AppUnderTest, LocationProbe } from "@/tests/routes/helpers"

/**
 * Passwort vergessen (KAN-33, Contract 6.1): immer dieselbe Bestaetigung,
 * unabhaengig davon, ob die Adresse bekannt ist; das Rate-Limit erscheint
 * als Wartehinweis; danach geht es zur Code-Eingabe.
 */
describe("ForgotPasswordPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
  })

  async function submitEmail(email: string) {
    const user = userEvent.setup()
    await user.type(screen.getByLabelText("Private E-Mail (Login)"), email)
    await user.click(screen.getByRole("button", { name: "Code anfordern" }))
    return user
  }

  it("zeigt fuer jede Adresse dieselbe Bestaetigung und fuehrt zur Code-Eingabe", async () => {
    /* Der Server antwortet immer 204, auch bei unbekannter Adresse
       (Contract 6.1, v35); die Oberflaeche schliesst daraus nichts. */
    server.use(
      http.post(
        "*/api/auth/forgot-password",
        () => new HttpResponse(null, { status: 204 })
      )
    )
    renderWithProviders(
      <>
        <AppUnderTest />
        <LocationProbe />
      </>,
      "/forgot-password"
    )

    const user = await submitEmail("wer-auch-immer@example.org")

    expect(
      await screen.findByText(
        "Wenn zu dieser Adresse ein aktives Konto existiert, wurde ein 6-stelliger Code dorthin gesendet."
      )
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Code eingeben" }))
    expect(screen.getByTestId("pathname")).toHaveTextContent("/reset-password")
    /* Die Adresse laeuft als Router-State mit und steht vorbefuellt im
       Formular. */
    expect(screen.getByLabelText("Private E-Mail (Login)")).toHaveValue(
      "wer-auch-immer@example.org"
    )
  })

  it("zeigt das Rate-Limit als Wartehinweis", async () => {
    server.use(
      http.post("*/api/auth/forgot-password", () =>
        apiErrorResponse(
          429,
          "TOO_MANY_LOGIN_ATTEMPTS",
          "/api/auth/forgot-password"
        )
      )
    )
    renderWithProviders(<ForgotPasswordPage />)

    await submitEmail("lena@example.org")

    expect(
      await screen.findByText(
        "Zu viele Fehlversuche. Bitte warten Sie einige Minuten und versuchen Sie es dann erneut."
      )
    ).toBeInTheDocument()
  })
})
