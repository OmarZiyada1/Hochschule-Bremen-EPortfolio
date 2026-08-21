import { generateHTML, generateJSON, getSchema } from "@tiptap/react"
import { describe, expect, it } from "vitest"

import { createBlockExtensions } from "@/features/project-content/blockSchema"
import { NODE_TYPE_TO_BLOCK_TYPE } from "@/features/project-content/blockTypes"

/*
 * Geprueft wird das gebaute Schema und nicht eine Handliste daneben: eine
 * zweite Aufzaehlung liefe irgendwann von createBlockExtensions weg, und
 * der Unterschied fiele erst beim Speichern auf.
 */

const extensions = createBlockExtensions()
const schema = getSchema(extensions)

/** Alle Knoten, die als Top-Level-Block im Dokument stehen duerfen. */
const blockNodeNames = Object.entries(schema.nodes)
  .filter(([, type]) => type.spec.group?.split(" ").includes("block") === true)
  .map(([name]) => name)
  .sort()

describe("Schema-Vollstaendigkeit (Contract 2.5)", () => {
  it("deckt Knotentyp und BlockType in beide Richtungen", () => {
    expect(blockNodeNames).toEqual(Object.keys(NODE_TYPE_TO_BLOCK_TYPE).sort())
  })

  it("bildet fuenfzehn Knotennamen auf vierzehn Blocktypen ab", () => {
    expect(Object.keys(NODE_TYPE_TO_BLOCK_TYPE)).toHaveLength(15)
    expect(new Set(Object.values(NODE_TYPE_TO_BLOCK_TYPE)).size).toBe(14)
  })

  it("fuehrt genau die zehn Marks aus 2.5", () => {
    expect(Object.keys(schema.marks).sort()).toEqual(
      [
        "bold",
        "code",
        "highlight",
        "italic",
        "link",
        "strike",
        "subscript",
        "superscript",
        "textStyle",
        "underline",
      ].sort()
    )
  })

  it("kennt weder Aufgabenlisten noch hardBreak noch ein Bild aus dem StarterKit", () => {
    for (const absent of ["taskList", "taskItem", "hardBreak", "image"]) {
      expect(schema.nodes[absent], absent).toBeUndefined()
    }
  })

  it("meldet die Tabelle mit ihren drei Kindknoten an", () => {
    for (const name of ["table", "tableRow", "tableHeader", "tableCell"]) {
      expect(schema.nodes[name], name).toBeDefined()
    }
  })
})

describe("Ueberschriftenebenen", () => {
  it("erzeugt Ueberschriften in den Ebenen 1 bis 6", () => {
    /* Sechs Ebenen seit Contract v63. Gespeichert wird die Gliederungsebene
       des Beitrags; dass die Anzeige sie um eine Stufe nach unten schiebt,
       ist Sache von headingRendering.ts und nicht des Schemas. */
    const json = generateJSON(
      "<h1>Eins</h1><h2>Zwei</h2><h3>Drei</h3><h4>Vier</h4><h5>Fuenf</h5><h6>Sechs</h6>",
      extensions
    ) as { content: { type: string; attrs?: { level?: number } }[] }

    expect(
      json.content.map((node) => `${node.type}:${node.attrs?.level ?? "-"}`)
    ).toEqual([
      "heading:1",
      "heading:2",
      "heading:3",
      "heading:4",
      "heading:5",
      "heading:6",
    ])
  })

  it("fuehrt textAlign an Absatz und Ueberschrift", () => {
    /* §2.5 seit v63. Die Werteliste gilt fuer beide Typen gemeinsam; dass
       justify an der Ueberschrift nicht stehenbleibt, sichert der
       HeadingAlignGuard, nicht das Schema. */
    expect(schema.nodes.heading.spec.attrs?.textAlign).toBeDefined()
    expect(schema.nodes.paragraph.spec.attrs?.textAlign).toBeDefined()
  })
})

