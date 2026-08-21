import type { Editor } from "@tiptap/react"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { Selection } from "@tiptap/pm/state"

import {
  isBlockNodeName,
  type BlockNode,
  type BlockNodeName,
} from "@/features/project-content/blockTypes"

/**
 * Die Griffe an der Blockliste des Editors: welcher Block liegt unter dem
 * Cursor, wie viele gibt es, und wie wird einer eingefuegt, verschoben oder
 * geloescht.
 *
 * <p><strong>Warum das nicht in den Komponenten steht.</strong> Ein Block
 * ist ein Top-Level-Knoten des Dokuments (Contract 2.5), und die Rechnung
 * von einer Cursorposition auf den Index dieses Knotens braucht niemand
 * zweimal: die Blockbedienung links am Block, die Einfuegeleiste und die
 * Tastaturbedienung fragen dasselbe. Hier stehen sie als Funktionen ueber
 * dem Editor, ohne React, und sind damit einzeln pruefbar.
 *
 * <p><strong>Positionen, kurz.</strong> Im {@code doc}-Knoten beginnt das
 * erste Kind an Position 0; jedes weitere beginnt um die {@code nodeSize}
 * seiner Vorgaenger versetzt. Deshalb genuegt {@link offsetOfBlock}, und es
 * braucht kein Durchlaufen mit {@code descendants}.
 */

/** Anzahl der Top-Level-Knoten, also der Bloecke im Sinne von 2.5. */
export function blockCount(editor: Editor): number {
  return editor.state.doc.childCount
}

/**
 * Position, an der der Block mit diesem Index beginnt.
 *
 * <p>Ein Index jenseits der Liste ergibt das Ende des Dokuments; das ist
 * die Stelle, an der ein Anhaengen landet, und kein Fehlerfall.
 */
export function offsetOfBlock(doc: ProseMirrorNode, index: number): number {
  let offset = 0
  for (let i = 0; i < Math.min(index, doc.childCount); i += 1) {
    offset += doc.child(i).nodeSize
  }
  return offset
}

/**
 * Index des Blocks, in dem die Auswahl steht.
 *
 * <p>Gemessen wird am Anfang der Auswahl: geht sie ueber zwei Bloecke, ist
 * der erste gemeint, denn die Blockbedienung steht links neben genau einem
 * Block. Ein leeres Dokument ergibt {@code null}.
 */
export function activeBlockIndex(editor: Editor): number | null {
  const { doc, selection } = editor.state
  if (doc.childCount === 0) {
    return null
  }
  const resolved = doc.resolve(selection.from)
  /* depth 0 ist das Dokument selbst; index(0) ist damit die Nummer des
     Top-Level-Kindes, in dem die Position liegt, unabhaengig davon, wie
     tief sie darin steckt. */
  return Math.min(resolved.index(0), doc.childCount - 1)
}

/**
 * Der Knotenname des Blocks an diesem Index, soweit er zum Schema aus 2.5
 * gehoert.
 *
 * <p>Gibt {@code null} zurueck, wenn der Index daneben liegt oder der Name
 * kein bekannter Blocktyp ist. Der zweite Fall entsteht im laufenden
 * Betrieb nicht (das Schema laesst nichts anderes zu) und wird trotzdem
 * abgefangen, damit die Beschriftung der Loeschen-Rueckfrage nie einen
 * erfundenen Namen zeigt.
 */
export function blockNameAt(
  editor: Editor,
  index: number
): BlockNodeName | null {
  const { doc } = editor.state
  if (index < 0 || index >= doc.childCount) {
    return null
  }
  const name = doc.child(index).type.name
  return isBlockNodeName(name) ? name : null
}

/**
 * Verschiebt den Block von {@code from} nach {@code to}, gemessen an der
 * Blockliste <em>vor</em> der Bewegung.
 *
 * <p>Meldet, ob wirklich etwas geschehen ist: an den Raendern (nach oben
 * aus dem ersten, nach unten aus dem letzten Block) passiert nichts, und
 * die aufrufende Stelle sagt dann auch nichts an.
 *
 * <p><strong>Loeschen und Einfuegen in einer Transaktion.</strong> Zwei
 * getrennte Schritte erzeugten zwei Eintraege in der Historie, und ein
 * einzelnes Rueckgaengig liesse den Block verschwunden zurueck.
 */
export function moveBlock(editor: Editor, from: number, to: number): boolean {
  const { state, view } = editor
  const { doc } = state
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= doc.childCount ||
    to >= doc.childCount
  ) {
    return false
  }

  const node = doc.child(from)
  const start = offsetOfBlock(doc, from)
  const transaction = state.tr.delete(start, start + node.nodeSize)
  const target = offsetOfBlock(transaction.doc, to)
  transaction.insert(target, node)
  /* Der Cursor wandert mit: sonst steht er nach der Bewegung in einem
     fremden Block, und die naechste Bewegung betraefe den falschen. */
  transaction.setSelection(
    Selection.near(
      transaction.doc.resolve(Math.min(target + 1, transaction.doc.content.size))
    )
  )
  view.dispatch(transaction.scrollIntoView())
  return true
}

/** Loescht den Block an diesem Index. */
export function removeBlock(editor: Editor, index: number): boolean {
  const { state, view } = editor
  const { doc } = state
  if (index < 0 || index >= doc.childCount) {
    return false
  }
  const node = doc.child(index)
  const start = offsetOfBlock(doc, index)
  view.dispatch(state.tr.delete(start, start + node.nodeSize).scrollIntoView())
  return true
}

/**
 * Fuegt einen Knoten hinter dem Block an diesem Index ein und setzt den
 * Cursor dahinter.
 *
 * <p><strong>Nie ein leerer Medienknoten.</strong> Der Aufrufer uebergibt
 * einen vollstaendigen {@link BlockNode}, also mit allen Pflichtattributen
 * aus 2.5. Der Grund steht in {@code InsertMenu}: {@code BlockService.replace}
 * prueft die gesamte Liste, bevor es die erste Zeile schreibt, und ein
 * Medienknoten ohne {@code fileId} machte damit jeden weiteren Autosave des
 * ganzen Projekts unmoeglich.
 *
 * <p>Hinter dem Medienknoten entsteht ein leerer Absatz, wenn er der letzte
 * Block waere. Ohne ihn liesse sich hinter einem Bild am Dokumentende nicht
 * weiterschreiben; gespeichert wird er nicht, {@code docToBlocks} laesst den
 * leeren Schlussabsatz weg.
 */
export function insertBlockAfter(
  editor: Editor,
  index: number,
  node: BlockNode
): boolean {
  const { state, view } = editor
  const { doc } = state
  const at = Math.min(Math.max(index + 1, 0), doc.childCount)
  const position = offsetOfBlock(doc, at)

  const created = state.schema.nodeFromJSON(node as unknown)
  const transaction = state.tr.insert(position, created)

  const needsTrailingParagraph =
    at === doc.childCount && created.type.spec.atom === true
  if (needsTrailingParagraph) {
    transaction.insert(
      position + created.nodeSize,
      state.schema.nodes.paragraph.create()
    )
  }

  transaction.setSelection(
    Selection.near(
      transaction.doc.resolve(
        Math.min(position + created.nodeSize, transaction.doc.content.size)
      )
    )
  )
  view.dispatch(transaction.scrollIntoView())
  return true
}
