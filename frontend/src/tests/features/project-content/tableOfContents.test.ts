import { Editor } from "@tiptap/react"
import { describe, expect, it } from "vitest"

import { createEditorExtensions } from "@/features/project-content/editorSchema"
import {
  applyTableOfContents,
  collectHeadings,
  findTableOfContents,
  sameEntries,
} from "@/features/project-content/tableOfContents"

/*
 * Das Ablesen der Gliederung braucht ein echtes ProseMirror-Dokument, aber
 * kein DOM-Ereignis: der Editor wird ohne Element gebaut und nur ueber seinen
 * Zustand befragt (Contract 2.5, seit v84, KAN-83).
 */
function editorWith(content: string): Editor {
  return new Editor({ extensions: createEditorExtensions(), content })
}

describe("collectHeadings", () => {
  it("liest Ebene, Text und laufende Nummer in Dokumentreihenfolge", () => {
    const editor = editorWith(
      "<h1>Einleitung</h1><p>Text</p><h2>Vorgehen</h2><h1>Fazit</h1>"
    )

    /*
     * Gezaehlt werden allein die Ueberschriften: der Absatz dazwischen
     * bekommt keine Nummer. Genau so vergibt der Renderer die Sprungmarken,
     * und beide Zaehlungen muessen uebereinstimmen, sonst zeigt ein Eintrag
     * auf die falsche Stelle.
     */
    expect(collectHeadings(editor)).toEqual([
      { level: 1, text: "Einleitung", index: 0 },
      { level: 2, text: "Vorgehen", index: 1 },
      { level: 1, text: "Fazit", index: 2 },
    ])
    editor.destroy()
  })

  it("nimmt den reinen Text und keine Auszeichnungen mit", () => {
    const editor = editorWith("<h1>Ein <strong>fetter</strong> Titel</h1>")

    expect(collectHeadings(editor)[0].text).toBe("Ein fetter Titel")
    editor.destroy()
  })

  it("kuerzt einen zu langen Ueberschriftentext auf 300 Zeichen", () => {
    /*
     * Contract 2.5 begrenzt text auf 300 Zeichen, und der Server setzt das
     * mit 400 BLOCK_CONTENT_INVALID durch. Er prueft die ganze Blockliste vor
     * der ersten Schreiboperation: ohne diese Kuerzung liesse eine einzige zu
     * lange Ueberschrift jeden weiteren Speicherlauf des gesamten Beitrags
     * scheitern, bis jemand den Block loescht.
     */
    const editor = editorWith(`<h1>${"x".repeat(400)}</h1>`)

    expect(collectHeadings(editor)[0].text).toHaveLength(300)
    editor.destroy()
  })

  it("nimmt hoechstens 200 Eintraege auf", () => {
    const editor = editorWith(
      Array.from({ length: 205 }, (_, i) => `<h1>Kapitel ${i}</h1>`).join("")
    )

    expect(collectHeadings(editor)).toHaveLength(200)
    editor.destroy()
  })

  it("ergibt fuer einen Beitrag ohne Ueberschriften die leere Liste", () => {
    const editor = editorWith("<p>Nur Text</p>")

    expect(collectHeadings(editor)).toEqual([])
    editor.destroy()
  })
})

describe("sameEntries", () => {
  const stored = [{ level: 1 as const, text: "Einleitung", index: 0 }]

  it("erkennt eine umformulierte Ueberschrift", () => {
    /* Der Kern der Pruefung: die Laenge bleibt gleich, das Verzeichnis ist
       trotzdem falsch. Ein Vergleich der Anzahl uebersaehe genau das. */
    expect(
      sameEntries(stored, [{ level: 1, text: "Einfuehrung", index: 0 }])
    ).toBe(false)
  })

  it("erkennt eine geaenderte Ebene", () => {
    expect(
      sameEntries(stored, [{ level: 2, text: "Einleitung", index: 0 }])
    ).toBe(false)
  })

  it("meldet Gleichheit, wenn alles uebereinstimmt", () => {
    expect(
      sameEntries(stored, [{ level: 1, text: "Einleitung", index: 0 }])
    ).toBe(true)
  })
})

describe("applyTableOfContents", () => {
  it("fuegt das Verzeichnis am Anfang ein und fuellt es", () => {
    const editor = editorWith("<h1>Einleitung</h1><p>Text</p>")

    expect(applyTableOfContents(editor)).toBe(true)

    const first = editor.state.doc.child(0)
    expect(first.type.name).toBe("tableOfContents")
    expect(first.attrs.entries).toEqual([
      { level: 1, text: "Einleitung", index: 0 },
    ])
    editor.destroy()
  })

  it("legt kein zweites an, sondern zieht das vorhandene nach", () => {
    const editor = editorWith("<h1>Einleitung</h1>")
    applyTableOfContents(editor)

    /* Eine Ueberschrift kommt dazu; der zweite Aufruf aktualisiert. */
    editor.commands.insertContentAt(
      editor.state.doc.content.size,
      "<h2>Fazit</h2>"
    )
    expect(applyTableOfContents(editor)).toBe(false)

    const positions: string[] = []
    editor.state.doc.forEach((node) => positions.push(node.type.name))
    expect(positions.filter((name) => name === "tableOfContents")).toHaveLength(
      1
    )
    expect(editor.state.doc.child(0).attrs.entries).toEqual([
      { level: 1, text: "Einleitung", index: 0 },
      { level: 2, text: "Fazit", index: 1 },
    ])
    editor.destroy()
  })

  it("findet das Verzeichnis auch, wenn es nicht vorn steht", () => {
    const editor = editorWith(
      '<h1>Einleitung</h1><div data-type="table-of-contents"></div>'
    )

    expect(findTableOfContents(editor.state.doc)).not.toBeNull()
    editor.destroy()
  })
})
