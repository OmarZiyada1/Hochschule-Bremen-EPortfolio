import { describe, expect, it } from "vitest"

import type {
  BlockNode,
  ContentBlockRequest,
  ContentBlockResponse,
  ParagraphNode,
  ProjectDocument,
} from "@/features/project-content/blockTypes"
import {
  blocksToDoc,
  docToBlocks,
  migrateBlockContent,
  BLOCK_SCHEMA_VERSION,
} from "@/features/project-content/blockSerialization"

/*
 * docToBlocks und blocksToDoc sind reine Funktionen: kein React, kein
 * Netzwerk, kein DOM. Diese Datei braucht deshalb weder jsdom noch MSW.
 */

const FILE_A = "11111111-2222-4333-8444-555555555555"
const FILE_B = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"

function paragraph(text: string): ParagraphNode {
  return {
    type: "paragraph",
    attrs: { textAlign: null },
    content: [{ type: "text", text }],
  }
}

/** Je ein Knoten aller fuenfzehn Namen, dazu die zweite Videoquelle. */
function everyNode(): BlockNode[] {
  return [
    {
      /* textAlign steht seit Contract v63 auch an der Ueberschrift und
         wird beim Lesen wie am Absatz auf null gesetzt, wenn nichts
         dasteht; ohne das Feld waere der Round-Trip keine Identitaet. */
      type: "heading",
      attrs: { level: 1, textAlign: null },
      content: [{ type: "text", text: "Zwischenueberschrift" }],
    },
    paragraph("Ein Absatz mit Text."),
    {
      type: "bulletList",
      content: [{ type: "listItem", content: [paragraph("Erster Punkt")] }],
    },
    {
      type: "orderedList",
      attrs: { start: 1 },
      content: [{ type: "listItem", content: [paragraph("Erster Schritt")] }],
    },
    { type: "blockquote", content: [paragraph("Ein Zitat.")] },
    {
      type: "codeBlock",
      attrs: { language: "ts" },
      content: [{ type: "text", text: "const a = 1" }],
    },
    { type: "horizontalRule" },
    {
      type: "table",
      attrs: { caption: null },
      content: [
        {
          type: "tableRow",
          content: [
            {
              type: "tableHeader",
              attrs: { colspan: 1, rowspan: 1 },
              content: [paragraph("Kopf")],
            },
          ],
        },
        {
          type: "tableRow",
          content: [
            {
              type: "tableCell",
              attrs: { colspan: 1, rowspan: 1 },
              content: [paragraph("Zelle")],
            },
          ],
        },
      ],
    },
    {
      type: "imageBlock",
      attrs: {
        fileId: FILE_A,
        alt: "Ein Messaufbau",
        caption: "Abbildung 1",
        width: 75,
      },
    },
    {
      type: "galleryBlock",
      attrs: {
        items: [
          { fileId: FILE_A, alt: "Erstes Bild" },
          { fileId: FILE_B, alt: "" },
        ],
        columns: 3,
        caption: "Drei Ansichten",
      },
    },
    { type: "videoBlock", attrs: { fileId: FILE_A, caption: "Aufnahme" } },
    {
      type: "videoBlock",
      attrs: { provider: "youtube", videoId: "dQw4w9WgXcQ", caption: "" },
    },
    { type: "audioBlock", attrs: { fileId: FILE_B, caption: "Interview" } },
    {
      type: "documentBlock",
      attrs: { fileId: FILE_A, fileName: "bericht.pdf", size: 2_400_000 },
    },
    {
      type: "embedBlock",
      attrs: {
        provider: "figma",
        embedUrl: "https://www.figma.com/embed?node-id=1",
        height: 460,
      },
    },
    { type: "mathBlock", attrs: { latex: "E = mc^2" } },
  ]
}

function documentOf(nodes: BlockNode[]): ProjectDocument {
  return { type: "doc", content: nodes }
}

