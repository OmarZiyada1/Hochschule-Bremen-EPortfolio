import { expect, test } from "@playwright/test"

import { expectKeyboardReachable } from "./support/keyboard"
import {
  expectHeadingStructure,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  expectSkipLink,
  settle,
} from "./support/page"
import {
  discoverFixtures,
  FLOW_BEFORE_EMAIL,
  FLOW_BEFORE_HSB,
  FLOW_DONE,
  login,
  prepare,
  type DevRole,
  type Fixtures,
  type RegistrationFlow,
  type Session,
} from "./support/session"

/**
 * Der Querschnittsdurchgang aus KAN-42: jede Seite der Anwendung, je einmal
 * hell und einmal dunkel, gegen WCAG 2.2 Stufe A und AA.
 *
 * <p>Die Liste ist die aus Umfang 1 des Tickets und bewusst vollstaendig
 * aufgeschrieben statt aus dem Routenbaum abgeleitet: eine Route, die
 * jemand hinzufuegt, soll hier auffallen und nicht stillschweigend
 * mitlaufen oder fehlen. Nicht enthalten sind /dev/tokens und
 * /dev/components; sie existieren im gebauten Stand nicht.
 */

type Case = {
  /** Der Name im Protokoll und im Testbericht. */
  name: string
  path: (fixtures: Fixtures) => string
  /** Ohne Angabe wird die Seite ohne Anmeldung aufgerufen. */
  as?: DevRole
  /**
   * Traegt die Seite den Anwendungsrahmen (NavBar, Sprunglink, Fusszeile)?
   * Auth-Seiten, Editor und 404 fuehren ihn nicht.
   */
  appFrame: boolean
  /**
   * Wird beim Aufruf ein Datensatz angelegt? Diese Seiten laufen nur im
   * hellen Projekt, damit ein Lauf nicht zwei Entwuerfe hinterlaesst.
   */
  writes?: boolean
  /**
   * Schrittzustand der Registrierung, den die Seite voraussetzt. Ohne ihn
   * leitet sie auf /register/details um.
   */
  flow?: RegistrationFlow
  /**
   * Zeigt diese Seite im Ausgangszustand eine Meldung mit
   * {@code role="alert"}? Ueberall sonst ist eine Meldung das Zeichen fuer
   * einen fehlgeschlagenen Abruf, und dann prueft der Lauf eine Fehlerseite
   * statt der Seite.
   */
  expectsAlert?: boolean
  /**
   * Wohin die Route bestimmungsgemaess fuehrt, wenn sie nicht bei sich
   * selbst bleibt. Ohne Angabe muss die Adresse nach dem Laden dieselbe
   * sein wie vorher.
   */
  landsOn?: RegExp
}

