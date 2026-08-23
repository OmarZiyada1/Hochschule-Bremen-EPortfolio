import { TextSelection } from "@tiptap/pm/state"
import { useEditorState, type Editor } from "@tiptap/react"
import { useCallback, useEffect, useState } from "react"
import { createPortal } from "react-dom"

import { TableControls } from "@/features/project-content/components/TableControls"

/**
 * Die Tabellenbedienung an jeder Tabelle, oben rechts in ihrer Ecke.
 *
 * <p><strong>Sie stand ueber der Schreibflaeche und steht jetzt an der
 * Tabelle</strong> (Nutzerentscheidung, wie bei den Medienbloecken): am
 * oberen Rand der Seite war sie von der Tabelle, auf die sie wirkt, beliebig
 * weit entfernt, und bei mehreren Tabellen war ihr nicht anzusehen, welche
 * gemeint ist. Sie erscheint beim Zeigen auf die Tabelle und bleibt stehen,
 * solange die Textmarke darin steht.
 *
 * <p><strong>Gerechnet wird keine Position.</strong> Die Tabellen-Erweiterung
 * legt um jede Tabelle bereits einen eigenen Rahmen
 * ({@code div.tableWrapper}, ihre {@code TableView}); die Bedienung wird als
 * Portal genau dorthin gehaengt und sitzt damit durch
 * {@code position: absolute} von selbst richtig. Der fruehere Einwand gegen
 * eine Bedienung an der Tabelle war das Nachmessen bei jedem Zellenwechsel,
 * und genau das entfaellt hier: es gibt keine Messung, weil es keine zweite
 * Position gibt.
 *
 * <p><strong>Ein Portal je Tabelle und nicht nur fuer die aktive.</strong>
 * Zum Zeigen gehoert, dass etwas erscheint, bevor man geklickt hat; eine
 * Bedienung, die erst mit der Textmarke entsteht, waere beim Zeigen nicht da.
 * Damit ein Klick trotzdem nie die falsche Tabelle trifft, setzt das Oeffnen
 * des Menues die Textmarke zuerst in die eigene Tabelle: die Vorgaenge der
 * Erweiterung wirken alle auf die Tabelle an der Textmarke.
 *
 * <p>Die Textmarke wird dabei ohne {@code focus()} gesetzt. Ein Fokus auf
 * die Schreibflaeche im Augenblick des Oeffnens naehme dem Menue den Fokus
 * wieder weg, und es schloesse sich sofort.
 *
 * <p><strong>Der Weg mit der Tastatur ist Alt+F8</strong>, abgefangen in
 * {@code EditorPage}. Der Tabulator taugt dafuer nicht: die
 * Tabellen-Erweiterung belegt ihn mit {@code goToNextCell} und haengt an der
 * letzten Zelle sogar eine Zeile an, er fuehrt also nie aus einer Tabelle
 * heraus (SC 2.1.1).
 */

/** Die Tabellen eines Beitrags und die, in der die Textmarke steht. */
type TableIndex = {
  /** Anfangsposition jeder Tabelle, in Dokumentreihenfolge. */
  positions: number[]
  /** Anfangsposition der Tabelle an der Textmarke, sonst {@code null}. */
  active: number | null
}

function collectTables(editor: Editor): TableIndex {
  const doc = editor.state.doc
  const cursor = editor.state.selection.from
  const positions: number[] = []
  let active: number | null = null
  let offset = 0

  for (let index = 0; index < doc.childCount; index++) {
    const child = doc.child(index)
    if (child.type.name === "table") {
      positions.push(offset)
      if (cursor > offset && cursor < offset + child.nodeSize) {
        active = offset
      }
    }
    offset += child.nodeSize
  }
  return { positions, active }
}

/** Was sich geaendert haben muss, damit neu gerendert wird. */
function signatureOf(index: TableIndex): string {
  return `${index.positions.join(",")}|${index.active ?? "-"}`
}

