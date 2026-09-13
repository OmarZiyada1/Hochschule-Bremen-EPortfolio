import { HttpResponse, delay, http } from "msw"
import { act, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { RESEND_COOLDOWN_SECONDS } from "@/features/auth/hooks/useResendCountdown"
import i18n from "@/i18n"
import { ownPortfolio } from "@/tests/fixtures"
import {
  apiErrorResponse,
  currentUserHandler,
  emptyProjectsHandler,
  ownPortfolioHandler,
} from "@/tests/msw/handlers"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"
import { AppUnderTest, LocationProbe, signInAs } from "@/tests/routes/helpers"

const CURRENT_EMAIL = "mira.beispiel@example.org"
const NEW_EMAIL = "mira.neu@example.org"

/** Ein gespeichertes Profilbild als Dateireferenz (§3.15.1). */
const AVATAR_URL = "/api/files/bbbb0000-0000-4000-8000-000000000001"

/** Der Titel des Dialogs zum laufenden Adresswechsel (KAN-105). */
const EMAIL_DIALOG = "Neue E-Mail-Adresse bestätigen"

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

/**
 * GET und PUT /portfolio/me mit gemeinsamem Stand: was gespeichert wurde,
 * liefert der naechste Abruf. PUT beschreibt den Zielzustand, ein
 * weggelassenes avatarUrl loescht den Wert (PortfolioUpdateRequest in
 * /v3/api-docs, Entscheidung zu KAN-22).
 */
function portfolioStore(avatarUrl: string | null) {
  const store = {
    avatarUrl,
    putBody: undefined as Record<string, unknown> | undefined,
    readsAfterPut: 0,
  }
  const handlers = [
    http.get("*/api/portfolio/me", () => {
      if (store.putBody !== undefined) {
        store.readsAfterPut += 1
      }
      return HttpResponse.json(ownPortfolio({ avatarUrl: store.avatarUrl }))
    }),
    http.put("*/api/portfolio/me", async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      store.putBody = body
      store.avatarUrl =
        typeof body.avatarUrl === "string" ? body.avatarUrl : null
      return HttpResponse.json(ownPortfolio({ avatarUrl: store.avatarUrl }))
    }),
  ]
  return { store, handlers }
}

/**
 * Ein Konto, dessen Adresswechsel die Handler mitfuehren (§3.1, §6.1):
 * PUT /auth/me mit neuer Adresse stoesst ihn an, mit der aktuellen nimmt es
 * ihn zurueck, POST /auth/verify loest ihn ein, und GET /auth/me antwortet
 * jeweils mit dem Stand danach. Mit einer festen Antwort zeigte die Seite
 * nach dem Bestaetigen weiter die Hinweiszeile, und der Test belegte einen
 * Zustand, den der Server nicht hat.
 */
function emailChangeAccount(initial: "none" | "pending" = "none") {
  const account = {
    phase: initial as "none" | "pending" | "confirmed",
    profileBodies: [] as Record<string, unknown>[],
    verifiedWith: null as Record<string, unknown> | null,
  }
  const response = () =>
    account.phase === "confirmed"
      ? { ...userResponse(), email: NEW_EMAIL }
      : userResponse(account.phase === "pending" ? NEW_EMAIL : null)
  const handlers = [
    http.get("*/api/auth/me", () => HttpResponse.json(response())),
    http.put("*/api/auth/me", async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      account.profileBodies.push(body)
      if (body.email === CURRENT_EMAIL) {
        account.phase = "none"
      } else if (typeof body.email === "string") {
        account.phase = "pending"
      }
      return HttpResponse.json(response())
    }),
    http.put("*/api/portfolio/me", () =>
      HttpResponse.json({ biography: null, avatarUrl: null })
    ),
    http.post("*/api/auth/verify", async ({ request }) => {
      account.verifiedWith = (await request.json()) as Record<string, unknown>
      account.phase = "confirmed"
      return HttpResponse.json({
        emailVerified: true,
        hsbEmailVerified: true,
        status: "ACTIVE",
      })
    }),
    emptyProjectsHandler(),
  ]
  return { account, handlers }
}

/*
 * jsdom laedt keine Bilder, und die Avatar-Primitive zeigt ein Bild erst,
 * wenn es geladen ist (Base UI, useImageLoadingStatus). Ohne Ersatz stuende
 * in jedem Test die Initialenflaeche, mit und ohne Bild, und "das Portfolio
 * zeigt die Initialen statt des Bildes" liesse sich nicht unterscheiden. Der
 * Ersatz meldet jedes Bild als bereits geladen und gilt nur in den Tests,
 * die ihn anfordern.
 */
function imagesLoadInstantly() {
  vi.stubGlobal(
    "Image",
    class {
      complete = true
      naturalWidth = 1
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      src = ""
      crossOrigin: string | null = null
    }
  )
}

async function renderProfile() {
  signInAs("STUDENT")
  renderWithProviders(
    <>
      <AppUnderTest />
      <LocationProbe />
    </>,
    "/my-portfolio/profile"
  )
  await screen.findByRole("heading", { level: 1, name: "Profil bearbeiten" })
}

