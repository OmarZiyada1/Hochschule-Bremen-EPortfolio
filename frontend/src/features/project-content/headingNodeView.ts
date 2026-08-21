import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { Plugin } from "@tiptap/pm/state"
import type { NodeView } from "@tiptap/pm/view"
import { Extension } from "@tiptap/react"

import type { HeadingLevel } from "@/features/project-content/blockTypes"
import {
  ariaLevelFor,
  headingTagFor,
} from "@/features/project-content/headingRendering"

/**
 * Die Knotenansicht der Ueberschrift auf der Schreibflaeche.
 *
 * <p><strong>Warum sie noetig ist.</strong> Contract 2.5 schreibt die
 * Renderabbildung abschliessend fest, und zwar ausdruecklich „im Editor wie
 * in der oeffentlichen Detailansicht": Ebene 1 wird {@code h2}, Ebene 6 wird
 * ein {@code div} mit {@code role="heading"} und {@code aria-level="7"}. Die
 * Heading-Extension gibt dagegen {@code h1} bis {@code h6} aus. Ohne diese
 * Ansicht stuenden auf der Schreibflaeche zwei {@code h1}, naemlich der
 * Projekttitel und der Block, und die Ueberschriftenliste eines
 * Screenreaders saehe im Editor anders aus als in der Vorschau daneben
 * (SC 1.3.1). Befund des Contract-Abgleichs zu KAN-36.
 *
 * <p><strong>Warum eine Knotenansicht und kein eigenes
 * {@code renderHTML}.</strong> Die Abbildung liesse sich auch an der
 * Heading-Extension setzen, aber {@code @tiptap/extension-heading} ist keine
 * direkte Abhaengigkeit dieses Projekts: unter pnpm gibt es kein flaches
 * {@code node_modules}, ein Import daraus scheiterte zur Laufzeit, und eine
 * neue Abhaengigkeit verlangt eine Rueckfrage (CLAUDE.md). Die Knotenansicht
 * kommt ohne aus und ersetzt genau das DOM, das ProseMirror sonst aus
 * {@code renderHTML} baut.
 *
 * <p><strong>Und warum sie ueber ein Plugin kommt.</strong> Ein
 * {@code editorProps.nodeViews} am Editor wirkt nicht: Tiptap ueberschreibt
 * das Feld beim Aufbau der View mit der Sammlung seines Extension-Managers
 * (siehe {@code Editor.createView}). ProseMirror sammelt Knotenansichten
 * dagegen ueber alle Plugins ein, und der erste Treffer je Knotenname
 * gewinnt; da kein Extension eine Ansicht fuer {@code heading} mitbringt,
 * greift diese hier.
 *
 * <p><strong>Das Speicherformat ist nicht betroffen.</strong> Gespeichert
 * wird das JSON des Knotens, also die Ebene; das Element ist reine Anzeige.
 * Kopieren und Einfuegen innerhalb des Editors laeuft ebenfalls ueber das
 * Dokumentmodell und nicht ueber HTML.
 */
export function createHeadingNodeView(node: ProseMirrorNode): NodeView {
  const level = toHeadingLevel(node.attrs.level)
  const dom = document.createElement(headingTagFor(level))

  const ariaLevel = ariaLevelFor(level)
  if (ariaLevel !== undefined) {
    dom.setAttribute("role", "heading")
    dom.setAttribute("aria-level", String(ariaLevel))
  }
  applyTextAlign(dom, node)

  return {
    dom,
    /* Derselbe Knoten: die Ueberschrift traegt ihren Text unmittelbar, es
       gibt kein Huellenelement dazwischen. */
    contentDOM: dom,
    /**
     * Bei einer Aenderung der Ebene wird die Ansicht neu gebaut, sonst
     * bliebe das alte Element stehen. Alles Uebrige, insbesondere die
     * Ausrichtung, wird an Ort und Stelle nachgezogen; ein Neuaufbau setzte
     * dabei den Cursor zurueck.
     */
    update(updated) {
      if (updated.type.name !== "heading") {
        return false
      }
      if (toHeadingLevel(updated.attrs.level) !== level) {
        return false
      }
      applyTextAlign(dom, updated)
      return true
    },
  }
}

