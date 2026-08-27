import { HttpResponse, http } from "msw"
import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"

import { RESEND_COOLDOWN_SECONDS } from "@/features/auth/hooks/useResendCountdown"
import i18n from "@/i18n"
import {
  apiErrorResponse,
  currentUserHandler,
  ownPortfolioHandler,
} from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { AppUnderTest, LocationProbe, signInAs } from "@/tests/routes/helpers"

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
    /* Die Seite frischt ihre Sitzung beim Betreten auf (KAN-69). Der
       Handler steht als erster; die Tests, die eine eigene Antwort auf
       GET /auth/me brauchen, melden ihre danach an und gewinnen damit. */
    server.use(currentUserHandler())
  })

  it("fuellt das Formular aus beiden Quellen und zeigt die eigene HSB-Adresse", async () => {
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
    /* §3.1 (seit v50, KAN-69): die eigene HSB-Adresse steht in den
       Auth-Antworten an die Person selbst und damit sichtbar, aber nicht
       aenderbar, in diesem Feld. */
    const hsbField = screen.getByLabelText("HS-E-Mail · nicht bearbeitbar")
    expect(hsbField).toHaveValue("mira.beispiel@stud.hs-bremen.de")
    expect(hsbField).toBeDisabled()
  })

  it("fuehrt im Breadcrumb ueber Mein Portfolio, ohne eigenen Zurueck-Link", async () => {
    /* KAN-69: die Seite liegt unter /my-portfolio, der Breadcrumb traegt
       den Weg; der fruehere Link "Zurueck zum Portfolio" ist entfallen. */
    server.use(ownPortfolioHandler())
    await renderProfile()

    /* Im Seitenpfad, nicht in der Kopfleiste: dort steht derselbe Text als
       Navigationspunkt. */
    const breadcrumb = screen.getByRole("navigation", { name: "Seitenpfad" })
    const crumb = within(breadcrumb).getByRole("link", {
      name: "Mein Portfolio",
    })
    expect(crumb).toHaveAttribute("href", "/my-portfolio")
    expect(
      screen.queryByRole("link", { name: "Zurück zum Portfolio" })
    ).not.toBeInTheDocument()
  })

  it("kommt mit einem Konto ohne Portfolio-Zeile ohne Fehler aus", async () => {
    /* §3.2.1: 200 mit leeren Feldern, kein 404. */
    server.use(ownPortfolioHandler({}))
    await renderProfile()

    expect(screen.getByLabelText("Bio")).toHaveValue("")
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("blendet das Passwortfeld erst ein, wenn die Adresse geaendert wurde", async () => {
    /* Gemeint ist das Feld des Profilformulars (#currentPassword); der
       Bereich "Passwort aendern" darunter traegt dasselbe Label an seinem
       eigenen Feld (#profile-currentPassword) und steht immer da. */
    server.use(ownPortfolioHandler())
    await renderProfile()

    expect(
      screen.queryByLabelText("Aktuelles Passwort", {
        selector: "#currentPassword",
      })
    ).not.toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText("Private E-Mail"))
    await userEvent.type(screen.getByLabelText("Private E-Mail"), NEW_EMAIL)

    expect(
      await screen.findByLabelText("Aktuelles Passwort", {
        selector: "#currentPassword",
      })
    ).toBeVisible()
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

  it("zeigt die Restzeichenzahl der Bio und beanstandet 501 Zeichen vor dem Request", async () => {
    /*
     * KAN-79, Contract v75 (§3.2): die Bio fasst 500 Zeichen. Weiches Limit
     * mit Zähler statt hartem maxLength, damit sichtbar ist, wie viel zu
     * viel ist (SC 3.3.1). Der eingegebene Text bleibt deshalb ungekürzt
     * im Feld stehen, und es geht kein Request raus.
     */
    let portfolioCalls = 0
    server.use(
      ownPortfolioHandler(),
      http.put("*/api/auth/me", () => HttpResponse.json(userResponse())),
      http.put("*/api/portfolio/me", () => {
        portfolioCalls += 1
        return HttpResponse.json({ biography: null, avatarUrl: null })
      }),
      http.get("*/api/auth/me", () => HttpResponse.json(userResponse()))
    )
    await renderProfile()

    const bio = screen.getByLabelText("Bio")
    /* Der Zähler hängt über aria-describedby am Feld; die zugängliche
       Beschreibung belegt Text und Verdrahtung in einem. getByText schiede
       aus, weil CharacterCounter denselben Text an der Ansageschwelle ein
       zweites Mal in seine Live-Region schreibt. */
    expect(bio).toHaveAccessibleDescription("Noch 500 Zeichen")

    /* Eingefügt statt getippt: 501 Tastendrücke wären derselbe Fall in
       langsam, und genau das Einfügen ist der Weg, auf dem ein zu langer
       Text ins Feld gerät. */
    const tooLong = "x".repeat(501)
    await userEvent.click(bio)
    await userEvent.paste(tooLong)

    expect(bio).toHaveValue(tooLong)
    expect(bio).toHaveAccessibleDescription("1 Zeichen zu viel")

    await userEvent.click(
      screen.getByRole("button", { name: "Änderungen speichern" })
    )

    expect(
      await screen.findByText("Die Bio darf höchstens 500 Zeichen lang sein.")
    ).toBeVisible()
    /* Ungekürzt stehen geblieben, nicht stillschweigend auf 500 gekappt. */
    expect(bio).toHaveValue(tooLong)
    expect(portfolioCalls).toBe(0)
  })

  it("laesst genau 500 Zeichen durch", async () => {
    /* Der Grenzfall gehört dazu: das Schema prüft max, nicht "kleiner
       als", und ein Off-by-one fällt sonst erst am 400 des Servers auf. */
    const atLimit = "x".repeat(500)
    const portfolio: { body?: unknown } = {}
    server.use(
      ownPortfolioHandler(),
      http.put("*/api/auth/me", () => HttpResponse.json(userResponse())),
      portfolioPutHandler(portfolio),
      http.get("*/api/auth/me", () => HttpResponse.json(userResponse()))
    )
    await renderProfile()

    const bio = screen.getByLabelText("Bio")
    await userEvent.click(bio)
    await userEvent.paste(atLimit)
    expect(bio).toHaveAccessibleDescription("Noch 0 Zeichen")

    await userEvent.click(
      screen.getByRole("button", { name: "Änderungen speichern" })
    )

    expect(
      await screen.findByText("Profil und Portfolio wurden gespeichert.")
    ).toBeVisible()
    expect(portfolio.body).toMatchObject({ biography: atLimit })
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
      await screen.findByLabelText("Aktuelles Passwort", {
        selector: "#currentPassword",
      }),
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
      screen.getByText(
        "Bio und Bild wurden gespeichert, Name und E-Mail nicht."
      )
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
      await screen.findByLabelText("Aktuelles Passwort", {
        selector: "#currentPassword",
      }),
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
      await screen.findByLabelText("Aktuelles Passwort", {
        selector: "#currentPassword",
      }),
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
      http.put("*/api/auth/me", () =>
        HttpResponse.json(userResponse(NEW_EMAIL))
      ),
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
      await screen.findByLabelText("Aktuelles Passwort", {
        selector: "#currentPassword",
      }),
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
    await userEvent.click(
      screen.getByRole("button", { name: "Code bestätigen" })
    )

    await waitFor(() =>
      expect(screen.getByLabelText("Private E-Mail")).toHaveValue(NEW_EMAIL)
    )
    expect(verifiedWith).toMatchObject({
      email: NEW_EMAIL,
      purpose: "EMAIL_CHANGE",
      code: "042317",
    })

    /*
     * Der gemeldete Fehler aus KAN-83: nach dem Einloesen blieb das Feld
     * „Aktuelles Passwort" stehen, und „Änderungen speichern" tat nichts
     * mehr. Ursache war der Cache-Eintrag von GET /auth/me, den niemand
     * invalidierte: das Formular hielt die alte Adresse weiter fuer die
     * aktuelle, verlangte deshalb erneut ein Passwort und scheiterte an
     * einem Feld, das gar nicht mehr sichtbar war.
     */
    await waitFor(() =>
      expect(
        screen.queryByLabelText("Aktuelles Passwort", {
          selector: "#currentPassword",
        })
      ).toBeNull()
    )
    expect(screen.queryByText(/Bestätigung ausstehend/)).not.toBeInTheDocument()
  })

  it("nimmt einen laufenden Wechsel nicht mehr nebenbei zurueck", async () => {
    /*
     * Bis KAN-83 schickte jedes gewoehnliche Speichern die aktuelle Adresse
     * mit, und das ist laut §6.1 der Weg zurueck: wer waehrend der
     * Wartezeit einen Tippfehler im Vornamen korrigierte, verlor unbemerkt
     * den Wechsel und den bereits verschickten Code. Der Weg zurueck steht
     * seither als eigene Schaltflaeche im Hinweis.
     */
    let sentBody: Record<string, unknown> | null = null
    server.use(
      ownPortfolioHandler(),
      http.get("*/api/auth/me", () =>
        HttpResponse.json(userResponse(NEW_EMAIL))
      ),
      http.put("*/api/auth/me", async ({ request }) => {
        sentBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(userResponse(NEW_EMAIL))
      }),
      http.put("*/api/portfolio/me", () =>
        HttpResponse.json({ biography: null, avatarUrl: null })
      )
    )
    await renderProfile()

    /* Nur der Vorname aendert sich; die Adresse bleibt unberuehrt. */
    await userEvent.clear(screen.getByLabelText("Vorname"))
    await userEvent.type(screen.getByLabelText("Vorname"), "Mirjam")
    await userEvent.click(
      screen.getByRole("button", { name: "Änderungen speichern" })
    )

    await waitFor(() => expect(sentBody).not.toBeNull())
    expect(sentBody).not.toHaveProperty("email")
    expect(sentBody).toMatchObject({ firstName: "Mirjam" })
  })

  it("bietet den Weg zurueck als eigene Schaltflaeche an", async () => {
    let sentBody: Record<string, unknown> | null = null
    server.use(
      ownPortfolioHandler(),
      http.get("*/api/auth/me", () =>
        HttpResponse.json(userResponse(NEW_EMAIL))
      ),
      http.put("*/api/auth/me", async ({ request }) => {
        sentBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(userResponse(null))
      }),
      http.put("*/api/portfolio/me", () =>
        HttpResponse.json({ biography: null, avatarUrl: null })
      )
    )
    await renderProfile()

    await userEvent.click(
      await screen.findByRole("button", { name: "Wechsel abbrechen" })
    )

    /* §6.1: die aktuelle Adresse zu senden nimmt den Wechsel zurueck. Ein
       Passwort braucht es dafuer nicht, die Adresse aendert sich ja
       nicht. */
    await waitFor(() => expect(sentBody).not.toBeNull())
    expect(sentBody).toMatchObject({ email: CURRENT_EMAIL })
    expect(sentBody).not.toHaveProperty("currentPassword")
  })

  it(
    "fordert einen neuen Code fuer die Wunschadresse an",
    async () => {
      let resendBody: Record<string, unknown> | null = null
      server.use(
        ownPortfolioHandler(),
        http.get("*/api/auth/me", () =>
          HttpResponse.json(userResponse(NEW_EMAIL))
        ),
        http.put("*/api/auth/me", () =>
          HttpResponse.json(userResponse(NEW_EMAIL))
        ),
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
        await screen.findByLabelText("Aktuelles Passwort", {
          selector: "#currentPassword",
        }),
        "richtigesPasswort"
      )
      await userEvent.click(
        screen.getByRole("button", { name: "Änderungen speichern" })
      )
      await screen.findByLabelText("Bestätigungscode")

      /* Bis zum Ablauf der Sperrfrist steht dort der Countdown, nicht der
       Knopf (useResendCountdown, 20 Sekunden nach Template). Geprueft wird
       die laufende Zahl und nicht die 20: unter Last vergeht zwischen dem
       Einhaengen und dieser Zeile schon eine Sekunde, und der Test schlug
       dann grundlos fehl. */
      expect(screen.getByText(/Code erneut senden in \d+s/)).toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: "Code erneut senden" })
      ).not.toBeInTheDocument()

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
    },
    (RESEND_COOLDOWN_SECONDS + 20) * 1000
  )

  /**
   * Der Bereich "Passwort aendern" (KAN-69, ueberarbeitet nach der
   * Sichtpruefung): ein Knopf oeffnet den Dialog mit den drei Feldern; der
   * Weg "Passwort vergessen" fordert fuer Angemeldete den Code selbst an
   * und fuehrt direkt zur Code-Eingabe.
   */
  async function openPasswordDialog() {
    await userEvent.click(
      screen.getByRole("button", { name: "Passwort ändern" })
    )
    return screen.findByRole("dialog")
  }

  async function fillPasswordDialog(currentPassword: string) {
    await userEvent.type(
      screen.getByLabelText("Aktuelles Passwort", {
        selector: "#profile-currentPassword",
      }),
      currentPassword
    )
    await userEvent.type(
      screen.getByLabelText("Neues Passwort"),
      "korrekt-pferd-batterie"
    )
    await userEvent.type(
      screen.getByLabelText("Neues Passwort bestätigen"),
      "korrekt-pferd-batterie"
    )
    await userEvent.click(
      screen.getByRole("button", { name: "Passwort speichern" })
    )
  }

  it("aendert das Passwort im Dialog, ohne Code und ohne Seitenwechsel", async () => {
    let changeBody: Record<string, unknown> | null = null
    server.use(
      ownPortfolioHandler(),
      http.put("*/api/auth/password", async ({ request }) => {
        changeBody = (await request.json()) as Record<string, unknown>
        return new HttpResponse(null, { status: 200 })
      })
    )
    await renderProfile()

    /* Ohne Klick auf den Knopf stehen die drei Felder nicht auf der Seite. */
    expect(screen.queryByLabelText("Neues Passwort")).not.toBeInTheDocument()

    await openPasswordDialog()
    await fillPasswordDialog("altesPasswort123")

    expect(
      await screen.findByText("Ihr Passwort wurde geändert.")
    ).toBeVisible()
    expect(changeBody).toMatchObject({
      currentPassword: "altesPasswort123",
      newPassword: "korrekt-pferd-batterie",
    })
    /* Der Dialog ist zu, die Profilseite steht weiter da. */
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(
      screen.getByRole("heading", { level: 1, name: "Profil bearbeiten" })
    ).toBeVisible()
  })

  it("legt ein falsches aktuelles Passwort an sein Feld (401 LOGIN_FAILED)", async () => {
    server.use(
      ownPortfolioHandler(),
      http.put("*/api/auth/password", () =>
        apiErrorResponse(401, "LOGIN_FAILED", "/api/auth/password")
      )
    )
    await renderProfile()

    await openPasswordDialog()
    await fillPasswordDialog("falschesPasswort")

    expect(
      await screen.findByText("Das aktuelle Passwort ist falsch.")
    ).toBeVisible()
    /* Der Dialog bleibt offen, damit die Meldung sichtbar ist. */
    expect(screen.getByRole("dialog")).toBeVisible()
  })

  it("beanstandet fehlende Passworteingaben, bevor ein Request rausgeht", async () => {
    /* Frontend-Regel 12: die Pflicht steht im zod-Schema. */
    let calls = 0
    server.use(
      ownPortfolioHandler(),
      http.put("*/api/auth/password", () => {
        calls += 1
        return new HttpResponse(null, { status: 200 })
      })
    )
    await renderProfile()

    await openPasswordDialog()
    await userEvent.click(
      screen.getByRole("button", { name: "Passwort speichern" })
    )

    /* Zweimal dieselbe Meldung: am aktuellen und am neuen Passwort. */
    expect(
      await screen.findAllByText("Bitte geben Sie Ihr Passwort ein.")
    ).toHaveLength(2)
    expect(calls).toBe(0)
  })

  it("fordert bei Passwort vergessen den Code selbst an und fuehrt zur Code-Eingabe", async () => {
    /* Sichtpruefung zu KAN-69: die Adresse ist bekannt, also entfaellt die
       Seite zur Adresseingabe. */
    let forgotBody: Record<string, unknown> | null = null
    server.use(
      ownPortfolioHandler(),
      http.post("*/api/auth/forgot-password", async ({ request }) => {
        forgotBody = (await request.json()) as Record<string, unknown>
        return new HttpResponse(null, { status: 204 })
      })
    )
    signInAs("STUDENT")
    renderWithProviders(
      <>
        <AppUnderTest />
        <LocationProbe />
      </>,
      "/my-portfolio/profile"
    )
    await screen.findByRole("heading", { level: 1, name: "Profil bearbeiten" })

    await openPasswordDialog()
    await userEvent.click(
      screen.getByRole("button", { name: "Passwort vergessen?" })
    )

    await waitFor(() =>
      expect(screen.getByTestId("pathname")).toHaveTextContent(
        "/reset-password"
      )
    )
    expect(forgotBody).toMatchObject({ email: CURRENT_EMAIL })
    /* Die Adresse steht dort bereits im Feld, und der Hinweis sagt, dass
       der Code unterwegs ist. */
    expect(screen.getByLabelText("Private E-Mail (Login)")).toHaveValue(
      CURRENT_EMAIL
    )
    expect(
      screen.getByText(
        `Wir haben einen 6-stelligen Code an ${CURRENT_EMAIL} gesendet. Geben Sie ihn hier zusammen mit Ihrem neuen Passwort ein.`
      )
    ).toBeVisible()
  })

  it("fragt vor dem Verlassen nach, wenn das Profilformular veraendert wurde", async () => {
    /* Skill frontend-design, Abschnitt 5: der Weg verlaesst die Seite und
       wuerde ungespeicherte Eingaben verwerfen. */
    let forgotCalls = 0
    server.use(
      ownPortfolioHandler(),
      http.post("*/api/auth/forgot-password", () => {
        forgotCalls += 1
        return new HttpResponse(null, { status: 204 })
      })
    )
    signInAs("STUDENT")
    renderWithProviders(
      <>
        <AppUnderTest />
        <LocationProbe />
      </>,
      "/my-portfolio/profile"
    )
    await screen.findByRole("heading", { level: 1, name: "Profil bearbeiten" })

    await userEvent.clear(screen.getByLabelText("Vorname"))
    await userEvent.type(screen.getByLabelText("Vorname"), "Mirjam")

    await openPasswordDialog()
    await userEvent.click(
      screen.getByRole("button", { name: "Passwort vergessen?" })
    )

    /* Erst die Rueckfrage, noch kein Code und keine Navigation. */
    expect(
      await screen.findByRole("heading", { name: "Profilseite verlassen?" })
    ).toBeVisible()
    expect(forgotCalls).toBe(0)
    expect(screen.getByTestId("pathname")).toHaveTextContent(
      "/my-portfolio/profile"
    )

    await userEvent.click(
      screen.getByRole("button", { name: "Code senden und weiter" })
    )

    await waitFor(() =>
      expect(screen.getByTestId("pathname")).toHaveTextContent(
        "/reset-password"
      )
    )
    expect(forgotCalls).toBe(1)
  })

  it("laesst den Passwortdialog stehen, wenn die Rueckfrage abgebrochen wird", async () => {
    /* Skill frontend-design, Abschnitt 5: ein Abbruch nimmt nichts vorweg. */
    let forgotCalls = 0
    server.use(
      ownPortfolioHandler(),
      http.post("*/api/auth/forgot-password", () => {
        forgotCalls += 1
        return new HttpResponse(null, { status: 204 })
      })
    )
    await renderProfile()

    await userEvent.clear(screen.getByLabelText("Vorname"))
    await userEvent.type(screen.getByLabelText("Vorname"), "Mirjam")
    await openPasswordDialog()
    await userEvent.click(
      screen.getByRole("button", { name: "Passwort vergessen?" })
    )
    await screen.findByRole("heading", { name: "Profilseite verlassen?" })

    await userEvent.click(screen.getByRole("button", { name: "Abbrechen" }))

    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Profilseite verlassen?" })
      ).not.toBeInTheDocument()
    )
    expect(forgotCalls).toBe(0)
    /* Der Passwortdialog steht weiter offen, samt getippter Eingaben. */
    expect(
      screen.getByRole("heading", { name: "Neues Passwort vergeben" })
    ).toBeVisible()
    expect(screen.getByLabelText("Vorname")).toHaveValue("Mirjam")
  })

  it("meldet einen gescheiterten Codeversand sichtbar, statt still zu bleiben", async () => {
    /* Der Dialog bleibt offen, wenn der Aufruf scheitert: sonst laege die
       Meldung in einem Knoten, der mit ihm verschwindet (Befund aus dem
       Review zu KAN-69). */
    server.use(
      ownPortfolioHandler(),
      http.post("*/api/auth/forgot-password", () =>
        apiErrorResponse(
          429,
          "TOO_MANY_LOGIN_ATTEMPTS",
          "/api/auth/forgot-password"
        )
      )
    )
    await renderProfile()

    await userEvent.clear(screen.getByLabelText("Vorname"))
    await userEvent.type(screen.getByLabelText("Vorname"), "Mirjam")
    await openPasswordDialog()
    await userEvent.click(
      screen.getByRole("button", { name: "Passwort vergessen?" })
    )
    await screen.findByRole("heading", { name: "Profilseite verlassen?" })
    await userEvent.click(
      screen.getByRole("button", { name: "Code senden und weiter" })
    )

    expect(
      await screen.findByText(
        "Zu viele Fehlversuche. Bitte warten Sie einige Minuten und versuchen Sie es dann erneut."
      )
    ).toBeVisible()
  })

  it("fragt nach dem Speichern nicht mehr nach: das Formular ist dann unveraendert", async () => {
    /* Ohne form.reset bliebe isDirty fuer immer true und die Rueckfrage
       kaeme ohne Anlass (Befund aus dem Review zu KAN-69). */
    let forgotCalls = 0
    const portfolio: { body?: unknown } = {}
    server.use(
      ownPortfolioHandler(),
      http.put("*/api/auth/me", () => HttpResponse.json(userResponse())),
      portfolioPutHandler(portfolio),
      http.get("*/api/auth/me", () => HttpResponse.json(userResponse())),
      http.post("*/api/auth/forgot-password", () => {
        forgotCalls += 1
        return new HttpResponse(null, { status: 204 })
      })
    )
    signInAs("STUDENT")
    renderWithProviders(
      <>
        <AppUnderTest />
        <LocationProbe />
      </>,
      "/my-portfolio/profile"
    )
    await screen.findByRole("heading", { level: 1, name: "Profil bearbeiten" })

    await userEvent.clear(screen.getByLabelText("Vorname"))
    await userEvent.type(screen.getByLabelText("Vorname"), "Mirjam")
    await userEvent.click(
      screen.getByRole("button", { name: "Änderungen speichern" })
    )
    await screen.findByText("Profil und Portfolio wurden gespeichert.")

    await openPasswordDialog()
    await userEvent.click(
      screen.getByRole("button", { name: "Passwort vergessen?" })
    )

    /* Keine Rueckfrage, direkt der Codeversand und der Wechsel. */
    await waitFor(() =>
      expect(screen.getByTestId("pathname")).toHaveTextContent(
        "/reset-password"
      )
    )
    expect(forgotCalls).toBe(1)
  })

  it("fuehrt ohne Anmeldung sichtbar zum Login", () => {
    renderWithProviders(<AppUnderTest />, "/my-portfolio/profile")

    expect(
      screen.getByRole("heading", { level: 1, name: "Anmelden" })
    ).toBeInTheDocument()
  })
})