/** Der Pfad, auf dem die Anwendung gerade steht. */
function currentPath() {
  return screen.getByTestId("pathname").textContent
}

/** Ein Toast in der Region "Benachrichtigungen" (KAN-105). */
async function findToast(title: string) {
  const region = await screen.findByRole("region", {
    name: "Benachrichtigungen",
  })
  return within(region).findByRole("dialog", { name: title })
}

function findEmailDialog() {
  return screen.findByRole("dialog", { name: EMAIL_DIALOG })
}

async function saveWithNewEmail() {
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
}

async function confirmCode(dialog: HTMLElement) {
  await userEvent.type(
    within(dialog).getByLabelText("Bestätigungscode"),
    "042317"
  )
  await userEvent.click(
    within(dialog).getByRole("button", { name: "Code bestätigen" })
  )
}

async function waitForEmailDialogClosed() {
  await waitFor(() =>
    expect(
      screen.queryByRole("dialog", { name: EMAIL_DIALOG })
    ).not.toBeInTheDocument()
  )
}

/**
 * "Profil bearbeiten" (KAN-34): ein Formular ueber zwei Endpoints (§6.1),
 * der E-Mail-Wechsel mit Passwortpflicht und Bestaetigungscode (KAN-60,
 * §3.1) und die bedingte zod-Regel aus Frontend-Regel 12. Seit KAN-105 dazu
 * Entfernen und Wiederherstellen des Profilbilds, die Weiterleitung ins
 * Portfolio nach dem Speichern und der Adresswechsel im Dialog.
 */
