import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { BlockResponse } from "@/api/types"
import { ProjectContent } from "@/features/project-content/renderer/ProjectContent"
import { renderWithProviders } from "@/tests/render"

/*
 * jsdom laedt weder Bilder noch iframe-Inhalte noch Medienstroeme. Geprueft
 * werden deshalb Attribute und Struktur, nicht das Laden und nicht das
 * Abspielen.
 */

const FILE_A = "11111111-2222-4333-8444-555555555555"
const FILE_B = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"

function blocksOf(...contents: unknown[]): BlockResponse[] {
  return contents.map((content, index) => ({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    orderIndex: index,
    schemaVersion: 1,
    content: content as BlockResponse["content"],
  }))
}

function paragraph(text: string) {
  return {
    type: "paragraph",
    attrs: { textAlign: null },
    content: [{ type: "text", text }],
  }
}

function render(...contents: unknown[]) {
  return renderWithProviders(<ProjectContent blocks={blocksOf(...contents)} />)
}

describe("Ueberschriften und Fliesstext", () => {
  it("gibt nur h2 und h3 aus, nie h1", () => {
    render(
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Zwei" }],
      },
      {
        type: "heading",
        attrs: { level: 3 },
        content: [{ type: "text", text: "Drei" }],
      }
    )

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Zwei")
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Drei")
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull()
  })

  it("setzt die Ausrichtung als Datenattribut und nicht als Inline-Stil", () => {
    const { container } = render({
      type: "paragraph",
      attrs: { textAlign: "center" },
      content: [{ type: "text", text: "mittig" }],
    })

    const element = container.querySelector("p")
    expect(element).toHaveAttribute("data-text-align", "center")
    expect(element).not.toHaveAttribute("style")
  })

  it("stellt ein Zitat als blockquote dar", () => {
    const { container } = render({
      type: "blockquote",
      content: [paragraph("Ein Zitat.")],
    })

    expect(container.querySelector("blockquote")).toHaveTextContent(
      "Ein Zitat."
    )
  })

  it("gibt den Quelltextblock als erreichbaren pre mit language-Klasse aus", () => {
    const { container } = render({
      type: "codeBlock",
      attrs: { language: "ts" },
      content: [{ type: "text", text: "const a = 1" }],
    })

    const code = container.querySelector("pre > code")
    expect(code).toHaveClass("language-ts")
    expect(code).toHaveTextContent("const a = 1")
    /* Ein Container mit overflow-x ohne Fokus laesst sich mit der Tastatur
       nicht scrollen (SC 2.1.1). */
    const region = screen.getByRole("region", {
      name: "Quelltext, waagerecht scrollbar",
    })
    expect(region.tagName).toBe("PRE")
    expect(region).toHaveAttribute("tabindex", "0")
  })
})

