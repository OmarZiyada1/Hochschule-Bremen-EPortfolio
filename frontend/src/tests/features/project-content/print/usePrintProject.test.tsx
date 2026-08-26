import { act, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { BlockResponse } from "@/api/types"
import { ProjectPrintView } from "@/features/project-content/print/ProjectPrintView"
import { usePrintProject } from "@/features/project-content/print/usePrintProject"
import { projectDetail } from "@/tests/fixtures"
import { renderWithProviders } from "@/tests/render"

/*
 * Die Aktion „PDF" (KAN-41, Umfang 5): clientseitig, ohne Endpoint und ohne
 * zusaetzliches Paket. Geprueft wird, dass sie den Druckbereich fuellt,
 * bevor sie druckt, und ihn danach wieder raeumt.
 *
 * <p>jsdom kennt kein Drucken; window.print ist hier ein Doppel. Was der
 * Browser daraus macht, sagt die dokumentierte manuelle Abnahme.
 */

const PRINTED_AT = new Date("2026-08-25T09:00:00Z")

function blocks(): BlockResponse[] {
  return [
    {
      id: "00000000-0000-4000-8000-000000000000",
      type: "TEXT",
      orderIndex: 0,
      schemaVersion: 1,
      content: {
        type: "paragraph",
        content: [{ type: "text", text: "Der Beitrag" }],
      },
    } as unknown as BlockResponse,
  ]
}

function Harness() {
  const { print, printing } = usePrintProject()
  return (
    <>
      <button type="button" onClick={() => void print()} disabled={printing}>
        PDF
      </button>
      <ProjectPrintView
        project={projectDetail({ title: "Campus-Garten" })}
        blocks={blocks()}
        coverUrl={null}
        now={PRINTED_AT}
      />
    </>
  )
}

function printArea(): HTMLElement {
  const area = document.querySelector<HTMLElement>('[data-print="area"]')
  if (area === null) {
    throw new Error("Kein Druckbereich im Dokument")
  }
  return area
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("Die Aktion PDF", () => {
  it("fuellt den Druckbereich, druckt und raeumt ihn erst danach", async () => {
    /*
     * Die Reihenfolge ist der Kern: waere der Bereich zum Zeitpunkt von
     * window.print() noch leer, blendete die Regel aus project-content.css
     * alles andere aus und das Blatt bliebe weiss.
     */
    let contentWhilePrinting = ""
    const print = vi.spyOn(window, "print").mockImplementation(() => {
      contentWhilePrinting = printArea().textContent ?? ""
    })

    renderWithProviders(<Harness />)
    expect(printArea()).toBeEmptyDOMElement()

    await userEvent.click(screen.getByRole("button", { name: "PDF" }))

    /* Die Aktion wartet erst auf den Formelsatz und die Bilder; gedruckt
       wird danach, also nicht schon im Klick. */
    await waitFor(() => {
      expect(print).toHaveBeenCalledTimes(1)
    })
    expect(contentWhilePrinting).toContain("Campus-Garten")
    expect(contentWhilePrinting).toContain("Der Beitrag")

    /*
     * Und er bleibt gefuellt, bis der Druck durch ist. In Chrome kehrt
     * window.print() zurueck, bevor die Vorschau den Seiteninhalt
     * abgreift; wer sofort aufraeumt, bekommt ein leeres Blatt.
     */
    expect(printArea()).not.toBeEmptyDOMElement()

    act(() => {
      window.dispatchEvent(new Event("afterprint"))
    })
    expect(printArea()).toBeEmptyDOMElement()
  })

  it("raeumt den Bereich auch, wenn der Browser den Druck verweigert", async () => {
    /*
     * Ein gefuellter Bereich, den niemand druckt, bliebe als zweiter
     * Beitrag im Baum stehen. Und die Ablehnung darf nicht als unbehandelte
     * Zurueckweisung aus der Aktion herauslaufen: die Aufrufstellen rufen
     * sie mit void auf, weil es nichts zu warten gibt.
     */
    vi.spyOn(window, "print").mockImplementation(() => {
      throw new Error("kein Drucker")
    })

    renderWithProviders(<Harness />)
    await userEvent.click(screen.getByRole("button", { name: "PDF" }))

    await waitFor(() => {
      expect(printArea()).toBeEmptyDOMElement()
    })
    /* Wieder bedienbar, sonst waere die Schaltflaeche nach einem
       Fehlversuch dauerhaft gesperrt. */
    expect(screen.getByRole("button", { name: "PDF" })).toBeEnabled()
  })
})
