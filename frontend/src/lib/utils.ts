import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * Die Radiusstufen der Foundation, wie sie {@code styles/tokens/tokens.css}
 * fuehrt. {@code tailwind-merge} kennt von Haus aus nur die Stufen der
 * Tailwind-Standardskala; die projekteigenen Namen sind ihm unbekannt, und
 * damit hielte es {@code rounded-card} und {@code rounded-xl} fuer zwei
 * Klassen aus verschiedenen Gruppen und behielte beide.
 */
const RADIUS_SCALE = [
  "none",
  "selection",
  "control",
  "card",
  "modal",
  "pill",
] as const

/**
 * Klassen zusammenfuehren, mit Kenntnis der Hausskala.
 *
 * <p><strong>Warum {@code extendTailwindMerge} und nicht das nackte
 * {@code twMerge}.</strong> Eine Domaenenhuelle uebergibt der erzeugten
 * Primitive regelmaessig einen anderen Radius, etwa {@code rounded-modal}
 * an einen Dialog, der von der Registry {@code rounded-xl} mitbringt.
 * Kennt die Zusammenfuehrung die Stufe {@code modal} nicht, verwirft sie
 * das {@code rounded-xl} nicht; beide Regeln stehen dann im Stylesheet mit
 * gleicher Spezifitaet, und die spaeter erzeugte gewinnt. Das faellt weder
 * im Typecheck noch im Lint noch in einem Test auf, sondern allein am
 * falschen Aussehen (Befund des frontend-reviewers zu KAN-37: die Dialoge
 * standen dadurch auf 12px statt der 16px, die sie setzen wollten).
 *
 * <p>Ergaenzt wird ausschliesslich die Gruppe {@code rounded}. Die uebrigen
 * Token des Projekts (Farben, Schriftrollen) erzeugen keine konkurrierenden
 * Utility-Gruppen: Farbklassen wie {@code bg-status-revision-bg} liegen in
 * derselben Gruppe wie {@code bg-muted} und werden schon jetzt richtig
 * aufgeloest, und die Schriftrollen {@code type-*} sind eigene Komponenten-
 * klassen und keine Utilities.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      rounded: [{ rounded: [...RADIUS_SCALE] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
