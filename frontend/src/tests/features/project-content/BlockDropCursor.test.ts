import { Editor } from "@tiptap/react"
import { Slice } from "@tiptap/pm/model"
import { NodeSelection, TextSelection } from "@tiptap/pm/state"
import { afterEach, describe, expect, it } from "vitest"

import { createBlockExtensions } from "@/features/project-content/blockSchema"
import {
  dropBlocksAt,
  offsetOfBlock,
} from "@/features/project-content/editorCommands"
import {
  dropIndexForBoxes,
  dropLineForBoxes,
  type BlockBox,
} from "@/features/project-content/extensions/BlockDropCursor"

/*
 * Die Ablegelinie in zwei Teilen, und beide Teile werden hier einzeln
 * geprueft: die Geometrie ohne DOM (jsdom misst nichts, jedes
 * getBoundingClientRect liefert dort Nullen, ein Test ueber die echte
 * Messung waere also wertlos) und das Ablegen an einem echten Editor.
 *
 * Der Regressionsfall dahinter: die Linie lag quer ueber einem Block statt
 * zwischen zwei, und zwar umso haeufiger, je unterschiedlicher die
 * Blockhoehen waren.
 */

/** Bloecke untereinander mit Zwischenraum, in Hoehen wie im Beitrag. */
function boxes(heights: readonly number[], gap = 16): BlockBox[] {
  let top = 0
  return heights.map((height) => {
    const box: BlockBox = { top, bottom: top + height, left: 0, right: 800 }
    top += height + gap
    return box
  })
}

describe("dropIndexForBoxes", () => {
  it("nimmt die Mitte jedes Blocks als Grenze, auch bei sehr ungleichen Hoehen", () => {
    /* Absatz, Bild, Ueberschrift: 24, 400 und 48 Pixel hoch. */
    const measured = boxes([24, 400, 48])

    /* Oberhalb der Mitte des ersten Absatzes: davor. */
    expect(dropIndexForBoxes(measured, 0)).toBe(0)
    expect(dropIndexForBoxes(measured, 11)).toBe(0)
    /* Unterhalb seiner Mitte: dahinter, also in die Luecke 1. */
    expect(dropIndexForBoxes(measured, 13)).toBe(1)

    /* Das hohe Bild reicht von 40 bis 440, seine Mitte liegt bei 240. */
    expect(dropIndexForBoxes(measured, 200)).toBe(1)
    expect(dropIndexForBoxes(measured, 300)).toBe(2)
  })

  it("legt unterhalb des letzten Blocks hinter ihn", () => {
    const measured = boxes([24, 400, 48])
    expect(dropIndexForBoxes(measured, 9999)).toBe(3)
  })

  it("kennt im leeren Beitrag nur die eine Stelle", () => {
    expect(dropIndexForBoxes([], 100)).toBe(0)
  })
})

describe("dropLineForBoxes", () => {
  it("liegt zwischen zwei Bloecken und niemals in einem", () => {
    const measured = boxes([24, 400, 48])

    for (let index = 0; index <= measured.length; index++) {
      const line = dropLineForBoxes(measured, index)
      expect(line, `Luecke ${index}`).not.toBeNull()
      const top = line?.top ?? Number.NaN

      for (const box of measured) {
        /* Der Kern der Meldung: nie ueber oder in einem Block. Die Kante
           selbst ist erlaubt, sie ist die Grenze. */
        const inside = top > box.top && top < box.bottom
        expect(inside, `Luecke ${index} liegt in einem Block`).toBe(false)
      }
    }
  })

  it("liegt im Zwischenraum genau zwischen Unterkante und Oberkante", () => {
    const measured = boxes([24, 400], 16)
    /* Erster Block endet bei 24, zweiter beginnt bei 40. */
    expect(dropLineForBoxes(measured, 1)?.top).toBe(32)
  })

  it("liegt am Rand auf der Kante des einzigen Nachbarn", () => {
    const measured = boxes([24, 400], 16)
    expect(dropLineForBoxes(measured, 0)?.top).toBe(0)
    expect(dropLineForBoxes(measured, 2)?.top).toBe(440)
  })

  it("reicht ueber die Breite beider Nachbarn", () => {
    /* Ein schmales Bild (50 Prozent) zwischen zwei vollen Absaetzen. */
    const measured: BlockBox[] = [
      { top: 0, bottom: 24, left: 0, right: 800 },
      { top: 40, bottom: 440, left: 200, right: 600 },
    ]
    const line = dropLineForBoxes(measured, 1)
    expect(line?.left).toBe(0)
    expect(line?.right).toBe(800)
  })

  it("hat im leeren Beitrag keine Lage", () => {
    expect(dropLineForBoxes([], 0)).toBeNull()
  })
})

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

/** Der Text aller Bloecke, in ihrer Reihenfolge. */
function blockTexts(current: Editor): string[] {
  return Array.from(
    { length: current.state.doc.childCount },
    (_, index) => current.state.doc.child(index).textContent
  )
}