const CASES: Case[] = [
  // Oeffentlich
  { name: "Startseite", path: () => "/", appFrame: true },
  { name: "Projektbibliothek", path: () => "/projects", appFrame: true },
  {
    name: "Projektdetail",
    path: (f) => `/projects/${f.publishedProjectId}`,
    appFrame: true,
  },
  {
    name: "Oeffentliches Portfolio",
    path: (f) => `/portfolios/${f.portfolioUserId}`,
    appFrame: true,
  },
  { name: "Kontakt und Support", path: () => "/support", appFrame: true },
  /*
   * Die Hilfeseite (KAN-93) steht zweimal, und beide Faelle messen
   * Verschiedenes. Ohne Anmeldung traegt sie genau einen Bereich und kein
   * Sprungverzeichnis, das ist der schmale Fall. Als Admin traegt sie alle
   * vier Bereiche, das Verzeichnis und 27 aufklappbare Punkte: erst dort ist
   * die Ueberschriftenkette in voller Laenge zu sehen, und erst dort misst
   * der Tastaturdurchgang mehr als sieben Schaltflaechen. Ein Fall allein
   * haette die Seite zur Haelfte ungeprueft gelassen (Befund aus dem
   * Review).
   */
  { name: "Hilfe und Dokumentation", path: () => "/help", appFrame: true },
  {
    name: "Hilfe und Dokumentation (Admin)",
    path: () => "/help",
    as: "admin",
    appFrame: true,
  },
  { name: "Impressum", path: () => "/imprint", appFrame: true },
  { name: "Datenschutz", path: () => "/privacy", appFrame: true },
  { name: "Barrierefreiheit", path: () => "/accessibility", appFrame: true },
  {
    name: "404",
    path: () => "/diese-seite-gibt-es-nicht",
    appFrame: false,
  },
  {
    /*
     * Die Flaeche "Kein Zugriff" entsteht, wenn ein angemeldetes Konto eine
     * Route seiner Rolle nicht oeffnen darf (RequireRole). Ein studentisches
     * Konto auf der Administrationsseite ist der kuerzeste Weg dorthin.
     */
    name: "Kein Zugriff",
    path: () => "/administration",
    as: "student",
    appFrame: true,
  },

  // Anmeldung, Registrierung, Passwort
  { name: "Anmeldung", path: () => "/login", appFrame: false },
  {
    name: "Registrierung Angaben",
    path: () => "/register/details",
    appFrame: false,
  },
  {
    name: "Registrierung E-Mail bestaetigen",
    path: () => "/register/verify-email",
    appFrame: false,
    flow: FLOW_BEFORE_EMAIL,
  },
  {
    name: "Registrierung HSB-Adresse",
    path: () => "/register/verify-hsb-email",
    appFrame: false,
    flow: FLOW_BEFORE_HSB,
  },
  {
    name: "Registrierung fertig",
    path: () => "/register/done",
    appFrame: false,
    flow: FLOW_DONE,
  },
  {
    name: "Passwort vergessen",
    path: () => "/forgot-password",
    appFrame: false,
  },
  {
    name: "Passwort zuruecksetzen",
    path: () => "/reset-password",
    appFrame: false,
  },
  {
    name: "Passwort aendern",
    path: () => "/change-password",
    as: "student",
    appFrame: false,
  },

  // Angemeldet
  {
    name: "Mein Portfolio",
    path: () => "/my-portfolio",
    as: "student",
    appFrame: true,
  },
  {
    name: "Profil bearbeiten",
    path: () => "/my-portfolio/profile",
    as: "student",
    appFrame: true,
  },
  {
    name: "Projekt anlegen",
    path: () => "/projects/new",
    as: "student",
    appFrame: true,
    writes: true,
    /*
     * Die Route hat keine eigene Flaeche: sie legt das Projekt an und fuehrt
     * sofort auf dessen Metadatenseite (KAN-35). Geprueft wird also der
     * Weg, den ein Klick auf "Neues Projekt" tatsaechlich nimmt, samt der
     * Seite, auf der er endet.
     */
    landsOn: /^\/projects\/[0-9a-f-]{36}\/metadata$/,
  },
  {
    name: "Projekt-Metadaten",
    path: (f) => `/projects/${f.draftProjectId}/metadata`,
    as: "student",
    appFrame: true,
  },

  // Redaktion
  {
    name: "Meine Reviews",
    path: () => "/reviews",
    as: "editor",
    appFrame: true,
  },
  {
    name: "Review-Modus",
    path: (f) => `/projects/${f.reviewProjectId}/review`,
    as: "editor",
    appFrame: true,
  },

  // Administrationsseite
  {
    name: "Administration Dashboard",
    path: () => "/administration",
    as: "admin",
    appFrame: true,
  },
  {
    name: "Administration Projekte",
    path: () => "/administration/projects",
    as: "admin",
    appFrame: true,
  },
  {
    name: "Administration Nutzende",
    path: () => "/administration/users",
    as: "admin",
    appFrame: true,
  },
  {
    name: "Administration Kategorien",
    path: () => "/administration/categories",
    as: "admin",
    appFrame: true,
  },
  {
    name: "Administration Semester",
    path: () => "/administration/semesters",
    as: "admin",
    appFrame: true,
  },
  {
    name: "Administration Studienstruktur",
    path: () => "/administration/study-structure",
    as: "admin",
    appFrame: true,
  },
  {
    name: "Administration Top 10",
    path: () => "/administration/top10",
    as: "admin",
    appFrame: true,
  },
  {
    name: "Administration Top-10-Protokoll",
    path: () => "/administration/top10/audit",
    as: "admin",
    appFrame: true,
  },
  {
    name: "Administration Anfragen",
    path: () => "/administration/support",
    as: "admin",
    appFrame: true,
  },
  {
    name: "Administration Startseitentexte",
    path: () => "/administration/site-content",
    as: "admin",
    appFrame: true,
  },

  // Editor. In Umfang 1 nicht aufgezaehlt, weil seine Bausteine ihre
  // Nachweise selbst tragen (KAN-36 und Teilaufgaben); die Seite als Ganzes
  // laeuft hier trotzdem mit, denn genau ihre Naehte sind Umfang 2.
  {
    name: "Editor",
    path: (f) => `/projects/${f.draftProjectId}/editor`,
    as: "student",
    appFrame: false,
  },
]

