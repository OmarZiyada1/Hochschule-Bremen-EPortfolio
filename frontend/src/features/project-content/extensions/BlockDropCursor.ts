import type { Slice } from "@tiptap/pm/model"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { dropPoint } from "@tiptap/pm/transform"
import type { EditorView } from "@tiptap/pm/view"
import { Extension } from "@tiptap/react"

import { isBlockNodeName } from "@/features/project-content/blockTypes"
import { dropBlocksAt } from "@/features/project-content/editorCommands"

/**
 * Die Ablegelinie beim Verschieben eines Blocks (KAN-36).
 *
 * <p><strong>Warum nicht der mitgelieferte Dropcursor.</strong> Das
 * StarterKit bringt {@code prosemirror-dropcursor} mit, und der zeichnete
 * die Linie regelmaessig quer ueber einen Block statt zwischen zwei. Der
 * Grund steht in seiner Rechnung: er nimmt {@code posAtCoords} unter dem
 * Zeiger und schiebt das Ergebnis mit {@code dropPoint} auf die naechste
 * einfuegbare Stelle. Diese Stelle liegt haeufig <em>innerhalb</em> eines
 * Blocks, etwa zwischen zwei Punkten einer Liste oder in einer Zelle, und
 * bei hohen Bloecken (Bild, Galerie, Einbettung) faellt {@code posAtCoords}
 * ueberdies auf die naechstgelegene Textzeile zurueck, nicht auf die
 * naechste Blockgrenze. Beides zusammen ergibt genau das gemeldete Bild:
 * eine Linie mitten im Block, und zwar umso haeufiger, je unterschiedlicher
 * die Blockhoehen sind.
 *
 * <p>Einstellen laesst sich das nicht: die Erweiterung nimmt
 * {@code color}, {@code width} und {@code class} entgegen und sonst nichts,
 * die Positionsrechnung ist nicht austauschbar. Auch die Basis bietet keine
 * zweite Fassung an (Frontend-Regel 11, Ausnahmefall „Bibliothek hat es
 * nicht"). Deshalb steht sie hier ab, und diese Extension nimmt ihren Platz
 * ein.
 *
 * <p><strong>Die Regel ist einfach und haelt die Zusage aus dem
 * Contract:</strong> ein Block ist ein Top-Level-Knoten (2.5), also gibt es
 * nur Luecken zwischen Top-Level-Bloecken. Gemessen wird die <em>echte</em>
 * Hoehe jedes Blocks im DOM; der Zeiger faellt in die obere oder die untere
 * Haelfte, und daraus folgt die Luecke davor oder dahinter. Die Linie liegt
 * dann zwischen Unterkante und Oberkante der beiden Nachbarn und damit nie
 * ueber einem Block.
 *
 * <p><strong>Anzeige und Ablage rechnen mit derselben Zahl.</strong> Ohne
 * eigenes {@code handleDrop} zeigte die Linie die Blockgrenze an, waehrend
 * ProseMirror danach doch nach {@code dropPoint} einfuegte: die Anzeige
 * waere eine Zusage, die die Ablage nicht haelt. Beide Wege laufen deshalb
 * ueber den Index der Luecke und ueber {@link dropBlocksAt}.
 *
 * <p><strong>Nur fuer ganze Bloecke.</strong> Wird eine Textstelle gezogen
 * (ein Ausschnitt aus einem Absatz), gibt es keine Blockgrenze, an der er
 * landen koennte; dort bleibt es bei der senkrechten Linie an der
 * Textstelle und bei ProseMirrors eigener Ablage, so wie zuvor.
 */

/** Die Kanten eines Blocks im Ansichtsfenster. */
export type BlockBox = {
  top: number
  bottom: number
  left: number
  right: number
}

/** Lage der Linie: eine Kante und die Breite, ueber die sie reicht. */
export type DropLine = { top: number; left: number; right: number }

