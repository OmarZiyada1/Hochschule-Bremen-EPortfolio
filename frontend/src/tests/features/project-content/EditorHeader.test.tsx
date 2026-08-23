import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { EditorContent, useEditor, type Editor } from "@tiptap/react"
import { useEffect } from "react"
import { describe, expect, it, vi } from "vitest"

import { EditorHeader } from "@/features/project-content/components/EditorHeader"
import { createEditorExtensions } from "@/features/project-content/editorSchema"
import { renderWithProviders } from "@/tests/render"

/**
 * Die Kopfzeile mit einem echten Editor.
 *
 * <p><strong>Worum es hier geht.</strong> Seit Tiptap v3 rendert der Editor
 * die Seite bei einer Transaktion nicht mehr neu
 * ({@code shouldRerenderOnTransaction} ist standardmaessig {@code false}).
 * Wer {@code editor.can().undo()} beim Rendern liest, bekommt deshalb den
 * Stand des letzten Renderns: „Rueckgaengig" blieb waehrend des ganzen
 * Tippens deaktiviert und wurde erst wieder richtig, wenn irgendetwas
 * anderes ein Rendern ausloeste, in der Praxis der Speichertakt gut eine
 * Sekunde spaeter. Dieser Test haelt fest, dass die Kopfzeile der
 * Schreibflaeche folgt, ohne dass jemand sonst rendert.
 *
 * <p>Seit dem Umzug der Formatierungsleiste steht ausserdem fest: die
 * Leiste steht dauerhaft in der Kopfzeile, ihre aktiven Zustaende folgen
 * der Textmarke, ohne Schreibrecht ist sie deaktiviert, und der Umschalter
 * Vorschau/Bearbeiten meldet den Wechsel.
 */

const WAIT = { timeout: 20000 }

let captured: Editor | null = null

function Harness({
  mayWrite = true,
  onPreview = () => undefined,
}: {
  mayWrite?: boolean
  onPreview?: () => void
}) {
  const editor = useEditor({
    extensions: createEditorExtensions(),
    content: "<p>Ein Absatz</p>",
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
      <EditorHeader
        editor={editor}
        status="DRAFT"
        autosaveState="idle"
        busy={false}
        mayRunWorkflow={false}
        mayWrite={mayWrite}
        onSubmit={() => undefined}
        onWithdraw={() => undefined}
        onBack={() => undefined}
        onPreview={onPreview}
      />
      <EditorContent editor={editor} />
    </div>
  )
}

describe("EditorHeader", () => {
  it("aktiviert Rueckgaengig, sobald sich der Text aendert, und nicht erst spaeter", async () => {
    renderWithProviders(<Harness />)

    const undo = await screen.findByRole("button", { name: "Rückgängig" }, WAIT)
    expect(undo).toBeDisabled()

    /* Eine echte Transaktion, so wie ein Tastendruck sie erzeugt, und
       sonst nichts: kein setState, kein Rendern von aussen. */
    captured?.commands.insertContent("X")

    await waitFor(() => expect(undo).toBeEnabled(), WAIT)

    const redo = screen.getByRole("button", { name: "Wiederholen" })
    expect(redo).toBeDisabled()

    captured?.commands.undo()
    await waitFor(() => expect(redo).toBeEnabled(), WAIT)
  })

  it("fuehrt die Formatierungsleiste dauerhaft, mit Zustand an der Textmarke", async () => {
    renderWithProviders(<Harness />)

    /* Die Leiste steht ohne Auswahl da: sie haengt nicht mehr an einer
       Blase ueber markiertem Text. */
    const bold = await screen.findByRole("button", { name: "Fett" }, WAIT)
    expect(bold).toBeEnabled()
    expect(bold).toHaveAttribute("aria-pressed", "false")

    /* Der aktive Zustand folgt der Textmarke: Cursor in fettem Text
       drueckt die Schaltflaeche, ohne dass etwas markiert ist. */
    captured?.chain().focus().selectAll().toggleBold().run()
    captured?.commands.setTextSelection(3)
    await waitFor(
      () => expect(bold).toHaveAttribute("aria-pressed", "true"),
      WAIT
    )
  })

  it("sperrt die Formatierungsleiste ohne Schreibrecht", async () => {
    renderWithProviders(<Harness mayWrite={false} />)

    /* Deaktiviert und nicht versteckt (SC 3.2.4): die Leiste bleibt
       sichtbar, jede Schaltflaeche ist gesperrt. */
    const bold = await screen.findByRole("button", { name: "Fett" }, WAIT)
    expect(bold).toBeDisabled()
    expect(screen.getByRole("button", { name: "Zitat" })).toBeDisabled()
  })

  it("meldet den Wechsel in die Vorschau ueber den Umschalter", async () => {
    const onPreview = vi.fn()
    renderWithProviders(<Harness onPreview={onPreview} />)

    await userEvent.click(
      await screen.findByRole("switch", { name: "Bearbeiten" }, WAIT)
    )
    expect(onPreview).toHaveBeenCalledTimes(1)
  })
})
