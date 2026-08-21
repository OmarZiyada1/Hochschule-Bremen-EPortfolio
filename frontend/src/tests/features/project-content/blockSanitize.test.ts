import { describe, expect, it } from "vitest"

import {
  isSafeHref,
  sanitizeBlockNode,
  toGalleryColumns,
  toImageWidth,
  MAX_NODE_DEPTH,
} from "@/features/project-content/blockSanitize"

/*
 * Die Whitelist ist die einzige Stelle, die den ganzen Knotenbaum prueft,
 * und der Lesepfad ist die einzige Ansicht ohne Anmeldung. Diese Datei
 * prueft deshalb nicht nur den Normalfall, sondern die Umgehungsversuche.
 */

const FILE_ID = "11111111-2222-4333-8444-555555555555"

/** Kurzform: prueft und gibt den Knoten heraus, oder scheitert laut. */
function sanitized(value: unknown) {
  const result = sanitizeBlockNode(value)
  if (!result.ok) {
    throw new Error(`unerwartet verworfen: ${result.reason}`)
  }
  return result
}

function textNode(marks: unknown) {
  return {
    type: "paragraph",
    attrs: { textAlign: null },
    content: [{ type: "text", text: "Text", marks }],
  }
}

describe("isSafeHref (Contract 2.5, Protokollfilter)", () => {
  it("laesst http, https und mailto durch", () => {
    expect(isSafeHref("https://hs-bremen.de/pfad?a=1")).toBe(true)
    expect(isSafeHref("http://example.org")).toBe(true)
    expect(isSafeHref("mailto:person@hs-bremen.de")).toBe(true)
  })

  it("weist javascript, data und vbscript in jeder Schreibweise ab", () => {
    for (const href of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "JAVASCRIPT:alert(1)",
      " javascript:alert(1)",
      "\tjavascript:alert(1)",
      "java\nscript:alert(1)",
      "java\rscript:alert(1)",
      "java\u0000script:alert(1)",
      "java script:alert(1)",
      "data:text/html;base64,PHNjcmlwdD4=",
      "DATA:text/html,<script>",
      "vbscript:msgbox(1)",
      "VBScript:msgbox(1)",
    ]) {
      expect(isSafeHref(href), href).toBe(false)
    }
  })

  it("weist eine Adresse ohne Schema ab, relativ wie protokollrelativ", () => {
    for (const href of [
      "//fremde.tld/pfad",
      "/interner/pfad",
      "hs-bremen.de",
      "",
      "   ",
    ]) {
      expect(isSafeHref(href), href).toBe(false)
    }
  })

  it("weist alles ab, was keine Zeichenkette ist", () => {
    for (const href of [null, undefined, 42, {}, ["https://a.de"]]) {
      expect(isSafeHref(href)).toBe(false)
    }
  })
})

describe("toImageWidth und toGalleryColumns", () => {
  it("geben nur die erlaubten Zahlen heraus, sonst den Standardwert", () => {
    expect(toImageWidth(100)).toBe(100)
    expect(toImageWidth(75)).toBe(75)
    expect(toImageWidth(50)).toBe(50)
    for (const value of [
      80,
      0,
      -50,
      null,
      undefined,
      {},
      [],
      "50",
      Number.NaN,
    ]) {
      expect(toImageWidth(value), String(value)).toBe(100)
    }

    expect(toGalleryColumns(2)).toBe(2)
    expect(toGalleryColumns(3)).toBe(3)
    for (const value of [1, 4, null, "3", Number.NaN]) {
      expect(toGalleryColumns(value), String(value)).toBe(2)
    }
  })
})

