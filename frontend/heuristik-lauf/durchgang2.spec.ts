import { test } from "@playwright/test"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { settle } from "../e2e/support/page"
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
} from "../e2e/support/session"

/**
 * Durchgang 2 der heuristischen Evaluation: Regelpruefung Screen fuer
 * Screen. Erzeugt je Screen ein Bild der ganzen Seite und ein Textinventar,
 * aus dem sich Beschriftungen, Ueberschriftenkette, Formularfelder und
 * sichtbare Statusanzeigen beurteilen lassen.
 *
 * Kein Testlauf im eigentlichen Sinn: hier wird nichts behauptet, sondern
 * erhoben. Die Bewertung gegen H1 bis H10 geschieht danach am Material.
 */

const OUT = process.env.HE_OUT ?? "heuristik-out"
mkdirSync(join(OUT, "bilder"), { recursive: true })

type Case = {
  name: string
  path: (f: Fixtures) => string
  as?: DevRole
  flow?: RegistrationFlow
  /** Zusaetzlich im Schmalfall 390px aufnehmen. */
  narrow?: boolean
}

const CASES: Case[] = [
  { name: "01-startseite", path: () => "/", narrow: true },
  { name: "02-projektliste", path: () => "/projects", narrow: true },
  {
    name: "03-projektdetail",
    path: (f) => `/projects/${f.publishedProjectId}`,
    narrow: true,
  },
  {
    name: "04-portfolio-oeffentlich",
    path: (f) => `/portfolios/${f.portfolioUserId}`,
  },
  { name: "05-support", path: () => "/support" },
  { name: "06-hilfe", path: () => "/help" },
  { name: "07-hilfe-admin", path: () => "/help", as: "admin" },
  { name: "08-barrierefreiheit", path: () => "/accessibility" },
  { name: "09-impressum", path: () => "/imprint" },
  { name: "10-404", path: () => "/diese-seite-gibt-es-nicht" },
  { name: "11-kein-zugriff", path: () => "/administration", as: "student" },
  { name: "12-login", path: () => "/login" },
  { name: "13-register-details", path: () => "/register/details" },
  {
    name: "14-register-verify-email",
    path: () => "/register/verify-email",
    flow: FLOW_BEFORE_EMAIL,
  },
  {
    name: "15-register-verify-hsb",
    path: () => "/register/verify-hsb-email",
    flow: FLOW_BEFORE_HSB,
  },
  { name: "16-register-done", path: () => "/register/done", flow: FLOW_DONE },
  { name: "17-forgot-password", path: () => "/forgot-password" },
  { name: "18-reset-password", path: () => "/reset-password" },
  { name: "19-change-password", path: () => "/change-password", as: "student" },
  {
    name: "20-mein-portfolio",
    path: () => "/my-portfolio",
    as: "student",
    narrow: true,
  },
  {
    name: "21-profil-bearbeiten",
    path: () => "/my-portfolio/profile",
    as: "student",
  },
  {
    name: "22-projekt-metadaten",
    path: (f) => `/projects/${f.draftProjectId}/metadata`,
    as: "student",
  },
  {
    name: "23-editor",
    path: (f) => `/projects/${f.draftProjectId}/editor`,
    as: "student",
  },
  { name: "24-reviews", path: () => "/reviews", as: "editor" },
  {
    name: "25-review-modus",
    path: (f) => `/projects/${f.reviewProjectId}/review`,
    as: "editor",
  },
  { name: "26-admin-dashboard", path: () => "/administration", as: "admin" },
  {
    name: "27-admin-projekte",
    path: () => "/administration/projects",
    as: "admin",
  },
  { name: "28-admin-nutzende", path: () => "/administration/users", as: "admin" },
  {
    name: "29-admin-kategorien",
    path: () => "/administration/categories",
    as: "admin",
  },
  {
    name: "30-admin-semester",
    path: () => "/administration/semesters",
    as: "admin",
  },
  {
    name: "31-admin-studienstruktur",
    path: () => "/administration/study-structure",
    as: "admin",
  },
  { name: "32-admin-top10", path: () => "/administration/top10", as: "admin" },
  {
    name: "33-admin-top10-protokoll",
    path: () => "/administration/top10/audit",
    as: "admin",
  },
  {
    name: "34-admin-anfragen",
    path: () => "/administration/support",
    as: "admin",
  },
  {
    name: "35-admin-startseitentexte",
    path: () => "/administration/site-content",
    as: "admin",
  },
]

