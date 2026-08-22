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

function Harness({ onBusyChange }: { onBusyChange: (busy: boolean) => void }) {
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
        onAnnounce={() => undefined}
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
})
