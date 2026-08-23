import { Editor } from "@tiptap/react"
import { TextSelection } from "@tiptap/pm/state"
import { afterEach, describe, expect, it } from "vitest"

import { createBlockExtensions } from "@/features/project-content/blockSchema"
import {
  activeBlockIndex,
  blockIndexAtPos,
  setDragHandleLocked,
  deleteBlock,
  insertBlockAfter,
  insertBlockAtRange,
  moveBlock,
  offsetOfBlock,
} from "@/features/project-content/editorCommands"

/*
 * Die Blockbefehle mit einem echten Editor und nicht gegen eine Attrappe:
 * was sie tun, haengt an ProseMirrors Positionsrechnung, und genau die war
 * der Fehler.
 */

let editor: Editor | null = null

afterEach(() => {
  editor?.destroy()
  editor = null
})

/** Ein Dokument aus {@code count} Absaetzen mit erkennbarem Text. */
function withParagraphs(count: number): Editor {
  editor = new Editor({
    extensions: createBlockExtensions(),
    content: {
      type: "doc",
      content: Array.from({ length: count }, (_, index) => ({
        type: "paragraph",
        content: [{ type: "text", text: `Absatz ${index}` }],
      })),
    },
  })
  return editor
}

/** Setzt die Textmarke mitten in den Block mit diesem Index. */
function cursorInBlock(current: Editor, index: number): void {
  const position = offsetOfBlock(current.state.doc, index) + 3
  current.view.dispatch(
    current.state.tr.setSelection(
      TextSelection.create(current.state.doc, position)
    )
  )
}

