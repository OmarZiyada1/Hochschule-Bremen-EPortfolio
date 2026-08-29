import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TooltipProvider } from "@/components/ui/tooltip"
import { CoverImageField } from "@/features/projects/components/CoverImageField"
import { server } from "@/tests/msw/server"
import { renderWithProviders } from "@/tests/render"

/*
 * Das Titelbild hat zwei Platzierungen (KAN-36, Nacharbeit): unter der
 * Flaeche im Metadatenformular, auf der Flaeche im Editor. Geprueft wird
 * beides ueber die Oberflaeche, also ueber den zugaenglichen Namen und
 * darueber, wo die Leiste im Dokument haengt.
 */

const FILE_URL = "/api/files/11111111-1111-4111-8111-111111111111"

/** Eine Datei, damit der Abruf der Object-URL nicht ins Leere laeuft. */
function fileHandler() {
  return http.get("*/api/files/*", () =>
    HttpResponse.arrayBuffer(new ArrayBuffer(8), {
      headers: { "Content-Type": "image/png" },
    })
  )
}

const onUpload = vi.fn(async () => FILE_URL)

beforeEach(() => {
  onUpload.mockClear()
  server.use(fileHandler())
})

/** Die Vorschauflaeche selbst, an ihrem Slot erkennbar. */
function frame(container: HTMLElement) {
  const found = container.querySelector('[data-slot="cover-image-preview"]')
  expect(found).not.toBeNull()
  return found as HTMLElement
}

describe("CoverImageField, ueberlagerte Leiste", () => {
  it("haengt die Bedienelemente in die Bildflaeche und nicht darunter", async () => {
    const { container } = renderWithProviders(
      <CoverImageField
        value={FILE_URL}
        onChange={vi.fn()}
        onUpload={onUpload}
        aspect="16/9"
        controlPlacement="overlay"
      />
    )

    const input = await screen.findByLabelText("Titelbild ersetzen")
    const remove = screen.getByRole("button", { name: "Titelbild entfernen" })

    expect(frame(container)).toContainElement(input)
    expect(frame(container)).toContainElement(remove)

    /* Nicht irgendwo darin, sondern oben rechts: das Eingabefeld ist ein
       direktes Kind der Leiste, sein Elternteil also ein fester Griff auf
       sie. Ueber die Klassen geprueft, weil vitest ohne CSS laeuft und ein
       berechneter Stil deshalb nichts hergibt. */
    expect(frame(container)).toHaveClass("relative")
    expect(input.parentElement).toHaveClass("absolute", "top-3", "right-3")
  })

  it("zeigt nur Zeichen: der Name steht unsichtbar im Bedienelement", async () => {
    renderWithProviders(
      <CoverImageField
        value={FILE_URL}
        onChange={vi.fn()}
        onUpload={onUpload}
        aspect="16/9"
        controlPlacement="overlay"
      />
    )

    const label = await screen.findByText("Titelbild ersetzen")
    expect(label).toHaveClass("sr-only")
    expect(label.closest("label")?.querySelector("svg")).not.toBeNull()

    const remove = screen.getByRole("button", { name: "Titelbild entfernen" })
    expect(within(remove).getByText("Titelbild entfernen")).toHaveClass(
      "sr-only"
    )
    expect(remove.querySelector("svg")).not.toBeNull()
  })

  it("nennt ohne Bild das Hinzufuegen und bietet kein Entfernen an", () => {
    renderWithProviders(
      <CoverImageField
        value=""
        onChange={vi.fn()}
        onUpload={onUpload}
        aspect="16/9"
        controlPlacement="overlay"
      />
    )

    expect(screen.getByLabelText("Titelbild wählen")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Titelbild entfernen" })
    ).not.toBeInTheDocument()
  })

  it("meldet beim Entfernen die leere Referenz", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithProviders(
      <CoverImageField
        value={FILE_URL}
        onChange={onChange}
        onUpload={onUpload}
        aspect="16/9"
        controlPlacement="overlay"
      />
    )

    await user.click(
      await screen.findByRole("button", { name: "Titelbild entfernen" })
    )
    expect(onChange).toHaveBeenCalledWith("")
  })

  it("erklaert das Zeichen beim Zeigen darauf", async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <TooltipProvider delay={0}>
        <CoverImageField
          value={FILE_URL}
          onChange={vi.fn()}
          onUpload={onUpload}
          aspect="16/9"
          controlPlacement="overlay"
        />
      </TooltipProvider>
    )

    const label = (await screen.findByText("Titelbild ersetzen")).closest(
      "label"
    ) as HTMLElement
    await user.hover(label)

    await waitFor(() =>
      expect(screen.getAllByText("Titelbild ersetzen").length).toBeGreaterThan(
        1
      )
    )
  })

  it("sperrt ohne Schreibrecht jede Bedienung fort", () => {
    renderWithProviders(
      <CoverImageField
        value={FILE_URL}
        onChange={vi.fn()}
        onUpload={onUpload}
        aspect="16/9"
        controlPlacement="overlay"
        disabled
      />
    )

    expect(
      screen.queryByLabelText("Titelbild ersetzen")
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Titelbild entfernen" })
    ).not.toBeInTheDocument()
  })
})

describe("CoverImageField, Leiste unter der Flaeche", () => {
  it("bleibt der Standard und behaelt die sichtbare Beschriftung", async () => {
    const { container } = renderWithProviders(
      <CoverImageField
        value={FILE_URL}
        onChange={vi.fn()}
        onUpload={onUpload}
      />
    )

    const input = await screen.findByLabelText("Titelbild ersetzen")
    const remove = screen.getByRole("button", { name: "Titelbild entfernen" })

    expect(frame(container)).not.toContainElement(input)
    expect(frame(container)).not.toContainElement(remove)
    expect(screen.getByText("Titelbild ersetzen")).not.toHaveClass("sr-only")
  })
})
