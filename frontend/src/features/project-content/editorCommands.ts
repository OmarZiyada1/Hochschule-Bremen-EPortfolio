import type { Editor } from "@tiptap/react"
import type { Node as ProseMirrorNode, Slice } from "@tiptap/pm/model"
import { NodeSelection, TextSelection } from "@tiptap/pm/state"
import type { EditorView } from "@tiptap/pm/view"

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
  for (
    let position = 0;
    position < index && position < doc.childCount;
    position++
  ) {
    offset += doc.child(position).nodeSize
  }
  return offset
}

/**
 * Index des Blocks, in dem die Auswahl steht, oder {@code null}, wenn es
 * keinen gibt (leeres Dokument).
 *
 * <p><strong>Gerechnet wird mit {@code index(0)} und nicht mit
 * {@code index(1)}.</strong> {@code ResolvedPos.index(depth)} zaehlt die
 * Kinder des Vorfahren auf <em>dieser</em> Ebene: {@code index(0)} ist das
 * wievielte Kind des Dokuments, {@code index(1)} das wievielte Kind
 * innerhalb dieses Knotens. Steht die Textmarke in einem Absatz, ist
 * {@code index(1)} also der Index des Inline-Kindes und damit fast immer
 * {@code 0}. Genau das war der Fehler: die Blockbedienung zeigte
 * unabhaengig von der Cursorstelle stets auf den ersten Block, und
 * Einfuegen, Verschieben und Loeschen trafen ihn auch.
 *
 * <p>Ebene 0 ist zugleich die richtige Ebene: ein Block ist nach Contract
 * 2.5 ein Knoten der obersten Ebene. Bei einer Textauswahl tief in einer
 * Tabelle ist der Block die Tabelle, nicht die Zelle, und {@code index(0)}
 * liefert genau sie.
 */
export function activeBlockIndex(editor: Editor): number | null {
  const doc = editor.state.doc
  if (doc.childCount === 0) {
    return null
  }
  /* Am Dokumentende zeigt index(0) hinter den letzten Block; dort gilt der
     letzte. */
  return Math.min(editor.state.selection.$from.index(0), doc.childCount - 1)
}

/**
 * Index des Blocks, in dem eine Dokumentposition liegt.
 *
 * <p>Die Bruecke zum Drag-Handle: {@code onNodeChange} meldet die Position
 * des Knotens, unter dem der Zeiger steht, und die Blockbefehle rechnen in
 * Kindern des Dokuments. Ohne diese Umrechnung an einer Stelle haette der
 * Zeigerweg wieder eine eigene Rechnung neben dem Tastaturweg.
 */