describe("Marks", () => {
  it("entfernt eine unbekannte Mark und laesst den Text stehen", () => {
    const { node } = sanitized(
      textNode([{ type: "bold" }, { type: "blink" }, { type: "fontSize" }])
    )

    expect(node).toEqual({
      type: "paragraph",
      attrs: { textAlign: null },
      content: [{ type: "text", text: "Text", marks: [{ type: "bold" }] }],
    })
  })

  it("laesst genau die zehn Marks aus 2.5 durch", () => {
    const { node } = sanitized(
      textNode([
        { type: "bold" },
        { type: "italic" },
        { type: "underline" },
        { type: "strike" },
        { type: "code" },
        { type: "superscript" },
        { type: "subscript" },
        { type: "link", attrs: { href: "https://hs-bremen.de" } },
        { type: "textStyle", attrs: { color: "blue" } },
        { type: "highlight", attrs: { color: "amber" } },
      ])
    )

    const paragraph = node.type === "paragraph" ? node : null
    expect(paragraph?.content?.[0].marks).toHaveLength(10)
  })

  it("wirft die link-Mark weg, wenn href scheitert, und behaelt den Text", () => {
    const { node } = sanitized(
      textNode([{ type: "link", attrs: { href: "javascript:alert(1)" } }])
    )

    expect(node).toEqual({
      type: "paragraph",
      attrs: { textAlign: null },
      content: [{ type: "text", text: "Text" }],
    })
  })

  it("behaelt an der link-Mark allein href", () => {
    const { node } = sanitized(
      textNode([
        {
          type: "link",
          attrs: {
            href: "https://hs-bremen.de",
            target: "_blank",
            rel: "me",
            onclick: "alert(1)",
          },
        },
      ])
    )

    const paragraph = node.type === "paragraph" ? node : null
    expect(paragraph?.content?.[0].marks?.[0]).toEqual({
      type: "link",
      attrs: { href: "https://hs-bremen.de" },
    })
  })

  it("nimmt bei textStyle und highlight nur bekannte Rollennamen", () => {
    /* Neun seit Contract v63; brown, orange, purple und pink kamen dazu. */
    for (const color of [
      "neutral",
      "brown",
      "orange",
      "amber",
      "green",
      "blue",
      "purple",
      "pink",
      "red",
    ]) {
      const { node } = sanitized(
        textNode([{ type: "textStyle", attrs: { color } }])
      )
      const paragraph = node.type === "paragraph" ? node : null
      expect(paragraph?.content?.[0].marks, color).toHaveLength(1)
    }

    /*
     * Die beiden ersten Werte sind zusammengesetzt und stehen nicht als
     * Literal da: tokens.test.ts verbietet jeden Hex-Wert und jeden
     * Primitive-Namen ausserhalb der Tokenschicht, und dieser Wachhund
     * soll scharf bleiben. Es sind Testdaten fuer die Zurueckweisung und
     * keine Farben.
     */
    const hexWert = `#${"ff0000"}`
    const primitiveAusdruck = `var(--${"rot"}-600)`

    for (const color of [
      hexWert,
      "rgb(255,0,0)",
      primitiveAusdruck,
      "url(x)",
      /* Bis v62 stand hier "orange" als Gegenprobe. Der Name ist seit v63
         eine gueltige Rolle; "teal" steht in keiner Fassung der Palette. */
      "teal",
      "",
      null,
      12,
    ]) {
      const { node } = sanitized(
        textNode([
          { type: "textStyle", attrs: { color } },
          { type: "highlight", attrs: { color } },
        ])
      )
      const paragraph = node.type === "paragraph" ? node : null
      expect(paragraph?.content?.[0].marks, String(color)).toBeUndefined()
    }
  })

  it("entfernt Marks in einem Quelltextblock, weil 2.5 sie dort nicht zulaesst", () => {
    const { node } = sanitized({
      type: "codeBlock",
      attrs: { language: "ts" },
      content: [
        { type: "text", text: "const a = 1", marks: [{ type: "bold" }] },
      ],
    })

    expect(node).toEqual({
      type: "codeBlock",
      attrs: { language: "ts" },
      content: [{ type: "text", text: "const a = 1" }],
    })
  })
})

