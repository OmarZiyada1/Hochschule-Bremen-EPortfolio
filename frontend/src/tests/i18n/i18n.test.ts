import { describe, expect, it } from "vitest"

import de from "@/i18n/de.json"
import en from "@/i18n/en.json"

/*
 * Ein Schluessel, den es nur in de.json gibt, faellt im englischen Betrieb
 * als roher Name auf und sonst nirgends. Deshalb wird der Gleichstand
 * geprueft und nicht dem Gedaechtnis ueberlassen (KAN-6, Abschnitt 7).
 */

function keysOf(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) {
    return [prefix]
  }

  return Object.entries(value).flatMap(([key, nested]) =>
    keysOf(nested, prefix === "" ? key : `${prefix}.${key}`)
  )
}

describe("i18n-Ressourcen", () => {
  it("fuehrt in beiden Sprachen dieselben Schluessel", () => {
    expect(keysOf(en).sort()).toEqual(keysOf(de).sort())
  })

  it("uebersetzt jeden Projektstatus aus Contract 2.2", () => {
    for (const status of [
      "DRAFT",
      "SUBMITTED",
      "APPROVED",
      "PUBLISHED",
      "REVISION",
    ]) {
      expect(de.project.status).toHaveProperty(status)
      expect(en.project.status).toHaveProperty(status)
    }
  })

  it("uebersetzt jede Rolle aus Contract 2.1 und keine vierte", () => {
    expect(Object.keys(de.user.role)).toEqual(["STUDENT", "EDITOR", "ADMIN"])
    expect(Object.keys(en.user.role)).toEqual(["STUDENT", "EDITOR", "ADMIN"])
  })
})
