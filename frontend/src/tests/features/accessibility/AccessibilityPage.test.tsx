import { screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import AccessibilityPage from "@/features/accessibility/AccessibilityPage"
import i18n from "@/i18n"
import { renderWithProviders } from "@/tests/render"

describe("AccessibilityPage", () => {
  it("traegt genau eine Seitenueberschrift und keine uebersprungene Ebene", () => {
    renderWithProviders(<AccessibilityPage />, "/accessibility")

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: i18n.t("accessibility.title"),
      })
    ).toBeVisible()
    /* Ebene 2 fuer jeden Abschnitt, Ebene 3 gibt es hier nicht. */
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(5)
    expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument()
  })

  /*
   * Der Kern der Seite: sie behauptet keine Konformitaet, sondern berichtet
   * einen Pruefstand. Faellt dieser Satz weg, wird aus dem Bericht eine
   * Zusage, die niemand halten kann (KAN-42, Umfang 9).
   */
  it("weist ausdruecklich aus, keine foermliche Erklaerung zu sein", () => {
    renderWithProviders(<AccessibilityPage />, "/accessibility")

    expect(screen.getByText(i18n.t("accessibility.notFormal"))).toBeVisible()
  })

  it("nennt jede bekannte Grenze", () => {
    renderWithProviders(<AccessibilityPage />, "/accessibility")

    const limits = i18n.t("accessibility.limits.items", {
      returnObjects: true,
    }) as string[]
    expect(limits.length).toBeGreaterThan(0)
    for (const limit of limits) {
      expect(screen.getByText(limit)).toBeVisible()
    }
  })

  it("fuehrt zum Kontaktformular", () => {
    renderWithProviders(<AccessibilityPage />, "/accessibility")

    const link = screen.getByRole("link", {
      name: i18n.t("accessibility.feedback.link"),
    })
    expect(link).toHaveAttribute("href", "/support")
  })

  /*
   * Die Listen kommen ueber returnObjects aus i18n. Ohne diesen Fall faellt
   * ein fehlender Schluessel erst im Browser auf, und zwar als leerer
   * Abschnitt.
   */
  it("rendert die Verfahrensschritte als Liste", () => {
    renderWithProviders(<AccessibilityPage />, "/accessibility")

    const heading = screen.getByRole("heading", {
      level: 2,
      name: i18n.t("accessibility.method.title"),
    })
    const section = heading.closest("section")
    expect(section).not.toBeNull()
    const items = within(section as HTMLElement).getAllByRole("listitem")
    expect(items).toHaveLength(
      (
        i18n.t("accessibility.method.items", {
          returnObjects: true,
        }) as string[]
      ).length
    )
  })
})