describe("ProfileEditPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
    /* Die Seite frischt ihre Sitzung beim Betreten auf (KAN-69). Der
       Handler steht als erster; die Tests, die eine eigene Antwort auf
       GET /auth/me brauchen, melden ihre danach an und gewinnen damit. */
    server.use(currentUserHandler())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
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

  it("speichert Name und Bio ueber die beiden zustaendigen Endpoints und fuehrt danach ins Portfolio", async () => {
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
      http.get("*/api/auth/me", () => HttpResponse.json(userResponse())),
      emptyProjectsHandler()
    )
    await renderProfile()

    await userEvent.clear(screen.getByLabelText("Vorname"))
    await userEvent.type(screen.getByLabelText("Vorname"), "Mirjam")
    await userEvent.clear(screen.getByLabelText("Bio"))
    await userEvent.type(screen.getByLabelText("Bio"), "Neu")
    await userEvent.click(
      screen.getByRole("button", { name: "Änderungen speichern" })
    )

    /* KAN-105: ohne offenen Adresswechsel ist das Speichern ein Abschluss.
       Die Seite entscheidet die Weiterleitung, und die Meldung steht im
       Toast, weil die Seite mit ihr verschwindet. */
    await waitFor(() => expect(currentPath()).toBe("/my-portfolio"))
    expect(
      await findToast("Profil und Portfolio wurden gespeichert.")
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
      http.get("*/api/auth/me", () => HttpResponse.json(userResponse())),
      emptyProjectsHandler()
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
      await findToast("Profil und Portfolio wurden gespeichert.")
    ).toBeVisible()
    expect(portfolio.body).toMatchObject({ biography: atLimit })
  })

  it("benennt einen Teilerfolg, statt ihn als Erfolg zu melden", async () => {
    /* DoD KAN-34: scheitert einer der beiden Requests, wird das sichtbar
       benannt. Seit KAN-105 bleibt die Seite dabei stehen: weitergeleitet
       wird nur nach vollstaendigem Speichern. */
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
    expect(currentPath()).toBe("/my-portfolio/profile")
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
      http.get("*/api/auth/me", () => HttpResponse.json(userResponse())),
      emptyProjectsHandler()
    )
    await renderProfile()

    /* Ohne Bild heisst der Dateiwaehler "waehlen" (KAN-105). */
    await userEvent.upload(
      screen.getByLabelText("Profilbild wählen"),
      new File(["x"], "bild.png", { type: "image/png" })
    )
    /* Nach dem Upload steht ein Bild im Feld, also heisst er "ersetzen". */
    expect(await screen.findByLabelText("Profilbild ersetzen")).toBeVisible()
    await userEvent.click(
      screen.getByRole("button", { name: "Änderungen speichern" })
    )

    await waitFor(() =>
      expect(portfolio.body).toMatchObject({
        avatarUrl: "/api/files/aaaa0000-0000-4000-8000-000000000001",
      })
    )
  })

  it("bietet ohne Bild weder Entfernen noch Wiederherstellen an", async () => {
    server.use(ownPortfolioHandler())
    await renderProfile()

    expect(screen.getByLabelText("Profilbild wählen")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Profilbild entfernen" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Profilbild wiederherstellen" })
    ).not.toBeInTheDocument()
  })

  it("entfernt das Profilbild ohne Rueckfrage; gespeichert zeigt das Portfolio die Initialen", async () => {
    /* KAN-105: geloescht wird nichts, das Feld wird geleert und erst mit
       dem Speichern wirksam. Weggelassenes avatarUrl loescht den Wert
       (PortfolioUpdateRequest in /v3/api-docs, Entscheidung zu KAN-22). */
    imagesLoadInstantly()
    const { store, handlers } = portfolioStore(AVATAR_URL)
    server.use(
      ...handlers,
      http.put("*/api/auth/me", () => HttpResponse.json(userResponse())),
      http.get("*/api/auth/me", () => HttpResponse.json(userResponse())),
      emptyProjectsHandler()
    )
    await renderProfile()

    expect(screen.getByLabelText("Profilbild ersetzen")).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole("button", { name: "Profilbild entfernen" })
    )

    /* Der geklickte Knopf ist fort; der Fokus steht auf dem Gegenknopf an
       derselben Stelle und faellt nicht an den Seitenanfang (SC 2.4.3). */
    expect(
      screen.getByRole("button", { name: "Profilbild wiederherstellen" })
    ).toHaveFocus()
    expect(
      screen.queryByRole("button", { name: "Profilbild entfernen" })
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText("Profilbild wählen")).toBeInTheDocument()
    /* Angesagt ueber die dauerhafte Statuszeile, und zwar erreichbar und
       nicht nur vorhanden (Skill frontend-shadcn, Abschnitt 6). */
    const notice = screen.getByText(
      "Profilbild entfernt. Die Änderung wird mit dem Speichern wirksam."
    )
    expect(notice).toHaveAttribute("role", "status")
    expect(notice.closest("[aria-hidden]")).toBeNull()

    await userEvent.click(
      screen.getByRole("button", { name: "Änderungen speichern" })
    )

    await waitFor(() => expect(currentPath()).toBe("/my-portfolio"))
    expect(store.putBody).not.toHaveProperty("avatarUrl")

    /* Die Portfolioseite zeigt den Stand nach dem Speichern: ihre
       Profilkarte fuehrt kein Bild mehr, sondern die Initialen. */
    const profileCard = (
      await screen.findByRole("heading", { level: 2, name: "Mira Beispiel" })
    ).closest("aside")!
    await waitFor(() => expect(store.readsAfterPut).toBeGreaterThan(0))
    await waitFor(() => expect(profileCard.querySelector("img")).toBeNull())
    expect(within(profileCard).getByText("MB")).toBeInTheDocument()
  })

  it("stellt ein entferntes Profilbild wieder her und speichert die alte Referenz", async () => {
    imagesLoadInstantly()
    const { store, handlers } = portfolioStore(AVATAR_URL)
    server.use(
      ...handlers,
      http.put("*/api/auth/me", () => HttpResponse.json(userResponse())),
      http.get("*/api/auth/me", () => HttpResponse.json(userResponse())),
      emptyProjectsHandler()
    )
    await renderProfile()

    await userEvent.click(
      screen.getByRole("button", { name: "Profilbild entfernen" })
    )
    await userEvent.click(
      screen.getByRole("button", { name: "Profilbild wiederherstellen" })
    )

    /* Der Tausch in die Gegenrichtung: der Fokus bleibt an der Stelle. */
    expect(
      screen.getByRole("button", { name: "Profilbild entfernen" })
    ).toHaveFocus()
    expect(screen.getByLabelText("Profilbild ersetzen")).toBeInTheDocument()
    const notice = screen.getByText("Profilbild wiederhergestellt.")
    expect(notice).toHaveAttribute("role", "status")
    expect(notice.closest("[aria-hidden]")).toBeNull()

    await userEvent.click(
      screen.getByRole("button", { name: "Änderungen speichern" })
    )

    await waitFor(() => expect(currentPath()).toBe("/my-portfolio"))
    expect(store.putBody).toMatchObject({ avatarUrl: AVATAR_URL })

    /* Die Gegenprobe zum Entfernen: dieselbe Profilkarte zeigt das Bild. */
    const profileCard = (
      await screen.findByRole("heading", { level: 2, name: "Mira Beispiel" })
    ).closest("aside")!
    await waitFor(() =>
      expect(profileCard.querySelector("img")?.getAttribute("src")).toContain(
        AVATAR_URL
      )
    )
  })

  it("legt den Fokus nach dem Entfernen ohne gespeichertes Bild auf den Dateiwaehler", async () => {
    /* Frisch hochgeladen und wieder entfernt: es gibt keinen gespeicherten
       Stand und damit kein Wiederherstellen. Der Fokus geht an das
       Dateifeld, dessen Label ihn ueber peer-focus-visible zeigt. */
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
      )
    )
    await renderProfile()

    await userEvent.upload(
      screen.getByLabelText("Profilbild wählen"),
      new File(["x"], "bild.png", { type: "image/png" })
    )
    await userEvent.click(
      await screen.findByRole("button", { name: "Profilbild entfernen" })
    )

    expect(
      screen.queryByRole("button", { name: "Profilbild wiederherstellen" })
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText("Profilbild wählen")).toHaveFocus()
  })

  it("laesst Entfernen waehrend eines laufenden Uploads ohne Wirkung", async () => {
    /* Ohne Sperre setzte das Ende des Uploads ein neues Bild ueber das
       gerade entfernte, der Fokus fiele mit dem Gegenknopf auf body, und die
       Statuszeile behauptete weiter "entfernt" (Befund aus dem Review zu
       KAN-105). Gesperrt wird ueber aria-disabled, damit der Fokus bleibt. */
    const NEW_AVATAR_URL = "/api/files/aaaa0000-0000-4000-8000-000000000001"
    const { store, handlers } = portfolioStore(AVATAR_URL)
    server.use(
      ...handlers,
      http.post("*/api/files", async () => {
        /* Lang genug, dass der Klick sicher in den laufenden Upload faellt. */
        await delay(300)
        return HttpResponse.json(
          {
            id: "aaaa0000-0000-4000-8000-000000000001",
            url: NEW_AVATAR_URL,
            mimeType: "image/png",
            size: 1024,
          },
          { status: 201 }
        )
      }),
      http.put("*/api/auth/me", () => HttpResponse.json(userResponse())),
      http.get("*/api/auth/me", () => HttpResponse.json(userResponse())),
      emptyProjectsHandler()
    )
    await renderProfile()

    await userEvent.upload(
      screen.getByLabelText("Profilbild ersetzen"),
      new File(["x"], "bild.png", { type: "image/png" })
    )
    const remove = screen.getByRole("button", { name: "Profilbild entfernen" })
    await waitFor(() => expect(remove).toHaveAttribute("aria-disabled", "true"))
    await userEvent.click(remove)

    expect(
      screen.queryByRole("button", { name: "Profilbild wiederherstellen" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(
        "Profilbild entfernt. Die Änderung wird mit dem Speichern wirksam."
      )
    ).not.toBeInTheDocument()

    /* Nach dem Upload steht das neue Bild im Feld, und gespeichert wird es. */
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Profilbild entfernen" })
      ).toHaveAttribute("aria-disabled", "false")
    )
    await userEvent.click(
      screen.getByRole("button", { name: "Änderungen speichern" })
    )
    await waitFor(() =>
      expect(store.putBody).toMatchObject({ avatarUrl: NEW_AVATAR_URL })
    )
  })

  it("laesst Wiederherstellen waehrend eines laufenden Uploads ohne Wirkung", async () => {
    /* Die Gegenrichtung zum Test davor: entfernt, dann ein neues Bild
       gewaehlt und waehrend des Uploads "wiederherstellen" geklickt. Ohne
       Sperre holte der Klick das alte Bild zurueck, und das Ende des Uploads
       ueberschriebe es gleich wieder. */
    const NEW_AVATAR_URL = "/api/files/aaaa0000-0000-4000-8000-000000000001"
    const { store, handlers } = portfolioStore(AVATAR_URL)
    server.use(
      ...handlers,
      http.post("*/api/files", async () => {
        /* Lang genug, dass der Klick sicher in den laufenden Upload faellt. */
        await delay(300)
        return HttpResponse.json(
          {
            id: "aaaa0000-0000-4000-8000-000000000001",
            url: NEW_AVATAR_URL,
            mimeType: "image/png",
            size: 1024,
          },
          { status: 201 }
        )
      }),
      http.put("*/api/auth/me", () => HttpResponse.json(userResponse())),
      http.get("*/api/auth/me", () => HttpResponse.json(userResponse())),
      emptyProjectsHandler()
    )
    await renderProfile()

    await userEvent.click(
      screen.getByRole("button", { name: "Profilbild entfernen" })
    )
    await userEvent.upload(
      screen.getByLabelText("Profilbild wählen"),
      new File(["x"], "bild.png", { type: "image/png" })
    )
    const restore = screen.getByRole("button", {
      name: "Profilbild wiederherstellen",
    })
    await waitFor(() =>
      expect(restore).toHaveAttribute("aria-disabled", "true")
    )
    await userEvent.click(restore)

    expect(
      screen.queryByText("Profilbild wiederhergestellt.")
    ).not.toBeInTheDocument()

    /* Nach dem Upload steht das neue Bild im Feld, und gespeichert wird es. */
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Profilbild entfernen" })
      ).toHaveAttribute("aria-disabled", "false")
    )
    await userEvent.click(
      screen.getByRole("button", { name: "Änderungen speichern" })
    )
    await waitFor(() =>
      expect(store.putBody).toMatchObject({ avatarUrl: NEW_AVATAR_URL })
    )
  })

  it("leert die Statuszeile am Profilbild, wenn die Seite nach dem Speichern stehen bleibt", async () => {
    /* Bei offenem Adresswechsel bleibt die Seite nach dem Speichern stehen.
       "Wirksam mit dem Speichern" stimmt dann nicht mehr und waere im
       Lesemodus weiter erreichbar (Befund aus dem Review zu KAN-105). */
    const { handlers: portfolioHandlers } = portfolioStore(AVATAR_URL)
    const { handlers } = emailChangeAccount()
    /* Vorne stehen die Portfolio-Handler: sie fuehren den gespeicherten
       Stand und gewinnen damit gegen das feste PUT des Kontos. */
    server.use(...portfolioHandlers, ...handlers)
    await renderProfile()

    await userEvent.click(
      screen.getByRole("button", { name: "Profilbild entfernen" })
    )
    expect(
      screen.getByText(
        "Profilbild entfernt. Die Änderung wird mit dem Speichern wirksam."
      )
    ).toBeInTheDocument()

    await saveWithNewEmail()
    const dialog = await findEmailDialog()
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Schließen" })
    )
    await waitForEmailDialogClosed()

    expect(currentPath()).toBe("/my-portfolio/profile")
    expect(
      screen.queryByText(
        "Profilbild entfernt. Die Änderung wird mit dem Speichern wirksam."
      )
    ).not.toBeInTheDocument()
    /* Gespeichert ist ohne Bild; es gibt nichts mehr wiederherzustellen. */
    expect(
      screen.queryByRole("button", { name: "Profilbild wiederherstellen" })
    ).not.toBeInTheDocument()
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

  it("oeffnet nach dem Speichern einer neuen Adresse den Dialog und fuehrt nach dem Code ins Portfolio", async () => {
    /* §3.1: die Wunschadresse steht bis zur Bestaetigung nur in
       pendingEmail; das Feld zeigt weiter die alte. §6.1: eingeloest wird
       gegen die neue Adresse mit dem Zweck EMAIL_CHANGE. KAN-105: die Seite
       bleibt nach dem Speichern stehen und oeffnet den Dialog, und die
       Bestaetigung schliesst das Speichern ab. */
    const { account, handlers } = emailChangeAccount()
    server.use(ownPortfolioHandler(), ...handlers)
    await renderProfile()

    expect(
      screen.queryByRole("button", { name: "Code eingeben" })
    ).not.toBeInTheDocument()

    await saveWithNewEmail()

    const dialog = await findEmailDialog()
    expect(
      within(dialog).getByText(
        `Bestätigung ausstehend: Wir haben einen Code an ${NEW_EMAIL} gesendet. Bis zur Bestätigung melden Sie sich weiter mit Ihrer bisherigen Adresse an.`
      )
    ).toBeVisible()
    expect(currentPath()).toBe("/my-portfolio/profile")
    /* Bis zur Bestaetigung bleibt die alte Adresse die Kennung. */
    expect(screen.getByLabelText("Private E-Mail")).toHaveValue(CURRENT_EMAIL)

    await confirmCode(dialog)

    await waitFor(() => expect(currentPath()).toBe("/my-portfolio"))
    expect(
      await findToast("Ihre neue E-Mail-Adresse ist bestätigt.")
    ).toBeVisible()
    expect(account.verifiedWith).toMatchObject({
      email: NEW_EMAIL,
      purpose: "EMAIL_CHANGE",
      code: "042317",
    })
  })

  it("laesst die Seite beim Schliessen ohne Code stehen und oeffnet den Dialog ueber die Hinweiszeile erneut", async () => {
    const { handlers } = emailChangeAccount()
    server.use(ownPortfolioHandler(), ...handlers)
    await renderProfile()

    await saveWithNewEmail()
    const dialog = await findEmailDialog()
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Schließen" })
    )

    await waitForEmailDialogClosed()
    expect(currentPath()).toBe("/my-portfolio/profile")
    const enterCode = await screen.findByRole("button", {
      name: "Code eingeben",
    })
    expect(
      screen.getByText(`Der Wechsel zu ${NEW_EMAIL} ist noch nicht bestätigt.`)
    ).toBeVisible()
    /* Nach dem Speichern ging der Dialog ohne Ausloeser auf. finalFocus
       gibt den Fokus trotzdem an die Hinweiszeile zurueck statt an body
       (SC 2.4.3, Skill frontend-design, Abschnitt 5). */
    await waitFor(() => expect(enterCode).toHaveFocus())

    await userEvent.click(enterCode)
    await findEmailDialog()
    await userEvent.keyboard("{Escape}")

    await waitForEmailDialogClosed()
    await waitFor(() => expect(enterCode).toHaveFocus())
    expect(currentPath()).toBe("/my-portfolio/profile")

    /* Seit dem Speichern unveraendert: auch die Bestaetigung aus dem wieder
       geoeffneten Dialog schliesst das Speichern ab. */
    await userEvent.click(enterCode)
    await confirmCode(await findEmailDialog())

    await waitFor(() => expect(currentPath()).toBe("/my-portfolio"))
    expect(
      await findToast("Ihre neue E-Mail-Adresse ist bestätigt.")
    ).toBeVisible()
  })

  it("zeigt nach dem Neuladen nur die Hinweiszeile und bleibt nach dem Bestaetigen auf der Seite", async () => {
    const { account, handlers } = emailChangeAccount("pending")
    server.use(ownPortfolioHandler(), ...handlers)
    await renderProfile()

    const enterCode = await screen.findByRole("button", {
      name: "Code eingeben",
    })
    expect(
      screen.getByText(`Der Wechsel zu ${NEW_EMAIL} ist noch nicht bestätigt.`)
    ).toBeVisible()
    /* Der Dialog springt beim Betreten der Seite nicht von selbst auf. */
    expect(
      screen.queryByRole("dialog", { name: EMAIL_DIALOG })
    ).not.toBeInTheDocument()

    await userEvent.click(enterCode)
    await confirmCode(await findEmailDialog())

    /* Ohne Speichern in dieser Sitzung ist die Bestaetigung eine Handlung
       fuer sich: der Dialog schliesst, die Seite bleibt. */
    expect(
      await findToast("Ihre neue E-Mail-Adresse ist bestätigt.")
    ).toBeVisible()
    await waitForEmailDialogClosed()
    expect(currentPath()).toBe("/my-portfolio/profile")
    await waitFor(() =>
      expect(screen.getByLabelText("Private E-Mail")).toHaveValue(NEW_EMAIL)
    )
    /* Die Hinweiszeile ist fort und mit ihr das erste Rueckgabeziel des
       Dialogs; der Fokus geht an das E-Mail-Feld, um das es ging, und nicht
       an body (SC 2.4.3). */
    await waitFor(() =>
      expect(screen.getByLabelText("Private E-Mail")).toHaveFocus()
    )
    expect(account.verifiedWith).toMatchObject({
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
    expect(
      screen.queryByRole("button", { name: "Code eingeben" })
    ).not.toBeInTheDocument()
  })

  it("bleibt nach dem Bestaetigen stehen, wenn seit dem Speichern neue Eingaben dazukamen", async () => {
    /* Eine Weiterleitung verwarf die neue Eingabe ohne Rueckfrage (Skill
       frontend-design, Abschnitt 5). */
    const { handlers } = emailChangeAccount()
    server.use(ownPortfolioHandler(), ...handlers)
    await renderProfile()

    await saveWithNewEmail()
    const dialog = await findEmailDialog()
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Schließen" })
    )
    await waitForEmailDialogClosed()
    const enterCode = await screen.findByRole("button", {
      name: "Code eingeben",
    })

    await userEvent.clear(screen.getByLabelText("Vorname"))
    await userEvent.type(screen.getByLabelText("Vorname"), "Mirjam")

    await userEvent.click(enterCode)
    await confirmCode(await findEmailDialog())

    expect(
      await findToast("Ihre neue E-Mail-Adresse ist bestätigt.")
    ).toBeVisible()
    await waitForEmailDialogClosed()
    expect(currentPath()).toBe("/my-portfolio/profile")
    expect(screen.getByLabelText("Vorname")).toHaveValue("Mirjam")
  })

  it("nimmt einen laufenden Wechsel nicht mehr nebenbei zurueck", async () => {
    /*
     * Bis KAN-83 schickte jedes gewoehnliche Speichern die aktuelle Adresse
     * mit, und das ist laut §6.1 der Weg zurueck: wer waehrend der
     * Wartezeit einen Tippfehler im Vornamen korrigierte, verlor unbemerkt
     * den Wechsel und den bereits verschickten Code. Der Weg zurueck steht
     * seither als eigene Schaltflaeche, seit KAN-105 im Dialog.
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

  it("bietet den Weg zurueck als eigene Schaltflaeche im Dialog an", async () => {
    const { account, handlers } = emailChangeAccount("pending")
    server.use(ownPortfolioHandler(), ...handlers)
    await renderProfile()

    await userEvent.click(
      await screen.findByRole("button", { name: "Code eingeben" })
    )
    const dialog = await findEmailDialog()
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Wechsel abbrechen" })
    )

    expect(
      await findToast("Der E-Mail-Wechsel wurde abgebrochen.")
    ).toBeVisible()
    /* §6.1: die aktuelle Adresse zu senden nimmt den Wechsel zurueck. Ein
       Passwort braucht es dafuer nicht, die Adresse aendert sich ja
       nicht. */
    const sentBody = account.profileBodies[account.profileBodies.length - 1]
    expect(sentBody).toMatchObject({ email: CURRENT_EMAIL })
    expect(sentBody).not.toHaveProperty("currentPassword")
    /* KAN-105: der Abbruch schliesst nur den Dialog, die Seite bleibt. */
    await waitForEmailDialogClosed()
    expect(currentPath()).toBe("/my-portfolio/profile")
    /* Ohne Hinweiszeile geht der Fokus an das E-Mail-Feld (SC 2.4.3). */
    await waitFor(() =>
      expect(screen.getByLabelText("Private E-Mail")).toHaveFocus()
    )
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Code eingeben" })
      ).not.toBeInTheDocument()
    )
  })

  it("laesst den Dialog bei einem gescheiterten Abbruch mit Meldung offen", async () => {
    /* Die Meldung steht im Dialog, der offen bleibt: in einem Knoten, der
       mit dem Dialog verschwaende, saehe sie niemand (Skill
       frontend-design, Abschnitt 5). */
    const { handlers } = emailChangeAccount("pending")
    server.use(ownPortfolioHandler(), ...handlers)
    server.use(
      http.put("*/api/auth/me", () =>
        apiErrorResponse(429, "TOO_MANY_LOGIN_ATTEMPTS", "/api/auth/me")
      )
    )
    await renderProfile()

    await userEvent.click(
      await screen.findByRole("button", { name: "Code eingeben" })
    )
    const dialog = await findEmailDialog()
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Wechsel abbrechen" })
    )

    expect(
      await within(dialog).findByText(
        "Zu viele Fehlversuche. Bitte warten Sie einige Minuten und versuchen Sie es dann erneut."
      )
    ).toBeVisible()
    expect(
      screen.getByRole("dialog", { name: EMAIL_DIALOG })
    ).toBeInTheDocument()
    expect(currentPath()).toBe("/my-portfolio/profile")
    /* Gescheitert ist gescheitert: kein Toast, der einen Abbruch meldet. */
    expect(
      screen.queryByRole("dialog", {
        name: "Der E-Mail-Wechsel wurde abgebrochen.",
      })
    ).not.toBeInTheDocument()
  })

  it("fuehrt einen Abbruch nach dem Speichern nicht ins Portfolio", async () => {
    /* Entscheidung aus der Klaerungsrunde zu KAN-105: allein "Code
       bestätigen" fuehrt weiter. Erst ein Speichern in derselben Sitzung
       setzt den Merker, an dem die Weiterleitung haengt; die Abbruch-Tests
       nach einem Neuladen bemerkten eine Weiterleitung beim Abbruch nicht. */
    const { account, handlers } = emailChangeAccount()
    server.use(ownPortfolioHandler(), ...handlers)
    await renderProfile()

    await saveWithNewEmail()
    const dialog = await findEmailDialog()
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Wechsel abbrechen" })
    )

    expect(
      await findToast("Der E-Mail-Wechsel wurde abgebrochen.")
    ).toBeVisible()
    await waitForEmailDialogClosed()
    expect(currentPath()).toBe("/my-portfolio/profile")
    expect(account.phase).toBe("none")
    await waitFor(() =>
      expect(screen.getByLabelText("Private E-Mail")).toHaveFocus()
    )
    expect(screen.getByLabelText("Private E-Mail")).toHaveValue(CURRENT_EMAIL)
  })

  it("schickt bei einem zweiten Klick auf Wechsel abbrechen kein zweites PUT", async () => {
    /* Zwei Klicks ohne Rendern dazwischen: kein Prop kann den zweiten
       abfangen, nur der Ref im Formular. Mit zwei getrennten userEvent-
       Klicks rendert React dazwischen, und der Test waere schon ohne Ref
       gruen (Befund aus der Nachpruefung zu KAN-105). */
    const { account, handlers } = emailChangeAccount("pending")
    server.use(ownPortfolioHandler(), ...handlers)
    await renderProfile()

    await userEvent.click(
      await screen.findByRole("button", { name: "Code eingeben" })
    )
    const dialog = await findEmailDialog()
    let cancelPuts = 0
    server.use(
      http.put("*/api/auth/me", () => {
        cancelPuts += 1
        account.phase = "none"
        return HttpResponse.json(userResponse())
      })
    )
    const cancel = within(dialog).getByRole("button", {
      name: "Wechsel abbrechen",
    })
    act(() => {
      cancel.click()
      cancel.click()
    })

    expect(
      await findToast("Der E-Mail-Wechsel wurde abgebrochen.")
    ).toBeVisible()
    await waitForEmailDialogClosed()
    expect(cancelPuts).toBe(1)
    expect(
      screen.getAllByRole("dialog", {
        name: "Der E-Mail-Wechsel wurde abgebrochen.",
      })
    ).toHaveLength(1)
  })

  it("schliesst den Dialog nach dem Einloesen auch dann, wenn das Nachladen der Sitzung scheitert", async () => {
    /* Der Code ist eingeloest, nur GET /auth/me danach scheitert. Das ist
       kein Fehlschlag, den die Person beheben koennte: Toast und Schliessen
       kommen trotzdem, und keine Ablehnung bleibt unbehandelt, an der Vitest
       den Lauf abbraeche (Befund aus dem Review zu KAN-105). */
    const { account, handlers } = emailChangeAccount("pending")
    server.use(ownPortfolioHandler(), ...handlers)
    await renderProfile()

    await userEvent.click(
      await screen.findByRole("button", { name: "Code eingeben" })
    )
    const dialog = await findEmailDialog()
    server.use(
      http.get("*/api/auth/me", () =>
        apiErrorResponse(500, "INTERNAL_ERROR", "/api/auth/me")
      )
    )
    await confirmCode(dialog)

    expect(
      await findToast("Ihre neue E-Mail-Adresse ist bestätigt.")
    ).toBeVisible()
    await waitForEmailDialogClosed()
    expect(currentPath()).toBe("/my-portfolio/profile")
    expect(account.verifiedWith).toMatchObject({ purpose: "EMAIL_CHANGE" })
    /* Der eingeloeste Stand steht auch ohne Nachladen im Cache: neben dem
       Toast "bestätigt" weder die Hinweiszeile "noch nicht bestätigt" noch
       ein Passwortfeld, als waere die neue Adresse ein weiterer Wechsel
       (Befund aus der Nachpruefung zu KAN-105). */
    await waitFor(() =>
      expect(screen.getByLabelText("Private E-Mail")).toHaveValue(NEW_EMAIL)
    )
    expect(
      screen.queryByRole("button", { name: "Code eingeben" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText("Aktuelles Passwort", {
        selector: "#currentPassword",
      })
    ).toBeNull()
  })

  it(
    "fordert im Dialog einen neuen Code fuer die Wunschadresse an",
    async () => {
      let resendBody: Record<string, unknown> | null = null
      const { handlers } = emailChangeAccount()
      server.use(
        ownPortfolioHandler(),
        ...handlers,
        http.post("*/api/auth/verify/resend", async ({ request }) => {
          resendBody = (await request.json()) as Record<string, unknown>
          return new HttpResponse(null, { status: 204 })
        })
      )
      await renderProfile()

      await saveWithNewEmail()
      const dialog = await findEmailDialog()
      within(dialog).getByLabelText("Bestätigungscode")

      /* Bis zum Ablauf der Sperrfrist steht dort der Countdown, nicht der
       Knopf (useResendCountdown, 20 Sekunden nach Template). Geprueft wird
       die laufende Zahl und nicht die 20: unter Last vergeht zwischen dem
       Einhaengen und dieser Zeile schon eine Sekunde, und der Test schlug
       dann grundlos fehl. */
      expect(
        within(dialog).getByText(/Code erneut senden in \d+s/)
      ).toBeInTheDocument()
      expect(
        within(dialog).queryByRole("button", { name: "Code erneut senden" })
      ).not.toBeInTheDocument()

      /*
       * Die Frist wird real abgewartet, nicht mit gestellten Timern
       * uebersprungen: der Countdown plant seinen naechsten Takt in einem
       * Effekt, und Reacts Scheduler haengt selbst an Timern. Mit
       * vi.useFakeTimers laeuft deshalb weder der Takt weiter noch das
       * Rendern dazwischen, und MSW braucht die echte Zeitachse ohnehin.
       * Der Preis sind rund 20 Sekunden in genau diesem Test.
       */
      const resendButton = await within(dialog).findByRole(
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
      await screen.findByRole("button", { name: "Passwort ändern" })
    )
    /* Mit Namen: seit KAN-105 kann auf derselben Seite ein Toast stehen,
       und auch der traegt die Rolle dialog. */
    return screen.findByRole("dialog", { name: "Neues Passwort vergeben" })
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
    expect(
      screen.getByRole("dialog", { name: "Neues Passwort vergeben" })
    ).toBeVisible()
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
    await renderProfile()

    await openPasswordDialog()
    await userEvent.click(
      screen.getByRole("button", { name: "Passwort vergessen?" })
    )

    await waitFor(() => expect(currentPath()).toBe("/reset-password"))
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
    await renderProfile()

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
    expect(currentPath()).toBe("/my-portfolio/profile")

    await userEvent.click(
      screen.getByRole("button", { name: "Code senden und weiter" })
    )

    await waitFor(() => expect(currentPath()).toBe("/reset-password"))
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
       kaeme ohne Anlass (Befund aus dem Review zu KAN-69). Belegt wird das
       seit KAN-105 dort, wo die Seite nach dem Speichern stehen bleibt, also
       mit offenem Adresswechsel: ohne ihn fuehrt das Speichern ins
       Portfolio. Geaenderte Adresse und getipptes Passwort machen das
       Formular vorher sicher veraendert. */
    let forgotCalls = 0
    const { handlers } = emailChangeAccount()
    server.use(
      ownPortfolioHandler(),
      ...handlers,
      http.post("*/api/auth/forgot-password", () => {
        forgotCalls += 1
        return new HttpResponse(null, { status: 204 })
      })
    )
    await renderProfile()

    await saveWithNewEmail()
    const dialog = await findEmailDialog()
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Schließen" })
    )
    await waitForEmailDialogClosed()

    await openPasswordDialog()
    await userEvent.click(
      screen.getByRole("button", { name: "Passwort vergessen?" })
    )

    /* Keine Rueckfrage, direkt der Codeversand und der Wechsel. */
    await waitFor(() => expect(currentPath()).toBe("/reset-password"))
    expect(forgotCalls).toBe(1)
  })

  it("fuehrt ohne Anmeldung sichtbar zum Login", () => {
    renderWithProviders(<AppUnderTest />, "/my-portfolio/profile")

    expect(
      screen.getByRole("heading", { level: 1, name: "Anmelden" })
    ).toBeInTheDocument()
  })
})
