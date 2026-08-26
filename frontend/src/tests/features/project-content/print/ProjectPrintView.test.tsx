import { act, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import { resolveApiUrl } from "@/api/client"
import { apiPaths } from "@/api/endpoints"
import type { BlockResponse } from "@/api/types"
import { ProjectPrintView } from "@/features/project-content/print/ProjectPrintView"
import i18n from "@/i18n"
import { person, projectDetail, reference } from "@/tests/fixtures"
import { renderWithProviders } from "@/tests/render"

/*
 * Der Druckbereich (KAN-41, Tests 2 bis 6).
 *
 * <p>Geprueft werden Struktur und Attribute im DOM, nicht berechnete Stile:
 * Vitest laeuft mit css: false. Alles, was mit @media print zu tun hat,
 * steht deshalb entweder als Attribut im Baum (dann steht es hier) oder in
 * der dokumentierten manuellen Abnahme.
 *
 * <p>Der Bereich haengt als Portal an body und traegt hidden. Gesucht wird
 * darin ueber Text und Attribute; Rollenabfragen liessen ihn aus, und genau
 * das ist am Bildschirm auch richtig so.
 *
 * <p>Gefuellt wird er erst zum Drucken. Die Tests loesen dafuer
 * {@code beforeprint} aus, also genau den Weg, den Strg+P nimmt; die
 * Schaltflaeche fuellt ihn ueber denselben Zustand.
 */

const FILE_A = "11111111-2222-4333-8444-555555555555"
const FILE_B = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
const FILE_C = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff"
const PRINTED_AT = new Date("2026-08-25T09:00:00Z")

function fileUrl(fileId: string): string {
  return resolveApiUrl(apiPaths.files.detail(fileId))
}

function blocksOf(...contents: unknown[]): BlockResponse[] {
  return contents.map((content, index) => ({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    type: "TEXT",
    orderIndex: index,
    schemaVersion: 1,
    content: content as BlockResponse["content"],
  }))
}

function project() {
  return projectDetail({
    title: "Campus-Garten",
    summary: "Ein Beet, ein Sensor und viel Geduld.",
    author: person({ firstName: "Mira", lastName: "Beispiel" }),
    studyProgram: reference({ id: "sp-1", name: "Informatik B. Sc." }),
    semester: reference({ id: "se-1", name: "WiSe 2025/26" }),
  })
}

/** Loest den Druck aus, wie es Strg+P im Browser tut. */
function startPrinting() {
  act(() => {
    window.dispatchEvent(new Event("beforeprint"))
  })
}

function printArea(): HTMLElement {
  const area = document.querySelector<HTMLElement>('[data-print="area"]')
  if (area === null) {
    throw new Error("Kein Druckbereich im Dokument")
  }
  return area
}

function render(...contents: unknown[]) {
  renderWithProviders(
    <ProjectPrintView
      project={project()}
      blocks={blocksOf(...contents)}
      coverUrl={null}
      now={PRINTED_AT}
    />
  )
  startPrinting()
  return printArea()
}

const uploadedVideo = {
  type: "videoBlock",
  attrs: { fileId: FILE_A, caption: "Der Aufbau im Zeitraffer" },
}

const embeddedVideo = {
  type: "videoBlock",
  attrs: {
    provider: "youtube",
    videoId: "abc123",
    hash: null,
    caption: "Der Vortrag",
  },
}

const audio = {
  type: "audioBlock",
  attrs: { fileId: FILE_B, caption: "Das Interview" },
}

const embed = {
  type: "embedBlock",
  attrs: {
    provider: "figma",
    embedUrl: "https://embed.figma.com/design/o6SECXRMKGOzCfG5xZebPV/Plan",
    height: 400,
  },
}

describe("Der Druckbereich als Ganzes", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
  })

  it("haengt unmittelbar an body", () => {
    /*
     * Die Regel aus project-content.css blendet im Ausdruck jedes
     * Geschwister des Bereichs aus; dafuer muss er ein unmittelbares Kind
     * von body sein. Dass er am Bildschirm verborgen ist, haengt an
     * derselben Datei und wird dort geprueft (tests/styles).
     */
    const area = render({
      type: "paragraph",
      content: [{ type: "text", text: "Hallo" }],
    })

    expect(area.parentElement).toBe(document.body)
  })

  it("enthaelt weder Navigation noch Bedienelemente", () => {
    /* Ticket-Test 4: im Ausdruck bleiben Kopfbereich und Beitrag, sonst
       nichts. Der Bereich traegt gar keine Bedienung, statt sie erst per
       Regel auszublenden. */
    const area = render(
      { type: "paragraph", content: [{ type: "text", text: "Hallo" }] },
      uploadedVideo,
      embed,
      {
        type: "documentBlock",
        attrs: { fileId: FILE_C, fileName: "bericht.pdf", size: 2_400_000 },
      }
    )

    expect(
      area.querySelectorAll(
        'nav, button, [role="button"], [role="toolbar"], [role="navigation"], input, textarea, select'
      )
    ).toHaveLength(0)
  })

  it("traegt den Projekttitel als einzige h1 und den Beitrag darunter", () => {
    const area = render({
      type: "heading",
      attrs: { level: 1, textAlign: null },
      content: [{ type: "text", text: "Aufbau" }],
    })

    expect(area.querySelectorAll("h1")).toHaveLength(1)
    expect(area.querySelector("h1")).toHaveTextContent("Campus-Garten")
    /* Die Editor-Ebene 1 wird um eine Stufe versetzt gerendert (§2.5).
       Gesucht wird im Beitrag: die Ueberschrift „Abstract" des Kopfbereichs
       steht ebenfalls auf Ebene 2. */
    expect(
      area.querySelector(".project-content h2, .project-content h3")
    ).toHaveTextContent("Aufbau")
  })
})

