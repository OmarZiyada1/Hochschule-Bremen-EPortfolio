import type { Editor } from "@tiptap/react"

import type {
  HeadingLevel,
  TocEntry,
} from "@/features/project-content/blockTypes"

/**
 * Die Grenzen aus Contract 2.5: hoechstens 200 Eintraege, je Eintrag
 * hoechstens 300 Zeichen Text.
 *
 * <p><strong>Sie stehen hier, weil der Server sie durchsetzt.</strong> Er
 * antwortet auf einen zu langen Eintrag mit 400 BLOCK_CONTENT_INVALID, und
 * geprueft wird die ganze Blockliste vor der ersten Schreiboperation: eine
 * einzige zu lange Ueberschrift liesse damit jeden weiteren Speicherlauf des
 * gesamten Beitrags scheitern, bis jemand den Block wieder loescht. Deshalb
 * kuerzt der Client hier, statt es darauf ankommen zu lassen.
 *
 * <p>Die Zahlen stehen bewusst doppelt, hier und im
 * {@code BlockValidationService}: der Server ist die verbindliche Instanz,
 * der Client die freundliche. Ein gemeinsamer Ort dafuer waere der Contract,
 * und der ist eine Confluence-Seite.
 */
const MAX_ENTRIES = 200

const MAX_TEXT = 300

/**
 * Die Gliederung eines Dokuments als Liste von Verzeichniseintraegen
 * (Contract 2.5, seit v84).
 *
 * <p><strong>Warum das hier steht und nicht im Renderer.</strong> Abgelesen
 * wird das lebende Editor-Dokument, und das gibt es nur beim Schreiben. Der
 * Lesepfad darf {@code @tiptap/*} gar nicht importieren
 * ({@code eslint.config.js}, {@code rendererImports.test.ts}); er bekommt die
 * Gliederung deshalb als gespeicherte Momentaufnahme im Block und rechnet
 * nichts nach.
 *
 * <p>{@code index} ist die laufende Nummer der Ueberschrift in
 * Dokumentreihenfolge, ab 0, und zaehlt nur Ueberschriften. Genau so zaehlt
 * der Renderer beim Vergeben der Sprungmarken; beide Zaehlungen muessen
 * uebereinstimmen, sonst zeigt ein Verzeichniseintrag auf die falsche Stelle.
 */
export function collectHeadings(editor: Editor): TocEntry[] {
  const entries: TocEntry[] = []
  let index = 0
  editor.state.doc.forEach((node) => {
    if (node.type.name !== "heading") {
      return
    }
    const level = node.attrs.level
    const text = node.textContent.trim().slice(0, MAX_TEXT)
    /*
     * Eine noch leere Ueberschrift bekommt keinen Eintrag: im Lesepfad
     * entstuende sonst ein Link ohne jeden Textknoten, also ohne
     * zugaenglichen Namen (SC 2.4.4, SC 4.1.2). Beim Schreiben ist das der
     * Normalfall, denn eine frisch eingefuegte Ueberschrift ist leer.
     *
     * Die Nummer zaehlt trotzdem weiter: sie haengt an der Position der
     * Ueberschrift im Dokument, und genau so vergibt der Renderer die
     * Sprungmarken. Wuerde hier ausgelassen, zeigten alle folgenden
     * Eintraege auf die falsche Stelle.
     */
    if (text !== "" && entries.length < MAX_ENTRIES) {
      entries.push({
        level: (typeof level === "number" && level >= 1 && level <= 6
          ? level
          : 1) as HeadingLevel,
        /* textContent statt der Inline-Knoten: das Verzeichnis zeigt Text und
           keine Auszeichnungen, und ein fetter Teil einer Ueberschrift ergaebe
           im Verzeichnis sonst ein zweites Erscheinungsbild. */
        text,
        index,
      })
    }
    index += 1
  })
  return entries
}

/**
 * Passt die gespeicherte Momentaufnahme noch zu den Ueberschriften des
 * Dokuments?
 *
 * <p>Verglichen wird der ganze Eintrag und nicht nur die Zahl: eine
 * umformulierte Ueberschrift veraendert die Liste, ohne ihre Laenge zu
 * aendern, und genau dann ist das Verzeichnis falsch, ohne dass es auffiele.
 */
export function sameEntries(
  stored: readonly TocEntry[],
  current: readonly TocEntry[]
): boolean {
  if (stored.length !== current.length) {
    return false
  }
  return stored.every((entry, position) => {
    const other = current[position]
    return (
      entry.level === other.level &&
      entry.text === other.text &&
      entry.index === other.index
    )
  })
}

/**
 * Wo im Dokument das Inhaltsverzeichnis steht, oder {@code null}.
 *
 * <p>Gesucht wird nur auf oberster Ebene: ein Block ist genau ein
 * Top-Level-Knoten (2.5), und tiefer kann er gar nicht liegen.
 */
export function findTableOfContents(
  doc: Editor["state"]["doc"]
): { pos: number } | null {
  let found: { pos: number } | null = null
  let pos = 0
  doc.forEach((node) => {
    if (found === null && node.type.name === "tableOfContents") {
      found = { pos }
    }
    pos += node.nodeSize
  })
  return found
}

/**
 * Setzt das Inhaltsverzeichnis auf den heutigen Stand: einfuegen, wenn es
 * keines gibt, sonst nachziehen (2.5 seit v84).
 *
 * <p>Eingefuegt wird am Anfang des Beitrags. Dort steht ein
 * Inhaltsverzeichnis; wer es anderswo haben will, verschiebt den Block wie
 * jeden anderen. An der Textmarke einzufuegen waere hier die schlechtere
 * Vorgabe: sie steht beim Klick auf die Toolbar irgendwo im Text.
 *
 * <p>Hoechstens eines je Beitrag (2.5): gibt es schon eines, entsteht kein
 * zweites. Der Server wiese es ohnehin mit 400 BLOCK_CONTENT_INVALID ab.
 *
 * @returns ob eingefuegt (statt nachgezogen) wurde, fuer die Ansage
 */
export function applyTableOfContents(editor: Editor): boolean {
  const entries = collectHeadings(editor)
  const existing = findTableOfContents(editor.state.doc)
  if (existing === null) {
    editor
      .chain()
      .focus()
      .insertContentAt(0, { type: "tableOfContents", attrs: { entries } })
      .run()
    return true
  }
  editor
    .chain()
    .focus()
    .command(({ tr }) => {
      tr.setNodeAttribute(existing.pos, "entries", entries)
      return true
    })
    .run()
  return false
}
