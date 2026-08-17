import { HttpResponse, http } from "msw"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"

import RegisterDetailsPage from "@/features/auth/RegisterDetailsPage"
import { readRegistrationFlow } from "@/features/auth/registrationFlow"
import i18n from "@/i18n"
import { apiErrorResponse } from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { AppUnderTest, LocationProbe } from "@/tests/routes/helpers"

/**
 * Angaben-Seite der Registrierung (KAN-33, Template "Registrierung 1"):
 * Aufbau nach Template, zod-Validierung vor dem Absenden (darunter die
 * Passwortregel aus Contract 3.1.1), Fehlerbilder nach 6.1 und der Weg
 * zum naechsten Schritt samt Schrittzustand.
 */
describe("RegisterDetailsPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
  })

  async function fillValid(
    overrides: {
      hsbEmail?: string
      password?: string
      confirmPassword?: string
    } = {}
  ) {
    const user = userEvent.setup()
    await user.type(screen.getByLabelText("Vorname"), "Lena")
    await user.type(screen.getByLabelText("Nachname"), "Müller")
    await user.type(
      screen.getByLabelText("HSB-E-Mail"),
      overrides.hsbEmail ?? "lmueller@stud.hs-bremen.de"
    )
    await user.type(
      screen.getByLabelText("Private E-Mail (Login)"),
      "lena@example.org"
    )
    await user.type(
      screen.getByLabelText("Passwort", { exact: true }),
      overrides.password ?? "zwoelfzeichenlang"
    )
    await user.type(
      screen.getByLabelText("Passwort bestätigen"),
      overrides.confirmPassword ?? overrides.password ?? "zwoelfzeichenlang"
    )
    await user.click(screen.getByRole("button", { name: "Registrieren" }))
    return user
  }

  it("folgt dem Template: Ueberschrift, Fortschritt, Hilfetexte und der Weg zurueck", () => {
    renderWithProviders(<RegisterDetailsPage />)

    expect(
      screen.getByRole("heading", { level: 1, name: "Persönliche Angaben" })
    ).toBeInTheDocument()
    /* Untertitel neutral statt "Registrierung als Studierende/r": seit dem
       Wegfall der Rollenauswahl registrieren sich hier auch Mitarbeitende
       (Klaerungsrunde KAN-33). */
    expect(
      screen.getByText("Hochschule Bremen E-Portfolio")
    ).toBeInTheDocument()

    /* Fortschritt: drei Schritte, der erste gefuellt; der Stand ist
       vorgelesen erreichbar und nicht nur gemalt. */
    const progress = screen.getByText("Schritt 1 von 3")
    expect(progress.closest("[aria-hidden]")).toBeNull()

    /* Rollenableitung und Tutor-Fall am HSB-Feld (Ticket-DoD). */
    expect(
      screen.getByText(/Die Art der Adresse entscheidet über die Rolle/)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Tutor:innen mit studentischer Adresse/)
    ).toBeInTheDocument()

    /* Kein Link "Rolle ändern" mehr; an seiner Stelle der Weg zum Login. */
    expect(screen.queryByText(/Rolle ändern/)).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Anmelden" })).toHaveAttribute(
      "href",
      "/login"
    )
  })

  it("beanstandet ein Passwort unter 12 Zeichen vor dem Absenden", async () => {
    /* Kein MSW-Handler: erreichte ein Request den Server, schluege der
       Test ueber onUnhandledRequest "error" fehl (DoD: die Regel prueft
       das zod-Schema, nicht erst der Server). */
    renderWithProviders(<RegisterDetailsPage />)

    await fillValid({ password: "zukurz", confirmPassword: "zukurz" })

    expect(
      await screen.findByText(
        "Das Passwort muss mindestens 12 Zeichen lang sein."
      )
    ).toBeInTheDocument()
  })

  it("beanstandet eine abweichende Passwortbestaetigung", async () => {
    renderWithProviders(<RegisterDetailsPage />)

    await fillValid({ confirmPassword: "andereszwoelflang" })

    expect(
      await screen.findByText("Die Passwörter stimmen nicht überein.")
    ).toBeInTheDocument()
  })

  it("legt bei 201 den Schrittzustand an und fuehrt zur privaten Bestaetigung", async () => {
    server.use(
      http.post("*/api/auth/register", () =>
        HttpResponse.json(
          {
            id: "00000000-0000-0000-0000-000000000002",
            email: "lena@example.org",
            firstName: "Lena",
            lastName: "Müller",
            role: "STUDENT",
            status: "REGISTRATION_PENDING",
          },
          { status: 201 }
        )
      )
    )
    renderWithProviders(
      <>
        <AppUnderTest />
        <LocationProbe />
      </>,
      "/register/details"
    )

    await fillValid()

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Private E-Mail bestätigen",
      })
    ).toBeInTheDocument()
    expect(screen.getByTestId("pathname")).toHaveTextContent(
      "/register/verify-email"
    )
    /* Der Schrittzustand liegt im sessionStorage und uebersteht damit
       einen Reload (DoD); die HSB-Adresse stammt aus dem Formular, weil
       keine Response sie nennt (Contract 3.1). */
    expect(readRegistrationFlow()).toEqual({
      email: "lena@example.org",
      hsbEmail: "lmueller@stud.hs-bremen.de",
      emailVerified: false,
      hsbEmailVerified: false,
      status: "REGISTRATION_PENDING",
    })
  })

  it("zeigt die fremde HSB-Domain als Meldung am Feld", async () => {
    server.use(
      http.post("*/api/auth/register", () =>
        apiErrorResponse(
          400,
          "VALIDATION_FAILED",
          "/api/auth/register",
          'hsbEmail: "beispiel.org" ist keine anerkannte Adressendung der Hochschule Bremen.'
        )
      )
    )
    renderWithProviders(<RegisterDetailsPage />)

    await fillValid({ hsbEmail: "lena@beispiel.org" })

    expect(
      await screen.findByText(/keine anerkannte Adressendung/)
    ).toBeInTheDocument()
  })

  it("zeigt eine vergebene Adresse als eigene Meldung an der richtigen Zeile", async () => {
    server.use(
      http.post("*/api/auth/register", () =>
        apiErrorResponse(
          409,
          "RESOURCE_IN_USE",
          "/api/auth/register",
          "hsbEmail: Diese E-Mail-Adresse ist bereits registriert."
        )
      )
    )
    renderWithProviders(<RegisterDetailsPage />)

    await fillValid()

    const hsbField = screen.getByLabelText("HSB-E-Mail")
    expect(
      await screen.findByText("Diese E-Mail-Adresse ist bereits registriert.")
    ).toBeInTheDocument()
    /* Die Meldung haengt an der HSB-Zeile: das Feld ist als ungueltig
       markiert, das private nicht. */
    expect(hsbField).toHaveAttribute("aria-invalid", "true")
    expect(screen.getByLabelText("Private E-Mail (Login)")).toHaveAttribute(
      "aria-invalid",
      "false"
    )
  })
})
