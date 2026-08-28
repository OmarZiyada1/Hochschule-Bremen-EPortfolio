import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it } from "vitest"

import SupportPage from "@/features/support/SupportPage"
import i18n from "@/i18n"
import { apiErrorResponse } from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { signInAs } from "@/tests/routes/helpers"

/**
 * Das oeffentliche Kontaktformular (§6.1 Abschnitt „Support", §3.20;
 * KAN-85).
 *
 * <p><strong>Die Faelle „ohne Serveranfrage" belegen sich selbst.</strong> Der
 * Testlauf faengt jeden Request ab und behandelt einen ohne angemeldeten
 * Handler als Fehler ({@code onUnhandledRequest: "error"} in setup.ts). Ein
 * Test, der keinen POST-Handler anmeldet und trotzdem gruen bleibt, hat damit
 * bewiesen, dass nichts gesendet wurde.
 */
describe("SupportPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
  })

  async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText("Name"), "Lena Brandt")
    await user.type(
      screen.getByLabelText("E-Mail-Adresse"),
      "lena.brandt@example.org"
    )
    await user.type(screen.getByLabelText("Betreff"), "Anmeldung schlaegt fehl")
    await user.type(
      screen.getByLabelText("Beschreibung"),
      "Seit gestern komme ich mit meiner HSB-Kennung nicht mehr hinein."
    )
  }

  it("meldet leere Pflichtfelder ueber zod, ohne den Server zu fragen", async () => {
    const user = userEvent.setup()
    renderWithProviders(<SupportPage />, "/support")

    await user.click(screen.getByRole("button", { name: "Anfrage senden" }))

    expect(
      await screen.findByText("Bitte geben Sie Ihren Namen ein.")
    ).toBeInTheDocument()
    expect(
      screen.getByText("Bitte geben Sie eine E-Mail-Adresse ein.")
    ).toBeInTheDocument()
    expect(
      screen.getByText("Bitte geben Sie einen Betreff ein.")
    ).toBeInTheDocument()
    expect(
      screen.getByText("Bitte beschreiben Sie Ihr Anliegen.")
    ).toBeInTheDocument()
  })

  it("beanstandet eine unbrauchbare Adresse, ohne den Server zu fragen", async () => {
    const user = userEvent.setup()
    renderWithProviders(<SupportPage />, "/support")

    await fillValidForm(user)
    await user.clear(screen.getByLabelText("E-Mail-Adresse"))
    await user.type(screen.getByLabelText("E-Mail-Adresse"), "keine-adresse")
    await user.click(screen.getByRole("button", { name: "Anfrage senden" }))

    expect(
      await screen.findByText(
        "Bitte geben Sie eine gültige E-Mail-Adresse ein."
      )
    ).toBeInTheDocument()
  })

  it("sendet ohne Token und ersetzt das Formular durch die Bestaetigung", async () => {
    const bodies: unknown[] = []
    server.use(
      http.post("*/api/support", async ({ request }) => {
        bodies.push(await request.json())
        return new HttpResponse(null, { status: 201 })
      })
    )

    const user = userEvent.setup()
    renderWithProviders(<SupportPage />, "/support")

    await fillValidForm(user)
    await user.click(screen.getByRole("button", { name: "Anfrage senden" }))

    expect(await screen.findByText("Anfrage gesendet")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Anfrage senden" })
    ).not.toBeInTheDocument()

    /*
     * Der Koerper traegt genau die sechs Felder aus §6.1, das versteckte
     * website darunter und leer: ein Formular, das es weglaesst, waere fuer
     * ein Programm daran erkennbar (Abschnitt „Support" in §6.1).
     */
    expect(bodies).toHaveLength(1)
    expect(bodies[0]).toEqual({
      name: "Lena Brandt",
      email: "lena.brandt@example.org",
      category: "TECHNICAL_ISSUE",
      subject: "Anmeldung schlaegt fehl",
      message:
        "Seit gestern komme ich mit meiner HSB-Kennung nicht mehr hinein.",
      website: "",
    })
  })

  it("zeigt 429 als Meldung ueber dem Formular und nicht an einem Feld", async () => {
    server.use(
      http.post("*/api/support", () =>
        apiErrorResponse(
          429,
          "TOO_MANY_SUPPORT_REQUESTS",
          "/api/support",
          "Zu viele Anfragen."
        )
      )
    )

    const user = userEvent.setup()
    renderWithProviders(<SupportPage />, "/support")

    await fillValidForm(user)
    await user.click(screen.getByRole("button", { name: "Anfrage senden" }))

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(
      "Es sind zu viele Anfragen in kurzer Zeit eingegangen."
    )
    /* Das Formular bleibt stehen: die Person soll es spaeter erneut
       absenden koennen, ohne alles neu zu tippen. */
    expect(
      screen.getByRole("button", { name: "Anfrage senden" })
    ).toBeInTheDocument()
    expect(screen.queryByText("Anfrage gesendet")).not.toBeInTheDocument()
  })

  it("haengt ein 400 VALIDATION_FAILED an das benannte Feld", async () => {
    server.use(
      http.post("*/api/support", () =>
        apiErrorResponse(
          400,
          "VALIDATION_FAILED",
          "/api/support",
          "subject: Der Betreff muss 3 bis 160 Zeichen lang sein."
        )
      )
    )

    const user = userEvent.setup()
    renderWithProviders(<SupportPage />, "/support")

    await fillValidForm(user)
    await user.click(screen.getByRole("button", { name: "Anfrage senden" }))

    expect(
      await screen.findByText("Der Betreff muss 3 bis 160 Zeichen lang sein.")
    ).toBeInTheDocument()
  })

  /**
   * §3.20: Fuer angemeldete Konten sind Name und Adresse vorbelegt, bleiben
   * aber aenderbar. Wer die Anmeldung mit der eigenen Adresse gerade nicht
   * schafft, muss eine erreichbare zweite nennen koennen.
   */
  it("belegt Name und Adresse fuer angemeldete Konten vor und laesst sie aenderbar", async () => {
    signInAs("STUDENT")
    const bodies: unknown[] = []
    server.use(
      http.post("*/api/support", async ({ request }) => {
        bodies.push(await request.json())
        return new HttpResponse(null, { status: 201 })
      })
    )

    const user = userEvent.setup()
    renderWithProviders(<SupportPage />, "/support")

    const email =
      await screen.findByLabelText<HTMLInputElement>("E-Mail-Adresse")
    await waitFor(() => expect(email).toHaveValue("mira.beispiel@example.org"))
    expect(screen.getByLabelText("Name")).toHaveValue("Mira Beispiel")

    await user.clear(email)
    await user.type(email, "andere@example.org")
    await user.type(screen.getByLabelText("Betreff"), "Komme nicht hinein")
    await user.type(
      screen.getByLabelText("Beschreibung"),
      "Die Anmeldung mit meiner Adresse schlaegt fehl."
    )
    await user.click(screen.getByRole("button", { name: "Anfrage senden" }))

    await screen.findByText("Anfrage gesendet")
    expect(bodies[0]).toMatchObject({ email: "andere@example.org" })
  })

  /**
   * Das versteckte Feld ist eine Falle und kein Feld (§6.1): fuer Menschen
   * unsichtbar, aus der Tastaturreihenfolge heraus und im
   * Zugaenglichkeitsbaum nicht vorhanden. Ein {@code sr-only} waere hier
   * falsch, es liesse das Feld fuer Screenreader ausdruecklich stehen.
   */
  it("haelt das Honeypot-Feld aus Tastatur und Zugaenglichkeitsbaum heraus", () => {
    const { container } = renderWithProviders(<SupportPage />, "/support")

    const honeypot =
      container.querySelector<HTMLInputElement>("#support-website")
    expect(honeypot).not.toBeNull()
    expect(honeypot).toHaveAttribute("tabindex", "-1")
    expect(honeypot).toHaveAttribute("autocomplete", "off")
    expect(honeypot?.closest("[aria-hidden='true']")).not.toBeNull()
    /* Rollenabfragen folgen dem Zugaenglichkeitsbaum: was unter
       aria-hidden liegt, kommt darin nicht vor. Genau das ist die
       Zusage, die hier gilt. */
    expect(
      screen.queryByRole("textbox", { name: "Dieses Feld bitte leer lassen" })
    ).not.toBeInTheDocument()
  })

  it("zaehlt die Zeichen der Beschreibung und verbindet den Zaehler mit dem Feld", async () => {
    const user = userEvent.setup()
    renderWithProviders(<SupportPage />, "/support")

    const message = screen.getByLabelText("Beschreibung")
    expect(message).toHaveAttribute(
      "aria-describedby",
      expect.stringContaining("support-message-counter")
    )

    await user.type(message, "Hallo")
    expect(screen.getByText("Noch 1995 Zeichen")).toBeInTheDocument()
  })
})