/**
 * Index der Luecke, in die bei dieser Zeigerhoehe abgelegt wird.
 *
 * <p>Der erste Block, dessen <em>Mitte</em> unter dem Zeiger liegt, bekommt
 * die Linie ueber sich; liegt keiner mehr darunter, kommt sie hinter den
 * letzten. Die Mitte und nicht die Oberkante: sonst waere die untere Haelfte
 * eines hohen Blocks nicht erreichbar, ohne den naechsten schon zu treffen.
 *
 * <p>Gerechnet wird ueber gemessene Kanten und nicht ueber Positionen im
 * Dokument. Genau deshalb steht die Funktion hier und nicht in der Klasse:
 * ohne DOM pruefbar, mit den Hoehen als Eingabe.
 */
export function dropIndexForBoxes(
  boxes: readonly BlockBox[],
  y: number
): number {
  for (let index = 0; index < boxes.length; index++) {
    const box = boxes[index]
    if (y < (box.top + box.bottom) / 2) {
      return index
    }
  }
  return boxes.length
}

/**
 * Wo die Linie fuer diese Luecke liegt.
 *
 * <p>Zwischen zwei Bloecken genau in der Mitte des Zwischenraums: ein
 * {@code getBoundingClientRect} misst ohne Aussenabstand, die Mitte zwischen
 * Unterkante und Oberkante liegt also in jedem Fall ausserhalb beider
 * Bloecke. Am Anfang und am Ende der Liste gibt es nur einen Nachbarn; dort
 * liegt sie auf dessen Kante.
 *
 * <p>Die Breite ist die Vereinigung beider Nachbarn, damit die Linie auch
 * dann von Rand zu Rand reicht, wenn einer der beiden schmal ist (ein Bild
 * mit 50 Prozent Breite).
 */
export function dropLineForBoxes(
  boxes: readonly BlockBox[],
  index: number
): DropLine | null {
  if (boxes.length === 0) {
    return null
  }
  const clamped = Math.max(0, Math.min(index, boxes.length))
  const before = clamped > 0 ? boxes[clamped - 1] : null
  const after = clamped < boxes.length ? boxes[clamped] : null

  if (before !== null && after !== null) {
    return {
      top: (before.bottom + after.top) / 2,
      left: Math.min(before.left, after.left),
      right: Math.max(before.right, after.right),
    }
  }
  if (before !== null) {
    return { top: before.bottom, left: before.left, right: before.right }
  }
  if (after !== null) {
    return { top: after.top, left: after.left, right: after.right }
  }
  return null
}

/**
 * Misst alle Top-Level-Bloecke.
 *
 * <p>Reihum und nicht mit einer binaeren Suche: mehrere Messungen
 * hintereinander ohne Schreibzugriff dazwischen kosten einen einzigen
 * Layoutdurchlauf, und die Reihenfolge der Bloecke muss so nicht als
 * monoton vorausgesetzt werden.
 *
 * <p><strong>Und bewusst bei jedem {@code dragover} neu</strong>, ohne
 * Zwischenspeicher. Der Aufwand ist ein Layoutdurchlauf je Ereignis und
 * nicht einer je Block, und {@code dragover} feuert hoechstens einmal je
 * Bildaufbau. Ein Zwischenspeicher muesste dagegen bei jedem Scrollen,
 * jeder Groessenaenderung und jeder Bildnachladung verworfen werden, und
 * gerade waehrend des Ziehens wird gescrollt: eine veraltete Messung waere
 * genau der Fehler, den diese Datei behebt.
 *
 * <p>Ein Knoten ohne eigenes Element ergibt eine Grenze ohne Hoehe an der
 * Stelle des Vorgaengers. Die Liste behaelt damit ihre Laenge, und der Index
 * der Luecke bleibt der Index im Dokument.
 */
function blockBoxes(view: EditorView): BlockBox[] {
  const doc = view.state.doc
  const boxes: BlockBox[] = []
  let offset = 0

  for (let index = 0; index < doc.childCount; index++) {
    const dom = view.nodeDOM(offset)
    if (dom instanceof HTMLElement) {
      const rect = dom.getBoundingClientRect()
      boxes.push({
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
      })
    } else {
      const previous = boxes[boxes.length - 1]
      const fallback = view.dom.getBoundingClientRect()
      boxes.push(
        previous === undefined
          ? {
              top: fallback.top,
              bottom: fallback.top,
              left: fallback.left,
              right: fallback.right,
            }
          : { ...previous, top: previous.bottom }
      )
    }
    offset += doc.child(index).nodeSize
  }

  return boxes
}

