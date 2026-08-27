import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { EditorContent, useEditor, type Editor } from "@tiptap/react"
import { useEffect } from "react"
import { describe, expect, it, vi } from "vitest"

import { BlockControls } from "@/features/project-content/components/BlockControls"
import { createEditorExtensions } from "@/features/project-content/editorSchema"
import { renderWithProviders } from "@/tests/render"

/*
 * Die Bedienung haengt am Zeiger im Drag-Handle von Tiptap, und der blendet
 * sich aus, sobald der Zeiger den Text verlaesst. Wer die Einfuegeleiste
 * oeffnet und die Maus darauf zu bewegt, tut genau das: ohne die Meldung
 * nach oben verschwand der Griff mitsamt der Leiste, bevor sich etwas
 * anklicken liess. jsdom kann diesen Weg nicht nachstellen, die Zusage
 * dieser Komponente aber sehr wohl.
 */

const WAIT = { timeout: 20000 }

let captured: Editor | null = null

function Harness({
  onBusyChange,
  onAnnounce = () => undefined,
}: {
  onBusyChange: (busy: boolean) => void
  onAnnounce?: (message: string) => void
}) {
  const editor = useEditor({
    extensions: createEditorExtensions(),
    content: "<p>Erster Absatz</p><p>Zweiter Absatz</p>",
  })
  /* Im Effekt und nicht beim Rendern: eine Zuweisung an eine Variable
     ausserhalb der Komponente waere waehrend des Renderns eine
     Nebenwirkung (react-hooks/globals). */
  useEffect(() => {
    captured = editor
  }, [editor])

  if (editor === null) {
    return null
  }
  return (
    <div>
      <BlockControls
        editor={editor}
        index={0}
        disabled={false}
        onBusyChange={onBusyChange}
        onAnnounce={onAnnounce}
      />
      <EditorContent editor={editor} />
    </div>
  )
}

describe("BlockControls", () => {
  it("meldet eine offene Flaeche nach oben und wieder zurueck", async () => {
    const user = userEvent.setup()
    const onBusyChange = vi.fn()
    renderWithProviders(<Harness onBusyChange={onBusyChange} />)

    await user.click(
      await screen.findByRole("button", { name: "Block einfügen" }, WAIT)
    )
    await waitFor(() => expect(onBusyChange).toHaveBeenCalledWith(true), WAIT)

    /* Und beim Schliessen wieder frei: sonst bliebe der Griff dauerhaft
       gesperrt und folgte dem Zeiger nicht mehr. */
    onBusyChange.mockClear()
    await user.keyboard("{Escape}")
    await waitFor(() => expect(onBusyChange).toHaveBeenCalledWith(false), WAIT)
  })

  it("laesst die Einfuegeleiste nach dem Einfuegen offen", async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness onBusyChange={() => undefined} />)

    await user.click(
      await screen.findByRole("button", { name: "Block einfügen" }, WAIT)
    )
    await user.click(
      await screen.findByRole("button", { name: "Trenner" }, WAIT)
    )

    /* Wer zwei Bloecke untereinander setzt, soll nicht zweimal auf das Plus
       klicken muessen. */
    expect(
      screen.getByRole("group", { name: "Block einfügen" })
    ).toBeInTheDocument()
    expect(captured?.state.doc.child(1).type.name).toBe("horizontalRule")
  })

  it("loescht den Block sofort, ohne Rueckfrage, und sagt den Weg zurueck an", async () => {
    const user = userEvent.setup()
    const onAnnounce = vi.fn()
    renderWithProviders(
      <Harness onBusyChange={() => undefined} onAnnounce={onAnnounce} />
    )

    await screen.findByRole("button", { name: "Block einfügen" }, WAIT)
    await waitFor(() => expect(captured?.state.doc.childCount).toBe(2), WAIT)

    await user.click(screen.getByRole("button", { name: "Absatz löschen" }))

    /* Kein Dialog dazwischen (Nutzerentscheidung): der Klick wirkt sofort,
       Rueckgaengig stellt den Block wieder her, und genau das sagt die
       Ansage. */
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()

    /*
     * Uebrig bleiben zwei Knoten und nicht einer: der zweite Absatz und der
     * leere Schlussblock, den TrailingBlock seit KAN-83 hinter den letzten
     * Block haengt. Gespeichert wird er nicht, docToBlocks schneidet ihn ab.
     */
    await waitFor(() => {
      expect(captured?.state.doc.childCount).toBe(2)
      expect(captured?.state.doc.child(0).textContent).toBe("Zweiter Absatz")
      expect(captured?.state.doc.child(1).textContent).toBe("")
    }, WAIT)
    expect(onAnnounce).toHaveBeenCalledWith(
      "Absatz gelöscht. Rückgängig stellt ihn wieder her."
    )

    /*
     * Rueckgaengig holt den geloeschten Absatz zurueck; der Schlussblock
     * bleibt, weil seine Transaktion mit addToHistory: false laeuft. Genau
     * das ist der Zweck: sonst naehme der erste Druck auf Rueckgaengig ihn
     * weg statt den letzten Handgriff der Autor:in.
     */
    captured?.commands.undo()
    await waitFor(() => expect(captured?.state.doc.childCount).toBe(3), WAIT)
  })
})