/** Was sich ohne Bild beurteilen laesst, wandert ins Inventar. */
async function inventar(page: import("@playwright/test").Page) {
  return await page.evaluate(() => {
    const sichtbar = (el: Element) => {
      const r = el.getBoundingClientRect()
      const s = window.getComputedStyle(el)
      return (
        r.width > 0 &&
        r.height > 0 &&
        s.visibility !== "hidden" &&
        s.display !== "none"
      )
    }
    const text = (el: Element) => (el.textContent ?? "").replace(/\s+/g, " ").trim()
    const alle = (sel: string) =>
      Array.from(document.querySelectorAll(sel)).filter(sichtbar)

    return {
      titel: document.title,
      sprache: document.documentElement.lang,
      ueberschriften: alle("h1,h2,h3,h4,h5,h6").map(
        (h) => h.tagName + " " + text(h).slice(0, 90)
      ),
      knoepfe: Array.from(
        new Set(
          alle("button,[role='button']").map(
            (b) =>
              text(b) ||
              b.getAttribute("aria-label") ||
              b.getAttribute("title") ||
              "(ohne Beschriftung)"
          )
        )
      ).slice(0, 60),
      links: Array.from(
        new Set(
          alle("a[href]").map(
            (a) =>
              (text(a) || a.getAttribute("aria-label") || "(leer)") +
              " -> " +
              a.getAttribute("href")
          )
        )
      ).slice(0, 60),
      felder: alle("input,select,textarea").map((f) => {
        const id = f.getAttribute("id")
        const label = id
          ? document.querySelector("label[for='" + CSS.escape(id) + "']")
          : null
        const beschriebenVon = f.getAttribute("aria-describedby")
        return {
          typ: f.getAttribute("type") ?? f.tagName.toLowerCase(),
          name: f.getAttribute("name"),
          label: label ? text(label) : f.getAttribute("aria-label"),
          pflicht:
            f.hasAttribute("required") ||
            f.getAttribute("aria-required") === "true",
          platzhalter: f.getAttribute("placeholder"),
          beschreibung: beschriebenVon
            ? beschriebenVon
                .split(/\s+/)
                .map((x) => document.getElementById(x))
                .filter((x): x is HTMLElement => x !== null)
                .map((x) => text(x))
                .join(" | ")
            : null,
        }
      }),
      meldungen: alle("[role='alert'],[role='status']").map((a) =>
        text(a).slice(0, 200)
      ),
      breadcrumb: alle("[data-slot='breadcrumb'],nav[aria-label]").map((b) =>
        (b.getAttribute("aria-label") + ": " + text(b)).slice(0, 240)
      ),
      tabellen: alle("table").map((t) => ({
        kopf: Array.from(t.querySelectorAll("thead th")).map((th) => text(th)),
        zeilen: t.querySelectorAll("tbody tr").length,
      })),
      leerzustand: alle("[data-slot='empty'],[data-slot='empty-title']").map((e) =>
        text(e).slice(0, 200)
      ),
      seitentextLaenge: (document.body.innerText ?? "").length,
    }
  })
}

test.describe("Durchgang 2: Regelpruefung", () => {
  for (const c of CASES) {
    test(c.name, async ({ page, request }) => {
      const f = await discoverFixtures(request)
      let session: Session | null = null
      if (c.as !== undefined) session = await login(request, c.as)
      await prepare(page, "light", session, c.flow ?? null)
      await page.goto(c.path(f))
      await settle(page)
      await page.waitForTimeout(600)

      const daten = await inventar(page)
      writeFileSync(
        join(OUT, c.name + ".json"),
        JSON.stringify(
          { fall: c.name, adresse: new URL(page.url()).pathname, ...daten },
          null,
          1
        ),
        "utf-8"
      )
      await page.screenshot({
        path: join(OUT, "bilder", c.name + ".png"),
        fullPage: true,
      })

      if (c.narrow === true) {
        await page.setViewportSize({ width: 390, height: 844 })
        await page.waitForTimeout(500)
        await page.screenshot({
          path: join(OUT, "bilder", c.name + "-schmal.png"),
          fullPage: true,
        })
      }
    })
  }
})
