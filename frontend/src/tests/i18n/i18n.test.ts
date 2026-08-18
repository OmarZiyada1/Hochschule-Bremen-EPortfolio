import { describe, expect, it } from "vitest"

import { ERROR_CODES } from "@/api/errors"
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

  /*
   * Ein Fehlercode ohne Uebersetzung erscheint in der Oberflaeche als roher
   * Schluesselname. Aufgefallen mit KAN-10 an
   * FILE_RANGE_NOT_SATISFIABLE, das seit Contract v52 in errors.ts steht
   * und in keiner der beiden Sprachdateien stand.
   */
  it("uebersetzt jeden Fehlercode aus Contract 6.2", () => {
    for (const code of ERROR_CODES) {
      expect(de.apiError, code).toHaveProperty(code)
      expect(en.apiError, code).toHaveProperty(code)
    }
  })

  /*
   * Der Namensraum des Read-Only-Renderers (KAN-10). Er traegt unter
   * anderem den Platzhalter fuer unbekannte Bloecke, die iframe-Titel, die
   * zugaenglichen Namen von video und audio, die Beschriftung des
   * scrollbaren Tabellenbereichs, den Dokumentlink und die
   * Formel-Fehlermeldung.
   */
  it("fuehrt den Namensraum projectContent in beiden Sprachen", () => {
    for (const bereich of [
      "unknownBlock",
      "formula",
      "table",
      "video",
      "audio",
      "embed",
      "document",
      "provider",
    ]) {
      expect(de.projectContent, bereich).toHaveProperty(bereich)
      expect(en.projectContent, bereich).toHaveProperty(bereich)
    }

    /* Je Anbieter aus der Allowlist ein Anzeigename (Contract 2.5). */
    expect(Object.keys(de.projectContent.provider)).toEqual([
      "youtube",
      "vimeo",
      "figma",
      "codepen",
      "gist",
    ])
  })
})