describe("Was auf Papier nicht ankommt", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
  })

  it("nennt das hochgeladene Video mit Bildunterschrift und Adresse", () => {
    /* Ticket-Test 2. Der Platzhalter steht im Baum und nicht als leerer
       Knoten; die Regel blendet dafuer das video-Element aus. */
    const area = render(uploadedVideo)

    expect(
      within(area).getByText(i18n.t("projectContent.print.video"))
    ).toBeInTheDocument()
    expect(
      within(area).getByText(
        i18n.t("projectContent.print.source", { url: fileUrl(FILE_A) })
      )
    ).toBeInTheDocument()
    expect(
      within(area).getByText("Der Aufbau im Zeitraffer")
    ).toBeInTheDocument()
  })

  it("nennt das eingebettete Video mit Anbieter und Quellangabe", () => {
    const area = render(embeddedVideo)

    expect(
      within(area).getByText(
        i18n.t("projectContent.print.videoEmbed", { provider: "YouTube" })
      )
    ).toBeInTheDocument()
    expect(
      within(area).getByText(
        i18n.t("projectContent.print.source", {
          url: "https://www.youtube.com/embed/abc123",
        })
      )
    ).toBeInTheDocument()
    expect(within(area).getByText("Der Vortrag")).toBeInTheDocument()
  })

  it("nennt die Tonaufnahme mit Beschriftung und Adresse", () => {
    const area = render(audio)

    expect(
      within(area).getByText(i18n.t("projectContent.print.audio"))
    ).toBeInTheDocument()
    expect(
      within(area).getByText(
        i18n.t("projectContent.print.source", { url: fileUrl(FILE_B) })
      )
    ).toBeInTheDocument()
    expect(within(area).getByText("Das Interview")).toBeInTheDocument()
  })

  it("nennt die Einbettung mit Anbieter und Quellangabe", () => {
    const area = render(embed)

    expect(
      within(area).getByText(
        i18n.t("projectContent.print.embed", { provider: "Figma" })
      )
    ).toBeInTheDocument()
    expect(
      within(area).getByText(
        i18n.t("projectContent.print.source", {
          url: "https://embed.figma.com/design/o6SECXRMKGOzCfG5xZebPV/Plan",
        })
      )
    ).toBeInTheDocument()
  })

  it("laesst eine blob-Adresse weg", () => {
    /*
     * Eine Object-URL gilt nur in der Sitzung, die sie erzeugt hat: auf dem
     * Blatt waere sie eine Adresse, die nirgends hinfuehrt. Die Vorschau
     * eines Entwurfs holt ihre Dateien genau so (useProjectFileUrls).
     */
    renderWithProviders(
      <ProjectPrintView
        project={project()}
        blocks={blocksOf(uploadedVideo)}
        coverUrl={null}
        resolveFileUrl={() => "blob:xyz"}
        now={PRINTED_AT}
      />
    )
    startPrinting()
    const area = printArea()

    expect(
      within(area).getByText(i18n.t("projectContent.print.video"))
    ).toBeInTheDocument()
    expect(within(area).queryByText(/blob:xyz/)).not.toBeInTheDocument()
  })

  it("druckt die Adresse vollstaendig, auch wenn der Pfad relativ ist", () => {
    /*
     * Ohne gesetztes VITE_API_BASE_URL laufen die Requests gegen den
     * eigenen Ursprung, und resolveApiUrl liefert dann nur den Pfad. Auf
     * dem Blatt waere „/api/files/8f3c…" eine Adresse ohne Host, die
     * niemand abtippen kann, und genau dafuer steht die Zeile da.
     */
    renderWithProviders(
      <ProjectPrintView
        project={project()}
        blocks={blocksOf(uploadedVideo)}
        coverUrl={null}
        resolveFileUrl={() => `/api/files/${FILE_A}`}
        now={PRINTED_AT}
      />
    )
    startPrinting()
    const area = printArea()

    expect(
      within(area).getByText(
        i18n.t("projectContent.print.source", {
          url: `${window.location.origin}/api/files/${FILE_A}`,
        })
      )
    ).toBeInTheDocument()
  })

  it("uebersetzt die Platzhalter", async () => {
    /* Ticket-Test 3: kein sichtbarer Text ausserhalb von i18n
       (Frontend-Regel 7). */
    await i18n.changeLanguage("en")
    const area = render(uploadedVideo, audio, embed)

    expect(
      within(area).getByText("Video, cannot be played on paper.")
    ).toBeInTheDocument()
    expect(
      within(area).getByText("Audio recording, cannot be played on paper.")
    ).toBeInTheDocument()
    expect(
      within(area).getByText(
        "Embedded content from Figma, cannot be shown on paper."
      )
    ).toBeInTheDocument()
    await i18n.changeLanguage("de")
  })
})

