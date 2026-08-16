import { describe, expect, it } from "vitest"

import { paginationItems } from "@/features/projects/paginationItems"

/**
 * Fensterbildung der Bibliotheks-Paginierung (Ticket KAN-31): erste und
 * letzte Seite immer, Fenster um die aktuelle, genau eine Auslassung je
 * Seite der Position. Die Faelle laufen ohne Rendern, genau dafuer liegt
 * die Funktion neben der Seite.
 */
describe("paginationItems", () => {
  it("zeigt am Anfang das Fenster und eine Auslassung zum Ende", () => {
    expect(paginationItems(1, 12)).toEqual([1, 2, "ellipsis-end", 12])
  })

  it("zeigt in der Mitte beide Auslassungen", () => {
    expect(paginationItems(6, 12)).toEqual([
      1,
      "ellipsis-start",
      5,
      6,
      7,
      "ellipsis-end",
      12,
    ])
  })

  it("zeigt am Ende die Auslassung zum Anfang", () => {
    expect(paginationItems(12, 12)).toEqual([1, "ellipsis-start", 11, 12])
  })

  it("laesst die Auslassung weg, wenn keine Luecke entsteht", () => {
    expect(paginationItems(3, 5)).toEqual([1, 2, 3, 4, 5])
  })

  it("kommt mit kleinen Gesamtmengen aus", () => {
    expect(paginationItems(1, 1)).toEqual([1])
    expect(paginationItems(1, 2)).toEqual([1, 2])
    expect(paginationItems(2, 2)).toEqual([1, 2])
  })

  it("liefert ohne Seiten nichts", () => {
    expect(paginationItems(1, 0)).toEqual([])
  })
})
