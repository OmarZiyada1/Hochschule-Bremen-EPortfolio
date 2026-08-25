import { describe, expect, it } from "vitest"

import type { CategoryResponse } from "@/api/types"
import {
  CATEGORY_GROUP_OTHER,
  filterCategories,
  groupCategories,
  initialOf,
} from "@/features/administration/categoryGroups"

function category(name: string): CategoryResponse {
  return { id: name, name }
}

/**
 * Die alphabetischen Baender der Kategorienliste (KAN-39). Reine Funktionen,
 * also ohne Rendern geprueft (Skill frontend-modul, Abschnitt 3).
 */
describe("categoryGroups", () => {
  it("fuehrt Umlaute auf ihren Grundbuchstaben zurueck", () => {
    /* „Öffentlicher Dienst" steht im Frame bei M bis O und nicht im
       Auffangband; ohne die Zurueckfuehrung landete es dort. */
    expect(initialOf("Öffentlicher Dienst")).toBe("O")
    expect(initialOf("Ärztliche Versorgung")).toBe("A")
    expect(initialOf("informatik")).toBe("I")
  })

  it("meldet alles ausserhalb von A bis Z als bandlos", () => {
    expect(initialOf("3D-Druck")).toBeNull()
    expect(initialOf("")).toBeNull()
  })

  it("verteilt auf die acht Baender des Frames", () => {
    const groups = groupCategories([
      category("Architektur"),
      category("Bionik"),
      category("Digitalisierung"),
      category("Wirtschaft"),
    ])

    expect(groups.map((group) => group.id)).toEqual(["A-C", "D-F", "V-Z"])
    expect(groups[0].categories.map((entry) => entry.name)).toEqual([
      "Architektur",
      "Bionik",
    ])
  })

  it("laesst leere Baender weg", () => {
    const groups = groupCategories([category("Logistik")])

    /* Ein Band „J – L (0)" waere eine Ueberschrift ohne Inhalt und liesse
       die Liste voller aussehen, als sie ist. */
    expect(groups).toHaveLength(1)
    expect(groups[0].id).toBe("J-L")
  })

  it("faengt Namen ohne Anfangsbuchstaben in einem eigenen Band", () => {
    const groups = groupCategories([category("3D-Druck"), category("Bionik")])

    const other = groups.find((group) => group.id === CATEGORY_GROUP_OTHER)
    expect(other?.categories.map((entry) => entry.name)).toEqual(["3D-Druck"])
  })

  it("sortiert innerhalb des Bandes nach Namen", () => {
    const groups = groupCategories([
      category("Bionik"),
      category("Architektur"),
    ])

    expect(groups[0].categories.map((entry) => entry.name)).toEqual([
      "Architektur",
      "Bionik",
    ])
  })

  it("filtert ohne Ruecksicht auf Gross- und Kleinschreibung", () => {
    const all = [category("Informatik"), category("Bionik")]

    expect(filterCategories(all, "ni").map((entry) => entry.name)).toEqual([
      "Bionik",
    ])
    expect(filterCategories(all, "INFO").map((entry) => entry.name)).toEqual([
      "Informatik",
    ])
    expect(filterCategories(all, "   ")).toHaveLength(2)
  })
})