/** Die Antwort des Servers, wie sie nach einem PUT zurueckkaeme. */
function asResponses(requests: ContentBlockRequest[]): ContentBlockResponse[] {
  return requests.map((request, index) => ({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    type: request.type,
    orderIndex: request.orderIndex,
    content: request.content,
    /*
     * Im Request darf die Angabe fehlen, in der Antwort nie: laesst der
     * Client sie weg, setzt der Server die aktuelle Version ein (§2.10), und
     * beim Lesen migriert BlockResponse.from ohnehin auf den heutigen Stand.
     * Die Nachbildung muss das mitmachen, sonst prueft die Suite eine
     * Antwortform, die es nicht gibt. Sichtbar geworden ist der Unterschied
     * erst, seit die generierten Typen null von "nicht gesetzt" trennen
     * (KAN-74).
     */
    schemaVersion: request.schemaVersion ?? BLOCK_SCHEMA_VERSION,
  }))
}

function roundTrip(nodes: BlockNode[]) {
  return blocksToDoc(asResponses(docToBlocks(documentOf(nodes))))
}

describe("docToBlocks", () => {
  it("vergibt orderIndex lueckenlos ab 0 und setzt die Schemaversion", () => {
    const blocks = docToBlocks(documentOf(everyNode()))

    expect(blocks.map((block) => block.orderIndex)).toEqual(
      blocks.map((_, index) => index)
    )
    expect(new Set(blocks.map((block) => block.schemaVersion))).toEqual(
      new Set([BLOCK_SCHEMA_VERSION])
    )
  })

  it("projiziert type aus content.type und fasst beide Listen zu LIST zusammen", () => {
    const blocks = docToBlocks(
      documentOf([
        { type: "bulletList", content: [] },
        { type: "orderedList", attrs: { start: 1 }, content: [] },
        { type: "mathBlock", attrs: { latex: "x" } },
      ])
    )

    expect(blocks.map((block) => block.type)).toEqual([
      "LIST",
      "LIST",
      "FORMULA",
    ])
  })

  it("verwirft einen leeren Schlussabsatz und laesst orderIndex lueckenlos", () => {
    const blocks = docToBlocks(
      documentOf([
        paragraph("Inhalt"),
        { type: "paragraph", attrs: { textAlign: null } },
      ])
    )

    expect(blocks).toHaveLength(1)
    expect(blocks[0].orderIndex).toBe(0)
  })

  it("behaelt einen gefuellten Schlussabsatz", () => {
    const blocks = docToBlocks(
      documentOf([paragraph("Erster"), paragraph("Letzter")])
    )

    expect(blocks).toHaveLength(2)
  })

  it("uebernimmt die vorige id nur bei gleichem Typ an gleicher Position", () => {
    const blocks = docToBlocks(
      documentOf([paragraph("Eins"), { type: "horizontalRule" }]),
      [
        { id: "id-0", type: "TEXT" },
        { id: "id-1", type: "TEXT" },
      ]
    )

    expect(blocks[0].id).toBe("id-0")
    /* Der zweite Block ist jetzt ein DIVIDER: er geht ohne id und wird neu
       angelegt, statt eine fremde Kennung zu erben. */
    expect(blocks[1].id).toBeUndefined()
  })

  it("legt weder Base64 noch eine Speicheradresse ins Dokument", () => {
    const media = everyNode().filter((node) =>
      [
        "imageBlock",
        "galleryBlock",
        "videoBlock",
        "audioBlock",
        "documentBlock",
        "embedBlock",
        "mathBlock",
      ].includes(node.type)
    )
    const serialized = JSON.stringify(docToBlocks(documentOf(media)))

    expect(serialized).not.toMatch(/data:[a-z]+\/[a-z0-9.+-]+;base64/i)
    for (const forbidden of [
      "blob.core.windows.net",
      "containerName",
      "storageKey",
      "endpoint",
      "accountName",
    ]) {
      expect(serialized).not.toContain(forbidden)
    }
  })
})