test.describe("Barrierefreiheit je Seite", () => {
  for (const testCase of CASES) {
    test(testCase.name, async ({ page, request }, testInfo) => {
      if (testCase.writes === true && testInfo.project.name !== "hell") {
        test.skip(
          true,
          "Legt beim Aufruf einen Entwurf an; laeuft deshalb nur einmal je Lauf."
        )
      }

      const theme = testInfo.project.name === "dunkel" ? "dark" : "light"
      const fixtures = await discoverFixtures(request)
      let session: Session | null = null
      if (testCase.as !== undefined) {
        session = await login(request, testCase.as)
      }

      await prepare(page, theme, session, testCase.flow ?? null)
      const path = testCase.path(fixtures)
      await page.goto(path)
      await settle(page)

      /*
       * Steht die Seite, die gemeint war? Mehrere Routen leiten unter
       * Bedingungen um (fehlender Registrierungsflow, fehlende Rolle,
       * abgelaufene Sitzung). Ohne diese Zusicherung bleibt der Lauf gruen
       * und misst eine andere Seite: drei Registrierungsschritte haben so
       * viermal /register/details geprueft (Befund des contract-pruefers).
       * Die Flaeche "Kein Zugriff" ist die eine gewollte Ausnahme, sie
       * erscheint unter der angefragten Adresse.
       */
      const landed = new URL(page.url()).pathname
      if (testCase.landsOn === undefined) {
        expect(landed, `${testCase.name}: die Route hat umgeleitet`).toBe(path)
      } else {
        expect(
          landed,
          `${testCase.name}: die Route ist nicht dort gelandet, wo sie soll`
        ).toMatch(testCase.landsOn)
      }

      /*
       * Steht wirklich die Seite da, oder eine Fehlerflaeche?
       *
       * Faellt ein Endpoint mit 500 aus, rendert die Seite einen ErrorState:
       * kein Skeleton mehr, eine saubere Ueberschrift, ein Tabstopp, kein
       * axe-Verstoss. Alle Pruefungen dieses Laufs gingen dann durch, und
       * das Ergebnis waere eine gruene Barrierefreiheitspruefung auf lauter
       * Fehlerseiten. Der Login und discoverFixtures fangen nur ab, dass das
       * Backend ganz fehlt, nicht dass ein einzelner Abruf scheitert.
       */
      if (testCase.expectsAlert !== true) {
        const alerts = await page.getByRole("alert").allTextContents()
        expect(
          alerts,
          `${testCase.name}: unerwartete Meldung, vermutlich ein ` +
            "fehlgeschlagener Abruf"
        ).toEqual([])
      }

      const label = `${testCase.name} (${theme})`

      /*
       * Der gewaehlte Modus muss auch angekommen sein. Ohne diese Pruefung
       * liefe ein Fehler im Init-Skript unbemerkt als zweiter heller
       * Durchgang durch, und der dunkle Kontrast waere nie geprueft.
       */
      await expect(
        page.locator("html"),
        `${label}: Farbmodus nicht gesetzt`
      ).toHaveClass(new RegExp(`\\b${theme}\\b`))

      await expectHeadingStructure(page, label)
      await expectNoAxeViolations(page, label)
      if (testCase.appFrame) {
        await expectSkipLink(page, label)
      }
      /*
       * Der Tastaturdurchgang setzt Kennungen auf die besuchten Knoten und
       * laeuft deshalb nach axe, nicht davor: sonst pruefte axe ein
       * Dokument, das der Test selbst veraendert hat.
       */
      await expectKeyboardReachable(page, label)
      await expectNoHorizontalScroll(page, label)
    })
  }
})