/**
 * Ob dieser Ausschnitt aus ganzen Bloecken besteht.
 *
 * <p>{@code openStart} und {@code openEnd} auf {@code 0} heisst: der
 * Ausschnitt beginnt und endet an einer Knotengrenze, es haengt also kein
 * halber Absatz daran. Nur solche Ausschnitte gehoeren zwischen zwei
 * Bloecke; alles andere ist ein Stueck Text und landet mitten in einem.
 *
 * <p><strong>Geprueft wird der Knotenname und nicht bloss
 * {@code isBlock}.</strong> {@code isBlock} trifft in ProseMirror auch auf
 * {@code listItem}, {@code tableRow} und {@code tableCell} zu; die gehoeren
 * nach Contract 2.5 nie auf die oberste Ebene. Landete einer dort, faende
 * {@code docToBlocks} keinen Blocktyp fuer ihn, und der Speicherlauf des
 * <em>ganzen</em> Beitrags endete in einem 400 (Befund der
 * Contract-Pruefung). Heute zieht der Ziehgriff nur ganze Bloecke, die
 * Pruefung haelt aber auch, wenn das einmal anders eingestellt wird.
 */
function isBlockSlice(slice: Slice | null | undefined): slice is Slice {
  if (slice == null || slice.openStart !== 0 || slice.openEnd !== 0) {
    return false
  }
  if (slice.content.childCount === 0) {
    return false
  }
  let onlyBlocks = true
  slice.content.forEach((child) => {
    if (!child.isBlock || !isBlockNodeName(child.type.name)) {
      onlyBlocks = false
    }
  })
  return onlyBlocks
}

/** Der Index der Luecke unter diesem Zeiger, aus den gemessenen Bloecken. */
function dropIndexAt(view: EditorView, clientY: number): number {
  return dropIndexForBoxes(blockBoxes(view), clientY)
}

/**
 * Ob zuletzt die waagerechte Linie zwischen zwei Bloecken stand.
 *
 * <p>Der Grund fuer dieses Gedaechtnis: beim Ziehen von <em>ausserhalb</em>
 * des Editors ist {@code view.dragging} waehrend {@code dragover} noch
 * {@code null}, es erscheint also die senkrechte Linie an der Textstelle.
 * ProseMirror liest den Inhalt erst beim Ablegen aus der Zwischenablage, und
 * ergibt das dann zufaellig einen Blockausschnitt, uebernaehme
 * {@code handleDrop} den Fall und legte woanders ab, als eben angezeigt war.
 * Die Zusage „Anzeige und Ablage rechnen mit derselben Zahl" haelt nur mit
 * dieser Notiz (Hinweis des Frontend-Reviews).
 *
 * <p>Eine WeakMap und kein Plugin-Zustand: der Wert entsteht aus einem
 * DOM-Ereignis und nicht aus einer Transaktion. Sie haelt die View nicht am
 * Leben.
 */
const horizontalLineShown = new WeakMap<EditorView, boolean>()

/**
 * Zeichnet die Linie und raeumt sie wieder ab.
 *
 * <p>Die Ereignisse sind dieselben wie beim mitgelieferten Dropcursor,
 * einschliesslich seines Notnagels: bleibt ein {@code drop} aus, weil das
 * Ziehen ausserhalb des Fensters endet, verschwindet die Linie nach fuenf
 * Sekunden von selbst.
 */
class BlockDropCursorView {
  private element: HTMLElement | null = null
  private timeout = -1
  private readonly view: EditorView
  private readonly listeners: {
    name: string
    handler: (event: Event) => void
  }[]

  constructor(view: EditorView) {
    this.view = view
    const names = ["dragover", "dragend", "drop", "dragleave"] as const
    this.listeners = names.map((name) => {
      const handler = (event: Event) => {
        this.handle(name, event as DragEvent)
      }
      view.dom.addEventListener(name, handler)
      return { name, handler }
    })
  }

  destroy(): void {
    for (const { name, handler } of this.listeners) {
      this.view.dom.removeEventListener(name, handler)
    }
    window.clearTimeout(this.timeout)
    this.hide()
  }

