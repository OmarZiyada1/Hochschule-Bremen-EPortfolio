import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"

import RegisterDonePage from "@/features/auth/RegisterDonePage"
import {
  readRegistrationFlow,
  saveRegistrationFlow,
  type RegistrationFlowState,
} from "@/features/auth/registrationFlow"
import i18n from "@/i18n"
import { renderWithProviders } from "@/tests/render"
import { AppUnderTest, LocationProbe } from "@/tests/routes/helpers"

/**
 * Aktiviert-Seite (KAN-33, Template "Registrierung 4"): Zusammenfassung
 * beider Adressen samt Status, erreichbar nur mit status ACTIVE, und der
 * Weg zur Anmeldung raeumt den Schrittzustand ab.
 */
describe("RegisterDonePage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
  })

  const activeFlow: RegistrationFlowState = {
    email: "lena@example.org",
    hsbEmail: "lmueller@stud.hs-bremen.de",
    emailVerified: true,
    hsbEmailVerified: true,
    status: "ACTIVE",
  }

  it("zeigt die Zusammenfassung aus dem Schrittzustand", () => {
    saveRegistrationFlow(activeFlow)
    renderWithProviders(<RegisterDonePage />)

    expect(
      screen.getByRole("heading", { level: 1, name: "Konto aktiviert" })
    ).toBeInTheDocument()
    expect(screen.getByText("lena@example.org")).toBeInTheDocument()
    expect(
      screen.getByText("lmueller@stud.hs-bremen.de")
    ).toBeInTheDocument()
    /* Der Contract-Enum-Wert ACTIVE laeuft unveraendert durch den Code und
       wird nur fuer die Anzeige uebersetzt (Frontend-Regel 6). */
    expect(screen.getByText("Aktiv")).toBeInTheDocument()
  })

  it("zeigt ohne bekannte HSB-Adresse einen Ersatztext statt einer leeren Zeile (KAN-68)", () => {
    /* Nach dem Wiedereinstieg ueber den Login bleibt hsbEmail leer, weil
       keine Response sie nennt (Contract 3.1); bestaetigt ist sie
       trotzdem, sonst waere der Status nicht ACTIVE. */
    saveRegistrationFlow({ ...activeFlow, hsbEmail: "" })
    renderWithProviders(<RegisterDonePage />)

    expect(screen.getByText("Bestätigt")).toBeInTheDocument()
    expect(screen.getByText("lena@example.org")).toBeInTheDocument()
  })

  it("leitet ohne aktivierten Zustand zum offenen Schritt um", () => {
    saveRegistrationFlow({
      ...activeFlow,
      emailVerified: true,
      hsbEmailVerified: false,
      status: "REGISTRATION_PENDING",
    })
    renderWithProviders(
      <>
        <AppUnderTest />
        <LocationProbe />
      </>,
      "/register/done"
    )

    expect(screen.getByTestId("pathname")).toHaveTextContent(
      "/register/verify-hsb-email"
    )
  })

  it("fuehrt zur Anmeldung und raeumt den Schrittzustand ab", async () => {
    saveRegistrationFlow(activeFlow)
    renderWithProviders(
      <>
        <AppUnderTest />
        <LocationProbe />
      </>,
      "/register/done"
    )

    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "Zur Anmeldung" }))

    expect(screen.getByTestId("pathname")).toHaveTextContent("/login")
    /* Ein Rest im sessionStorage wuerde eine spaetere Registrierung am
       selben Rechner in die falschen Schritte leiten. */
    expect(readRegistrationFlow()).toBeNull()
  })
})
