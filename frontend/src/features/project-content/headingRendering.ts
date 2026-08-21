import type { HeadingLevel } from "@/features/project-content/blockTypes"

/**
 * Die versetzte Abbildung der Ueberschriftenebenen (Contract 2.5 seit v63),
 * an genau einer Stelle.
 *
 * <p><strong>Warum versetzt.</strong> Gespeichert wird die Ebene, die die
 * Autor:in im Editor waehlt (1 bis 6); die einzige Ebene 1 der Seite bleibt
 * der Projekttitel aus {@code Project.title} (3.3). Die Anzeige schiebt
 * deshalb jede Ebene um genau eine Stufe nach unten. Der gespeicherte Wert
 * beschreibt die Gliederung des Beitrags, nicht das Element, in dem er
 * landet.
 *
 * <p><strong>Warum eine eigene Datei.</strong> Lesepfad und Schreibflaeche
 * brauchen dieselbe Abbildung: der Renderer, um {@code h2} bis {@code h6}
 * auszugeben, und der Editor, um die Ueberschrift beim Schreiben so
 * aussehen zu lassen wie danach. Zwei Fassungen liefen beim naechsten
 * Contract-Schritt auseinander, und der Unterschied faellt erst auf der
 * oeffentlichen Seite auf.
 *
 * <p><strong>Ebene 6 ist kein Element.</strong> Die HTML-Reihe endet bei
 * {@code h6}; eine siebte Stufe gibt es nicht. Sie wird deshalb als
 * {@code div} mit {@code role="heading"} und {@code aria-level="7"}
 * ausgezeichnet, was WAI-ARIA fuer Ebenen jenseits von sechs ausdruecklich
 * vorsieht. Fuer einen Screenreader ist sie damit eine Ueberschrift der
 * Ebene 7, fuer das Auge eine kleinere Zwischenzeile.
 */

/** Die sechs Ebenen, in der Reihenfolge des Blocktyp-Menues. */
export const HEADING_LEVELS: readonly HeadingLevel[] = [1, 2, 3, 4, 5, 6]

/**
 * Was aus einer Ebene im DOM wird.
 *
 * <p>{@code ariaLevel} steht nur an der siebten Stufe: an einem echten
 * {@code h2} bis {@code h6} waere es eine Wiederholung des Elements und bei
 * einem Tippfehler ein Widerspruch dazu.
 */
export type HeadingRendering = {
  /** Elementname fuer die Ausgabe. */
  tag: "h2" | "h3" | "h4" | "h5" | "h6" | "div"
  /** Gesetzt, sobald das Element selbst keine Ueberschrift ist. */
  role?: "heading"
  /** Gesetzt, sobald die Ebene ueber die HTML-Reihe hinausgeht. */
  ariaLevel?: 7
  /** Die Rollenklasse der Inhaltsskala (typography-tokens.css). */
  className: string
}

const TAGS: Record<HeadingLevel, HeadingRendering["tag"]> = {
  1: "h2",
  2: "h3",
  3: "h4",
  4: "h5",
  5: "h6",
  6: "div",
}

/**
 * Die Ausgabeform einer gespeicherten Ebene.
 *
 * <p>Als {@code Record} ueber den Ebenentyp gefuehrt: eine siebte Ebene im
 * Contract braeche den Typecheck, statt still auf {@code div} zu fallen.
 */
export function headingRendering(level: HeadingLevel): HeadingRendering {
  const tag = TAGS[level]
  const className = `type-content-h${level}`
  if (tag === "div") {
    return { tag, role: "heading", ariaLevel: 7, className }
  }
  return { tag, className }
}