describe("Attribut-Serialisierung der sieben eigenen Nodes", () => {
  const FILE_A = "11111111-2222-4333-8444-555555555555"
  const FILE_B = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"

  /** Ein Knoten durch getHTML und wieder zurueck. */
  function throughHtml(node: Record<string, unknown>) {
    const html = generateHTML({ type: "doc", content: [node] }, extensions)
    const json = generateJSON(html, extensions) as {
      content: { type: string; attrs: Record<string, unknown> }[]
    }
    return { html, node: json.content[0] }
  }

  it("schreibt jedes Attribut als data-Attribut und liest es zurueck", () => {
    const cases: [string, Record<string, unknown>][] = [
      [
        "imageBlock",
        {
          fileId: FILE_A,
          alt: "Ein Alt",
          caption: "Eine Unterschrift",
          width: 75,
        },
      ],
      [
        "galleryBlock",
        {
          items: [
            { fileId: FILE_A, alt: "Erstes" },
            { fileId: FILE_B, alt: "" },
          ],
          columns: 3,
          caption: "Galerie",
        },
      ],
      [
        "videoBlock",
        { fileId: FILE_A, provider: null, videoId: null, caption: "Aufnahme" },
      ],
      [
        "videoBlock",
        {
          fileId: null,
          provider: "youtube",
          videoId: "dQw4w9WgXcQ",
          caption: "",
        },
      ],
      ["audioBlock", { fileId: FILE_B, caption: "Interview" }],
      [
        "documentBlock",
        { fileId: FILE_A, fileName: "bericht.pdf", size: 2400000 },
      ],
      [
        "embedBlock",
        {
          provider: "gist",
          embedUrl: "https://gist.github.com/a/b",
          height: 520,
        },
      ],
      ["mathBlock", { latex: "E = mc^2" }],
    ]

    for (const [type, attrs] of cases) {
      const { node } = throughHtml({ type, attrs })

      expect(node.type, type).toBe(type)
      expect(node.attrs, `${type} ${JSON.stringify(attrs)}`).toEqual(attrs)
    }
  })

  it("kodiert die Galerieeintraege als data-items", () => {
    const { html } = throughHtml({
      type: "galleryBlock",
      attrs: {
        items: [{ fileId: FILE_A, alt: "Erstes" }],
        columns: 2,
        caption: "",
      },
    })

    expect(html).toContain("data-items=")
    expect(html).toContain('data-columns="2"')
    expect(html).toContain(FILE_A)
  })

  it("gibt width und columns als Zahl zurueck, im HTML als data-Attribut", () => {
    const image = throughHtml({
      type: "imageBlock",
      attrs: { fileId: FILE_A, alt: "", caption: "", width: 50 },
    })
    const gallery = throughHtml({
      type: "galleryBlock",
      attrs: {
        items: [{ fileId: FILE_A, alt: "" }],
        columns: 3,
        caption: "",
      },
    })

    expect(image.html).toContain('data-width="50"')
    expect(image.node.attrs.width).toBe(50)
    expect(gallery.html).toContain('data-columns="3"')
    expect(gallery.node.attrs.columns).toBe(3)
  })

  it("nimmt einen unzulaessigen Wert im HTML auf den Standardwert zurueck, nie auf NaN", () => {
    const json = generateJSON(
      '<figure data-type="image-block" data-file-id="' +
        FILE_A +
        '" data-width="80"></figure>' +
        '<figure data-type="gallery-block" data-items="[]" data-columns="9"></figure>',
      extensions
    ) as { content: { attrs: Record<string, unknown> }[] }

    expect(json.content[0].attrs.width).toBe(100)
    expect(json.content[1].attrs.columns).toBe(2)
  })
})

describe("Farbrollen im Schema", () => {
  it("schreibt textStyle und highlight als data-color, ohne Inline-Stil", () => {
    const html = generateHTML(
      {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "farbig",
                marks: [
                  { type: "textStyle", attrs: { color: "blue" } },
                  { type: "highlight", attrs: { color: "amber" } },
                ],
              },
            ],
          },
        ],
      },
      extensions
    )

    expect(html).toContain('data-color="blue"')
    expect(html).toContain('data-color="amber"')
    expect(html).not.toContain("background-color")
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it("liest den Rollennamen aus data-color wieder ein", () => {
    const json = generateJSON(
      '<p><span data-color="green">gruen</span></p>',
      extensions
    ) as {
      content: {
        content: {
          marks?: { type: string; attrs: Record<string, unknown> }[]
        }[]
      }[]
    }

    expect(json.content[0].content[0].marks?.[0]).toEqual({
      type: "textStyle",
      attrs: { color: "green" },
    })
  })
})
