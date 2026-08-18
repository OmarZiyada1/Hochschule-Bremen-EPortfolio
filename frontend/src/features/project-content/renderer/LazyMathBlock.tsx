import { lazy, Suspense } from "react"

/**
 * Die Formel, nachgeladen statt mitgeliefert.
 *
 * <p>Dasselbe Argument wie beim Verzicht auf Tiptap (Risiko R7 in KAN-10):
 * die oeffentliche Detailseite ist die haeufigste Ansicht und die einzige
 * ohne Anmeldung, und {@code katex} bringt samt Stylesheet und
 * Schriftdateien mehrere hundert Kilobyte mit, die ein Beitrag ohne Formel
 * nie braucht. Im ersten Entwurf hing KaTeX fest am Lesepfad; das war ein
 * Befund des Frontend-Reviews.
 *
 * <p>Diese Datei gibt es, weil {@code renderBlockNode.tsx} keine Komponente
 * enthaelt und eine {@code lazy()}-Bindung dort die Regel
 * {@code react-refresh/only-export-components} bricht. Sie exportiert
 * deshalb genau eine Komponente und sonst nichts.
 *
 * <p>{@code lazy()} erwartet einen Standardexport; das Modul fuehrt wie
 * alle anderen einen benannten, also wird er hier umgeschrieben statt dort
 * ergaenzt.
 */
const MathBlockView = lazy(() =>
  import("@/features/project-content/renderer/MathBlockView").then(
    (module) => ({ default: module.MathBlockView })
  )
)

export function LazyMathBlock({ latex }: { latex: string }) {
  /*
   * Kein sichtbarer Ersatzinhalt: die Formel steht im Fliesstext, und eine
   * Ladeanzeige an ihrer Stelle liesse den Absatz beim Nachladen springen.
   * Wer nicht auf das Nachladen warten kann, ruft preloadMath() aus
   * renderBlockNode.ts vorher auf (KAN-41, Druckausgabe).
   */
  return (
    <Suspense fallback={null}>
      <MathBlockView latex={latex} />
    </Suspense>
  )
}
