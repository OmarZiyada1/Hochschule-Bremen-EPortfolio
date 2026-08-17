import { HttpResponse, http } from "msw"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"

import { RESEND_COOLDOWN_SECONDS } from "@/features/auth/hooks/useResendCountdown"
import i18n from "@/i18n"
import { apiErrorResponse, ownPortfolioHandler } from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { AppUnderTest, signInAs } from "@/tests/routes/helpers"

const CURRENT_EMAIL = "mira.beispiel@example.org"
const NEW_EMAIL = "mira.neu@example.org"

/** Die Antwort von GET und PUT /auth/me, mit optionalem laufendem Wechsel. */
function userResponse(pendingEmail: string | null = null) {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    email: CURRENT_EMAIL,
    pendingEmail,
    firstName: "Mira",
    lastName: "Beispiel",
    role: "STUDENT",
    status: "ACTIVE",
  }
}

/** Ein erfolgreiches PUT /portfolio/me, das den gesendeten Body festhaelt. */
function portfolioPutHandler(captured: { body?: unknown }) {
  return http.put("*/api/portfolio/me", async ({ request }) => {
    captured.body = await request.json()
    return HttpResponse.json({ biography: null, avatarUrl: null })
  })
}

async function renderProfile() {
  signInAs("STUDENT")
  renderWithProviders(<AppUnderTest />, "/my-portfolio/profile")
  await screen.findByRole("heading", { level: 1, name: "Profil bearbeiten" })
}

/**
 * "Profil bearbeiten" (KAN-34): ein Formular ueber zwei Endpoints (§6.1),
 * der E-Mail-Wechsel mit Passwortpflicht und Bestaetigungscode (KAN-60,
 * §3.1) und die bedingte zod-Regel aus Frontend-Regel 12.
 */