/**
 * Waehlt den Block aus und schneidet ihn als Ausschnitt heraus, so wie es
 * der Ziehgriff beim Beginn des Ziehens tut.
 */
function pickUp(current: Editor, index: number): Slice {
  const from = offsetOfBlock(current.state.doc, index)
  const to = from + current.state.doc.child(index).nodeSize
  current.view.dispatch(
    current.state.tr.setSelection(NodeSelection.create(current.state.doc, from))
  )
  return current.state.doc.slice(from, to)
}

describe("dropBlocksAt", () => {
  it("legt an der gemeinten Luecke ab und nicht daneben", () => {
    const current = withParagraphs(4)
    const slice = pickUp(current, 0)

    /* In die Luecke vor Absatz 3, gezaehlt vor dem Ablegen. */
    expect(dropBlocksAt(current.view, 3, slice, true)).toBe(true)
    expect(blockTexts(current)).toEqual([
      "Absatz 1",
      "Absatz 2",
      "Absatz 0",
      "Absatz 3",
    ])
  })

  it("rechnet die Einfuegestelle nach, wenn die Quelle davor lag", () => {
    const current = withParagraphs(5)
    const slice = pickUp(current, 1)

    /* Ohne Nachfuehrung ueber tr.mapping landete der Block eine Stelle zu
       weit unten: das Loeschen der Quelle schiebt alles darunter nach oben. */
    expect(dropBlocksAt(current.view, 4, slice, true)).toBe(true)
    expect(blockTexts(current)).toEqual([
      "Absatz 0",
      "Absatz 2",
      "Absatz 3",
      "Absatz 1",
      "Absatz 4",
    ])
  })

  it("legt vor den ersten Block", () => {
    const current = withParagraphs(3)
    const slice = pickUp(current, 2)

    expect(dropBlocksAt(current.view, 0, slice, true)).toBe(true)
    expect(blockTexts(current)).toEqual(["Absatz 2", "Absatz 0", "Absatz 1"])
  })

  it("legt hinter den letzten Block", () => {
    const current = withParagraphs(3)
    const slice = pickUp(current, 0)

    expect(dropBlocksAt(current.view, 3, slice, true)).toBe(true)
    expect(blockTexts(current)).toEqual(["Absatz 1", "Absatz 2", "Absatz 0"])
  })

  it("laesst den Beitrag in Ruhe, wenn ein Block auf sich selbst faellt", () => {
    const current = withParagraphs(3)
    const slice = pickUp(current, 1)
    const before = JSON.stringify(current.getJSON())

    expect(dropBlocksAt(current.view, 1, slice, true)).toBe(true)
    expect(JSON.stringify(current.getJSON())).toBe(before)
    /* Kein leerer Schritt im Rueckgaengig-Verlauf und kein Speicherlauf. */
    expect(current.can().undo()).toBe(false)
  })

  it("kopiert statt zu verschieben, wenn nicht verschoben wird", () => {
    const current = withParagraphs(2)
    const slice = pickUp(current, 0)

    expect(dropBlocksAt(current.view, 2, slice, false)).toBe(true)
    expect(blockTexts(current)).toEqual(["Absatz 0", "Absatz 1", "Absatz 0"])
  })

  it("ueberlaesst ProseMirror den Fall ohne Auswahl", () => {
    const current = withParagraphs(3)
    const from = offsetOfBlock(current.state.doc, 0)
    const slice = current.state.doc.slice(
      from,
      from + current.state.doc.child(0).nodeSize
    )
    current.view.dispatch(
      current.state.tr.setSelection(
        TextSelection.create(current.state.doc, from + 1)
      )
    )

    /* Eine leere Textmarke ist keine gezogene Auswahl: ohne sie wuesste
       niemand, was zu entfernen ist, und der Block stuende zweimal da. */
    expect(dropBlocksAt(current.view, 2, slice, true)).toBe(false)
    expect(blockTexts(current)).toEqual(["Absatz 0", "Absatz 1", "Absatz 2"])
  })

  it("laesst nichts auf die oberste Ebene, was dort nicht hingehoert", () => {
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
    const current = editor

    /*
     * Eine Tabellenzeile ist ein Block im Sinne von ProseMirror
     * ({@code isBlock}), aber kein Block nach Contract 2.5: auf oberster
     * Ebene faende docToBlocks keinen Blocktyp fuer sie, und der
     * Speicherlauf des ganzen Beitrags endete in einem 400. Statt zu
     * werfen, gibt die Ablage den Fall an ProseMirror zurueck.
     */
    const tableStart = offsetOfBlock(current.state.doc, 1)
    const row = current.state.doc.child(1).child(0)
    const rowStart = tableStart + 1
    const slice = current.state.doc.slice(rowStart, rowStart + row.nodeSize)

    const before = JSON.stringify(current.getJSON())
    expect(dropBlocksAt(current.view, 0, slice, false)).toBe(false)
    expect(JSON.stringify(current.getJSON())).toBe(before)
  })
})