describe("activeBlockIndex", () => {
  /*
   * Der Regressionsfall. Zuvor stand hier $from.index(1), also der Index
   * des Inline-Kindes innerhalb des Absatzes, und der ist bei einer
   * Textmarke im Fliesstext immer 0: die Blockbedienung zeigte unabhaengig
   * von der Cursorstelle stets auf den ersten Block, und Einfuegen,
   * Verschieben und Loeschen trafen ihn auch.
   */
  it("nennt den Block, in dem die Textmarke steht, und nicht immer den ersten", () => {
    const current = withParagraphs(10)

    for (const target of [0, 1, 3, 7, 9]) {
      cursorInBlock(current, target)
      expect(activeBlockIndex(current), `Block ${target}`).toBe(target)
      expect(
        current.state.doc.child(activeBlockIndex(current) ?? -1).textContent
      ).toBe(`Absatz ${target}`)
    }
  })

  it("bleibt am Dokumentende im letzten Block", () => {
    const current = withParagraphs(3)
    current.commands.focus("end")
    expect(activeBlockIndex(current)).toBe(current.state.doc.childCount - 1)
  })

  it("nennt bei einer Auswahl in einer Tabelle die Tabelle und nicht die Zelle", () => {
    editor = new Editor({
      extensions: createBlockExtensions(),
      content: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Davor" }] },
          {
            type: "table",
            content: [
              {
                type: "tableRow",
                content: [
                  {
                    type: "tableCell",
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: "Zelle" }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    })
    const position = offsetOfBlock(editor.state.doc, 1) + 4
    editor.view.dispatch(
      editor.state.tr.setSelection(
        TextSelection.create(editor.state.doc, position)
      )
    )
    /* Ein Block ist ein Knoten der obersten Ebene (Contract 2.5). */
    expect(activeBlockIndex(editor)).toBe(1)
    expect(editor.state.doc.child(1).type.name).toBe("table")
  })
})

describe("blockIndexAtPos", () => {
  it("rechnet eine Dokumentposition in den Blockindex um", () => {
    const current = withParagraphs(5)
    for (const target of [0, 2, 4]) {
      const position = offsetOfBlock(current.state.doc, target) + 1
      expect(
        blockIndexAtPos(current.state.doc, position),
        `Block ${target}`
      ).toBe(target)
    }
  })

  it("klemmt ausserhalb liegende Positionen auf den Bestand", () => {
    const current = withParagraphs(3)
    expect(blockIndexAtPos(current.state.doc, -50)).toBe(0)
    expect(blockIndexAtPos(current.state.doc, 99999)).toBe(2)
  })
})

describe("Blockbefehle treffen den gemeinten Block", () => {
  it("fuegt hinter dem gemeinten Block ein und nicht hinter dem ersten", () => {
    const current = withParagraphs(5)
    insertBlockAfter(current, 3, { type: "horizontalRule" })

    expect(current.state.doc.child(4).type.name).toBe("horizontalRule")
    expect(current.state.doc.child(3).textContent).toBe("Absatz 3")
  })

  it("loescht den gemeinten Block", () => {
    const current = withParagraphs(5)
    deleteBlock(current, 2)

    expect(current.state.doc.childCount).toBe(4)
    expect(
      Array.from(
        { length: 4 },
        (_, index) => current.state.doc.child(index).textContent
      )
    ).toEqual(["Absatz 0", "Absatz 1", "Absatz 3", "Absatz 4"])
  })

  it("verschiebt den gemeinten Block und nimmt die Auswahl mit", () => {
    const current = withParagraphs(4)
    expect(moveBlock(current, 2, 0)).toBe(true)

    expect(
      Array.from(
        { length: 4 },
        (_, index) => current.state.doc.child(index).textContent
      )
    ).toEqual(["Absatz 2", "Absatz 0", "Absatz 1", "Absatz 3"])
    expect(activeBlockIndex(current)).toBe(0)
  })

  it("bewegt am Rand der Liste nichts", () => {
    const current = withParagraphs(3)
    expect(moveBlock(current, 0, -1)).toBe(false)
    expect(moveBlock(current, 2, 3)).toBe(false)
    expect(current.state.doc.childCount).toBe(3)
  })
})

describe("insertBlockAtRange", () => {
  it("ersetzt den getippten Befehl durch den Knoten", () => {
    editor = new Editor({
      extensions: createBlockExtensions(),
      content: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Davor" }] },
          { type: "paragraph", content: [{ type: "text", text: "/tab" }] },
        ],
      },
    })

    /* Der Bereich des Befehls im zweiten Absatz. */
    const from = offsetOfBlock(editor.state.doc, 1) + 1
    insertBlockAtRange(
      editor,
      { from, to: from + 4 },
      { type: "horizontalRule" }
    )

    expect(editor.state.doc.child(0).textContent).toBe("Davor")
    /* Der Absatz war nach dem Loeschen leer und wird ersetzt, statt als
       leere Zeile ueber dem neuen Knoten stehen zu bleiben. */
    expect(editor.state.doc.child(1).type.name).toBe("horizontalRule")
    expect(editor.state.doc.textContent).not.toContain("/tab")
  })
})

describe("setDragHandleLocked", () => {
  /*
   * Der Regressionsfall: hier stand einmal
   * {@code editor.commands.lockDragHandle()}. Das Kommando gehoert der
   * Extension {@code DragHandle}, {@code DragHandleReact} bindet aber nur
   * das Plugin ein; der Aufruf endete in „is not a function", und zwar erst
   * zur Laufzeit, weil die Typdeklaration des Pakets es trotzdem anmeldet.
   * Der Typecheck fand das nicht, ein Test findet es.
   */
  it("wirft nicht, auch ohne angemeldetes Drag-Handle-Plugin", () => {
    const current = withParagraphs(3)
    expect(() => setDragHandleLocked(current, true)).not.toThrow()
    expect(() => setDragHandleLocked(current, false)).not.toThrow()
  })

  it("laesst den Beitrag unveraendert und den Rueckgaengig-Verlauf leer", () => {
    const current = withParagraphs(3)
    const before = JSON.stringify(current.getJSON())

    setDragHandleLocked(current, true)

    expect(JSON.stringify(current.getJSON())).toBe(before)
    /* Das Oeffnen eines Menues ist keine Aenderung am Beitrag. */
    expect(current.can().undo()).toBe(false)
  })
})
