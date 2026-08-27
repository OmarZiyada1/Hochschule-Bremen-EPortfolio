import { Editor } from "@tiptap/react"
import { describe, expect, it } from "vitest"

import { docToBlocks } from "@/features/project-content/blockSerialization"
import { createEditorExtensions } from "@/features/project-content/editorSchema"
import type { ProjectDocument } from "@/features/project-content/blockTypes"

/**
 * Der Schlussblock aus KAN-83: hinter dem letzten Block liegt immer ein
 * leerer Absatz, damit sich unter einem Bild, einer Tabelle oder einem Video
 * ueberhaupt etwas anhaengen laesst.
 */
function editorWith(content: string): Editor {
  return new Editor({ extensions: createEditorExtensions(), content })
}

function nodeNames(editor: Editor): string[] {
  const names: string[] = []
  editor.state.doc.forEach((node) => names.push(node.type.name))
  return names
}

describe("TrailingBlock", () => {
  it("haengt nach einer Aenderung einen leeren Absatz an, wenn der letzte Block keiner ist", () => {
    const editor = editorWith("<h1>Einleitung</h1>")

    /* appendTransaction laeuft erst mit der ersten Aenderung; die Garantie
       beim Oeffnen stellt EditorPage ueber initialContent her. */
    editor.commands.insertContentAt(0, "<p>Text</p>")

    expect(nodeNames(editor).at(-1)).toBe("paragraph")
    expect(editor.state.doc.lastChild?.textContent).toBe("")
    editor.destroy()
  })

  it("haengt keinen zweiten an, wenn schon einer dasteht", () => {
    /*
     * Sonst wuechse das Dokument bei jeder Transaktion um eine Zeile, und
     * docToBlocks schneidet nur genau einen ab: der Rest erschiene im
     * Lesepfad als Leerraum.
     */
    const editor = editorWith("<h1>Einleitung</h1>")
    editor.commands.insertContentAt(0, "<p>Text</p>")
    expect(nodeNames(editor)).toEqual(["paragraph", "heading", "paragraph"])

    /* Eine zweite Aenderung ergibt eine Zeile mehr Inhalt, aber keinen
       zweiten Schlussblock. */
    editor.commands.insertContentAt(0, "<p>Noch mehr</p>")

    expect(nodeNames(editor)).toEqual([
      "paragraph",
      "paragraph",
      "heading",
      "paragraph",
    ])
    expect(editor.state.doc.lastChild?.textContent).toBe("")
    editor.destroy()
  })

  it("landet nicht in der gespeicherten Blockliste", () => {
    const editor = editorWith("<h1>Einleitung</h1>")
    editor.commands.insertContentAt(0, "<p>Text</p>")

    const blocks = docToBlocks(editor.state.doc.toJSON() as ProjectDocument)

    /* Der Schlussblock ist eine Eigenheit der Schreibflaeche und kein
       Inhalt; gespeichert wird er nicht (Contract 2.5). */
    expect(blocks.at(-1)?.type).not.toBe("TEXT")
    expect(blocks.map((block) => block.type)).toEqual(["TEXT", "HEADING"])
    editor.destroy()
  })

  it("bleibt in der gesperrten Ansicht aus", () => {
    /* Ohne Schreibrecht waere eine leere Zeile am Ende Raum ohne Anlass. */
    const editor = new Editor({
      extensions: createEditorExtensions(),
      content: "<h1>Einleitung</h1>",
      editable: false,
    })
    editor.commands.setContent("<h1>Anders</h1>")

    expect(nodeNames(editor)).toEqual(["heading"])
    editor.destroy()
  })
})
