import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"

import HelpPage from "@/features/help/HelpPage"
import i18n from "@/i18n"
import { renderWithProviders } from "@/tests/render"
import { signInAs } from "@/tests/routes/helpers"

/**
 * Die Hilfeseite unter {@code /help} (KAN-93).
 *
 * <p>Zwei Zusagen tragen diese Seite, und beide werden hier belegt: die
 * Ueberschriftenstruktur (genau eine h1, keine uebersprungene Ebene) und die
 * Sichtbarkeit je Zugriffsebene. Der zweite Punkt wird bewusst in beide
 * Richtungen geprueft: dass der eigene Bereich da ist, sagt fuer sich genommen
 * nichts darueber, ob die fremden fehlen.
 */
const sectionTitle = (key: string) => i18n.t(`help.${key}.title`)

describe("HelpPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
  })

  it("traegt genau eine Seitenueberschrift", () => {
    renderWithProviders(<HelpPage />, "/help")

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(
      screen.getByRole("heading", { level: 1, name: i18n.t("help.title") })
    ).toBeVisible()
  })

  it("zeigt ohne Anmeldung allein den oeffentlichen Bereich", () => {
    renderWithProviders(<HelpPage />, "/help")

    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(1)
    expect(
      screen.getByRole("heading", { level: 2, name: sectionTitle("visitors") })
    ).toBeVisible()
    for (const key of ["students", "editors", "admins"]) {
      expect(
        screen.queryByRole("heading", { level: 2, name: sectionTitle(key) })
      ).not.toBeInTheDocument()
    }
  })

  it("zeigt einem studentischen Konto zusaetzlich den Editor", () => {
    signInAs("STUDENT")
    renderWithProviders(<HelpPage />, "/help")

    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(2)
    expect(
      screen.getByRole("heading", { level: 2, name: sectionTitle("students") })
    ).toBeVisible()
    expect(
      screen.queryByRole("heading", { level: 2, name: sectionTitle("editors") })
    ).not.toBeInTheDocument()
  })

  it("zeigt der Redaktion ihren eigenen Bereich, aber nicht die Administration", () => {
    signInAs("EDITOR")
    renderWithProviders(<HelpPage />, "/help")

    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(3)
    expect(
      screen.getByRole("heading", { level: 2, name: sectionTitle("editors") })
    ).toBeVisible()
    expect(
      screen.queryByRole("heading", { level: 2, name: sectionTitle("admins") })
    ).not.toBeInTheDocument()
  })

  /*
   * ADMIN ist seit KAN-82 die Obermenge von STUDENT und EDITOR (§2.1): ein
   * Verwaltungskonto fuehrt ein eigenes Portfolio und arbeitet redaktionell,
   * also braucht es beide Anleitungen und nicht nur die eigene.
   */
  it("zeigt der Administration alle vier Bereiche", () => {
    signInAs("ADMIN")
    renderWithProviders(<HelpPage />, "/help")

    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(4)
    for (const key of ["visitors", "students", "editors", "admins"]) {
      expect(
        screen.getByRole("heading", { level: 2, name: sectionTitle(key) })
      ).toBeVisible()
    }
  })

  /*
   * Die dritte Ebene setzt nicht die Seite, sondern Base UI: Accordion.Header
   * rendert fest ein h3. Geprueft wird deshalb, dass die Kette h1, h2, h3
   * geschlossen bleibt und keine vierte Ebene dazukommt (SC 1.3.1).
   */
  it("fuehrt die aufklappbaren Punkte als dritte Ebene und keine vierte", () => {
    renderWithProviders(<HelpPage />, "/help")

    expect(screen.getAllByRole("heading", { level: 3 }).length).toBeGreaterThan(
      0
    )
    expect(screen.queryByRole("heading", { level: 4 })).not.toBeInTheDocument()
  })

  it("fuehrt im Sprungverzeichnis nur die sichtbaren Bereiche", () => {
    signInAs("EDITOR")
    renderWithProviders(<HelpPage />, "/help")

    const contents = screen.getByRole("navigation", {
      name: i18n.t("help.contents"),
    })
    const links = within(contents).getAllByRole("link")
    expect(links.map((link) => link.textContent)).toEqual([
      sectionTitle("visitors"),
      sectionTitle("students"),
      sectionTitle("editors"),
    ])
    expect(links[0]).toHaveAttribute("href", "#help-visitors")
  })

  /*
   * Ohne Anmeldung gibt es genau einen Bereich. Ein Verzeichnis mit einem
   * einzigen Eintrag verspricht eine Gliederung, die es nicht gibt, und
   * stuende als leere Karte zwischen Einleitung und Inhalt.
   */
  it("laesst das Sprungverzeichnis bei einem einzigen Bereich weg", () => {
    renderWithProviders(<HelpPage />, "/help")

    expect(
      screen.queryByRole("navigation", { name: i18n.t("help.contents") })
    ).not.toBeInTheDocument()
  })

  it("zeigt beim Aufklappen Text, Aufzaehlung und Abbildung", async () => {
    const user = userEvent.setup()
    renderWithProviders(<HelpPage />, "/help")

    const base = "help.visitors.topics.browse"
    await user.click(
      screen.getByRole("button", { name: i18n.t(`${base}.title`) })
    )

    expect(await screen.findByText(i18n.t(`${base}.text`))).toBeVisible()
    const steps = i18n.t(`${base}.steps`, { returnObjects: true }) as string[]
    expect(steps.length).toBeGreaterThan(0)
    for (const step of steps) {
      expect(screen.getByText(step)).toBeVisible()
    }
    expect(screen.getByText(i18n.t(`${base}.imageCaption`))).toBeVisible()
  })

  /*
   * Ein erklaerendes Bild mit leerem alt waere hier der Befund: es traegt
   * Inhalt und ist kein Schmuck.
   *
   * hidden: true schliesst die zugeklappten Punkte ein. Seit
   * `hiddenUntilFound` haengen sie im Baum, damit die Browsersuche den Text
   * findet; ohne dieses Flag faende die Abfrage nur die offenen, und der
   * Fall pruefte fast nichts.
   */
  it("gibt jeder Abbildung einen Alternativtext aus i18n", async () => {
    const user = userEvent.setup()
    signInAs("ADMIN")
    renderWithProviders(<HelpPage />, "/help")

    const images = screen.getAllByRole("img", { hidden: true })
    expect(images.length).toBeGreaterThan(20)
    for (const image of images) {
      expect(image).toHaveAccessibleName()
      /* Ohne width und height misst Base UI die Panelhoehe ohne das noch
         ladende Bild, und der Punkt springt beim Oeffnen auf. */
      expect(image).toHaveAttribute("width")
      expect(image).toHaveAttribute("height")
      expect(image.closest("figure")).not.toBeNull()
    }

    /* Und einmal sichtbar am aufgeklappten Punkt. */
    await user.click(
      screen.getByRole("button", {
        name: i18n.t("help.visitors.topics.browse.title"),
      })
    )
    expect(
      await screen.findByRole("img", {
        name: i18n.t("help.visitors.topics.browse.imageAlt"),
      })
    ).toBeVisible()
  })

  it("fuehrt zum Kontaktformular", () => {
    renderWithProviders(<HelpPage />, "/help")

    expect(
      screen.getByRole("link", { name: i18n.t("help.feedback.link") })
    ).toHaveAttribute("href", "/support")
  })

  it("sagt, dass die Abbildungen die englische Oberflaeche zeigen", () => {
    renderWithProviders(<HelpPage />, "/help")

    expect(screen.getByText(i18n.t("help.imageNote"))).toBeVisible()
  })
})