  private handle(name: string, event: DragEvent): void {
    if (name === "dragover") {
      this.onDragOver(event)
      return
    }
    if (name === "dragleave") {
      /* Nur wenn der Zeiger die Schreibflaeche wirklich verlaesst: beim
         Wechsel zwischen zwei Bloecken feuert dragleave ebenfalls. */
      const related = event.relatedTarget
      if (!(related instanceof Node) || !this.view.dom.contains(related)) {
        this.hide()
      }
      return
    }
    /* drop und dragend: kurz warten, damit die Transaktion durch ist. */
    this.scheduleRemoval(20)
  }

  private onDragOver(event: DragEvent): void {
    if (!this.view.editable) {
      return
    }
    const slice = this.view.dragging?.slice ?? null

    if (isBlockSlice(slice)) {
      const boxes = blockBoxes(this.view)
      const line = dropLineForBoxes(
        boxes,
        dropIndexForBoxes(boxes, event.clientY)
      )
      if (line === null) {
        this.hide()
        return
      }
      horizontalLineShown.set(this.view, true)
      this.show("horizontal", {
        top: line.top,
        left: line.left,
        length: line.right - line.left,
      })
      this.scheduleRemoval(5000)
      return
    }

    horizontalLineShown.set(this.view, false)

    /*
     * Ein Stueck Text: dieselbe senkrechte Linie an der Textstelle wie
     * bisher, und die Ablage bleibt ProseMirrors eigene.
     */
    const position = this.view.posAtCoords({
      left: event.clientX,
      top: event.clientY,
    })
    if (position == null) {
      this.hide()
      return
    }
    let target = position.pos
    if (slice !== null) {
      const point = dropPoint(this.view.state.doc, target, slice)
      if (point != null) {
        target = point
      }
    }
    const coords = this.view.coordsAtPos(target)
    this.show("vertical", {
      top: coords.top,
      left: coords.left,
      length: coords.bottom - coords.top,
    })
    this.scheduleRemoval(5000)
  }

  /**
   * Setzt die Linie in den Rahmen der Schreibflaeche.
   *
   * <p>Gerechnet wird aus Ansichtsfenster-Koordinaten in die Koordinaten des
   * {@code offsetParent}; das ist der Rahmen mit {@code position: relative}
   * um die Schreibflaeche, in dem auch der Ziehgriff sitzt. Dicke und Farbe
   * stehen im Stylesheet (Frontend-Regel 5), hier nur Ort und Laenge.
   */
  private show(
    orientation: "horizontal" | "vertical",
    rect: { top: number; left: number; length: number }
  ): void {
    const parent = this.view.dom.offsetParent
    if (!(parent instanceof HTMLElement)) {
      return
    }
    if (this.element === null) {
      const element = document.createElement("div")
      element.className = "project-content-drop-line"
      element.setAttribute("aria-hidden", "true")
      this.element = parent.appendChild(element)
    }

    const parentRect = parent.getBoundingClientRect()
    const element = this.element
    element.dataset.orientation = orientation
    element.style.top = `${rect.top - parentRect.top + parent.scrollTop}px`
    element.style.left = `${rect.left - parentRect.left + parent.scrollLeft}px`
    if (orientation === "horizontal") {
      element.style.width = `${rect.length}px`
      element.style.height = ""
    } else {
      element.style.height = `${rect.length}px`
      element.style.width = ""
    }
  }

  private hide(): void {
    window.clearTimeout(this.timeout)
    this.element?.remove()
    this.element = null
    horizontalLineShown.set(this.view, false)
  }

  private scheduleRemoval(delay: number): void {
    window.clearTimeout(this.timeout)
    this.timeout = window.setTimeout(() => this.hide(), delay)
  }
}

export const blockDropCursorKey = new PluginKey("blockDropCursor")

export const BlockDropCursor = Extension.create({
  name: "blockDropCursor",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: blockDropCursorKey,
        view: (view) => new BlockDropCursorView(view),
        props: {
          handleDrop: (view, event, slice, moved) => {
            /* Abgelegt wird nur da, wo eben auch die Linie stand. */
            if (
              horizontalLineShown.get(view) !== true ||
              !isBlockSlice(slice)
            ) {
              return false
            }
            return dropBlocksAt(
              view,
              dropIndexAt(view, event.clientY),
              slice,
              moved
            )
          },
        },
      }),
    ]
  },
})
