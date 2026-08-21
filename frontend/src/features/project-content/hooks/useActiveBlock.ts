import type { Editor } from "@tiptap/react"
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react"

import {
  activeBlockIndex,
  blockNameAt,
  offsetOfBlock,
} from "@/features/project-content/editorCommands"
import type { BlockNodeName } from "@/features/project-content/blockTypes"

/**
 * Welcher Block die Bedienung bekommt und wo sie steht.
 *
 * <p><strong>Zwei Quellen, und beide sind noetig.</strong> Der Zeiger sagt,
 * worauf jemand gerade zielt, die Textmarke sagt, wo geschrieben wird. Nur
 * auf die Textmarke zu hoeren hiesse, dass die Bedienung beim Ueberfahren
 * eines anderen Blocks nicht mitgeht: man sieht das Plus neben dem Absatz,
 * an dem der Cursor steht, und nicht neben dem, auf den man zeigt. Nur auf
 * den Zeiger zu hoeren liesse die Bedienung fuer Tastaturbedienung ganz
 * verschwinden.
 *
 * <p><strong>Gemessen wird nur, wenn sich etwas geaendert hat.</strong>
 * {@code getBoundingClientRect} erzwingt einen Layoutdurchlauf; bei jeder
 * Transaktion aufgerufen, also bei jedem Tastenanschlag, kostet das
 * spuerbar Zeit und macht das Tippen zaeh. Neu gemessen wird deshalb, wenn
 * der Block wechselt, und ausserdem, wenn sich die Hoehe der Schreibflaeche
 * aendert: das faengt den Umbruch beim Tippen und das nachtraeglich
 * geladene Bild mit ab, ohne an jeder Taste zu haengen.
 *
 * <p>Die Zeigerbewegung laeuft ueber {@code requestAnimationFrame}: bei
 * schnellem Ziehen feuert {@code mousemove} oefter als der Bildschirm neu
 * zeichnet.
 */
export type ActiveBlock = {
  /** Position in der Blockliste, ab 0. */
  index: number
  /** Knotenname aus 2.5, fuer Beschriftungen. */
  name: BlockNodeName | null
  /** Gesamtzahl der Bloecke, fuer die Ansage „Block 3 von 7". */
  count: number
  /** Abstand von der Oberkante der Schreibflaeche, in CSS-Pixeln. */
  top: number
}

export function useActiveBlock(
  editor: Editor | null,
  containerRef: RefObject<HTMLElement | null>
): ActiveBlock | null {
  const [chosen, setChosen] = useState<number | null>(null)
  const [top, setTop] = useState(0)
  const frameRef = useRef<number | null>(null)

  /*
   * Solange niemand gezielt hat, gilt der erste Block. Abgeleitet und nicht
   * im Effekt gesetzt: ein setState im Effekt loeste eine zweite
   * Renderrunde aus, und der Wert steht schon beim ersten fest.
   *
   * <p>Ohne diesen Rueckfall erschiene die Bedienung erst, wenn jemand die
   * Maus bewegt oder in den Text klickt: wer mit der Tastatur arbeitet,
   * saehe das Plus nie, und wer zum ersten Mal auf der Seite steht, saehe
   * gar nicht, dass es eine Blockbedienung gibt.
   */
  const index =
    chosen ??
    (editor !== null && !editor.isDestroyed && editor.state.doc.childCount > 0
      ? 0
      : null)

  /* Beim Ziehen bleibt die Bedienung an ihrem Block: der Zeiger faehrt
     waehrenddessen ueber alle anderen hinweg. */
  const draggingRef = useRef(false)

  const measure = useCallback(() => {
    const container = containerRef.current
    if (editor === null || editor.isDestroyed || index === null || container === null) {
      return
    }
    const doc = editor.state.doc
    if (index >= doc.childCount) {
      return
    }
    /* nodeDOM liefert das Element des Knotens selbst; domAtPos gaebe den
       Textknoten darin und damit die Zeile statt des Blocks. */
    const dom = editor.view.nodeDOM(offsetOfBlock(doc, index))
    if (!(dom instanceof HTMLElement)) {
      return
    }
    setTop(
      dom.getBoundingClientRect().top - container.getBoundingClientRect().top
    )
  }, [containerRef, editor, index])

  /* Zeiger */
  useEffect(() => {
    const container = containerRef.current
    if (editor === null || container === null) {
      return
    }
    const onMove = (event: MouseEvent) => {
      if (draggingRef.current) {
        return
      }
      if (frameRef.current !== null) {
        return
      }
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null
        if (editor.isDestroyed) {
          return
        }
        const hit = editor.view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        })
        if (hit === null) {
          return
        }
        const resolved = editor.state.doc.resolve(hit.pos)
        setChosen(resolved.depth === 0 ? resolved.index() : resolved.index(1))
      })
    }
    const onDragStart = () => {
      draggingRef.current = true
    }
    const onDragEnd = () => {
      draggingRef.current = false
    }

    container.addEventListener("mousemove", onMove)
    container.addEventListener("dragstart", onDragStart)
    container.addEventListener("dragend", onDragEnd)
    container.addEventListener("drop", onDragEnd)
    return () => {
      container.removeEventListener("mousemove", onMove)
      container.removeEventListener("dragstart", onDragStart)
      container.removeEventListener("dragend", onDragEnd)
      container.removeEventListener("drop", onDragEnd)
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
    }
  }, [containerRef, editor])

  /* Textmarke */
  useEffect(() => {
    if (editor === null) {
      return
    }
    const update = () => setChosen(activeBlockIndex(editor))
    editor.on("selectionUpdate", update)
    editor.on("focus", update)
    return () => {
      editor.off("selectionUpdate", update)
      editor.off("focus", update)
    }
  }, [editor])

  /* Messen: beim Wechsel des Blocks und bei jeder Hoehenaenderung. */
  useLayoutEffect(() => {
    measure()
  }, [measure])

  useEffect(() => {
    const container = containerRef.current
    if (container === null || typeof ResizeObserver === "undefined") {
      return
    }
    const observer = new ResizeObserver(() => measure())
    observer.observe(container)
    return () => observer.disconnect()
  }, [containerRef, measure])

  if (editor === null || index === null || index >= editor.state.doc.childCount) {
    return null
  }
  return {
    index,
    name: blockNameAt(editor, index),
    count: editor.state.doc.childCount,
    top,
  }
}
