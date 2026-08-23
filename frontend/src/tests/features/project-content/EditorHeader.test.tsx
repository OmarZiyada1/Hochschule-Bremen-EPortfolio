import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { EditorContent, useEditor, type Editor } from "@tiptap/react"
import { useEffect } from "react"
import { describe, expect, it, vi } from "vitest"

import { EditorHeader } from "@/features/project-content/components/EditorHeader"
import { createEditorExtensions } from "@/features/project-content/editorSchema"
import type { AutosaveState } from "@/features/project-content/hooks/useAutosave"
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
  onShowInfo = () => undefined,
  mayRunWorkflow = false,
  autosaveState = "idle",
}: {
  mayWrite?: boolean
  onPreview?: () => void
  onShowInfo?: () => void
  mayRunWorkflow?: boolean
  autosaveState?: AutosaveState
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
        autosaveState={autosaveState}
        busy={false}
        mayRunWorkflow={mayRunWorkflow}
        mayWrite={mayWrite}
        onSubmit={() => undefined}
        onWithdraw={() => undefined}
        onBack={() => undefined}
        onPreview={onPreview}
        onShowInfo={onShowInfo}
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

  it("fuehrt Zurueck und den Speicherzustand ausserhalb des Menues", async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness autosaveState="saved" />)

    /*
     * Beide bleiben sichtbar, egal wie schmal die Ansicht ist
     * (Nutzerentscheidung): der eine ist der Weg aus der Seite, der andere
     * die Auskunft, ob der Text gesichert ist. Wer dafuer erst aufklappen
     * muesste, klappt staendig auf.
     */
    const back = await screen.findByRole("button", { name: "Zurück" }, WAIT)
    expect(back.closest('[role="menu"]')).toBeNull()
    expect(screen.getByText("Gespeichert").closest('[role="menu"]')).toBeNull()

    /* Und im Menue stehen sie auch nicht ein zweites Mal. */
    await user.click(screen.getByRole("button", { name: "Weitere Aktionen" }))
    const menu = await screen.findByRole("menu", {}, WAIT)
    expect(
      within(menu).queryByRole("menuitem", { name: "Zurück" })
    ).not.toBeInTheDocument()
    expect(within(menu).queryByText("Gespeichert")).not.toBeInTheDocument()
  })

  it("fuehrt die uebrigen Aktionen im Menue", async () => {
    const onPreview = vi.fn()
    const onShowInfo = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(
      <Harness mayRunWorkflow onPreview={onPreview} onShowInfo={onShowInfo} />
    )

    await user.click(
      await screen.findByRole("button", { name: "Weitere Aktionen" }, WAIT)
    )

    const menu = await screen.findByRole("menu", {}, WAIT)
    await user.click(
      within(menu).getByRole("menuitem", { name: "Projektinformationen" })
    )
    expect(onShowInfo).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole("button", { name: "Weitere Aktionen" }))
    await user.click(
      within(await screen.findByRole("menu", {}, WAIT)).getByRole("menuitem", {
        name: "Vorschau",
      })
    )
    expect(onPreview).toHaveBeenCalledTimes(1)

    /* Einreichen steht im Status DRAFT und nur fuer die Autor:in (§4.1, §5). */
    await user.click(screen.getByRole("button", { name: "Weitere Aktionen" }))
    expect(
      within(await screen.findByRole("menu", {}, WAIT)).getByRole("menuitem", {
        name: "Einreichen",
      })
    ).toBeInTheDocument()
  })

  it("fuehrt die Formatierung genau einmal, auch neben dem Menue", async () => {
    renderWithProviders(<Harness />)

    /*
     * Der schmale Umbruch ist ein Raster und keine zweite Fassung: zwei
     * Werkzeugleisten im DOM waeren zwei gleich benannte Schaltflaechen je
     * Auszeichnung, und der Sprung mit Alt+F10 traefe womoeglich die
     * unsichtbare.
     */
    await screen.findByRole("button", { name: "Fett" }, WAIT)
    expect(screen.getAllByRole("button", { name: "Fett" })).toHaveLength(1)
    expect(document.querySelectorAll("[data-selection-toolbar]")).toHaveLength(
      1
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

  it("fuehrt mit einer Schaltflaeche in die Vorschau und nicht mit einem Schalter", async () => {
    const onPreview = vi.fn()
    renderWithProviders(<Harness onPreview={onPreview} />)

    /* Der Editor kennt nur eine Richtung; ein Schalter mit zwei Zustaenden
       lud dazu ein, „Bearbeiten" anzuklicken, obwohl man darin war
       (Nutzerentscheidung). Zurueck fuehrt der Schalter auf der
       oeffentlichen Seite. */
    expect(screen.queryByRole("switch")).not.toBeInTheDocument()

    await userEvent.click(
      await screen.findByRole("button", { name: "Vorschau" }, WAIT)
    )
    expect(onPreview).toHaveBeenCalledTimes(1)
  })
})