describe("Round-Trip ueber alle Blocktypen", () => {
  it("gibt denselben Baum zurueck", () => {
    const nodes = everyNode()
    const { doc, dropped, normalized } = roundTrip(nodes)

    expect(dropped).toEqual([])
    expect(normalized).toEqual([])
    expect(doc.content).toEqual(nodes)
  })

  it("haelt die Galerie mit beiden alt-Texten in ihrer Reihenfolge", () => {
    const gallery: BlockNode = {
      type: "galleryBlock",
      attrs: {
        items: [
          { fileId: FILE_A, alt: "Erstes Bild" },
          { fileId: FILE_B, alt: "" },
        ],
        columns: 2,
        caption: "",
      },
    }
    const { doc } = roundTrip([gallery])

    expect(doc.content[0]).toEqual(gallery)
  })

  it("gibt width und columns als Zahl zurueck, nicht als Zeichenkette", () => {
    const { doc } = roundTrip([
      {
        type: "imageBlock",
        attrs: { fileId: FILE_A, alt: "", caption: "", width: 50 },
      },
      {
        type: "galleryBlock",
        attrs: {
          items: [{ fileId: FILE_A, alt: "" }],
          columns: 3,
          caption: "",
        },
      },
    ])

    const image = doc.content[0]
    const gallery = doc.content[1]
    expect(image.type === "imageBlock" && image.attrs.width).toBe(50)
    expect(gallery.type === "galleryBlock" && gallery.attrs.columns).toBe(3)
  })

  it("uebersteht beide Videoquellen mit allen Attributen", () => {
    const nodes: BlockNode[] = [
      { type: "videoBlock", attrs: { fileId: FILE_A, caption: "Aufnahme" } },
      {
        type: "videoBlock",
        attrs: { provider: "vimeo", videoId: "123456789", caption: "Vortrag" },
      },
    ]
    const { doc, dropped } = roundTrip(nodes)

    expect(dropped).toEqual([])
    expect(doc.content).toEqual(nodes)
  })
})