describe("Bild, Galerie und Dokument", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de")
  })

  it("traegt Breite und Spaltenzahl als Datenattribut, nie als Inline-Stil", () => {
    /*
     * Ticket-Test 5. Genau darauf setzen die Druckregeln auf: ein
     * Inline-Stil liesse sich im Druck nicht ueberschreiben, und ein
     * 50-Prozent-Bild bliebe auf dem Blatt so breit wie am Bildschirm.
     */
    const area = render(
      {
        type: "imageBlock",
        attrs: { fileId: FILE_A, alt: "Das Beet", caption: "", width: 50 },
      },
      {
        type: "galleryBlock",
        attrs: {
          items: [
            { fileId: FILE_A, alt: "Eins" },
            { fileId: FILE_B, alt: "Zwei" },
            { fileId: FILE_C, alt: "Drei" },
          ],
          columns: 3,
          caption: "",
        },
      }
    )

    const image = area.querySelector("figure[data-width]")
    const gallery = area.querySelector("figure[data-columns]")
    expect(image).toHaveAttribute("data-width", "50")
    expect(gallery).toHaveAttribute("data-columns", "3")

    for (const figure of area.querySelectorAll("figure")) {
      expect(figure.getAttribute("style") ?? "").not.toMatch(/%/)
    }
  })

  it("gibt am Dokument Dateiname, Typ, Groesse und Adresse als Text aus", () => {
    /* Ticket-Test 6. Ein Link ohne Adresse ist auf Papier tot. */
    const area = render({
      type: "documentBlock",
      attrs: { fileId: FILE_C, fileName: "bericht.pdf", size: 2_400_000 },
    })

    expect(within(area).getByText("bericht.pdf")).toBeInTheDocument()
    expect(within(area).getByText("2,4 MB")).toBeInTheDocument()
    expect(
      within(area).getByText(i18n.t("projectContent.print.documentType"))
    ).toBeInTheDocument()
    expect(
      within(area).getByText(
        i18n.t("projectContent.print.source", { url: fileUrl(FILE_C) })
      )
    ).toBeInTheDocument()
  })
})

describe("Am Bildschirm", () => {
  it("bleibt leer, bis gedruckt wird", () => {
    /*
     * Der Bereich traegt denselben Beitrag ein zweites Mal. Stuende er
     * dauernd gefuellt im DOM, verdoppelte jede Detailseite ihren Baum samt
     * aller video- und audio-Elemente, die auch verborgen ihre Metadaten
     * holen. Und ein Screenreader laese den Beitrag zweimal vor: dass der
     * Bereich am Bildschirm auf display: none steht, kann dieser Test nicht
     * pruefen (css: false), wohl aber, dass ausserhalb des Druckens gar
     * nichts darin steht.
     */
    renderWithProviders(
      <ProjectPrintView
        project={project()}
        blocks={blocksOf({
          type: "paragraph",
          content: [{ type: "text", text: "Hallo" }],
        })}
        coverUrl={null}
        now={PRINTED_AT}
      />
    )

    expect(printArea()).toBeEmptyDOMElement()
    expect(screen.queryByText("Hallo")).not.toBeInTheDocument()
  })

  it("raeumt den Bereich nach dem Druck wieder", () => {
    const area = render({
      type: "paragraph",
      content: [{ type: "text", text: "Hallo" }],
    })
    expect(within(area).getByText("Hallo")).toBeInTheDocument()

    act(() => {
      window.dispatchEvent(new Event("afterprint"))
    })

    expect(printArea()).toBeEmptyDOMElement()
  })
})