describe("Marks", () => {
  it("laesst javascript: in keiner Schreibweise ins DOM", () => {
    const { container } = render({
      type: "paragraph",
      attrs: { textAlign: null },
      content: [
        {
          type: "text",
          text: "Klick mich",
          marks: [{ type: "link", attrs: { href: "JavaScript:alert(1)" } }],
        },
      ],
    })

    expect(container.querySelector("a")).toBeNull()
    expect(container.innerHTML).not.toMatch(/javascript:/i)
    /* Der Text bleibt: es faellt die Mark, nicht der Satz. */
    expect(screen.getByText("Klick mich")).toBeInTheDocument()
  })

  it("gibt einen erlaubten Link mit rel aus", () => {
    render({
      type: "paragraph",
      attrs: { textAlign: null },
      content: [
        {
          type: "text",
          text: "Zur Hochschule",
          marks: [{ type: "link", attrs: { href: "https://hs-bremen.de" } }],
        },
      ],
    })

    const link = screen.getByRole("link", { name: "Zur Hochschule" })
    expect(link).toHaveAttribute("href", "https://hs-bremen.de")
    expect(link).toHaveAttribute("rel", "noopener noreferrer")
  })

  it("setzt Farbrollen als data-color und nie als Farbwert", () => {
    const { container } = render({
      type: "paragraph",
      attrs: { textAlign: null },
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
    })

    expect(container.querySelector('span[data-color="blue"]')).not.toBeNull()
    expect(container.querySelector('mark[data-color="amber"]')).not.toBeNull()
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})

describe("Bild und Galerie", () => {
  it("stellt ein Bild als figure mit figcaption dar", () => {
    const { container } = render({
      type: "imageBlock",
      attrs: {
        fileId: FILE_A,
        alt: "Ein Messaufbau",
        caption: "Abbildung 1",
        width: 75,
      },
    })

    const figure = container.querySelector("figure")
    const image = screen.getByRole("img", { name: "Ein Messaufbau" })
    expect(figure).toHaveAttribute("data-width", "75")
    expect(figure).not.toHaveAttribute("style")
    expect(image).toHaveAttribute("src", `/api/files/${FILE_A}`)
    expect(image).toHaveAttribute("loading", "lazy")
    expect(image).toHaveAttribute("decoding", "async")
    expect(container.querySelector("figcaption")).toHaveTextContent(
      "Abbildung 1"
    )
  })

  it("gibt jedem Galeriebild sein eigenes alt in einem eigenen li", () => {
    const { container } = render({
      type: "galleryBlock",
      attrs: {
        items: [
          { fileId: FILE_A, alt: "Erstes Bild" },
          { fileId: FILE_B, alt: "" },
        ],
        columns: 3,
        caption: "Drei Ansichten",
      },
    })

    const figure = container.querySelector("figure")
    expect(figure).toHaveAttribute("data-columns", "3")
    /* role="group" nimmt dem figure den Namen aus der figcaption; die
       Huelle reicht ihn deshalb ausdruecklich nach. Geprueft wird die
       Wirkung, nicht das Attribut. */
    expect(
      screen.getByRole("group", { name: "Drei Ansichten" })
    ).toBeInTheDocument()
    expect(container.querySelectorAll("li")).toHaveLength(2)
    expect(container.querySelectorAll("li img")).toHaveLength(2)
    expect(screen.getByRole("img", { name: "Erstes Bild" })).toBeInTheDocument()
    /* Das zweite Bild ist ausdruecklich schmueckend: leeres alt, kein
       fehlendes (SC 1.1.1). */
    const images = container.querySelectorAll("img")
    expect(images[1]).toHaveAttribute("alt", "")
  })

  it("laesst die figcaption weg, wenn keine gesetzt ist", () => {
    const { container } = render({
      type: "imageBlock",
      attrs: {
        fileId: FILE_A,
        alt: "ohne Unterschrift",
        caption: "",
        width: 100,
      },
    })

    expect(container.querySelector("figcaption")).toBeNull()
  })
})

describe("Video, Audio und Einbettung", () => {
  it("gibt ein hochgeladenes Video mit controls und preload=metadata aus", () => {
    const { container } = render({
      type: "videoBlock",
      attrs: { fileId: FILE_A, caption: "" },
    })

    const video = container.querySelector("video")
    expect(video).toHaveAttribute("controls")
    expect(video).toHaveAttribute("preload", "metadata")
    expect(video).not.toHaveAttribute("autoplay")
    expect(video).not.toHaveAttribute("loop")
    expect(video).toHaveAttribute("src", `/api/files/${FILE_A}`)
    /* Ohne Unterschrift bleibt der allgemeine Name aus i18n. */
    expect(video).toHaveAttribute("aria-label", "Video aus diesem Beitrag")
    /* Keine Untertitelspur: benannte Grenze von KAN-10, 2.5 kennt kein
       Attribut fuer eine WebVTT-Datei. */
    expect(container.querySelector("track")).toBeNull()
  })

  it("nimmt die Unterschrift als Namen, sobald es eine gibt", () => {
    /* Sonst haette ein Beitrag mit vier Videos vier gleich benannte
       Player, zwischen denen in der Elementliste nichts zu unterscheiden
       ist (SC 2.4.6). */
    const { container } = render(
      { type: "videoBlock", attrs: { fileId: FILE_A, caption: "Erster Lauf" } },
      { type: "videoBlock", attrs: { fileId: FILE_B, caption: "Zweiter Lauf" } }
    )

    const videos = container.querySelectorAll("video")
    const captions = container.querySelectorAll("figcaption")
    expect(videos[0].getAttribute("aria-labelledby")).toBe(captions[0].id)
    expect(videos[1].getAttribute("aria-labelledby")).toBe(captions[1].id)
    /* Nicht zusaetzlich als Beschreibung, sonst wird sie zweimal
       vorgelesen. */
    expect(videos[0]).not.toHaveAttribute("aria-describedby")
    expect(captions[0].id).not.toBe(captions[1].id)
  })

  it("gibt eine Videoeinbettung als iframe mit title aus", () => {
    render({
      type: "videoBlock",
      attrs: { provider: "youtube", videoId: "dQw4w9WgXcQ", caption: "" },
    })

    const frame = screen.getByTitle("Eingebettetes Video von YouTube")
    expect(frame).toHaveAttribute(
      "src",
      "https://www.youtube.com/embed/dQw4w9WgXcQ"
    )
  })

  it("gibt Audio mit controls und ohne autoplay aus", () => {
    const { container } = render({
      type: "audioBlock",
      attrs: { fileId: FILE_B, caption: "" },
    })

    const audio = container.querySelector("audio")
    expect(audio).toHaveAttribute("controls")
    expect(audio).toHaveAttribute("preload", "metadata")
    expect(audio).not.toHaveAttribute("autoplay")
    expect(audio).toHaveAttribute("src", `/api/files/${FILE_B}`)
    expect(audio).toHaveAttribute(
      "aria-label",
      "Audioaufnahme aus diesem Beitrag"
    )
  })

  it("gibt eine Einbettung mit title und Hoehe aus", () => {
    const frame = render({
      type: "embedBlock",
      attrs: {
        provider: "codepen",
        embedUrl: "https://codepen.io/pen/embed/abc",
        height: 520,
      },
    })

    const iframe = screen.getByTitle("Eingebetteter Inhalt von CodePen")
    expect(iframe).toHaveAttribute("height", "520")
    expect(frame.container.querySelectorAll("iframe")).toHaveLength(1)
  })

  it("begrenzt die Hoehe der Einbettung in der Anzeige auf 200 bis 1200", () => {
    /* Nur die Anzeige: der gespeicherte Wert bleibt, wie er ist, weil
       weder 2.5 noch der Server eine Spanne kennen. Ein iframe von
       fuenftausend Pixeln braeche den Textfluss (SC 1.4.10). */
    const { container } = render(
      {
        type: "embedBlock",
        attrs: {
          provider: "gist",
          embedUrl: "https://gist.github.com/a/b",
          height: 5000,
        },
      },
      {
        type: "embedBlock",
        attrs: {
          provider: "figma",
          embedUrl: "https://www.figma.com/embed?x=1",
          height: 40,
        },
      }
    )

    const frames = container.querySelectorAll("iframe")
    expect(frames[0]).toHaveAttribute("height", "1200")
    expect(frames[1]).toHaveAttribute("height", "200")
  })

  it("zeigt bei fremdem Host den Platzhalter mit der Adresse als Text", () => {
    const { container } = render({
      type: "embedBlock",
      attrs: {
        provider: "youtube",
        embedUrl: "https://fremde.tld/embed/1",
        height: 460,
      },
    })

    expect(container.querySelector("iframe")).toBeNull()
    expect(screen.getByRole("note")).toBeInTheDocument()
    expect(screen.getByText("https://fremde.tld/embed/1")).toBeInTheDocument()
    /* Als reiner Text, nie als Ziel eines Links. */
    expect(container.querySelector("a")).toBeNull()
  })

  it("verlinkt ein Dokument mit Name und Groesse im zugaenglichen Namen", () => {
    render({
      type: "documentBlock",
      attrs: { fileId: FILE_A, fileName: "bericht.pdf", size: 2_400_000 },
    })

    const link = screen.getByRole("link", { name: /bericht\.pdf/ })
    expect(link).toHaveAttribute("href", `/api/files/${FILE_A}`)
    expect(link.getAttribute("aria-label")).toMatch(/PDF/)
    expect(link.getAttribute("aria-label")).toMatch(/MB/)
  })
})

describe("Tabelle", () => {
  it("gibt Kopfzellen als th mit scope in einem erreichbaren Bereich aus", () => {
    const { container } = render({
      type: "table",
      attrs: { caption: "Messreihe" },
      content: [
        {
          type: "tableRow",
          content: [
            { type: "tableHeader", attrs: {}, content: [paragraph("Groesse")] },
            { type: "tableHeader", attrs: {}, content: [paragraph("Wert")] },
          ],
        },
        {
          type: "tableRow",
          content: [
            { type: "tableHeader", attrs: {}, content: [paragraph("Masse")] },
            { type: "tableCell", attrs: {}, content: [paragraph("12 kg")] },
          ],
        },
      ],
    })

    /* Liegt eine Beschriftung vor, ist sie der Name des Bereichs; der
       allgemeine Text bleibt fuer Tabellen ohne caption. */
    const region = screen.getByRole("region", { name: "Messreihe" })
    expect(region).toHaveAttribute("tabindex", "0")

    const headers = container.querySelectorAll("th")
    expect(headers[0]).toHaveAttribute("scope", "col")
    expect(headers[1]).toHaveAttribute("scope", "col")
    expect(headers[2]).toHaveAttribute("scope", "row")
    expect(container.querySelector("caption")).toHaveTextContent("Messreihe")
    expect(container.querySelector("thead")).not.toBeNull()
  })
})

describe("Formel", () => {
  /* KaTeX wird nachgeladen, damit es nicht auf jeder Detailseite liegt;
     die Formel erscheint deshalb erst nach dem Aufloesen des Chunks. */
  it("gibt eine gueltige Formel mit MathML aus", async () => {
    const { container } = render({
      type: "mathBlock",
      attrs: { latex: "E = mc^2" },
    })

    const region = await screen.findByRole("region", {
      name: "Formel, waagerecht scrollbar",
    })
    expect(region).toHaveAttribute("tabindex", "0")
    expect(container.querySelector("math")).not.toBeNull()
  })

  it("zeigt bei fehlerhafter Formel den Platzhalter mit rohem LaTeX", async () => {
    const { container } = render({
      type: "mathBlock",
      attrs: { latex: "\\frac{1}{" },
    })

    expect(await screen.findByRole("note")).toBeInTheDocument()
    expect(container.querySelector("code")).toHaveTextContent("\\frac{1}{")
    for (const element of container.querySelectorAll("[style]")) {
      expect(element.getAttribute("style")).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    }
  })
})

describe("Unbekannter Block", () => {
  it("zeigt einen sichtbaren Platzhalter an der Stelle des Blocks", () => {
    const { container } = render(
      paragraph("davor"),
      { type: "taskList", content: [] },
      paragraph("danach")
    )

    /* role="note" und nicht die role="alert" der Primitive: eine assertive
       Live-Region wuerde beim Laden der Seite dazwischenreden, obwohl die
       Meldung im Fliesstext steht und dort gelesen wird. */
    const notice = screen.getByRole("note")
    expect(notice).toHaveAttribute("data-reason", "NODE_TYPE_UNKNOWN")
    expect(notice).toHaveTextContent("taskList")

    const children = [...(container.firstElementChild?.children ?? [])]
    expect(children).toHaveLength(3)
    expect(children[1]).toBe(notice)
  })

  it("stellt eine leere Blockliste ohne Absturz dar", () => {
    const { container } = render()

    expect(container.querySelector(".project-content")).not.toBeNull()
  })
})