describe("blocksToDoc", () => {
  function responseOf(
    content: unknown,
    overrides: Partial<ContentBlockResponse> = {}
  ): ContentBlockResponse {
    return {
      id: "00000000-0000-4000-8000-000000000000",
      type: "TEXT",
      orderIndex: 0,
      content,
      schemaVersion: 1,
      ...overrides,
    }
  }

  it("sortiert nach orderIndex und glaubt der Reihenfolge des Arrays nicht", () => {
    const { doc } = blocksToDoc([
      responseOf(paragraph("zweiter"), { orderIndex: 1 }),
      responseOf(paragraph("erster"), { orderIndex: 0 }),
    ])

    expect(doc.content).toEqual([paragraph("erster"), paragraph("zweiter")])
  })

  it("nimmt die aktuelle Schemaversion an", () => {
    /* 2 seit Contract v51, und der Server liefert nie weniger: BlockResponse
       migriert beim Lesen (KAN-72). Bis KAN-32 stand die Konstante hier auf 1
       und verwarf damit jeden real gespeicherten Block. */
    const { doc, dropped } = blocksToDoc([
      responseOf(paragraph("aus dem Bestand"), {
        schemaVersion: BLOCK_SCHEMA_VERSION,
      }),
    ])

    expect(dropped).toEqual([])
    expect(doc.content).toHaveLength(1)
  })

  it("raet bei einer kuenftigen Schemaversion nicht, sondern verwirft", () => {
    const { doc, dropped } = blocksToDoc([
      responseOf(paragraph("aus der Zukunft"), {
        schemaVersion: BLOCK_SCHEMA_VERSION + 1,
      }),
    ])

    expect(doc.content).toEqual([])
    expect(dropped[0].reason).toBe("SCHEMA_VERSION_UNSUPPORTED")
  })

  it("verwirft einen unbekannten Knotentyp, ohne zu werfen", () => {
    const { doc, dropped, entries } = blocksToDoc([
      responseOf({ type: "taskList", content: [] }),
    ])

    expect(doc.content).toEqual([])
    expect(dropped).toEqual([
      {
        id: "00000000-0000-4000-8000-000000000000",
        orderIndex: 0,
        nodeType: "taskList",
        reason: "NODE_TYPE_UNKNOWN",
      },
    ])
    /* Das Loch steht an der Stelle des Blocks, damit der Platzhalter im
       Renderer dort erscheint und nicht am Ende der Seite. */
    expect(entries).toHaveLength(1)
    expect(entries[0].kind).toBe("dropped")
  })

  it("verwirft einen content, der kein Objekt ist", () => {
    const { dropped } = blocksToDoc([responseOf("kein Objekt")])

    expect(dropped[0].reason).toBe("CONTENT_NOT_AN_OBJECT")
  })

  it("setzt unzulaessige Breiten auf 100 und laesst den Block stehen", () => {
    for (const width of [80, 0, "50", null]) {
      const { doc, dropped, normalized } = blocksToDoc([
        responseOf({
          type: "imageBlock",
          attrs: { fileId: FILE_A, alt: "", caption: "", width },
        }),
      ])

      const node = doc.content[0]
      expect(dropped, `width ${String(width)}`).toEqual([])
      expect(node.type === "imageBlock" && node.attrs.width).toBe(100)
      /* null heisst "nicht gesetzt" und ist keine Normalisierung. */
      expect(normalized.length > 0).toBe(width !== null)
    }
  })

  it("setzt unzulaessige Spaltenzahlen auf 2 und laesst den Block stehen", () => {
    for (const columns of [4, 1, "3", null]) {
      const { doc, dropped } = blocksToDoc([
        responseOf({
          type: "galleryBlock",
          attrs: {
            items: [{ fileId: FILE_A, alt: "" }],
            columns,
            caption: "",
          },
        }),
      ])

      const node = doc.content[0]
      expect(dropped, `columns ${String(columns)}`).toEqual([])
      expect(node.type === "galleryBlock" && node.attrs.columns).toBe(2)
    }
  })

  it("nimmt ohne Angabe die Standardwerte 100 und 2", () => {
    const { doc } = blocksToDoc([
      responseOf({
        type: "imageBlock",
        attrs: { fileId: FILE_A, alt: "", caption: "" },
      }),
      responseOf(
        {
          type: "galleryBlock",
          attrs: { items: [{ fileId: FILE_A, alt: "" }], caption: "" },
        },
        { orderIndex: 1 }
      ),
    ])

    const image = doc.content[0]
    const gallery = doc.content[1]
    expect(image.type === "imageBlock" && image.attrs.width).toBe(100)
    expect(gallery.type === "galleryBlock" && gallery.attrs.columns).toBe(2)
  })

  it("verwirft ein Video mit beiden Quellen und eines ohne Quelle", () => {
    const both = blocksToDoc([
      responseOf({
        type: "videoBlock",
        attrs: { fileId: FILE_A, provider: "youtube", videoId: "abc" },
      }),
    ])
    const none = blocksToDoc([
      responseOf({ type: "videoBlock", attrs: { caption: "" } }),
    ])

    expect(both.dropped[0].reason).toBe("VIDEO_SOURCE_AMBIGUOUS")
    expect(none.dropped[0].reason).toBe("VIDEO_SOURCE_MISSING")
    expect(both.doc.content).toEqual([])
    expect(none.doc.content).toEqual([])
  })

  it("entfernt ein mitgeliefertes audio.src und behaelt den Block", () => {
    const { doc, dropped, normalized } = blocksToDoc([
      responseOf({
        type: "audioBlock",
        attrs: {
          fileId: FILE_A,
          src: "https://fremde.tld/ton.mp3",
          caption: "Ton",
        },
      }),
    ])

    expect(dropped).toEqual([])
    expect(doc.content[0]).toEqual({
      type: "audioBlock",
      attrs: { fileId: FILE_A, caption: "Ton" },
    })
    expect(normalized[0].reasons).toContain("AUDIO_SRC_REMOVED")
  })

  it("verwirft ein audio, das nur ein src traegt", () => {
    const { dropped } = blocksToDoc([
      responseOf({
        type: "audioBlock",
        attrs: { src: "https://fremde.tld/ton.mp3" },
      }),
    ])

    expect(dropped[0].reason).toBe("AUDIO_FILE_ID_INVALID")
  })

  it("wirft einen Galerieeintrag ohne fileId weg und ergaenzt ein fehlendes alt", () => {
    const { doc, normalized } = blocksToDoc([
      responseOf({
        type: "galleryBlock",
        attrs: {
          items: [{ alt: "ohne Datei" }, { fileId: FILE_A }],
          columns: 2,
          caption: "",
        },
      }),
    ])

    const node = doc.content[0]
    expect(node.type === "galleryBlock" && node.attrs.items).toEqual([
      { fileId: FILE_A, alt: "" },
    ])
    expect(normalized[0].reasons).toContain("GALLERY_ITEM_DROPPED")
  })

  it("verwirft eine Galerie ohne gueltigen Eintrag", () => {
    const { dropped } = blocksToDoc([
      responseOf({
        type: "galleryBlock",
        attrs: { items: [{ alt: "ohne Datei" }], columns: 2, caption: "" },
      }),
    ])

    expect(dropped[0].reason).toBe("GALLERY_ITEMS_EMPTY")
  })

  it("nennt beim abgewiesenen Einbettungshost die Adresse als reinen Text", () => {
    const { dropped } = blocksToDoc([
      responseOf({
        type: "embedBlock",
        attrs: {
          provider: "youtube",
          embedUrl: "https://fremde.tld/embed/1",
          height: 460,
        },
      }),
    ])

    expect(dropped[0].reason).toBe("EMBED_URL_NOT_ALLOWED")
    expect(dropped[0].detail).toBe("https://fremde.tld/embed/1")
  })
})

