import katex from "katex"

/*
 * Das Stylesheet von KaTeX liegt bei der einzigen Stelle, die KaTeX
 * aufruft, und nicht in index.css: eine Seite ohne Formel soll es nicht
 * laden. main.tsx laedt die Schriftdateien nach demselben Muster direkt am
 * Verwender. Es bringt eigene Farb- und Groessenangaben mit; sie betreffen
 * ausschliesslich den Formelsatz und stehen unter node_modules, nicht in
 * frontend/src (Frontend-Regel 5).
 */
import "katex/dist/katex.min.css"

/**
 * Der einzige KaTeX-Aufruf des Projekts (KAN-10, Umfangspunkt 8).
 *
 * <p>Der Formel-Dialog aus KAN-73 ruft dieselbe Funktion auf. Zwei
 * Aufrufstellen liefen in ihren Optionen auseinander, und die Optionen sind
 * hier keine Kosmetik:
 *
 * <ul>
 * <li>{@code displayMode: true}, weil 2.5 kein {@code displayMode} kennt
 * und Formeln im Blockmodus stehen.</li>
 * <li>{@code output: "htmlAndMathml"}, damit neben der Darstellung eine
 * MathML-Entsprechung im Baum steht (SC 1.1.1).</li>
 * <li>{@code trust: false}, damit {@code \href} und {@code \url} nicht
 * greifen: sonst waere die Formel ein Weg, einen Link an der Whitelist
 * vorbei in die oeffentliche Detailseite zu bekommen.</li>
 * <li>{@code maxSize: 100}, weil die Voreinstellung {@code Infinity} ist
 * und ein Streckenbefehl mit riesiger Hoehe damit ein Element von mehreren
 * Metern auf der oeffentlichen Seite erzeugte; {@code overflow-x} faengt
 * nur die Breite ab. KaTeX nennt die Option ausdruecklich als Pflicht fuer
 * nicht vertrauenswuerdige Eingaben, und der Text eines Beitrags ist genau
 * das (Befund aus dem Frontend-Review zu KAN-10).</li>
 * <li><strong>kein {@code throwOnError: false}</strong>: KaTeX schriebe
 * dann seine Fehlerfarbe als Hex-Wert in die Ausgabe, also eine Farbe
 * ausserhalb der Tokenschicht (Frontend-Regel 5). Stattdessen faengt diese
 * Funktion den Fehler und meldet ihn.</li>
 * </ul>
 *
 * <p>Die Ausgabe ist erzeugt und nicht eingegeben; sie ist deshalb die
 * einzige Stelle des Renderers, an der {@code dangerouslySetInnerHTML}
 * verwendet wird (in {@code MathBlockView}).
 */
export type MathRenderResult = { ok: true; html: string } | { ok: false }

export function renderMath(latex: string): MathRenderResult {
  try {
    return {
      ok: true,
      html: katex.renderToString(latex, {
        displayMode: true,
        output: "htmlAndMathml",
        trust: false,
        maxSize: 100,
      }),
    }
  } catch {
    return { ok: false }
  }
}
