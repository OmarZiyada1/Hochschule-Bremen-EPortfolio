import { screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import {
  ProjectPeople,
  type DisplayPerson,
} from "@/components/common/ProjectPeople"
import i18n from "@/i18n"
import { renderWithProviders } from "@/tests/render"

function person(id: string, firstName: string, lastName: string): DisplayPerson {
  return { id, firstName, lastName }
}

const LENA = person("u-1", "Lena", "Müller")
const MAX = person("u-2", "Max", "Weber")
const ANNA = person("u-3", "Anna", "Fischer")
const PAUL = person("u-4", "Paul", "Krüger")
const CLARA = person("u-5", "Clara", "Hoffmann")

/**
 * Die Personen eines Projekts (Nacharbeit an KAN-40): eine Person mit Namen,
 * ab zwei eine Gruppe mit Zaehler und ohne sichtbare Namen.
 */
describe("ProjectPeople", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
  })

  it("zeigt bei genau einer Person den Namen aus", () => {
    renderWithProviders(<ProjectPeople people={[LENA]} />)

    expect(screen.getByText("Lena Müller")).toBeVisible()
  })

  /*
   * Die Regel aus der Nacharbeit: mehrere Namen nebeneinander brechen auf
   * einer Kachel um und lesen sich als Rangfolge. Sichtbar bleibt die
   * Gruppe.
   */
  it("nennt ab zwei Personen keinen Namen mehr sichtbar", () => {
    renderWithProviders(<ProjectPeople people={[LENA, MAX]} />)

    expect(screen.queryByText("Lena Müller")).not.toBeInTheDocument()
    expect(screen.queryByText("Max Weber")).not.toBeInTheDocument()
  })

  /*
   * Verschwunden sind die Namen nur optisch. Ein Bild ohne Namen waere fuer
   * einen Screenreader nichts; der Satz nennt jede Person, auch die, deren
   * Gesicht hinter dem Zaehler steckt.
   */
  it("nennt jede Person im vorgelesenen Satz, auch die hinter dem Zaehler", () => {
    renderWithProviders(
      <ProjectPeople people={[LENA, MAX, ANNA, PAUL, CLARA]} />
    )

    const satz = screen.getByText(/^Von /)
    for (const name of [
      "Lena Müller",
      "Max Weber",
      "Anna Fischer",
      "Paul Krüger",
      "Clara Hoffmann",
    ]) {
      expect(satz).toHaveTextContent(name)
    }
  })

  /*
   * Befund aus KAN-29: ein Text im DOM, den aria-hidden verdeckt, besteht
   * getByText anstandslos und wird trotzdem nie vorgelesen.
   */
  it("haelt den vorgelesenen Satz erreichbar", () => {
    renderWithProviders(<ProjectPeople people={[LENA, MAX]} />)

    expect(screen.getByText(/^Von /).closest("[aria-hidden]")).toBeNull()
  })

  it("zeigt bis zu drei Gesichter und den Rest als Zahl", () => {
    const { container } = renderWithProviders(
      <ProjectPeople people={[LENA, MAX, ANNA, PAUL, CLARA]} />
    )

    const group = container.querySelector('[data-slot="avatar-group"]')
    expect(group).not.toBeNull()
    expect(
      group?.querySelectorAll('[data-slot="avatar"]')
    ).toHaveLength(3)
    /* Der Rest, nicht die Gesamtzahl: neben drei Gesichtern liest sich
       „+2" als „zwei weitere". */
    expect(
      within(group as HTMLElement).getByText("+2")
    ).toBeInTheDocument()
  })

  it("laesst den Zaehler weg, solange alle Gesichter passen", () => {
    const { container } = renderWithProviders(
      <ProjectPeople people={[LENA, MAX, ANNA]} />
    )

    const group = container.querySelector('[data-slot="avatar-group"]')
    expect(group?.querySelectorAll('[data-slot="avatar"]')).toHaveLength(3)
    expect(
      group?.querySelector('[data-slot="avatar-group-count"]')
    ).toBeNull()
  })

  /* Ein Projekt ohne Personen gibt es fachlich nicht; ein Platzhalter waere
     eine Behauptung. */
  it("zeigt bei leerer Liste nichts", () => {
    const { container } = renderWithProviders(<ProjectPeople people={[]} />)

    expect(container).toBeEmptyDOMElement()
  })
})
