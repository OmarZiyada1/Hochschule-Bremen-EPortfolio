import type { Editor } from "@tiptap/react"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { NodeSelection, TextSelection } from "@tiptap/pm/state"

import {
  isBlockNodeName,
  type BlockNodeName,
} from "@/features/project-content/blockTypes"

/**
 * Die Befehle der Blockbedienung: welcher Block ist gerade dran, wo steht
 * er, wie wird er verschoben und wie geloescht.
 *
 * <p>Reine Funktionen ueber dem Editor, kein React. Sie sind der gemeinsame
 * Nenner von Maus- und Tastaturbedienung: das Ziehen mit der Maus und das
 * schrittweise Verschieben mit den Pfeiltasten laufen durch dieselbe
 * Funktion, sonst hat eine der beiden Bedienungen frueher oder spaeter
 * einen Fall, den die andere nicht kennt.
 *
 * <p><strong>Ein Block ist ein Top-Level-Knoten</strong> (Contract 2.5).
 * Alles hier rechnet deshalb in Kindern des Dokuments und nicht in
 * ProseMirror-Positionen; die Umrechnung steht an einer Stelle
 * ({@link offsetOfBlock}).
 */

/**
 * Position im Dokument, an der der Block mit diesem Index beginnt.
 *
 * <p>{@code index === childCount} ergibt das Ende des Dokuments. Das ist
 * kein Sonderfall, sondern die Einfuegestelle hinter dem letzten Block, und
 * ohne sie braeuchte jeder Aufrufer eine eigene Fallunterscheidung.
 */
export function offsetOfBlock(doc: ProseMirrorNode, index: number): number {
  let offset = 0
  for (let position = 0; position < index && position < doc.childCount; position++) {
    offset += doc.child(position).nodeSize
  }
  return offset
}

/**
 * Index des Blocks, in dem die Auswahl steht, oder {@code null}, wenn es
 * keinen gibt (leeres Dokument).
 *
 * <p>Gerechnet wird ueber {@code $from.depth}: bei einer Textauswahl tief in
 * einer Tabelle ist der Block der Vorfahre auf Ebene 1, nicht die Zelle.
 */
export function activeBlockIndex(editor: Editor): number | null {
  const { $from } = editor.state.selection
  if (editor.state.doc.childCount === 0) {
    return null
  }
  return $from.depth === 0 ? $from.index() : $from.index(1)
}

/** Knotenname des Blocks an dieser Stelle, fuer Beschriftungen. */
export function blockNameAt(
  editor: Editor,
  index: number
): BlockNodeName | null {
  const doc = editor.state.doc
  if (index < 0 || index >= doc.childCount) {
    return null
  }
  const name = doc.child(index).type.name
  return isBlockNodeName(name) ? name : null
}

/**
 * Verschiebt einen Block an eine andere Stelle.
 *
 * <p>Ausgeschnitten und wieder eingesetzt, in einer einzigen Transaktion:
 * so ist es ein Schritt im Rueckgaengig-Verlauf und ein einziger Anlass fuer
 * den Speichertakt.
 *
 * <p>Die Auswahl wandert mit. Ohne das bliebe die Bedienung am alten Platz
 * stehen, und wer zweimal hintereinander verschiebt, verschoebe beim
 * zweiten Mal den falschen Block.
 *
 * @param toIndex Zielindex in der Zaehlung <em>vor</em> dem Verschieben
 * @returns ob verschoben wurde; am Rand der Liste passiert nichts
 */
export function moveBlock(
  editor: Editor,
  fromIndex: number,
  toIndex: number
): boolean {
  const doc = editor.state.doc
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    fromIndex >= doc.childCount ||
    toIndex < 0 ||
    toIndex >= doc.childCount
  ) {
    return false
  }

  const node = doc.child(fromIndex)
  const from = offsetOfBlock(doc, fromIndex)
  const transaction = editor.state.tr.delete(from, from + node.nodeSize)
  const target = offsetOfBlock(transaction.doc, toIndex)
  transaction.insert(target, node)

  transaction.setSelection(
    node.isAtom
      ? NodeSelection.create(transaction.doc, target)
      : TextSelection.near(transaction.doc.resolve(target + 1))
  )
  editor.view.dispatch(transaction.scrollIntoView())
  return true
}

/**
 * Beginnt die Ziehbewegung an einem Block.
 *
 * <p>Der Knoten wird ausgewaehlt und als Schnipsel an ProseMirror
 * uebergeben; {@code move: true} sagt, dass er an der alten Stelle
 * verschwindet, statt kopiert zu werden. Ablegen, Cursor und
 * Rueckgaengig-Verlauf besorgt danach die Bibliothek. Ein eigener Ablauf
 * mit Zielberechnung waere ein zweites, schlechteres Drag-and-Drop neben
 * dem vorhandenen.
 *
 * <p>Die Funktion steht hier und nicht in der Komponente, weil sie
 * {@code view.dragging} setzt: in einer Komponente waere das eine Aenderung
 * an einem Prop, und die Regel {@code react-hooks/immutability} weist sie
 * zu Recht zurueck, ohne den Sonderfall zu kennen.
 *
 * @param dataTransfer das {@code dataTransfer} des Ereignisses
 * @returns ob die Bewegung beginnen konnte
 */
export function startBlockDrag(
  editor: Editor,
  index: number,
  dataTransfer: DataTransfer
): boolean {
  const doc = editor.state.doc
  if (index < 0 || index >= doc.childCount) {
    return false
  }
  const position = offsetOfBlock(doc, index)
  const node = doc.nodeAt(position)
  if (node === null) {
    return false
  }

  editor.chain().setNodeSelection(position).run()
  editor.view.dragging = {
    slice: editor.state.doc.slice(position, position + node.nodeSize),
    move: true,
  }
  dataTransfer.effectAllowed = "move"
  /* Ohne einen gesetzten Datentyp startet Firefox die Ziehbewegung nicht;
     der Inhalt selbst kommt aus view.dragging. */
  dataTransfer.setData("text/plain", "")
  return true
}

/** Loescht den Block mit diesem Index. */
export function deleteBlock(editor: Editor, index: number): boolean {
  const doc = editor.state.doc
  if (index < 0 || index >= doc.childCount) {
    return false
  }
  const from = offsetOfBlock(doc, index)
  const to = from + doc.child(index).nodeSize
  return editor.chain().focus().deleteRange({ from, to }).run()
}

/**
 * Fuegt einen Knoten hinter dem Block mit diesem Index ein.
 *
 * <p><strong>Hinter und nicht davor</strong>: das Plus steht neben dem
 * Block, an dem gerade gearbeitet wird, und der naechste Gedanke kommt
 * darunter. Steht der Cursor in einem leeren Absatz, ersetzt der neue
 * Knoten diesen Absatz, statt einen leeren darueber stehen zu lassen.
 */
export function insertBlockAfter(
  editor: Editor,
  index: number,
  content: Record<string, unknown>
): boolean {
  const doc = editor.state.doc
  if (index < 0 || index >= doc.childCount) {
    return editor.chain().focus().insertContent(content).run()
  }
  const current = doc.child(index)
  const start = offsetOfBlock(doc, index)
  const isEmptyParagraph =
    current.type.name === "paragraph" && current.content.size === 0

  return editor
    .chain()
    .focus()
    .insertContentAt(
      isEmptyParagraph
        ? { from: start, to: start + current.nodeSize }
        : start + current.nodeSize,
      content
    )
    .run()
}
