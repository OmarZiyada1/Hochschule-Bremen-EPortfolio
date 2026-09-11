import { screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import PrivacyPage from "@/features/legal/PrivacyPage"
import i18n from "@/i18n"
import { renderWithProviders } from "@/tests/render"

const OPERATOR = "Vorname Nachname"
const STREET = "Musterweg 1"
const CITY = "28199 Bremen"
const EMAIL = "kontakt@example.org"

function withOperatorDetails() {
  vi.stubEnv("VITE_IMPRINT_OPERATOR", OPERATOR)
  vi.stubEnv("VITE_IMPRINT_STREET", STREET)
  vi.stubEnv("VITE_IMPRINT_CITY", CITY)
  vi.stubEnv("VITE_IMPRINT_EMAIL", EMAIL)
}

/** Die Punkte eines Abschnitts, gesucht ueber dessen Ueberschrift. */
function itemsOfSection(titleKey: string, itemsKey: string): string[] {
  const heading = screen.getByRole("heading", {
    level: 2,
    name: i18n.t(titleKey),
  })
  const section = heading.closest("section")
  expect(section).not.toBeNull()
  const items = i18n.t(itemsKey, { returnObjects: true }) as string[]
  expect(items.length).toBeGreaterThan(0)
  for (const item of items) {
    expect(within(section as HTMLElement).getByText(item)).toBeVisible()
  }
  return items
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("PrivacyPage", () => {
  it("traegt genau eine Seitenueberschrift und keine uebersprungene Ebene", () => {
    withOperatorDetails()
    renderWithProviders(<PrivacyPage />, "/privacy")

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(
      screen.getByRole("heading", { level: 1, name: i18n.t("privacy.title") })
    ).toBeVisible()
    /* Elf Abschnitte auf Ebene 2, keine dritte Ebene. */
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(11)
    expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument()
  })

  it("nennt denselben Verantwortlichen wie das Impressum", () => {
    withOperatorDetails()
    renderWithProviders(<PrivacyPage />, "/privacy")

    expect(screen.getByText(OPERATOR)).toBeVisible()
    expect(screen.getByText(STREET)).toBeVisible()
    expect(screen.getByText(CITY)).toBeVisible()
    expect(screen.getByRole("link", { name: EMAIL })).toHaveAttribute(
      "href",
      `mailto:${EMAIL}`
    )
  })

  it("sagt bei fehlender Angabe, dass sie fehlt", () => {
    renderWithProviders(<PrivacyPage />, "/privacy")

    expect(screen.getByText(i18n.t("privacy.controller.missing"))).toBeVisible()
    expect(screen.queryByText(OPERATOR)).not.toBeInTheDocument()
  })

  it("zaehlt jede verarbeitete Datenart auf", () => {
    withOperatorDetails()
    renderWithProviders(<PrivacyPage />, "/privacy")

    itemsOfSection("privacy.data.title", "privacy.data.items")
  })

  it("nennt zu jedem Zweck eine Rechtsgrundlage", () => {
    withOperatorDetails()
    renderWithProviders(<PrivacyPage />, "/privacy")

    const items = itemsOfSection(
      "privacy.purposes.title",
      "privacy.purposes.items"
    )
    for (const item of items) {
      expect(item).toMatch(/Artikel 6 Absatz 1 Buchstabe [bf] DSGVO/)
    }
  })

  /*
   * Der Kern der Seite und der Grund, warum sie nicht aus einem Muster
   * abgeschrieben werden konnte: die Empfaenger sind der tatsaechlich
   * ausgerollte Stapel, und jeder muss mit Standort dastehen. Faellt einer
   * weg, behauptet die Seite eine Verarbeitung, die es so nicht gibt.
   *
   * Der vierte Punkt kam mit der Contract-Pruefung dazu und ist der
   * wichtigste: der Lesepfad oeffnet iframes auf youtube, vimeo, figma und
   * codepen (Contract 2.5, providers.ts). Eine fruehere Fassung dieser Seite
   * bestritt jede Drittlandsuebermittlung und jedes fremde Skript, waehrend
   * eine Projektseite mit Videoblock genau das tut. Faellt der Punkt weg,
   * steht das Dementi wieder unwidersprochen da.
   */
  it("nennt jeden Empfaenger mit Standort, auch die Einbettungen", () => {
    withOperatorDetails()
    renderWithProviders(<PrivacyPage />, "/privacy")

    const items = itemsOfSection(
      "privacy.processors.title",
      "privacy.processors.items"
    )
    expect(items).toHaveLength(4)
    /* Serverbetrieb, Dateiablage, Mailversand, Einbettungen. */
    expect(items[0]).toContain("Deutschland")
    expect(items[1]).toContain("Schweden")
    expect(items[2]).toContain("Litauen")
    for (const provider of ["YouTube", "Vimeo", "Figma", "CodePen"]) {
      expect(items[3]).toContain(provider)
    }
    expect(items[3]).toContain("Vereinigte Staaten")
    expect(screen.getByText(i18n.t("privacy.processors.note"))).toBeVisible()
  })

  /*
   * Es gibt keine Selbstloeschung: AdminUserService setzt
   * status = DEACTIVATED und loescht ausdruecklich keine Zeile. Artikel 17
   * DSGVO gilt trotzdem, also muss die Seite den Weg von Hand nennen. Ein
   * Text, der eine Schaltflaeche verspraeche, waere schlicht falsch.
   */
  it("beschreibt die Loeschung als Weg von Hand", () => {
    withOperatorDetails()
    renderWithProviders(<PrivacyPage />, "/privacy")

    expect(screen.getByText(i18n.t("privacy.deletion.text"))).toBeVisible()
  })

  /*
   * Wer das oeffentliche Kontaktformular ohne Konto benutzt, hat hinterher
   * keinen Weg ueber die Oberflaeche zu seinen Daten. Genau diesen Fall
   * verlangt KAN-100 ausdruecklich beschrieben.
   */
  it("beschreibt den Weg fuer Personen ohne Konto", () => {
    withOperatorDetails()
    renderWithProviders(<PrivacyPage />, "/privacy")

    expect(screen.getByText(i18n.t("privacy.contactForm.text"))).toBeVisible()
  })

  it("fuehrt jedes Betroffenenrecht auf und den Weg zur Aufsichtsbehoerde", () => {
    withOperatorDetails()
    renderWithProviders(<PrivacyPage />, "/privacy")

    itemsOfSection("privacy.rights.title", "privacy.rights.items")
    expect(screen.getByText(i18n.t("privacy.rights.authority"))).toBeVisible()
  })

  /*
   * Vier Absaetze und nicht zwei. Die beiden neuen halten fest, was die
   * Pruefer als falsche Zusagen aufgedeckt haben: dass die eingebetteten
   * Medien die Ausnahme vom Tracking-Dementi sind (consent), und dass das
   * Abmelden das Token nur im Browser loescht, waehrend es auf dem Server
   * bis zum Ablauf gueltig bleibt (logout, Contract 6.5).
   */
  it("nennt die Grenzen des Tracking-Dementis und der Abmeldung", () => {
    withOperatorDetails()
    renderWithProviders(<PrivacyPage />, "/privacy")

    for (const key of [
      "privacy.noTracking.text",
      "privacy.noTracking.consent",
      "privacy.noTracking.storage",
      "privacy.noTracking.logout",
      "privacy.indexing.text",
    ] as const) {
      expect(screen.getByText(i18n.t(key))).toBeVisible()
    }
  })

  /*
   * Die schwerste Auslassung der ersten Fassung: PortfolioUserResponse fuehrt
   * die private E-Mail als Kontaktweg (Contract 3.2), und /api/portfolios/*
   * steht in der permitAll-Liste von SecurityConfig. Sie ist damit ohne
   * Anmeldung abrufbar, und die Seite muss das sagen, statt die Adresse nur
   * unter "Konto" zu fuehren.
   */
  it("sagt, dass die private E-Mail-Adresse oeffentlich abrufbar ist", () => {
    withOperatorDetails()
    renderWithProviders(<PrivacyPage />, "/privacy")

    const items = i18n.t("privacy.data.items", {
      returnObjects: true,
    }) as string[]
    const profile = items.find((item) => item.startsWith("Öffentliches Profil"))
    expect(profile).toBeDefined()
    expect(profile).toContain("private E-Mail-Adresse")
    expect(profile).toContain("ohne Anmeldung abrufbar")
    expect(screen.getByText(profile as string)).toBeVisible()
  })

  /*
   * Contract 5, Fussnote 11: ein DRAFT bleibt Autor:in, Projektmitgliedern
   * und Admin vorbehalten, AUCH gegenueber der bereits zugewiesenen
   * Redaktion. Die erste Fassung dieser Seite hatte es genau andersherum.
   */
  it("beschreibt richtig, wer einen Entwurf sieht", () => {
    withOperatorDetails()
    renderWithProviders(<PrivacyPage />, "/privacy")

    const items = i18n.t("privacy.data.items", {
      returnObjects: true,
    }) as string[]
    const projects = items.find((item) => item.startsWith("Projekte:"))
    expect(projects).toBeDefined()
    expect(projects).toContain("Projektmitglieder")
    expect(projects).toContain("nach dem Einreichen")
  })

  it("verweist auf Impressum und Barrierefreiheit", () => {
    withOperatorDetails()
    renderWithProviders(<PrivacyPage />, "/privacy")

    for (const [key, href] of [
      ["privacy.related.imprint", "/imprint"],
      ["privacy.related.accessibility", "/accessibility"],
    ] as const) {
      expect(screen.getByRole("link", { name: i18n.t(key) })).toHaveAttribute(
        "href",
        href
      )
    }
  })
})