export function TableControlsLayer({ editor }: { editor: Editor }) {
  /**
   * Haelt den Tabulator vom Editor fern, solange der Fokus in der Bedienung
   * steht.
   *
   * <p>Die Bedienung liegt im DOM der Schreibflaeche, und die
   * Tabellen-Erweiterung horcht dort auf {@code Tab}: ein Tabulator auf dem
   * fokussierten Ausloeser haengte der Tabelle eine Zeile an. Abgefangen
   * wird nur die Weiterreichung, nicht die Taste selbst: der Browser schiebt
   * den Fokus weiterhin weiter, sonst entstuende genau die Tastaturfalle,
   * die SC 2.1.2 verbietet.
   *
   * <p>Ein echter Lauscher und kein React-Handler: React haengt seine
   * Lauscher an die Wurzel des Baums, dort abzubrechen kaeme fuer den
   * Lauscher auf {@code view.dom} zu spaet.
   */
  const stopTabInside = useCallback((node: HTMLDivElement | null) => {
    if (node === null) {
      return
    }
    const stop = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        event.stopPropagation()
      }
    }
    node.addEventListener("keydown", stop)
    return () => node.removeEventListener("keydown", stop)
  }, [])

  /*
   * <strong>{@code useEditorState} gibt hier den Anstoss, nicht den
   * Wert.</strong> Seit Tiptap v3 rendert eine Transaktion die Seite nicht
   * mehr neu, ein Anstoss wird also gebraucht. Sein Ergebnis taugt hier aber
   * nicht als Quelle: die Seite baut den Editor neu auf, sobald der Beitrag
   * geladen ist ({@code useEditor} mit Abhaengigkeiten), und der Hook meldete
   * nach diesem Wechsel weiter den Stand des <em>alten</em>, noch leeren
   * Editors, bis zufaellig eine Transaktion kam. Die Bedienung fehlte damit
   * an jeder Tabelle eines geladenen Beitrags, obwohl ihr Rahmen im DOM
   * stand. Gerechnet wird deshalb beim Rendern, aus genau dem Editor, der
   * auch die Rahmen traegt.
   */
  const signature = useEditorState({
    editor,
    selector: ({ editor: current }) => signatureOf(collectTables(current)),
  })

  /*
   * Ein zweiter Durchlauf, einen Bildaufbau spaeter.
   *
   * <p><strong>Die Rahmen der Tabellen stehen beim ersten Rendern noch nicht
   * im Dokument.</strong> Die Seite haengt die Schreibflaeche in einem
   * eigenen Schritt ein, und dabei entstehen die Knotenansichten neu: was
   * {@code nodeDOM} vorher liefert, ist ein Rahmen, der nirgends haengt
   * ({@code isConnected === false}). Ein Portal dorthin waere unsichtbar,
   * und die Bedienung fehlte an jeder Tabelle eines geladenen Beitrags.
   *
   * <p>Der Zustand wird im Bildaufbau gesetzt und nicht im Rumpf des
   * Effekts: das eine ist ein Nachziehen nach dem Einhaengen, das andere
   * waere ein zweiter Renderdurchlauf ohne Anlass
   * (react-hooks/set-state-in-effect).
   */
  const [, setTick] = useState(0)
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setTick((value) => value + 1)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [editor, signature])

  const tables = collectTables(editor)

  /** Setzt die Textmarke in diese Tabelle, falls sie nicht schon darin steht. */
  const focusTable = (position: number) => {
    if (editor.isDestroyed) {
      return
    }
    const node = editor.state.doc.nodeAt(position)
    if (node === null) {
      return
    }
    const cursor = editor.state.selection.from
    if (cursor > position && cursor < position + node.nodeSize) {
      return
    }
    editor.view.dispatch(
      editor.state.tr
        .setSelection(
          TextSelection.near(editor.state.doc.resolve(position + 1))
        )
        /* Eine Textmarke ist keine Aenderung am Beitrag. */
        .setMeta("addToHistory", false)
    )
  }

  return (
    <>
      {tables.positions.map((position, order) => {
        const wrapper = editor.view.nodeDOM(position)
        /* Nur in einen Rahmen, der wirklich im Dokument haengt: in einen
           abgehaengten zu rendern hiesse, die Bedienung ins Leere zu
           stellen. Der Durchlauf oben holt sie eine Bildwiederholung
           spaeter nach. */
        if (!(wrapper instanceof HTMLElement) || !wrapper.isConnected) {
          return null
        }
        return createPortal(
          <div
            data-table-controls=""
            data-active={tables.active === position}
            /* Die Schreibflaeche ist beschreibbar; ohne dies liesse sich in
               die Bedienung hineinschreiben und sie sich loeschen. */
            contentEditable={false}
            /*
             * Escape fuehrt zurueck in den Text, wie aus der
             * Formatierungsleiste. Nur wenn das Menue den Tastendruck nicht
             * schon verbraucht hat: dessen eigenes Escape schliesst erst das
             * Menue und laesst den Fokus auf dem Ausloeser (SC 2.4.3).
             */
            onKeyDown={(event) => {
              if (event.key === "Escape" && !event.defaultPrevented) {
                event.preventDefault()
                editor.commands.focus()
              }
            }}
            ref={stopTabInside}
          >
            <TableControls
              editor={editor}
              position={order + 1}
              onOpen={() => focusTable(position)}
            />
          </div>,
          wrapper,
          String(position)
        )
      })}
    </>
  )
}
