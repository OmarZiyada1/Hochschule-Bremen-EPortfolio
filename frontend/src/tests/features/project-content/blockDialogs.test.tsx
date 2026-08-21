import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { HttpResponse, http } from "msw"
import { describe, expect, it, vi } from "vitest"

import type { StoredFileResponse } from "@/api/types"
import type {
  EmbedBlockNode,
  ImageBlockNode,
  MathBlockNode,
} from "@/features/project-content/blockTypes"
import { EmbedDialog } from "@/features/project-content/components/dialogs/EmbedDialog"
import { FormulaDialog } from "@/features/project-content/components/dialogs/FormulaDialog"
import { ImageDialog } from "@/features/project-content/components/dialogs/ImageDialog"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"

/**
 * Die Blockdialoge (KAN-36): kein Medienknoten ohne Pflichtattribute.
 *
 * <p><strong>Warum das der wichtigste Fall dieser Datei ist.</strong>
 * {@code BlockService.replace} prueft die <em>gesamte</em> Blockliste, bevor
 * es die erste Zeile schreibt. Ein Bildknoten ohne {@code fileId} machte
 * damit jeden weiteren Autosave des ganzen Projekts unmoeglich, und zwar
 * bis jemand ihn wieder loescht: der Beitrag liesse sich nicht mehr
 * speichern, und niemand saehe, warum. Deshalb entsteht der Knoten erst,
 * wenn der Dialog vollstaendig ist.
 *
 * <p>Drei Dialoge stehen stellvertretend: das Bild fuer die Pflichtdatei und
 * den Alternativtext, die Einbettung fuer die Host-Allowlist, die Formel
 * fuer die Pruefung auf Leerraum. Die uebrigen vier folgen demselben Bau
 * ({@code BlockDialogShell}).
 */

const PROJECT_ID = "1f9d7a10-0000-0000-0000-000000000000"

const STORED: StoredFileResponse = {
  id: "22222222-3333-4444-8555-666666666666",
  fileName: "campus.png",
  mimeType: "image/png",
  size: 12_345,
  url: "/api/files/22222222-3333-4444-8555-666666666666",
}

function uploadHandler() {
  return http.post("*/api/files", () => HttpResponse.json(STORED))
}

describe("ImageDialog", () => {
  it("legt ohne Datei keinen Knoten an und nennt den Grund", async () => {
    const user = userEvent.setup()
    const onInsert = vi.fn()
    renderWithProviders(
      <ImageDialog
        projectId={PROJECT_ID}
        open
        onOpenChange={() => undefined}
        onInsert={onInsert}
      />
    )

    await user.click(screen.getByRole("button", { name: "Einfügen" }))

    expect(onInsert).not.toHaveBeenCalled()
    expect(
      await screen.findByText("Bitte laden Sie eine Datei hoch.")
    ).toBeInTheDocument()
  })

  /*
   * SC 1.1.1 und Contract 2.5: ein leeres alt ist die ausdrueckliche
   * Aussage "schmueckend", ein fehlendes ein vergessener Alternativtext.
   * Der Server weist den zweiten Fall ab.
   */
  it("verlangt einen Alternativtext, solange das Bild nicht schmueckend ist", async () => {
    server.use(uploadHandler())
    const user = userEvent.setup()
    const onInsert = vi.fn()
    renderWithProviders(
      <ImageDialog
        projectId={PROJECT_ID}
        open
        onOpenChange={() => undefined}
        onInsert={onInsert}
      />
    )

    await user.upload(
      screen.getByLabelText("Bilddatei"),
      new File(["x"], "campus.png", { type: "image/png" })
    )
    /* Auf die Karte der hochgeladenen Datei gewartet und nicht auf ihren
       Namen: der steht auch in der Live-Region des Uploads. */
    await screen.findByRole("button", { name: "Andere Datei" })

    await user.click(screen.getByRole("button", { name: "Einfügen" }))

    expect(onInsert).not.toHaveBeenCalled()
    expect(
      await screen.findByText(
        "Bitte beschreiben Sie das Bild oder kennzeichnen Sie es als schmückend."
      )
    ).toBeInTheDocument()
  })

  it("legt mit Datei und Alternativtext einen vollstaendigen Knoten an", async () => {
    server.use(uploadHandler())
    const user = userEvent.setup()
    const onInsert = vi.fn()
    renderWithProviders(
      <ImageDialog
        projectId={PROJECT_ID}
        open
        onOpenChange={() => undefined}
        onInsert={onInsert}
      />
    )

    await user.upload(
      screen.getByLabelText("Bilddatei"),
      new File(["x"], "campus.png", { type: "image/png" })
    )
    /* Auf die Karte der hochgeladenen Datei gewartet und nicht auf ihren
       Namen: der steht auch in der Live-Region des Uploads. */
    await screen.findByRole("button", { name: "Andere Datei" })
    await user.type(screen.getByLabelText("Alternativtext"), "Der Campus")
    await user.click(screen.getByRole("radio", { name: "75 %" }))
    await user.click(screen.getByRole("button", { name: "Einfügen" }))

    const node = onInsert.mock.calls[0]?.[0] as ImageBlockNode
    expect(node).toEqual({
      type: "imageBlock",
      attrs: {
        fileId: STORED.id,
        alt: "Der Campus",
        caption: "",
        /* Zahl und nicht Zeichenkette: content ist JSON, und der Server
           prueft gegen genau 100, 75 und 50 (2.5). */
        width: 75,
      },
    })
  })

  it("schreibt bei „schmueckend“ das leere alt und nicht den getippten Text", async () => {
    server.use(uploadHandler())
    const user = userEvent.setup()
    const onInsert = vi.fn()
    renderWithProviders(
      <ImageDialog
        projectId={PROJECT_ID}
        open
        onOpenChange={() => undefined}
        onInsert={onInsert}
      />
    )

    await user.upload(
      screen.getByLabelText("Bilddatei"),
      new File(["x"], "campus.png", { type: "image/png" })
    )
    /* Auf die Karte der hochgeladenen Datei gewartet und nicht auf ihren
       Namen: der steht auch in der Live-Region des Uploads. */
    await screen.findByRole("button", { name: "Andere Datei" })
    await user.type(screen.getByLabelText("Alternativtext"), "Stehengeblieben")
    await user.click(
      screen.getByRole("checkbox", {
        name: /Dieses Bild ist schmückend/,
      })
    )
    await user.click(screen.getByRole("button", { name: "Einfügen" }))

    const node = onInsert.mock.calls[0]?.[0] as ImageBlockNode
    expect(node.attrs.alt).toBe("")
  })
})

