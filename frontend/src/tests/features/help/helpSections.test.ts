import { describe, expect, it } from "vitest"

import { HELP_SECTIONS, helpSectionsFor } from "@/features/help/helpSections"
import { helpScreenshots } from "@/features/help/screenshots"
import i18n from "@/i18n"

/**
 * Die Gliederung der Hilfeseite als reine Funktion (KAN-93).
 *
 * <p>Geprueft wird hier, was ohne Rendern zu pruefen ist: welche Bereiche
 * eine Zugriffsebene sieht, und dass jeder Bildschluessel auch ein Bild hat.
 * Die Darstellung selbst prueft HelpPage.test.tsx ueber die Oberflaeche.
 */
describe("helpSectionsFor", () => {
  it("zeigt ohne Anmeldung allein den oeffentlichen Bereich", () => {
    expect(helpSectionsFor(null).map((section) => section.key)).toEqual([
      "visitors",
    ])
  })

  it("gibt einem studentischen Konto den Editor dazu", () => {
    expect(helpSectionsFor("STUDENT").map((section) => section.key)).toEqual([
      "visitors",
      "students",
    ])
  })

  it("gibt der Redaktion zusaetzlich ihren Bereich", () => {
    expect(helpSectionsFor("EDITOR").map((section) => section.key)).toEqual([
      "visitors",
      "students",
      "editors",
    ])
  })

  /*
   * ADMIN ist seit KAN-82 die Obermenge von STUDENT und EDITOR (§2.1). Ein
   * Verwaltungskonto, das seinen eigenen Editor nicht erklaert bekaeme,
   * waere genau der Fall, den KAN-82 aufgeloest hat.
   */
  it("zeigt der Administration alle vier Bereiche", () => {
    expect(helpSectionsFor("ADMIN").map((section) => section.key)).toEqual([
      "visitors",
      "students",
      "editors",
      "admins",
    ])
  })

  it("verweist mit jedem Bildschluessel auf ein vorhandenes Bild", () => {
    const used = HELP_SECTIONS.flatMap((section) =>
      section.topics.map((topic) => topic.shot)
    ).filter((shot) => shot !== undefined)

    expect(used.length).toBeGreaterThan(0)
    for (const shot of used) {
      expect(helpScreenshots[shot]).toBeTruthy()
    }
  })

  /*
   * Ein Bild ohne Verwendung ist Ballast im Repository: es wird bei jedem
   * Lauf neu erzeugt, wiegt mit und erklaert nichts. Dieser Fall macht das
   * sichtbar, statt es der Aufmerksamkeit zu ueberlassen.
   */
  it("laesst kein Bild ohne Verwendung liegen", () => {
    const used = new Set(
      HELP_SECTIONS.flatMap((section) =>
        section.topics.map((topic) => topic.shot)
      ).filter((shot) => shot !== undefined)
    )

    expect(
      Object.keys(helpScreenshots).filter((key) => !used.has(key as never))
    ).toEqual([])
  })

  /*
   * Der teuerste Fehler dieser Seite waere ein fehlender Schluessel: er
   * erscheint dann roh im Text, und bei einem Alternativtext faellt er
   * ueberhaupt nicht auf, weil man ihn nicht sieht. Geprueft wird deshalb
   * der ganze Bestand und in beiden Sprachen, nicht ein Beispiel.
   */
  it.each(["de", "en"])(
    "fuehrt jeden Punkt vollstaendig in %s",
    async (language) => {
      await i18n.changeLanguage(language)
      const missing: string[] = []

      const require = (key: string) => {
        const value = i18n.t(key, { defaultValue: "" })
        if (typeof value !== "string" || value.trim() === "") {
          missing.push(key)
        }
      }

      for (const section of HELP_SECTIONS) {
        require(`help.${section.key}.title`)
        require(`help.${section.key}.intro`)
        for (const topic of section.topics) {
          const base = `help.${section.key}.topics.${topic.key}`
          require(`${base}.title`)
          require(`${base}.text`)
          if (topic.shot !== undefined) {
            require(`${base}.imageAlt`)
            require(`${base}.imageCaption`)
          }
        }
      }

      expect(missing).toEqual([])
      await i18n.changeLanguage("de")
    }
  )
})