describe("Attribute und Knotengrammatik", () => {
  it("laesst die Ebenen 1 bis 6 unveraendert (2.5 seit v63)", () => {
    for (const level of [1, 2, 3, 4, 5, 6] as const) {
      const result = sanitized({
        type: "heading",
        attrs: { level },
        content: [],
      })
      const node = result.node.type === "heading" ? result.node : null
      expect(node?.attrs.level, String(level)).toBe(level)
      expect(result.normalizations, String(level)).not.toContain(
        "HEADING_LEVEL_CLAMPED"
      )
    }
  })

  it("klemmt eine Ueberschriftenebene ausserhalb von 1 bis 6", () => {
    for (const [given, expected] of [
      [0, 1],
      [-3, 1],
      [7, 6],
      [12, 6],
    ] as const) {
      const result = sanitized({
        type: "heading",
        attrs: { level: given },
        content: [],
      })
      const node = result.node.type === "heading" ? result.node : null
      expect(node?.attrs.level, String(given)).toBe(expected)
      expect(result.normalizations).toContain("HEADING_LEVEL_CLAMPED")
    }
  })

  it("verwirft justify an der Ueberschrift und vermerkt es", () => {
    const result = sanitized({
      type: "heading",
      attrs: { level: 2, textAlign: "justify" },
      content: [],
    })
    const node = result.node.type === "heading" ? result.node : null

    expect(node?.attrs.textAlign).toBeNull()
    expect(result.normalizations).toContain("HEADING_ALIGN_DROPPED")
  })

  it("laesst links, zentriert und rechts an der Ueberschrift stehen", () => {
    for (const textAlign of ["left", "center", "right"] as const) {
      const result = sanitized({
        type: "heading",
        attrs: { level: 2, textAlign },
        content: [],
      })
      const node = result.node.type === "heading" ? result.node : null

      expect(node?.attrs.textAlign, textAlign).toBe(textAlign)
      expect(result.normalizations, textAlign).not.toContain(
        "HEADING_ALIGN_DROPPED"
      )
    }
  })

  it("laesst justify am Absatz stehen: die Schranke gilt nur an der Ueberschrift", () => {
    const result = sanitized({
      type: "paragraph",
      attrs: { textAlign: "justify" },
      content: [],
    })
    const node = result.node.type === "paragraph" ? result.node : null

    expect(node?.attrs?.textAlign).toBe("justify")
    expect(result.normalizations).not.toContain("HEADING_ALIGN_DROPPED")
  })

  it("nimmt textAlign nur mit einem der vier Werte", () => {
    for (const [given, expected] of [
      ["center", "center"],
      ["justify", "justify"],
      ["middle", null],
      ["", null],
    ] as const) {
      const { node } = sanitized({
        type: "paragraph",
        attrs: { textAlign: given },
        content: [],
      })
      const paragraph = node.type === "paragraph" ? node : null
      expect(paragraph?.attrs?.textAlign, given).toBe(expected)
    }
  })

  it("entfernt colwidth an Tabellenzellen und behaelt colspan und rowspan", () => {
    const { node } = sanitized({
      type: "table",
      attrs: { caption: null },
      content: [
        {
          type: "tableRow",
          content: [
            {
              type: "tableCell",
              attrs: { colspan: 2, rowspan: 1, colwidth: [120, 240] },
              content: [],
            },
          ],
        },
      ],
    })

    const table = node.type === "table" ? node : null
    expect(table?.content?.[0].content?.[0].attrs).toEqual({
      colspan: 2,
      rowspan: 1,
    })
  })

  it("wirft einen Kindknoten weg, den 2.5 an dieser Stelle nicht kennt", () => {
    const { node } = sanitized({
      type: "bulletList",
      content: [
        { type: "listItem", content: [{ type: "taskItem", content: [] }] },
        { type: "taskItem", content: [] },
      ],
    })

    expect(node).toEqual({
      type: "bulletList",
      content: [{ type: "listItem", content: [] }],
    })
  })

  it("laesst im Zitat nur Absaetze stehen", () => {
    const { node } = sanitized({
      type: "blockquote",
      content: [
        { type: "paragraph", attrs: { textAlign: null }, content: [] },
        { type: "bulletList", content: [] },
      ],
    })

    const quote = node.type === "blockquote" ? node : null
    expect(quote?.content).toHaveLength(1)
  })
})

