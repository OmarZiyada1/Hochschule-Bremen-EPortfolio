import type { HeadingLevel } from "@/features/project-content/blockTypes"

/**
 * Die Renderabbildung der Ueberschriftenebenen (Contract 2.5 seit v63), an
 * genau einer Stelle.
 *
 * <p><strong>Warum das ein eigenes Modul ist.</strong> Die Abbildung gilt
 * „im Editor wie in der oeffentlichen Detailansicht", und beide erzeugen ihr
 * DOM auf ganz verschiedenen Wegen: der Lesepfad ueber einen eigenen
 * JSON-Renderer ohne Tiptap, die Schreibflaeche ueber eine Knotenansicht von
 * ProseMirror. Zwei Aufschreibungen derselben Tabelle liefen genau so
 * auseinander, wie sie es vor dem Contract-Abgleich zu KAN-36 schon getan
 * haben: der Editor gab {@code h1} bis {@code h6} aus, die Detailseite
 * {@code h2} bis {@code h6} und ein {@code div}.
 *
 * <p>Dieses Modul importiert nichts aus {@code @tiptap/*} und darf deshalb
 * auch aus dem Lesepfad heraus benutzt werden (ESLint-Regel in
 * {@code eslint.config.js} fuer {@code renderer/**}).
 */

/** Die sechs Ebenen aus 2.5, in dieser Reihenfolge. */
export const HEADING_LEVELS: readonly HeadingLevel[] = [1, 2, 3, 4, 5, 6]

/**
 * Das Element, in dem eine Ebene erscheint.
 *
 * <p>Um genau eine Stufe versetzt, weil der Projekttitel aus
 * {@code Project.title} die einzige {@code h1} der Seite bleibt (2.5, 3.3).
 * Ebene 6 hat keine Entsprechung, weil die Elementreihe bei {@code h6}
 * endet; WAI-ARIA sieht dafuer {@code role="heading"} mit
 * {@code aria-level} vor.
 */
export function headingTagFor(
  level: HeadingLevel
): "h2" | "h3" | "h4" | "h5" | "h6" | "div" {
  switch (level) {
    case 1:
      return "h2"
    case 2:
      return "h3"
    case 3:
      return "h4"
    case 4:
      return "h5"
    case 5:
      return "h6"
    case 6:
      return "div"
  }
}

/**
 * Die Ebene, die ein Screenreader hoert. Nur Ebene 6 braucht sie
 * ausdruecklich; die uebrigen bringen sie ueber ihr Element mit.
 */
export function ariaLevelFor(level: HeadingLevel): number | undefined {
  return level === 6 ? 7 : undefined
}
