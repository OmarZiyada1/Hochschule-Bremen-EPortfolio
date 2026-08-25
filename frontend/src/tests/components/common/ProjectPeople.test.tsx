import { screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import {
  ProjectPeople,
  type DisplayPerson,
} from "@/components/common/ProjectPeople"
import i18n from "@/i18n"
import { renderWithProviders } from "@/tests/render"

function person(
  id: string,
  firstName: string,
  lastName: string
): DisplayPerson {
  return { id, firstName, lastName }
}

const LENA = person("u-1", "Lena", "Müller")
const MAX = person("u-2", "Max", "Weber")
const ANNA = person("u-3", "Anna", "Fischer")
const PAUL = person("u-4", "Paul", "Krüger")
const CLARA = person("u-5", "Clara", "Hoffmann")

/**
 * Die Personen eines Projekts (Nacharbeit an KAN-40, verlinkt seit KAN-80):
 * eine Person mit Namen, ab zwei eine Gruppe mit Zaehler und ohne sichtbare
 * Namen. Jede Person ist ein Link auf ihr Portfolio.
 */
describe("ProjectPeople", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
  })

  it("zeigt bei genau einer Person den Namen aus", () => {
    renderWithProviders(<ProjectPeople people={[LENA]} />)

    expect(screen.getByText("Lena Müller")).toBeVisible()
  })

  /* Punkt 4 aus KAN-80: Namen sind ueberall Wege zu einer Person. */
  it("fuehrt die einzelne Person auf ihr Portfolio", () => {
    renderWithProviders(<ProjectPeople people={[LENA]} />)

    expect(screen.getByRole("link", { name: "Lena Müller" })).toHaveAttribute(
      "href",
      "/portfolios/u-1"
    )
  })

  /*
   * Die Regel aus der Nacharbeit: mehrere Namen nebeneinander brechen auf
   * einer Kachel um und lesen sich als Rangfolge. Sichtbar bleibt die
   * Gruppe.
   */
  it("nennt ab zwei Personen keinen Namen mehr sichtbar", () => {
    renderWithProviders(<ProjectPeople people={[LENA, MAX]} />)

    /* Sichtbar bleibt die Gruppe. Die Namen stehen im DOM, aber
       ausschliesslich als sr-only-Text: er gibt dem Link seinen
       zugaenglichen Namen, ohne die Kachel zu verbreitern. Geprueft wird die
       Klasse und nicht toBeVisible, denn sr-only versteckt ueber clip und
       Groesse, was jest-dom weiterhin als sichtbar zaehlt. */
    expect(screen.getByText("Lena Müller")).toHaveClass("sr-only")
    expect(screen.getByText("Max Weber")).toHaveClass("sr-only")
  })

  /*
   * Verschwunden sind die Namen nur optisch. Jede Person traegt ihren Namen
   * seit KAN-80 selbst, als zugaenglicher Name ihres Links; das gilt auch
   * fuer die, deren Gesicht zusammengeschoben hinter dem Zaehler steckt.
   */
  it("nennt jede Person als Link, auch die hinter dem Zaehler", () => {
    renderWithProviders(
      <ProjectPeople people={[LENA, MAX, ANNA, PAUL, CLARA]} />
    )

    for (const [name, id] of [
      ["Lena Müller", "u-1"],
      ["Max Weber", "u-2"],
      ["Anna Fischer", "u-3"],
      ["Paul Krüger", "u-4"],
      ["Clara Hoffmann", "u-5"],
    ]) {
      expect(screen.getByRole("link", { name })).toHaveAttribute(
        "href",
        `/portfolios/${id}`
      )
    }
  })

  /*
   * Befund aus KAN-29: ein Text im DOM, den aria-hidden verdeckt, besteht
   * getByText anstandslos und wird trotzdem nie vorgelesen. Die Gruppe ist
   * deshalb nicht mehr aria-hidden, seit sie Links traegt.
   */
  it("haelt die Gruppe fuer Hilfsmittel erreichbar", () => {
    renderWithProviders(<ProjectPeople people={[LENA, MAX]} />)

    expect(
      screen.getByRole("link", { name: "Lena Müller" }).closest("[aria-hidden]")
    ).toBeNull()
  })

  it("zeigt drei Gesichter offen und den Rest als Zahl", () => {
    const { container } = renderWithProviders(
      <ProjectPeople people={[LENA, MAX, ANNA, PAUL, CLARA]} />
    )

    const group = container.querySelector('[data-slot="avatar-group"]')
    expect(group).not.toBeNull()
    /* Alle fuenf stehen im DOM: die hinteren sind zusammengeschoben und
       nicht ausgeblendet, sonst waeren sie mit der Tastatur unerreichbar
       und die Gruppe liesse sich nie oeffnen (KAN-80). */
    expect(group?.querySelectorAll('[data-slot="avatar"]')).toHaveLength(5)
    expect(group?.querySelectorAll('a[class*="max-w-0"]')).toHaveLength(2)
    /* Der Rest, nicht die Gesamtzahl: neben drei Gesichtern liest sich
       „+2" als „zwei weitere". */
    expect(within(group as HTMLElement).getByText("+2")).toBeInTheDocument()
  })

  /*
   * Punkt aus der Nacharbeit zu KAN-80: die Zahl war groesser als die Kreise
   * daneben. Die Primitive gibt ihr size-8 und schaltet nur auf size-6 um,
   * wenn die Gruppe ein data-size="sm" enthaelt; das kann sie hier nie, weil
   * die Avatarhuelle der Primitive immer size="default" reicht.
   */
  it("gibt dem Zaehler dasselbe Mass wie den Gesichtern", () => {
    const { container } = renderWithProviders(
      <ProjectPeople people={[LENA, MAX, ANNA, PAUL, CLARA]} />
    )

    const group = container.querySelector('[data-slot="avatar-group"]')
    const counter = group?.querySelector('[data-slot="avatar-group-count"]')
    const face = group?.querySelector('[data-slot="avatar"]')

    expect(counter).not.toBeNull()
    expect(counter).toHaveClass("size-6")
    expect(face).toHaveClass("size-6")
  })

  /*
   * Zusammengeschoben und aufgefaechert sind zwei verschiedene Layouts. Ein
   * Uebergang dazwischen animiert Breiten und Abstaende, also genau die
   * Eigenschaften, die den Browser bei jedem Einzelbild neu rechnen lassen;
   * die Kachel ruckelte und die Elemente daneben tanzten mit. Weich bleibt
   * allein die Deckkraft.
   */
  it("animiert nichts, was das Layout kostet", () => {
    const { container } = renderWithProviders(
      <ProjectPeople people={[LENA, MAX, ANNA, PAUL, CLARA]} />
    )

    const group = container.querySelector('[data-slot="avatar-group"]')
    for (const element of group?.querySelectorAll('[class*="transition"]') ??
      []) {
      expect(element.className).toContain("transition-opacity")
      expect(element.className).not.toContain("transition-[max-width")
      expect(element.className).not.toContain("transition-all")
    }
  })

  /*
   * Die Gruppe reserviert die Breite ihres aufgefaecherten Zustands, damit
   * die Kachel beim Hovern nicht umbricht und wegspringt.
   */
  it("reserviert den Platz des aufgefaecherten Zustands", () => {
    const { container } = renderWithProviders(
      <ProjectPeople people={[LENA, MAX, ANNA, PAUL, CLARA]} />
    )

    const group = container.querySelector(
      '[data-slot="avatar-group"]'
    ) as HTMLElement

    /* Fuenf Gesichter zu 1,5rem plus je 0,25rem Abstand. */
    expect(group.style.minWidth).toBe("8.75rem")
  })

  it("laesst den Zaehler weg, solange alle Gesichter passen", () => {
    const { container } = renderWithProviders(
      <ProjectPeople people={[LENA, MAX, ANNA]} />
    )

    const group = container.querySelector('[data-slot="avatar-group"]')
    expect(group?.querySelectorAll('[data-slot="avatar"]')).toHaveLength(3)
    expect(group?.querySelector('[data-slot="avatar-group-count"]')).toBeNull()
  })

  /* Ein Projekt ohne Personen gibt es fachlich nicht; ein Platzhalter waere
     eine Behauptung. */
  it("zeigt bei leerer Liste nichts", () => {
    const { container } = renderWithProviders(<ProjectPeople people={[]} />)

    expect(container).toBeEmptyDOMElement()
  })
})