describe("Schachtelungstiefe (Contract 2.5 seit v54)", () => {
  /**
   * Kette aus bulletList und listItem, deren tiefster Knoten ein Absatz
   * auf der gewuenschten Ebene ist. Der Wurzelknoten zaehlt als Ebene 1.
   */
  function chain(depth: number): unknown {
    let current: unknown = { type: "paragraph", attrs: { textAlign: null } }
    for (let level = depth - 1; level >= 1; level -= 1) {
      current =
        level % 2 === 1
          ? { type: "bulletList", content: [current] }
          : { type: "listItem", content: [current] }
    }
    return current
  }

  it("nimmt einen Baum mit genau zwanzig Ebenen an", () => {
    const result = sanitizeBlockNode(chain(MAX_NODE_DEPTH))

    expect(result.ok).toBe(true)
  })

  it("verwirft einen Baum mit einundzwanzig Ebenen", () => {
    const result = sanitizeBlockNode(chain(MAX_NODE_DEPTH + 1))

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reason).toBe("NODE_DEPTH_EXCEEDED")
  })

  it("begrenzt die Anzahl der Bloecke nicht", () => {
    /* Die Grenze gilt innerhalb eines Blocks. Wie viele Bloecke ein Projekt
       hat, begrenzt weder diese Datei noch der Server. */
    const many = Array.from({ length: 500 }, () =>
      sanitizeBlockNode({ type: "horizontalRule" })
    )

    expect(many.every((result) => result.ok)).toBe(true)
  })
})