describe("EmbedDialog", () => {
  /*
   * Die Vorabpruefung ist Freundlichkeit und kein Ersatz: verbindlich ist
   * der Server mit 400 EMBED_PROVIDER_NOT_ALLOWED (2.5, 6.2). Sie steht
   * hier, damit niemand erst nach dem Speichern erfaehrt, dass die Adresse
   * nicht durchgeht.
   */
  it("weist einen Host ausserhalb der Allowlist ab", async () => {
    const user = userEvent.setup()
    const onInsert = vi.fn()
    renderWithProviders(
      <EmbedDialog open onOpenChange={() => undefined} onInsert={onInsert} />
    )

    await user.type(
      screen.getByLabelText("Einbettungsadresse"),
      "https://fremde.tld/etwas"
    )
    await user.click(screen.getByRole("button", { name: "Einfügen" }))

    expect(onInsert).not.toHaveBeenCalled()
    expect(
      await screen.findByText(
        "Diese Adresse gehört nicht zu den erlaubten Hosts des Anbieters."
      )
    ).toBeInTheDocument()
  })

  it("weist http ab, auch auf einem erlaubten Host", async () => {
    const user = userEvent.setup()
    const onInsert = vi.fn()
    renderWithProviders(
      <EmbedDialog open onOpenChange={() => undefined} onInsert={onInsert} />
    )

    await user.type(
      screen.getByLabelText("Einbettungsadresse"),
      "http://www.figma.com/embed"
    )
    await user.click(screen.getByRole("button", { name: "Einfügen" }))

    expect(onInsert).not.toHaveBeenCalled()
  })

  it("nimmt eine https-Adresse auf einem erlaubten Host an", async () => {
    const user = userEvent.setup()
    const onInsert = vi.fn()
    renderWithProviders(
      <EmbedDialog open onOpenChange={() => undefined} onInsert={onInsert} />
    )

    await user.type(
      screen.getByLabelText("Einbettungsadresse"),
      "https://www.figma.com/embed?url=x"
    )
    await user.click(screen.getByRole("button", { name: "Einfügen" }))

    const node = onInsert.mock.calls[0]?.[0] as EmbedBlockNode
    expect(node).toEqual({
      type: "embedBlock",
      attrs: {
        provider: "figma",
        embedUrl: "https://www.figma.com/embed?url=x",
        height: 460,
      },
    })
  })
})

describe("FormulaDialog", () => {
  /*
   * Auf Leerraum geprueft und nicht auf Laenge, wie serverseitig mit
   * isBlank: eine Formel aus drei Leerzeichen waere sonst hier gueltig und
   * beim Speichern ein 400.
   */
  it("weist eine Formel aus reinem Leerraum ab", async () => {
    const user = userEvent.setup()
    const onInsert = vi.fn()
    renderWithProviders(
      <FormulaDialog open onOpenChange={() => undefined} onInsert={onInsert} />
    )

    await user.type(screen.getByLabelText("Formel"), "   ")
    await user.click(screen.getByRole("button", { name: "Einfügen" }))

    expect(onInsert).not.toHaveBeenCalled()
    expect(
      await screen.findByText("Bitte geben Sie eine Formel ein.")
    ).toBeInTheDocument()
  })

  it("legt den Knoten mit der eingegebenen Formel an", async () => {
    const user = userEvent.setup()
    const onInsert = vi.fn()
    renderWithProviders(
      <FormulaDialog open onOpenChange={() => undefined} onInsert={onInsert} />
    )

    await user.type(screen.getByLabelText("Formel"), "a^2 + b^2 = c^2")
    await user.click(screen.getByRole("button", { name: "Einfügen" }))

    const node = onInsert.mock.calls[0]?.[0] as MathBlockNode
    expect(node).toEqual({
      type: "mathBlock",
      attrs: { latex: "a^2 + b^2 = c^2" },
    })
  })
})