/**
 * Die Ausrichtung als Datenattribut, wie im Lesepfad (2.5 seit v63).
 *
 * <p>Nicht als Inline-Stil: der liesse sich per Medienabfrage nicht
 * ueberschreiben, und die Regeln in {@code styles/project-content.css}
 * treffen beide Wege ueber dasselbe Attribut. Die Extension {@code TextAlign}
 * schriebe von sich aus einen Inline-Stil, kommt hier aber nicht zum Zug,
 * weil die Knotenansicht das DOM selbst baut.
 */
function applyTextAlign(dom: HTMLElement, node: ProseMirrorNode): void {
  const textAlign: unknown = node.attrs.textAlign
  if (typeof textAlign === "string" && textAlign !== "") {
    dom.setAttribute("data-text-align", textAlign)
  } else {
    dom.removeAttribute("data-text-align")
  }
}

/**
 * Die Ebene aus einem Knotenattribut. Ein Wert ausserhalb von 1 bis 6 kann
 * aus dem Schema nicht kommen; er wird geklemmt statt geraten, damit die
 * Ansicht in keinem Fall ein Element ohne Entsprechung baut.
 */
function toHeadingLevel(value: unknown): HeadingLevel {
  const level = Number(value)
  if (!Number.isInteger(level) || level < 1) {
    return 1
  }
  return (level > 6 ? 6 : level) as HeadingLevel
}

/**
 * Die Erweiterung, die {@link createHeadingNodeView} in den Editor bringt.
 *
 * <p>Sie steht in {@code createBlockExtensions()} und damit an derselben
 * Stelle wie das Schema: wer den Editor baut, bekommt die Abbildung aus 2.5
 * mit, ohne sie an seiner Aufrufstelle noch einmal einhaengen zu muessen.
 * Genau das war der Fehler beim ersten Anlauf.
 */
export const HeadingNodeView = Extension.create({
  name: "headingNodeView",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: { nodeViews: { heading: createHeadingNodeView } },
      }),
      /**
       * Die zweite Haelfte der Regel aus 2.5: {@code justify} kommt an einer
       * Ueberschrift nicht vor.
       *
       * <p><strong>Warum das nicht die Auswahlleiste allein leisten
       * kann.</strong> {@code TextAlign} bringt eigene Tastenkuerzel mit,
       * darunter {@code Mod-Shift-J} fuer den Blocksatz, und ein
       * eingefuegtes HTML mit {@code style="text-align: justify"} traegt ihn
       * ebenfalls herein. Beide Wege gehen an der deaktivierten
       * Schaltflaeche vorbei. Der Server weist das Ergebnis mit 400
       * {@code BLOCK_CONTENT_INVALID} ab, und weil der PUT die ganze
       * Blockliste ersetzt, scheiterte danach <em>jeder</em> weitere
       * Autosave des Projekts, bis jemand den Blocksatz von Hand
       * zuruecknimmt.
       *
       * <p>Deshalb steht die Regel hier, wo jede Transaktion vorbeikommt.
       * Entfernt wird nur der eine unzulaessige Wert; links, zentriert und
       * rechts bleiben unberuehrt.
       */
      new Plugin({
        appendTransaction(_transactions, oldState, newState) {
          if (oldState.doc === newState.doc) {
            return null
          }
          const transaction = newState.tr
          let touched = false
          newState.doc.descendants((node, position) => {
            if (
              node.type.name === "heading" &&
              node.attrs.textAlign === "justify"
            ) {
              transaction.setNodeAttribute(position, "textAlign", null)
              touched = true
            }
            /* Ueberschriften stehen nur auf oberster Ebene; tiefer muss
               nicht gesucht werden. */
            return false
          })
          return touched ? transaction : null
        },
      }),
    ]
  },
})