export function blockIndexAtPos(
  doc: ProseMirrorNode,
  pos: number
): number | null {
  if (doc.childCount === 0) {
    return null
  }
  const clamped = Math.max(0, Math.min(pos, doc.content.size))
  return Math.min(doc.resolve(clamped).index(0), doc.childCount - 1)
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
 * Legt gezogene Bloecke an einer Blockgrenze ab.
 *
 * <p>Das Gegenstueck zur Ablegelinie ({@code extensions/BlockDropCursor}):
 * beide rechnen mit derselben Zahl, dem <strong>Index der Luecke</strong>
 * zwischen zwei Top-Level-Bloecken. {@code 0} ist vor dem ersten,
 * {@code childCount} hinter dem letzten. Ohne diese gemeinsame Zahl zeigte
 * die Linie das eine an und ProseMirrors eigener Ablegeweg taete das andere:
 * er rechnet ueber {@code dropPoint} und trifft dabei auch Stellen
 * <em>innerhalb</em> eines Blocks, etwa zwischen zwei Punkten einer Liste.
 *
 * <p><strong>Ausschneiden und Einsetzen in einer Transaktion</strong>, wie
 * bei {@link moveBlock}: ein Schritt im Rueckgaengig-Verlauf und ein Anlass
 * fuer den Speichertakt. Die Einfuegestelle wird ueber {@code tr.mapping}
 * nachgefuehrt und nicht neu gerechnet; nur so stimmt sie auch, wenn die
 * Quelle vor ihr lag und das Loeschen alles nach oben geschoben hat.
 *
 * @param index Index der Luecke, gezaehlt <em>vor</em> dem Ablegen
 * @param moved ob dies ein Verschieben ist (sonst eine Kopie)
 * @returns ob abgelegt wurde; {@code false} ueberlaesst den Fall ProseMirror
 */
export function dropBlocksAt(
  view: EditorView,
  index: number,
  slice: Slice,
  moved: boolean
): boolean {
  const doc = view.state.doc
  const selection = view.state.selection

  /* Verschieben ohne Auswahl gibt es nicht: ohne sie wuesste niemand, was
     zu entfernen ist, und der Block stuende danach zweimal da. */
  if (moved && selection.empty) {
    return false
  }

  const target = Math.max(0, Math.min(index, doc.childCount))
  const insertPos = offsetOfBlock(doc, target)

  /*
   * Ob das Dokument diesen Inhalt an dieser Stelle ueberhaupt aufnimmt.
   * {@code insert} wirft sonst einen TransformError, und geworfen wuerde
   * mitten im Ablegen, wo niemand ihn faengt. Mit {@code false} behaelt
   * ProseMirror den Fall und macht daraus, was es kann (Hinweis des
   * Frontend-Reviews).
   */
  const $insert = doc.resolve(insertPos)
  if (
    !$insert.parent.canReplace($insert.index(), $insert.index(), slice.content)
  ) {
    return false
  }

  /* Auf sich selbst abgelegt: der Beitrag saehe danach aus wie zuvor, und
     eine Transaktion dafuer waere ein leerer Schritt im Verlauf und ein
     unnoetiger Speicherlauf. */
  if (moved && insertPos >= selection.from && insertPos <= selection.to) {
    return true
  }

  const transaction = view.state.tr
  if (moved) {
    transaction.deleteSelection()
  }

  const at = transaction.mapping.map(insertPos)
  transaction.insert(at, slice.content)

  const first = slice.content.firstChild
  transaction.setSelection(
    first !== null && first.isAtom
      ? NodeSelection.create(transaction.doc, at)
      : TextSelection.near(transaction.doc.resolve(at + 1))
  )
  view.dispatch(transaction.scrollIntoView())
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

/**
 * Fuegt einen Knoten anstelle eines Bereichs ein: der Weg des
 * Slash-Befehls.
 *
 * <p>Zuerst faellt der getippte Befehl weg, danach entscheidet
 * {@link insertBlockAfter} wie ueberall, ob der Knoten den nun leeren
 * Absatz ersetzt oder dahinter kommt. Zwei Schritte und nicht einer, weil
 * die Entscheidung ueber den leeren Absatz erst nach dem Loeschen faellt;
 * fuer den Rueckgaengig-Verlauf ist das dank der Gruppierung von
 * ProseMirror trotzdem ein Schritt.
 */
export function insertBlockAtRange(
  editor: Editor,
  range: { from: number; to: number },
  content: Record<string, unknown>
): boolean {
  if (!editor.chain().focus().deleteRange(range).run()) {
    return false
  }
  const index = activeBlockIndex(editor)
  if (index === null) {
    return editor.chain().focus().insertContent(content).run()
  }
  return insertBlockAfter(editor, index, content)
}

/**
 * Haelt den Ziehgriff an seinem Platz, solange eine Flaeche der
 * Blockbedienung offen steht.
 *
 * <p><strong>Warum nicht {@code editor.commands.lockDragHandle()}.</strong>
 * Das Kommando gehoert der Extension {@code DragHandle};
 * {@code DragHandleReact} bindet aber nur {@code DragHandlePlugin} ein und
 * keine Extension. Der Aufruf endete deshalb in „is not a function", und
 * zwar erst zur Laufzeit, weil die Typdeklaration des Pakets das Kommando
 * trotzdem anmeldet. Das Plugin selbst liest die Sperre aus einem
 * Transaktions-Meta, und genau das wird hier gesetzt: derselbe Weg, den
 * das Kommando intern nimmt, nur ohne die Extension.
 *
 * <p>Ohne die Sperre blendet sich der Griff aus, sobald der Zeiger den
 * Text verlaesst. Wer die Einfuegeleiste oeffnet und die Maus darauf zu
 * bewegt, tut genau das: der Griff verschwand mitsamt der Leiste, bevor
 * sich etwas anklicken liess.
 *
 * <p>Ohne angemeldetes Plugin, etwa in einem Test ohne Zeigerbedienung,
 * bleibt das Meta wirkungslos und wirft nicht.
 */
export function setDragHandleLocked(editor: Editor, locked: boolean): void {
  if (editor.isDestroyed) {
    return
  }
  editor.view.dispatch(
    editor.state.tr
      .setMeta("lockDragHandle", locked)
      /* Kein Schritt im Rueckgaengig-Verlauf: das Oeffnen eines Menues
			   ist keine Aenderung am Beitrag. */
      .setMeta("addToHistory", false)
  )
}
