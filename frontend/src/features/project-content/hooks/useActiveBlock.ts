import { useEditorState, type Editor } from "@tiptap/react"
import { useCallback, useLayoutEffect, useState, type RefObject } from "react"

import {
  activeBlockIndex,
  blockNameAt,
  offsetOfBlock,
} from "@/features/project-content/blockCommands"
import type { BlockNodeName } from "@/features/project-content/blockTypes"

/**
 * Welcher Block steht unter dem Cursor, wie heisst er, und wo liegt er auf
 * dem Bildschirm.
 *
 * <p>Die Blockbedienung steht links <em>neben</em> dem aktiven Block
 * (Figma {@code BlockControls}). Sie kann deshalb nicht im Fluss der
 * Schreibflaeche liegen: ProseMirror verwaltet das DOM dort selbst, und ein
 * eingehaengter React-Knoten waere beim naechsten Tastenanschlag wieder
 * weg. Sie liegt stattdessen absolut ueber der Flaeche, und diese Datei
 * liefert ihr die senkrechte Position.
 *
 * <p><strong>Gemessen wird nach dem Rendern</strong>
 * ({@code useLayoutEffect}), damit die Bedienung nicht eine Bildwiederholung
 * lang an der alten Stelle steht. Neu gemessen wird bei jeder Transaktion,
 * denn schon ein eingefuegtes Zeichen kann den Block umbrechen lassen und
 * damit alles darunter verschieben.
 */

export type ActiveBlock = {
  /** Position in der Blockliste, gezaehlt ab 0. */
  index: number
  /** Knotenname aus 2.5, fuer die Beschriftung der Rueckfrage. */
  name: BlockNodeName | null
  /** Abstand von der Oberkante der Schreibflaeche, in CSS-Pixeln. */
  top: number
  /** Gesamtzahl der Bloecke, fuer die Ansage „Block 3 von 7". */
  count: number
}

export function useActiveBlock(
  editor: Editor | null,
  containerRef: RefObject<HTMLElement | null>
): ActiveBlock | null {
  /*
   * Der abgeleitete Zustand traegt nur Index und Anzahl. Die Position ist
   * eine DOM-Messung und gehoert nicht in den Vergleich: sie aendert sich
   * auch ohne Transaktion, etwa wenn ein Bild fertig laedt.
   */
  const selection = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      /* isDestroyed mitgeprueft: nach dem Abraeumen laeuft der Selektor
         noch einmal, und state greift dann auf eine View zu, die es nicht
         mehr gibt. */
      current === null || current.isDestroyed
        ? null
        : {
            index: activeBlockIndex(current),
            count: current.state.doc.childCount,
            /* Der Knotenname wandert mit in den Vergleich: ohne ihn bliebe
               die Beschriftung stehen, wenn sich der Typ desselben Blocks
               aendert (Absatz wird Ueberschrift). */
            name: blockNameAt(current, activeBlockIndex(current) ?? -1),
          },
  })

  const [top, setTop] = useState(0)

  const measure = useCallback(() => {
    if (
      editor === null ||
      selection === null ||
      selection.index === null ||
      containerRef.current === null
    ) {
      return
    }
    const position = offsetOfBlock(editor.state.doc, selection.index)
    /* nodeDOM liefert das Element des Knotens selbst; domAtPos gaebe den
       Textknoten darin und damit die Zeile statt des Blocks. */
    const dom = editor.view.nodeDOM(position)
    if (!(dom instanceof HTMLElement)) {
      return
    }
    setTop(
      dom.getBoundingClientRect().top -
        containerRef.current.getBoundingClientRect().top
    )
  }, [containerRef, editor, selection])

  useLayoutEffect(() => {
    measure()
  }, [measure])

  if (selection === null || selection.index === null) {
    return null
  }
  return {
    index: selection.index,
    name: selection.name,
    count: selection.count,
    top,
  }
}
