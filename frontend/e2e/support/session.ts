import type { APIRequestContext, Page } from "@playwright/test"

/**
 * Anmeldung und Testdaten fuer den e2e-Lauf (KAN-42, Umfang 8).
 *
 * <p><strong>Angemeldet wird ueber die API, nicht ueber das Formular.</strong>
 * Die Anmeldeseite hat ihren eigenen Prueffall; sie in jedem weiteren Fall
 * noch einmal zu durchlaufen, kostet Zeit und macht jeden Fehlschlag
 * mehrdeutig. Die Antwort von POST /api/auth/login hat genau die Form, die
 * api/auth/authStore.ts unter `eportfolio.session` ablegt, also wird sie
 * dorthin geschrieben.
 *
 * <p><strong>Die IDs werden gesucht, nicht eingetragen.</strong> Die
 * Demodaten aus var/demodaten/ tragen feste UUID-Praefixe, aber ein
 * fest verdrahtetes `d0d00011-...` im Test bindet den Lauf an genau diesen
 * Datenbestand und faellt bei der naechsten Erweiterung um. Gesucht wird
 * deshalb zur Laufzeit ueber dieselben Endpoints, die auch die Oberflaeche
 * benutzt.
 */

/** Der Schluessel aus api/auth/authStore.ts. */
const SESSION_KEY = "eportfolio.session"

/** Der Schluessel aus components/theme-provider.tsx. */
const THEME_KEY = "theme"

/** Der Schluessel aus features/auth/registrationFlow.ts, im sessionStorage. */
const REGISTRATION_KEY = "eportfolio.registration"

/**
 * Der Schrittzustand der Registrierung, wie ihn
 * {@code features/auth/registrationFlow.ts} ablegt.
 *
 * <p>Ohne ihn leiten die drei Seiten {@code /register/verify-email},
 * {@code /register/verify-hsb-email} und {@code /register/done} sofort auf
 * {@code /register/details} um. Sie sahen im Lauf gruen aus und waren es
 * auch, nur haben sie viermal dieselbe Seite gemessen (Befund des
 * contract-pruefers zu KAN-42).
 */
export type RegistrationFlow = {
  email: string
  hsbEmail: string
  emailVerified: boolean
  hsbEmailVerified: boolean
  status: "REGISTRATION_PENDING" | "ACTIVE" | "DEACTIVATED"
}

/** Vor Schritt 2: noch nichts bestaetigt. */
export const FLOW_BEFORE_EMAIL: RegistrationFlow = {
  email: "e2e@dev.invalid",
  hsbEmail: "e2e@stud.hs-bremen.de",
  emailVerified: false,
  hsbEmailVerified: false,
  status: "REGISTRATION_PENDING",
}

/** Vor Schritt 3: die private Adresse ist bestaetigt, die HSB-Adresse nicht. */
export const FLOW_BEFORE_HSB: RegistrationFlow = {
  ...FLOW_BEFORE_EMAIL,
  emailVerified: true,
}

/** Nach Schritt 4: das Konto ist aktiv. */
export const FLOW_DONE: RegistrationFlow = {
  ...FLOW_BEFORE_EMAIL,
  emailVerified: true,
  hsbEmailVerified: true,
  status: "ACTIVE",
}

export type DevRole = "student" | "editor" | "admin"

const CREDENTIALS: Record<DevRole, { email: string; password: string }> = {
  /*
   * Die drei Konten aus DevTestUserSeeder. Das Passwort steht in der .env
   * als DEV_TEST_PASSWORD; ohne gesetzten Wert legt der Seeder test1234 an,
   * und derselbe Vorgabewert steht in docs/SETUP.md.
   */
  student: { email: "dev-studi@dev.invalid", password: devPassword() },
  editor: { email: "dev-redakteur@dev.invalid", password: devPassword() },
  admin: { email: "dev-admin@dev.invalid", password: devPassword() },
}

function devPassword(): string {
  return process.env.DEV_TEST_PASSWORD ?? "test1234"
}

export type Session = {
  token: string
  expiresAt: string
  passwordChangeRequired: boolean
  user: { id: string; role: string }
}

const sessions = new Map<DevRole, Session>()

/**
 * Meldet ein Dev-Konto an und liefert die Sitzung. Je Rolle einmal je Lauf:
 * das Token gilt Stunden, und drei Anmeldungen je Prueffall waeren nur
 * Wartezeit.
 */
export async function login(
  request: APIRequestContext,
  role: DevRole
): Promise<Session> {
  const cached = sessions.get(role)
  if (cached !== undefined) {
    return cached
  }
  const response = await request.post("/api/auth/login", {
    data: CREDENTIALS[role],
  })
  if (!response.ok()) {
    throw new Error(
      `Anmeldung als ${role} fehlgeschlagen (${response.status()}). ` +
        "Laeuft das Backend im Profil dev mit den Dev-Testnutzern? " +
        "Siehe docs/SETUP.md."
    )
  }
  const session = (await response.json()) as Session
  sessions.set(role, session)
  return session
}

