import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { EditorContent, useEditor, type Editor } from "@tiptap/react"
import { useEffect, useState } from "react"
import { describe, expect, it, vi } from "vitest"

import type { ProjectStatus } from "@/api/types"
import {
  EditorHeader,
  type EditorMode,
} from "@/features/project-content/components/EditorHeader"
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
 * der Textmarke, und ohne Schreibrecht ist sie deaktiviert. Seit KAN-104
 * wechselt der Umschalter an Ort und Stelle zwischen Schreibflaeche und
 * Vorschau, und im Vorschau-Modus traegt die Werkzeugzeile nur noch Drucken
 * und Hell/Dunkel.
 */

const WAIT = { timeout: 20000 }

let captured: Editor | null = null

function Harness({
  mayWrite = true,
  initialMode = "edit",
  onModeToggle = () => undefined,
  onShowInfo = () => undefined,
  onPrint = () => undefined,
  onWithdraw = () => undefined,
  mayRunWorkflow = false,
  autosaveState = "idle",
  status = "DRAFT",
}: {
  mayWrite?: boolean
  initialMode?: EditorMode
  onModeToggle?: () => void
  onShowInfo?: () => void
  onPrint?: () => void
  onWithdraw?: () => void
  mayRunWorkflow?: boolean
  autosaveState?: AutosaveState
  status?: ProjectStatus
}) {
  const editor = useEditor({
    extensions: createEditorExtensions(),
    content: "<p>Ein Absatz</p>",
  })
  /* Der Modus liegt wie in der Seite ausserhalb der Kopfzeile; die Huelle
     haelt ihn, damit ein Test den Wechsel samt Beschriftung sieht. */
  const [mode, setMode] = useState<EditorMode>(initialMode)
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
        status={status}
        autosaveState={autosaveState}
        busy={false}
        mayRunWorkflow={mayRunWorkflow}
        mayWrite={mayWrite}
        onSubmit={() => undefined}
        onWithdraw={onWithdraw}
        onBack={() => undefined}
        mode={mode}
        onModeToggle={() => {
          onModeToggle()
          setMode((current) => (current === "edit" ? "preview" : "edit"))
        }}
        onPrint={onPrint}
        printing={false}
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
    const onModeToggle = vi.fn()
    const onShowInfo = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(
      <Harness
        mayRunWorkflow
        onModeToggle={onModeToggle}
        onShowInfo={onShowInfo}
      />
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
    expect(onModeToggle).toHaveBeenCalledTimes(1)

    /* Einreichen steht im Status DRAFT und nur fuer die Projektseite
       (§4.1, §5); der Menueeintrag des Umschalters nennt jetzt die
       Gegenrichtung. */
    await user.click(screen.getByRole("button", { name: "Weitere Aktionen" }))
    const next = await screen.findByRole("menu", {}, WAIT)
    expect(
      within(next).getByRole("menuitem", { name: "Einreichen" })
    ).toBeInTheDocument()
    expect(
      within(next).getByRole("menuitem", { name: "Bearbeiten" })
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

  it("schaltet mit einem Knopf mit wechselnder Beschriftung und nicht mit einem Schalter", async () => {
    const onModeToggle = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(<Harness onModeToggle={onModeToggle} />)

    /* Kein Schiebeschalter (KAN-104, Entscheidung): ein Knopf, der nennt,
       wohin der Druck fuehrt. */
    expect(screen.queryByRole("switch")).not.toBeInTheDocument()

    const toggle = await screen.findByRole("button", { name: "Vorschau" }, WAIT)
    await user.click(toggle)
    expect(onModeToggle).toHaveBeenCalledTimes(1)

    /* Derselbe Knoten mit neuer Beschriftung, und der Fokus bleibt darauf
       (SC 2.4.3). Kein aria-pressed: der Name traegt die Handlung. */
    const edit = screen.getByRole("button", { name: "Bearbeiten" })
    expect(edit).toBe(toggle)
    expect(edit).toHaveFocus()
    expect(edit).not.toHaveAttribute("aria-pressed")

    await user.click(edit)
    expect(screen.getByRole("button", { name: "Vorschau" })).toBe(toggle)
    expect(toggle).toHaveFocus()
  })

  it("laesst im Vorschau-Modus nur Drucken und Hell/Dunkel in der Werkzeugzeile", async () => {
    const { container } = renderWithProviders(<Harness initialMode="preview" />)

    await screen.findByRole("button", { name: "Bearbeiten" }, WAIT)

    /* Rueckgaengig, Wiederholen, Formatierung und Inhaltsverzeichnis
       entfallen; es gibt nichts, worauf sie wirken koennten. */
    for (const name of ["Rückgängig", "Wiederholen", "Fett", "Zitat"]) {
      expect(screen.queryByRole("button", { name }), name).toBeNull()
    }
    expect(
      screen.queryByRole("button", { name: /Inhaltsverzeichnis/ })
    ).toBeNull()
    expect(container.querySelector("[data-selection-toolbar]")).toBeNull()

    /* Drucken und Hell/Dunkel bleiben an ihrem Platz. */
    const tools = container.querySelector<HTMLElement>(
      '[data-header-area="tools"]'
    )
    expect(tools).not.toBeNull()
    const area = within(tools as HTMLElement)
    expect(area.getByRole("button", { name: "Als PDF drucken" })).toBeVisible()
    expect(
      area.getByRole("button", { name: /Modus einschalten/ })
    ).toBeVisible()

    /* Kein Trenner ohne linken Nachbarn: der Ausdruck ist der erste
       Eintrag der Zeile. */
    expect(tools?.querySelector('[data-slot="separator"]')).toBeNull()
  })

  it("stellt die Schreibwerkzeuge beim Wechsel zurueck in die Schreibflaeche wieder her", async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness initialMode="preview" />)

    await user.click(
      await screen.findByRole("button", { name: "Bearbeiten" }, WAIT)
    )

    expect(
      await screen.findByRole("button", { name: "Fett" }, WAIT)
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Rückgängig" })).toBeVisible()
  })

  it("laesst Zurueckziehen in beiden Modi sichtbar und bedienbar", async () => {
    /* Bei SUBMITTED zieht die Projektseite zurueck (§4.1, §5). Der Wechsel in
       die Vorschau darf diesen Weg nicht verstecken. */
    const onWithdraw = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(
      <Harness
        status="SUBMITTED"
        mayRunWorkflow
        mayWrite={false}
        onWithdraw={onWithdraw}
      />
    )

    const withdraw = await screen.findByRole(
      "button",
      { name: "Zurückziehen" },
      WAIT
    )
    expect(withdraw).toBeEnabled()

    await user.click(screen.getByRole("button", { name: "Vorschau" }))
    await screen.findByRole("button", { name: "Bearbeiten" }, WAIT)

    const inPreview = screen.getByRole("button", { name: "Zurückziehen" })
    expect(inPreview).toBeEnabled()
    await user.click(inPreview)
    expect(onWithdraw).toHaveBeenCalledTimes(1)
  })

  it("gibt den Fokus nach dem Menueeintrag an den Menueausloeser zurueck", async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness />)

    const trigger = await screen.findByRole(
      "button",
      { name: "Weitere Aktionen" },
      WAIT
    )
    await user.click(trigger)
    await user.click(
      within(await screen.findByRole("menu", {}, WAIT)).getByRole("menuitem", {
        name: "Vorschau",
      })
    )

    /* Der Eintrag ist mit dem Menue fort; ohne Rueckgabe fiele der Fokus auf
       den Seitenanfang (SC 2.4.3). */
    await waitFor(() => expect(trigger).toHaveFocus(), WAIT)
    expect(screen.getByRole("button", { name: "Bearbeiten" })).toBeVisible()
  })

  it("loest den Ausdruck aus, ohne Schreibrecht ebenso", async () => {
    /*
     * Die Aktion „PDF" (KAN-41) steht am Ende der Werkzeugzeile, hinter der
     * Formatierung. Sie haengt nicht am Schreibrecht: gedruckt werden darf,
     * was gelesen werden darf, und ein eingereichter Beitrag ist read-only,
     * aber nicht ungedruckt.
     */
    const onPrint = vi.fn()
    renderWithProviders(<Harness mayWrite={false} onPrint={onPrint} />)

    const print = await screen.findByRole(
      "button",
      { name: "Als PDF drucken" },
      WAIT
    )
    expect(print).not.toBeDisabled()

    await userEvent.click(print)
    expect(onPrint).toHaveBeenCalledTimes(1)
  })
})