describe("ProfileEditPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
  })

  it("fuellt das Formular aus beiden Quellen und zeigt nie die HSB-Adresse", async () => {
    server.use(
      ownPortfolioHandler({ biography: "Informatik-Studentin an der HSB." })
    )
    await renderProfile()

    expect(screen.getByLabelText("Vorname")).toHaveValue("Mira")
    expect(screen.getByLabelText("Nachname")).toHaveValue("Beispiel")
    expect(screen.getByLabelText("Private E-Mail")).toHaveValue(CURRENT_EMAIL)
    expect(screen.getByLabelText("Bio")).toHaveValue(
      "Informatik-Studentin an der HSB."
    )
    /* §3.1: die HSB-Adresse verlaesst den Server nur ueber
       AdminUserResponse. Das Feld steht laut Template da, bleibt aber
       ohne Wert. */
    expect(
      screen.getByLabelText("HS-E-Mail · nicht bearbeitbar")
    ).toHaveValue("")
    expect(screen.queryByText(/hs-bremen\.de/)).not.toBeInTheDocument()
  })

  it("kommt mit einem Konto ohne Portfolio-Zeile ohne Fehler aus", async () => {
    /* §3.2.1: 200 mit leeren Feldern, kein 404. */
    server.use(ownPortfolioHandler({}))
    await renderProfile()

    expect(screen.getByLabelText("Bio")).toHaveValue("")
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("blendet das Passwortfeld erst ein, wenn die Adresse geaendert wurde", async () => {
    server.use(ownPortfolioHandler())
    await renderProfile()

    expect(
      screen.queryByLabelText("Aktuelles Passwort")
    ).not.toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText("Private E-Mail"))
    await userEvent.type(screen.getByLabelText("Private E-Mail"), NEW_EMAIL)

    expect(await screen.findByLabelText("Aktuelles Passwort")).toBeVisible()
  })

  it("beanstandet das Absenden mit geaenderter Adresse ohne Passwort", async () => {
    /* Die Bedingung steht im zod-Schema, nicht im Komponentencode
       (Frontend-Regel 12). Ohne Passwort geht gar kein Request raus. */
    let profileCalls = 0
    server.use(
      ownPortfolioHandler(),
      http.put("*/api/auth/me", () => {
        profileCalls += 1
        return HttpResponse.json(userResponse())
      })
    )
    await renderProfile()

    await userEvent.clear(screen.getByLabelText("Private E-Mail"))
    await userEvent.type(screen.getByLabelText("Private E-Mail"), NEW_EMAIL)
    await userEvent.click(
      screen.getByRole("button", { name: "Änderungen speichern" })
    )

    expect(
      await screen.findByText(
        "Bitte geben Sie Ihr aktuelles Passwort ein, um die E-Mail-Adresse zu ändern."
      )
    ).toBeVisible()
    expect(profileCalls).toBe(0)
  })

  it("speichert Name und Bio ueber die beiden zustaendigen Endpoints", async () => {
    /* §6.1: Name gehoert zum User, Bio zum Portfolio. Ein Formular, zwei
       Requests. Ohne Adressaenderung geht kein Passwort mit. */
    let profileBody: Record<string, unknown> | null = null
    const portfolio: { body?: unknown } = {}
    server.use(
      ownPortfolioHandler({ biography: "Alt" }),
      http.put("*/api/auth/me", async ({ request }) => {
        profileBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(userResponse())
      }),
      portfolioPutHandler(portfolio),
      http.get("*/api/auth/me", () => HttpResponse.json(userResponse()))
    )
    await renderProfile()

    await userEvent.clear(screen.getByLabelText("Vorname"))
    await userEvent.type(screen.getByLabelText("Vorname"), "Mirjam")
    await userEvent.clear(screen.getByLabelText("Bio"))
    await userEvent.type(screen.getByLabelText("Bio"), "Neu")
    await userEvent.click(
      screen.getByRole("button", { name: "Änderungen speichern" })
    )

    expect(
      await screen.findByText("Profil und Portfolio wurden gespeichert.")
    ).toBeVisible()
    expect(profileBody!.firstName).toBe("Mirjam")
    expect(profileBody!.email).toBeUndefined()
    expect(profileBody!.currentPassword).toBeUndefined()
    expect(portfolio.body).toMatchObject({ biography: "Neu" })
  })

  it("benennt einen Teilerfolg, statt ihn als Erfolg zu melden", async () => {
    /* DoD KAN-34: scheitert einer der beiden Requests, wird das sichtbar
       benannt. */
    server.use(
      ownPortfolioHandler(),
      http.put("*/api/auth/me", () => HttpResponse.json(userResponse())),
      http.put("*/api/portfolio/me", () =>
        apiErrorResponse(500, "INTERNAL_ERROR", "/api/portfolio/me")
      ),
      http.get("*/api/auth/me", () => HttpResponse.json(userResponse()))
    )
    await renderProfile()

    await userEvent.click(
      screen.getByRole("button", { name: "Änderungen speichern" })
    )

    expect(
      await screen.findByText(
        "Name und E-Mail wurden gespeichert, die Bio und das Bild nicht."
      )
    ).toBeVisible()
  })

  it("speichert die Dateireferenz des Avatars und keine Speicheradresse", async () => {
    /* §3.15.1: im Profil steht /api/files/{id}, nie ein Pfad im Speicher
       und nie Base64. */
    const portfolio: { body?: unknown } = {}
    server.use(
      ownPortfolioHandler(),
      http.post("*/api/files", () =>
        HttpResponse.json(
          {
            id: "aaaa0000-0000-4000-8000-000000000001",
            url: "/api/files/aaaa0000-0000-4000-8000-000000000001",
            mimeType: "image/png",
            size: 1024,
          },
          { status: 201 }
        )
      ),
      http.put("*/api/auth/me", () => HttpResponse.json(userResponse())),
      portfolioPutHandler(portfolio),
      http.get("*/api/auth/me", () => HttpResponse.json(userResponse()))
    )
    await renderProfile()

    await userEvent.upload(
      screen.getByLabelText("Foto ändern"),
      new File(["x"], "bild.png", { type: "image/png" })
    )
    await userEvent.click(
      screen.getByRole("button", { name: "Änderungen speichern" })
    )

    await waitFor(() =>
      expect(portfolio.body).toMatchObject({
        avatarUrl: "/api/files/aaaa0000-0000-4000-8000-000000000001",
      })
    )
  })

  it("legt ein falsches Passwort an sein Feld und meldet keinen Erfolg fuer den Namen", async () => {
    /* §6.1 (v40): der Endpoint uebernimmt alles oder nichts. Scheitert der
       Wechsel an 401, bleibt auch die Namensaenderung aus. */
    server.use(
      ownPortfolioHandler(),
      http.put("*/api/auth/me", () =>
        apiErrorResponse(401, "LOGIN_FAILED", "/api/auth/me")
      ),
      http.put("*/api/portfolio/me", () =>
        HttpResponse.json({ biography: null, avatarUrl: null })
      )
    )
    await renderProfile()

    await userEvent.clear(screen.getByLabelText("Vorname"))
    await userEvent.type(screen.getByLabelText("Vorname"), "Mirjam")
    await userEvent.clear(screen.getByLabelText("Private E-Mail"))
    await userEvent.type(screen.getByLabelText("Private E-Mail"), NEW_EMAIL)
    await userEvent.type(
      await screen.findByLabelText("Aktuelles Passwort"),
      "falschesPasswort"
    )
    await userEvent.click(
      screen.getByRole("button", { name: "Änderungen speichern" })
    )

    expect(
      await screen.findByText(
        "Das aktuelle Passwort ist falsch. Es wurde nichts geändert, auch nicht der Name."
      )
    ).toBeVisible()
    expect(
      screen.queryByText("Profil und Portfolio wurden gespeichert.")
    ).not.toBeInTheDocument()
    expect(
      screen.getByText("Bio und Bild wurden gespeichert, Name und E-Mail nicht.")
    ).toBeVisible()
  })

  it("legt eine vergebene Adresse an das E-Mail-Feld", async () => {
    server.use(
      ownPortfolioHandler(),
      http.put("*/api/auth/me", () =>
        apiErrorResponse(409, "RESOURCE_IN_USE", "/api/auth/me")
      ),
      http.put("*/api/portfolio/me", () =>
        HttpResponse.json({ biography: null, avatarUrl: null })
      )
    )
    await renderProfile()

    await userEvent.clear(screen.getByLabelText("Private E-Mail"))
    await userEvent.type(screen.getByLabelText("Private E-Mail"), NEW_EMAIL)
    await userEvent.type(
      await screen.findByLabelText("Aktuelles Passwort"),
      "richtigesPasswort"
    )
    await userEvent.click(
      screen.getByRole("button", { name: "Änderungen speichern" })
    )

    expect(
      await screen.findByText(
        "Diese E-Mail-Adresse ist bereits vergeben. Es wurde nichts geändert, auch nicht der Name."
      )
    ).toBeVisible()
  })

  it("meldet zu viele Versuche als Wartehinweis am Formular", async () => {
    server.use(
      ownPortfolioHandler(),
      http.put("*/api/auth/me", () =>
        apiErrorResponse(429, "TOO_MANY_LOGIN_ATTEMPTS", "/api/auth/me")
      ),
      http.put("*/api/portfolio/me", () =>
        HttpResponse.json({ biography: null, avatarUrl: null })
      )
    )
    await renderProfile()

    await userEvent.clear(screen.getByLabelText("Private E-Mail"))
    await userEvent.type(screen.getByLabelText("Private E-Mail"), NEW_EMAIL)
    await userEvent.type(
      await screen.findByLabelText("Aktuelles Passwort"),
      "richtigesPasswort"
    )
    await userEvent.click(
      screen.getByRole("button", { name: "Änderungen speichern" })
    )

    expect(
      await screen.findByText(
        "Zu viele Fehlversuche. Bitte warten Sie einige Minuten und versuchen Sie es dann erneut."
      )
    ).toBeVisible()
  })

  it("zeigt nach dem Speichern den laufenden Wechsel und loest ihn mit dem Code ein", async () => {
    /* §3.1: die Wunschadresse steht bis zur Bestaetigung nur in
       pendingEmail; das Feld zeigt weiter die alte. §6.1: eingeloest wird
       gegen die neue Adresse mit dem Zweck EMAIL_CHANGE. */
    let verifiedWith: Record<string, unknown> | null = null
    let confirmed = false
    server.use(
      ownPortfolioHandler(),
      http.put("*/api/auth/me", () => HttpResponse.json(userResponse(NEW_EMAIL))),
      http.put("*/api/portfolio/me", () =>
        HttpResponse.json({ biography: null, avatarUrl: null })
      ),
      http.get("*/api/auth/me", () =>
        HttpResponse.json(
          confirmed
            ? { ...userResponse(), email: NEW_EMAIL }
            : userResponse(NEW_EMAIL)
        )
      ),
      http.post("*/api/auth/verify", async ({ request }) => {
        verifiedWith = (await request.json()) as Record<string, unknown>
        confirmed = true
        return HttpResponse.json({
          emailVerified: true,
          hsbEmailVerified: true,
          status: "ACTIVE",
        })
      })
    )
    await renderProfile()

    await userEvent.clear(screen.getByLabelText("Private E-Mail"))
    await userEvent.type(screen.getByLabelText("Private E-Mail"), NEW_EMAIL)
    await userEvent.type(
      await screen.findByLabelText("Aktuelles Passwort"),
      "richtigesPasswort"
    )
    await userEvent.click(
      screen.getByRole("button", { name: "Änderungen speichern" })
    )

    expect(
      await screen.findByText(
        `Bestätigung ausstehend: Wir haben einen Code an ${NEW_EMAIL} gesendet. Bis zur Bestätigung melden Sie sich weiter mit Ihrer bisherigen Adresse an.`
      )
    ).toBeVisible()
    /* Bis zur Bestaetigung bleibt die alte Adresse die Kennung. */
    expect(screen.getByLabelText("Private E-Mail")).toHaveValue(CURRENT_EMAIL)

    await userEvent.type(screen.getByLabelText("Bestätigungscode"), "042317")
    await userEvent.click(screen.getByRole("button", { name: "Code bestätigen" }))

    await waitFor(() =>
      expect(screen.getByLabelText("Private E-Mail")).toHaveValue(NEW_EMAIL)
    )
    expect(verifiedWith).toMatchObject({
      email: NEW_EMAIL,
      purpose: "EMAIL_CHANGE",
      code: "042317",
    })
  })

  it("fordert einen neuen Code fuer die Wunschadresse an", async () => {
    let resendBody: Record<string, unknown> | null = null
    server.use(
      ownPortfolioHandler(),
      http.get("*/api/auth/me", () => HttpResponse.json(userResponse(NEW_EMAIL))),
      http.put("*/api/auth/me", () => HttpResponse.json(userResponse(NEW_EMAIL))),
      http.put("*/api/portfolio/me", () =>
        HttpResponse.json({ biography: null, avatarUrl: null })
      ),
      http.post("*/api/auth/verify/resend", async ({ request }) => {
        resendBody = (await request.json()) as Record<string, unknown>
        return new HttpResponse(null, { status: 204 })
      })
    )
    await renderProfile()

    await userEvent.clear(screen.getByLabelText("Private E-Mail"))
    await userEvent.type(screen.getByLabelText("Private E-Mail"), NEW_EMAIL)
    await userEvent.type(
      await screen.findByLabelText("Aktuelles Passwort"),
      "richtigesPasswort"
    )
    await userEvent.click(
      screen.getByRole("button", { name: "Änderungen speichern" })
    )
    await screen.findByLabelText("Bestätigungscode")

    /* Bis zum Ablauf der Sperrfrist steht dort der Countdown, nicht der
       Knopf (useResendCountdown, 20 Sekunden nach Template). */
    expect(screen.getByText("Code erneut senden in 20s")).toBeInTheDocument()

    /*
     * Die Frist wird real abgewartet, nicht mit gestellten Timern
     * uebersprungen: der Countdown plant seinen naechsten Takt in einem
     * Effekt, und Reacts Scheduler haengt selbst an Timern. Mit
     * vi.useFakeTimers laeuft deshalb weder der Takt weiter noch das
     * Rendern dazwischen, und MSW braucht die echte Zeitachse ohnehin.
     * Der Preis sind rund 20 Sekunden in genau diesem Test.
     */
    const resendButton = await screen.findByRole(
      "button",
      { name: "Code erneut senden" },
      { timeout: (RESEND_COOLDOWN_SECONDS + 5) * 1000 }
    )
    await userEvent.click(resendButton)

    await waitFor(() =>
      expect(resendBody).toMatchObject({
        email: NEW_EMAIL,
        purpose: "EMAIL_CHANGE",
      })
    )
  }, (RESEND_COOLDOWN_SECONDS + 20) * 1000)

  it("sendet den Ruecksetzcode an die eigene private Adresse", async () => {
    /* §6.1, KAN-43: der Code geht an die private Adresse und wird ueber
       /auth/reset-password eingeloest. Die Antwort ist immer 204. */
    let forgotBody: Record<string, unknown> | null = null
    server.use(
      ownPortfolioHandler(),
      http.post("*/api/auth/forgot-password", async ({ request }) => {
        forgotBody = (await request.json()) as Record<string, unknown>
        return new HttpResponse(null, { status: 204 })
      })
    )
    await renderProfile()

    await userEvent.click(screen.getByRole("button", { name: "Code senden" }))

    expect(
      await screen.findByText(
        "Wenn zu dieser Adresse ein aktives Konto existiert, wurde ein 6-stelliger Code dorthin gesendet."
      )
    ).toBeVisible()
    expect(forgotBody).toMatchObject({ email: CURRENT_EMAIL })
    /* Der Weg zur Code-Eingabe steht daneben, statt das Formular ohne
       Rueckfrage zu verlassen (Klaerungsrunde KAN-34). */
    expect(screen.getByRole("button", { name: "Code eingeben" })).toBeVisible()
  })

  it("fuehrt ohne Anmeldung sichtbar zum Login", () => {
    renderWithProviders(<AppUnderTest />, "/my-portfolio/profile")

    expect(
      screen.getByRole("heading", { level: 1, name: "Anmelden" })
    ).toBeInTheDocument()
  })
})