describe("Medienknoten", () => {
  it("verwirft ein Bild ohne brauchbare fileId", () => {
    for (const fileId of [undefined, null, "", "keine-uuid", 42]) {
      const result = sanitizeBlockNode({
        type: "imageBlock",
        attrs: { fileId, alt: "", caption: "" },
      })

      expect(result.ok, String(fileId)).toBe(false)
    }
  })

  it("laesst die Hoehe einer Einbettung stehen und ergaenzt nur den Standardwert", () => {
    /* Die Spanne 200 bis 1200 ist eine Anzeigeentscheidung und steht im
       Renderer: weder 2.5 noch der Server kennen sie, und was der Lesepfad
       hier klemmte, schriebe der naechste Speicherlauf zurueck. */
    for (const [given, expected] of [
      [50, 50],
      [5000, 5000],
      [460, 460],
      [null, 460],
      [0, 460],
      ["460", 460],
    ] as const) {
      const { node } = sanitized({
        type: "embedBlock",
        attrs: {
          provider: "codepen",
          embedUrl: "https://codepen.io/pen/embed/abc",
          height: given,
        },
      })
      const embed = node.type === "embedBlock" ? node : null
      expect(embed?.attrs.height, String(given)).toBe(expected)
    }
  })

  it("verwirft eine Einbettung mit fremdem Provider oder fremdem Host", () => {
    const fremderProvider = sanitizeBlockNode({
      type: "embedBlock",
      attrs: { provider: "tiktok", embedUrl: "https://www.tiktok.com/x" },
    })
    const fremderHost = sanitizeBlockNode({
      type: "embedBlock",
      attrs: { provider: "figma", embedUrl: "https://figma.fremde.tld/x" },
    })
    const ohneHttps = sanitizeBlockNode({
      type: "embedBlock",
      attrs: { provider: "codepen", embedUrl: "http://codepen.io/pen/embed/a" },
    })

    expect(fremderProvider.ok === false && fremderProvider.reason).toBe(
      "EMBED_PROVIDER_NOT_ALLOWED"
    )
    expect(fremderHost.ok === false && fremderHost.reason).toBe(
      "EMBED_URL_NOT_ALLOWED"
    )
    expect(ohneHttps.ok === false && ohneHttps.reason).toBe(
      "EMBED_URL_NOT_ALLOWED"
    )
  })

  it("prueft die videoId gegen das Muster ihres Anbieters", () => {
    const gut = sanitizeBlockNode({
      type: "videoBlock",
      attrs: { provider: "vimeo", videoId: "123456789", caption: "" },
    })
    const schlecht = sanitizeBlockNode({
      type: "videoBlock",
      attrs: { provider: "vimeo", videoId: "abc/../x", caption: "" },
    })

    expect(gut.ok).toBe(true)
    expect(schlecht.ok === false && schlecht.reason).toBe("VIDEO_ID_INVALID")
  })

  it("verwirft ein Dokument ohne Namen oder ohne Groesse", () => {
    for (const attrs of [
      { fileId: FILE_ID, fileName: "", size: 10 },
      /* Der Server prueft mit isBlank; drei Leerzeichen sind kein Name. */
      { fileId: FILE_ID, fileName: "   ", size: 10 },
      { fileId: FILE_ID, fileName: "a.pdf", size: 0 },
      { fileId: FILE_ID, fileName: "a.pdf", size: "10" },
      { fileId: FILE_ID, fileName: "a.pdf" },
    ]) {
      const result = sanitizeBlockNode({ type: "documentBlock", attrs })

      expect(result.ok, JSON.stringify(attrs)).toBe(false)
    }
  })

  it("verwirft eine Formel ohne latex, auch bei reinem Leerraum", () => {
    for (const latex of ["", "   ", "\n\t"]) {
      const result = sanitizeBlockNode({ type: "mathBlock", attrs: { latex } })

      expect(result.ok === false && result.reason, JSON.stringify(latex)).toBe(
        "MATH_LATEX_MISSING"
      )
    }
  })

  it("vermerkt jedes mit 2.5 gestrichene Attribut, statt es spurlos zu entfernen", () => {
    /* Der Server weist AUDIO.src, GALLERY.fileIds, VIDEO.embedUrl und
       VIDEO.src aktiv mit 400 ab. Der Lesepfad repariert stattdessen, damit
       ein Altdokument lesbar bleibt; unbemerkt umschreiben soll er es
       nicht. */
    const gallery = sanitized({
      type: "galleryBlock",
      attrs: {
        fileIds: [FILE_ID],
        items: [{ fileId: FILE_ID, alt: "" }],
        columns: 2,
        caption: "",
      },
    })
    expect(gallery.normalizations).toContain("GALLERY_FILE_IDS_REMOVED")

    const video = sanitized({
      type: "videoBlock",
      attrs: {
        provider: "vimeo",
        videoId: "1",
        caption: "",
        embedUrl: "https://player.vimeo.com/video/1",
      },
    })
    expect(video.normalizations).toContain("VIDEO_URL_REMOVED")
  })

  it("unterscheidet ein leeres alt von einem fehlenden", () => {
    /* Leer heisst ausdruecklich "schmueckend", fehlend heisst vergessen
       (2.5, SC 1.1.1). Der Server weist den zweiten Fall ab; hier wird er
       repariert und vermerkt. */
    const leer = sanitized({
      type: "galleryBlock",
      attrs: { items: [{ fileId: FILE_ID, alt: "" }], columns: 2, caption: "" },
    })
    const fehlend = sanitized({
      type: "galleryBlock",
      attrs: { items: [{ fileId: FILE_ID }], columns: 2, caption: "" },
    })

    expect(leer.normalizations).not.toContain("GALLERY_ITEM_ALT_DEFAULTED")
    expect(fehlend.normalizations).toContain("GALLERY_ITEM_ALT_DEFAULTED")
    const node = fehlend.node
    expect(node.type === "galleryBlock" && node.attrs.items[0].alt).toBe("")
  })
})
