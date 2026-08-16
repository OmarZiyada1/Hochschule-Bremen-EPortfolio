import { describe, expect, it } from "vitest"

import { projectQueries } from "@/api/queries/projects"
import {
  FILTER_DEGREES,
  FILTER_PROJECT_TYPES,
  readFilterSelection,
  toggleValue,
} from "@/features/projects/projectFilters"

describe("readFilterSelection", () => {
  it("liest wiederholte Parameter als Mehrfachauswahl", () => {
    const selection = readFilterSelection(
      new URLSearchParams("faculty=a&faculty=b&degree=BACHELOR&q=egal")
    )

    expect(selection.faculty).toEqual(["a", "b"])
    expect(selection.degree).toEqual(["BACHELOR"])
    expect(selection.studyProgram).toEqual([])
    expect(selection.semester).toEqual([])
    expect(selection.type).toEqual([])
    expect(selection.category).toEqual([])
  })

  it("behaelt in den Enum-Gruppen nur Werte aus dem Contract", () => {
    const selection = readFilterSelection(
      new URLSearchParams("degree=BACHELOR&degree=DIPLOM&type=KEIN_TYP")
    )

    /* Ein Fantasiewert aus einer von Hand geschriebenen URL wuerde am
       Server als 400 enden, obwohl ihn keine Checkbox darstellt; die
       ID-Gruppen bleiben dagegen ungeprueft, weil eine unbekannte ID laut
       §6.1 ein gueltiger Filter mit leerem Ergebnis ist. */
    expect(selection.degree).toEqual(["BACHELOR"])
    expect(selection.type).toEqual([])
  })

  it("kennt alle Contract-Werte der Enum-Gruppen in Template-Reihenfolge", () => {
    expect(FILTER_DEGREES).toEqual(["BACHELOR", "MASTER", "MBA"])
    expect(FILTER_PROJECT_TYPES).toEqual(["PAPER", "REGULAR", "THESIS"])
  })
})

describe("toggleValue", () => {
  it("waehlt einen fehlenden Wert an und einen vorhandenen ab", () => {
    expect(toggleValue(["a"], "b")).toEqual(["a", "b"])
    expect(toggleValue(["a", "b"], "a")).toEqual(["b"])
  })
})

describe("projectQueries.list", () => {
  it("trennt unterschiedliche Filterauswahlen im Query-Key", () => {
    const one = projectQueries.list({ faculty: ["a"] }).queryKey
    const two = projectQueries.list({ faculty: ["a", "b"] }).queryKey
    const three = projectQueries.list({ semester: ["a"] }).queryKey

    /* Zwei Auswahlen teilen sich nie einen Cache-Eintrag: ein Wechsel
       zeigt sonst kurz das Ergebnis der vorigen Auswahl (DoD KAN-64). */
    expect(one).not.toEqual(two)
    expect(one).not.toEqual(three)
    expect(projectQueries.list({ faculty: ["a"] }).queryKey).toEqual(one)
  })
})