/**
 * Legt Farbwahl und Sitzung vor dem ersten Bild in den localStorage.
 *
 * <p>Ueber addInitScript und nicht ueber page.evaluate nach dem Laden: der
 * ThemeProvider liest den Schluessel im Initialzustand seines useState, und
 * die Zugriffsschranken lesen die Sitzung beim ersten Rendern. Wer nachher
 * schreibt und neu laedt, misst die erste Seite jedes Falls im falschen
 * Zustand.
 */
export async function prepare(
  page: Page,
  theme: "light" | "dark",
  session: Session | null,
  flow: RegistrationFlow | null = null
): Promise<void> {
  await page.addInitScript(
    ({
      themeKey,
      sessionKey,
      registrationKey,
      themeValue,
      sessionValue,
      flowValue,
    }) => {
      window.localStorage.setItem(themeKey, themeValue)
      if (sessionValue === null) {
        window.localStorage.removeItem(sessionKey)
      } else {
        window.localStorage.setItem(sessionKey, sessionValue)
      }
      /* Der Registrierungsflow liegt im sessionStorage, nicht im local. */
      if (flowValue === null) {
        window.sessionStorage.removeItem(registrationKey)
      } else {
        window.sessionStorage.setItem(registrationKey, flowValue)
      }
    },
    {
      themeKey: THEME_KEY,
      sessionKey: SESSION_KEY,
      registrationKey: REGISTRATION_KEY,
      themeValue: theme,
      sessionValue: session === null ? null : JSON.stringify(session),
      flowValue: flow === null ? null : JSON.stringify(flow),
    }
  )
}

export type Fixtures = {
  /** Ein veroeffentlichtes Projekt, oeffentlich lesbar. */
  publishedProjectId: string
  /** Die Person, der dieses Projekt gehoert (fuer /portfolios/:userId). */
  portfolioUserId: string
  /** Ein Entwurf des studentischen Kontos (Metadaten und Editor). */
  draftProjectId: string
  /** Ein Projekt im Zustaendigkeitsbereich der Redaktion. */
  reviewProjectId: string
}

let fixtures: Fixtures | null = null

/**
 * Sucht je einen Datensatz fuer die Routen mit Parameter. Faellt einer aus,
 * bricht der Lauf mit einer Meldung ab, die sagt, was in der Datenbank
 * fehlt: ein uebersprungener Prueffall waere eine stille Luecke im
 * Nachweis.
 */
export async function discoverFixtures(
  request: APIRequestContext
): Promise<Fixtures> {
  if (fixtures !== null) {
    return fixtures
  }

  const published = await request.get("/api/projects", {
    params: { size: 1, page: 0 },
  })
  const publishedPage = (await published.json()) as {
    content?: { id: string; author: { id: string } }[]
  }
  const first = publishedPage.content?.[0]
  if (first === undefined) {
    throw new Error(
      "Kein veroeffentlichtes Projekt gefunden. Demodaten einspielen: " +
        "var/demodaten/demo-daten-komplett.sh"
    )
  }

  const student = await login(request, "student")
  const own = await request.get("/api/projects", {
    headers: { Authorization: `Bearer ${student.token}` },
    params: { participant: student.user.id, size: 50 },
  })
  const ownPage = (await own.json()) as {
    content?: { id: string; status: string }[]
  }
  const draft = ownPage.content?.find((entry) => entry.status === "DRAFT")
  if (draft === undefined) {
    throw new Error(
      "Kein Entwurf des Kontos dev-studi gefunden. Demodaten einspielen: " +
        "var/demodaten/demo-daten-komplett.sh"
    )
  }

  const editor = await login(request, "editor")
  const assigned = await request.get("/api/projects", {
    headers: { Authorization: `Bearer ${editor.token}` },
    params: { editor: editor.user.id, size: 50 },
  })
  const assignedPage = (await assigned.json()) as {
    content?: { id: string; status: string }[]
  }
  /*
   * Bevorzugt ein eingereichtes Projekt: die Reviewansicht zeigt dort die
   * Entscheidungsleiste, und genau die traegt die meisten Bedienelemente.
   * Sonst genuegt irgendeines aus der Zustaendigkeit.
   */
  const review =
    assignedPage.content?.find((entry) => entry.status === "SUBMITTED") ??
    assignedPage.content?.[0]
  if (review === undefined) {
    throw new Error(
      "Kein Projekt in der Zustaendigkeit von dev-redakteur gefunden. " +
        "Demodaten einspielen: var/demodaten/demo-daten-komplett.sh"
    )
  }

  fixtures = {
    publishedProjectId: first.id,
    portfolioUserId: first.author.id,
    draftProjectId: draft.id,
    reviewProjectId: review.id,
  }

  /*
   * Die Antwortformen stehen hier von Hand, weil tsconfig.e2e.json den
   * @/-Alias nicht kennt und damit auch nicht @/api/types. Ein umbenanntes
   * Feld faellt deshalb nicht beim Typecheck auf, sondern erst als
   * /portfolios/undefined, und die Pruefung liefe gruen auf einer
   * Fehlerseite. Diese Zusicherung faengt genau das ab.
   */
  for (const [name, value] of Object.entries(fixtures)) {
    if (typeof value !== "string" || value === "") {
      throw new Error(
        `Testdatum ${name} ist leer. Hat sich ein Feldname in der Antwort ` +
          "geaendert? Die Formen stehen in discoverFixtures von Hand."
      )
    }
  }
  return fixtures
}
