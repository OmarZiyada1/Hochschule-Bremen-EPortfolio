import { describe, expect, it } from "vitest"

import { BLOCK_SCHEMA_VERSION } from "@/features/project-content/blockSerialization"
import type { ProjectDocument } from "@/features/project-content/blockTypes"
import { printableBlocks } from "@/features/project-content/print/printableBlocks"

/*
 * Der Stand, der aus dem Editor gedruckt wird (KAN-41, Umfang 6).
 *
 * <p>Gedruckt wird das Dokument der Schreibflaeche und nicht die zuletzt
 * gespeicherte Blockliste: der Speichertakt laeuft dem Tippen mit gut einer
 * Sekunde hinterher. Uebersetzt wird mit derselben Funktion wie beim
 * Speichern, damit im Ausdruck der Beitrag steht und nicht der
 * Bedienzustand des Editors.
 */

function doc(...content: unknown[]): ProjectDocument {
  return { type: "doc", content } as ProjectDocument
}

const paragraph = (text: string) => ({
  type: "paragraph",
  content: [{ type: "text", text }],
})

describe("Der Druckstand aus dem Dokument", () => {
  it("uebersetzt die Knoten in Blocklistenform", () => {
    const blocks = printableBlocks(
      doc(paragraph("Erster"), paragraph("Zweiter"))
    )

    expect(blocks).toHaveLength(2)
    expect(blocks[0].type).toBe("TEXT")
    expect(blocks[0].orderIndex).toBe(0)
    expect(blocks[1].orderIndex).toBe(1)
    expect(blocks[0].schemaVersion).toBe(BLOCK_SCHEMA_VERSION)
  })

  it("laesst den leeren Schlussabsatz weg", () => {
    /* Er ist Editor-Verhalten und kein Inhalt: Tiptap haengt ihn an, damit
       sich nach einem Medienblock am Dokumentende weiterschreiben laesst.
       Gedruckt erschiene er als Leerraum. */
    const blocks = printableBlocks(
      doc(paragraph("Erster"), { type: "paragraph" })
    )

    expect(blocks).toHaveLength(1)
  })

  it("laesst einen unvollstaendigen Medienknoten weg", () => {
    /* Dieselbe Regel wie beim Speichern: ein Platzhalter ohne fileId ist
       Bedienzustand und kein Inhalt (Template „Editor (Bearbeiten)"). */
    const blocks = printableBlocks(
      doc(paragraph("Erster"), {
        type: "imageBlock",
        attrs: { fileId: null, alt: "", caption: "", width: 100 },
      })
    )

    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe("TEXT")
  })

  it("gibt jedem Block eine Kennung, auch einem noch nicht gespeicherten", () => {
    /* Der Lesepfad braucht sie, um seine Liste stabil zu halten. Sie kommt
       aus der Position und geht nirgends hin: diese Liste wird nie
       geschrieben, sie wird gedruckt. */
    const blocks = printableBlocks(
      doc(paragraph("Erster"), paragraph("Zweiter"))
    )

    const ids = blocks.map((block) => block.id)
    expect(ids.every((id) => typeof id === "string" && id.length > 0)).toBe(
      true
    )
    expect(new Set(ids).size).toBe(ids.length)
  })
})
