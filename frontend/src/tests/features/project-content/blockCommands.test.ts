import { Editor } from "@tiptap/react"
import { afterEach, describe, expect, it } from "vitest"

import {
  activeBlockIndex,
  blockCount,
  blockNameAt,
  insertBlockAfter,
  moveBlock,
  offsetOfBlock,
  removeBlock,
} from "@/features/project-content/blockCommands"
import { createBlockExtensions } from "@/features/project-content/blockSchema"
import type {
  BlockNode,
  ParagraphNode,
  ProjectDocument,
} from "@/features/project-content/blockTypes"

/**
 * Die Griffe an der Blockliste (KAN-36). Sie laufen ueber einen echten
 * Editor und nicht ueber eine Attrappe: geprueft wird gerade die Rechnung
 * von einer Cursorposition auf den Index eines Top-Level-Knotens, und die
 * gibt es nur mit einem echten ProseMirror-Dokument.
 */

const FILE_ID = "11111111-2222-4333-8444-555555555555"

let editor: Editor | null = null

afterEach(() => {
  editor?.destroy()
  editor = null
})

/* Als ParagraphNode getypt und nicht als BlockNode: der Absatz steht auch
   innerhalb eines Listeneintrags, und dort ist nur ein FlowNode zulaessig. */
function paragraph(text: string): ParagraphNode {
  return {
    type: "paragraph",
    attrs: { textAlign: null },
    content: [{ type: "text", text }],
  }
}

function createEditor(nodes: BlockNode[]): Editor {
  editor = new Editor({
    extensions: createBlockExtensions(),
    content: { type: "doc", content: nodes } satisfies ProjectDocument,
  })
  return editor
}

/** Die Texte der Top-Level-Knoten, in Dokumentreihenfolge. */
function texts(instance: Editor): string[] {
  const document = instance.getJSON() as ProjectDocument
  return document.content.map((node) =>
    node.type === "paragraph"
      ? (node.content?.[0]?.text ?? "")
      : `<${node.type}>`
  )
}

describe("Position und Index eines Blocks", () => {
  it("zaehlt die Top-Level-Knoten", () => {
    const instance = createEditor([paragraph("A"), paragraph("B")])

    expect(blockCount(instance)).toBe(2)
  })

  it("berechnet den Anfang jedes Blocks aus den Groessen seiner Vorgaenger", () => {
    const instance = createEditor([paragraph("A"), paragraph("BB")])
    const { doc } = instance.state

    expect(offsetOfBlock(doc, 0)).toBe(0)
    expect(offsetOfBlock(doc, 1)).toBe(doc.child(0).nodeSize)
    /* Ein Index jenseits der Liste ergibt das Ende und keinen Fehler: das
       ist die Stelle, an der ein Anhaengen landet. */
    expect(offsetOfBlock(doc, 99)).toBe(doc.content.size)
  })

  it("findet den Block, in dem die Auswahl steht, auch aus der Tiefe", () => {
    const instance = createEditor([
      paragraph("A"),
      {
        type: "bulletList",
        content: [{ type: "listItem", content: [paragraph("tief")] }],
      },
    ])

    instance.commands.setTextSelection(1)
    expect(activeBlockIndex(instance)).toBe(0)

    /*
     * Drei Ebenen tiefer, im Absatz innerhalb des Listeneintrags: gemeint
     * ist trotzdem der Top-Level-Knoten darum. Die Position wird gerechnet
     * und nicht am Dokumentende geraten, denn Tiptap haengt hinter der
     * Liste einen leeren Absatz an, und der waere ein anderer Block.
     */
    const listStart = offsetOfBlock(instance.state.doc, 1)
    instance.commands.setTextSelection(listStart + 3)
    expect(activeBlockIndex(instance)).toBe(1)
  })

  it("nennt den Knotennamen an einer Position und null daneben", () => {
    const instance = createEditor([paragraph("A"), { type: "horizontalRule" }])

    expect(blockNameAt(instance, 0)).toBe("paragraph")
    expect(blockNameAt(instance, 1)).toBe("horizontalRule")
    expect(blockNameAt(instance, 5)).toBeNull()
    expect(blockNameAt(instance, -1)).toBeNull()
  })
})

describe("Bloecke verschieben", () => {
  it("tauscht zwei benachbarte Bloecke", () => {
    const instance = createEditor([
      paragraph("A"),
      paragraph("B"),
      paragraph("C"),
    ])

    expect(moveBlock(instance, 1, 0)).toBe(true)
    expect(texts(instance)).toEqual(["B", "A", "C"])
  })

  it("verschiebt ueber mehrere Stellen hinweg", () => {
    const instance = createEditor([
      paragraph("A"),
      paragraph("B"),
      paragraph("C"),
    ])

    expect(moveBlock(instance, 0, 2)).toBe(true)
    expect(texts(instance)).toEqual(["B", "C", "A"])
  })

  /*
   * Am Rand passiert nichts, und die aufrufende Stelle sagt dann auch
   * nichts an: eine Ansage "Position 0 von 3" waere schlimmer als keine.
   */
  it("meldet false an den Raendern und laesst das Dokument unveraendert", () => {
    const instance = createEditor([paragraph("A"), paragraph("B")])

    expect(moveBlock(instance, 0, -1)).toBe(false)
    expect(moveBlock(instance, 1, 2)).toBe(false)
    expect(moveBlock(instance, 0, 0)).toBe(false)
    expect(texts(instance)).toEqual(["A", "B"])
  })

  it("laesst den Cursor im verschobenen Block", () => {
    const instance = createEditor([
      paragraph("A"),
      paragraph("B"),
      paragraph("C"),
    ])

    moveBlock(instance, 2, 0)

    expect(activeBlockIndex(instance)).toBe(0)
  })
})

describe("Bloecke loeschen und einfuegen", () => {
  it("loescht den Block an seinem Index", () => {
    const instance = createEditor([
      paragraph("A"),
      paragraph("B"),
      paragraph("C"),
    ])

    expect(removeBlock(instance, 1)).toBe(true)
    expect(texts(instance)).toEqual(["A", "C"])
  })

  it("meldet false bei einem Index daneben", () => {
    const instance = createEditor([paragraph("A")])

    expect(removeBlock(instance, 3)).toBe(false)
    expect(texts(instance)).toEqual(["A"])
  })

  it("fuegt hinter dem angegebenen Block ein", () => {
    const instance = createEditor([paragraph("A"), paragraph("C")])

    insertBlockAfter(instance, 0, paragraph("B"))

    expect(texts(instance)).toEqual(["A", "B", "C"])
  })

  /*
   * Ohne den Absatz dahinter liesse sich hinter einem Bild am Dokumentende
   * nicht weiterschreiben. Gespeichert wird er nicht: docToBlocks laesst
   * den leeren Schlussabsatz weg.
   */
  it("haengt hinter einem Medienknoten am Ende einen leeren Absatz an", () => {
    const instance = createEditor([paragraph("A")])

    insertBlockAfter(instance, 0, {
      type: "imageBlock",
      attrs: { fileId: FILE_ID, alt: "Ein Bild", caption: "", width: 100 },
    })

    expect(texts(instance)).toEqual(["A", "<imageBlock>", ""])
  })

  it("haengt keinen Absatz an, wenn der Medienknoten mitten im Dokument landet", () => {
    const instance = createEditor([paragraph("A"), paragraph("B")])

    insertBlockAfter(instance, 0, {
      type: "imageBlock",
      attrs: { fileId: FILE_ID, alt: "Ein Bild", caption: "", width: 100 },
    })

    expect(texts(instance)).toEqual(["A", "<imageBlock>", "B"])
  })
})
