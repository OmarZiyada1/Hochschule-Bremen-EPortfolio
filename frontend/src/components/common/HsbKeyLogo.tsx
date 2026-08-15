/**
 * Bildmarke der Hochschule Bremen (Bremer Schluessel), 1:1 aus der
 * Figma-Bibliothek uebernommen.
 *
 * Sie ist die eine Ausnahme von der Regel, dass Symbole aus lucide-react
 * kommen: eine Wortbildmarke traegt eine feste Bedeutung und hat in einer
 * generischen Symbolsammlung keine Entsprechung. Die Pfade und die viewBox
 * stehen unveraendert wie in Figma; geaendert ist allein die Fuellung, die
 * dort als fester Weisswert steht und hier currentColor erbt. Sonst waere
 * die Marke die einzige Stelle im Frontend mit einer Farbe ausserhalb der
 * Tokenschicht, und sie bliebe im hellen Footer unsichtbar.
 *
 * Ohne Titel und mit aria-hidden: die Marke steht immer neben dem
 * ausgeschriebenen Namen, ein zweiter zugaenglicher Name daneben wuerde
 * doppelt vorgelesen.
 */
export function HsbKeyLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 28.4967 33.7767"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5.28333 3.68333L8.96667 0L12.65 3.68333L8.96667 7.36667L5.28333 3.68333Z" />
      <path d="M10.5633 8.96333L14.2467 5.28L17.93 8.96333L14.2467 12.6467L10.5633 8.96333Z" />
      <path d="M0 8.96333L3.68333 5.28L12.65 14.2467L8.96667 17.93L0 8.96333Z" />
      <path d="M19.53 28.4933L14.2467 33.7767L10.5633 30.0933L15.8467 24.81L10.5633 19.53L14.2467 15.8467L19.53 21.1267L24.8133 15.8467L28.4967 19.53L23.2133 24.81L28.4967 30.0933L24.8133 33.7767L19.53 28.4933Z" />
    </svg>
  )
}