describe("migrateBlockContent", () => {
  it("ist fuer Version 1 die Identitaet", () => {
    /* Den Schritt von 1 nach 2 geht der Server beim Lesen; ein Dokument
       dieser Version erreicht den Client gar nicht. */
    const content = paragraph("unveraendert")

    expect(migrateBlockContent(content, 1)).toBe(content)
  })

  it("fuehrt die aktuelle Version 3 (Contract v63, 2.10)", () => {
    expect(BLOCK_SCHEMA_VERSION).toBe(3)
  })

  it("bildet aus Version 2 die Ebene 2 auf 1 und 3 auf 2 ab", () => {
    /* Ohne den Schritt rutschte jede vorhandene Ueberschrift eine Stufe
       nach unten: dieselbe Zahl bedeutet ab v63 etwas anderes, weil die
       Anzeige eine Stufe tiefer rendert. */
    for (const [given, expected] of [
      [2, 1],
      [3, 2],
    ] as const) {
      const migrated = migrateBlockContent(
        { type: "heading", attrs: { level: given }, content: [] },
        2
      ) as { attrs: { level: number } }

      expect(migrated.attrs.level, String(given)).toBe(expected)
    }
  })

  it("laesst andere Knoten und die aktuelle Version unberuehrt", () => {
    const content = paragraph("unveraendert")
    expect(migrateBlockContent(content, 2)).toBe(content)

    const heading = { type: "heading", attrs: { level: 2 }, content: [] }
    expect(migrateBlockContent(heading, BLOCK_SCHEMA_VERSION)).toBe(heading)
  })
})

describe("docToBlocks laesst unfertige Medienknoten weg", () => {
  /*
   * Ein Medienblock entsteht auf der Schreibflaeche leer und wird dort
   * gefuellt. Ginge er in diesem Zustand mit, ergaebe er 400
   * BLOCK_CONTENT_INVALID fuer die gesamte Liste, und damit waere jede
   * weitere Aenderung am ganzen Beitrag unspeicherbar, bis jemand den
   * Platzhalter wieder loescht.
   */
  it("schickt einen Medienknoten ohne Pflichtattribute nicht mit", () => {
    const blocks = docToBlocks({
      type: "doc",
      content: [
        paragraph("bleibt"),
        { type: "imageBlock", attrs: { fileId: "", alt: "", caption: "", width: 100 } },
        { type: "galleryBlock", attrs: { items: [], columns: 2, caption: "" } },
        { type: "mathBlock", attrs: { latex: "   " } },
        { type: "embedBlock", attrs: { provider: "figma", embedUrl: "", height: 460 } },
      ] as BlockNode[],
    })

    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe("TEXT")
  })

  it("schickt ihn mit, sobald er seine Pflichtattribute hat", () => {
    const blocks = docToBlocks({
      type: "doc",
      content: [
        {
          type: "imageBlock",
          attrs: { fileId: FILE_A, alt: "", caption: "", width: 100 },
        },
      ],
    })

    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe("IMAGE")
  })

  it("laesst Absatz, Ueberschrift und Tabelle auch leer durch", () => {
    /* Sie haben keine Pflichtattribute: leer sind sie Inhalt und kein
       unfertiger Zustand. */
    const blocks = docToBlocks({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1, textAlign: null }, content: [] },
        { type: "table", content: [] },
        paragraph("damit der Schlussabsatz nicht der einzige ist"),
      ] as BlockNode[],
    })

    expect(blocks.map((block) => block.type)).toEqual([
      "HEADING",
      "TABLE",
      "TEXT",
    ])
  })
})
