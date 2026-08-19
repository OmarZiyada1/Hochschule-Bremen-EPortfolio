import type { Ref } from "react"

/**
 * Zwei klatschende Haende, das Symbol der Reaktionszahl (Figma "Project
 * Card", Ebene "icon"). Die Reaktion auf ein Projekt ist ein Applaus wie auf
 * der Referenzplattform der HfG Schwaebisch Gmuend, kein Gefaellt-mir; das
 * Herz an dieser Stelle war der Befund.
 *
 * <p>Es ist die zweite Ausnahme von der Regel, dass Symbole aus lucide-react
 * kommen, und die Ausnahme ist geprueft und nicht bequem: die Symbolnamen
 * beider verfuegbaren Fassungen wurden durchsucht (1.30.0 mit 2022, 1.31.0
 * mit 2025 Symbolen), und ein Klatsch-Symbol gibt es in keiner. Zu "clap",
 * "applause" oder "hands" finden sich allein clapperboard, handshake und
 * heart-handshake. Ein Aktualisieren des Pakets loest das Problem also
 * nicht, und ein danebenliegendes lucide-Symbol (thumbs-up, party-popper)
 * waere eine stille Abweichung von der Vorlage.
 *
 * <p><strong>Zwei Haende, eine Geometrie.</strong> Beide Haende sind
 * dieselbe Hand: die Pfade stehen unveraendert wie in Figma, nur vom
 * dortigen 14er-Raster auf die 24er-viewBox von lucide umgerechnet (Faktor
 * 24/14). Platziert werden sie ueber Transformationen, die linke gespiegelt.
 * Frei gezeichnete Zweithand-Formen waeren zwei Quellen fuer dieselbe
 * Silhouette und liefen beim naechsten Feinschliff auseinander.
 *
 * <p><strong>Zwei Fassungen, nicht eine mit CSS-Fuellung.</strong> Die
 * Konturfassung besteht aus offenen Pfaden; sie ueber {@code fill-current}
 * zu fuellen ergibt keine Silhouette, sondern legt Flaechen zwischen die
 * Strichenden und laesst die 2er-Kontur darum stehen. Das sah nach einem
 * dicker gewordenen Rand aus und war der Befund. Die gefuellte Fassung
 * fuehrt deshalb eigene, geschlossene Formen ohne Kontur.
 *
 * <p><strong>Die data-clap-Marken sind Angriffspunkte fuer die
 * Animation</strong> und keine Gestaltung: {@code ReactionPanel} sucht ueber
 * sie die beiden Haende und den Funkenkranz und bewegt sie beim Klatschen
 * (GSAP). Sie stehen hier, damit die Animation nicht von der Reihenfolge der
 * Gruppen abhaengt, die sich beim naechsten Feinschliff aendern kann. Ohne
 * Animation ergeben sie nichts und stoeren nichts.
 *
 * <p>Ohne Titel und mit aria-hidden: die Zahl daneben traegt ihren Sinn
 * schon als vorgelesener Satz ("128 Reaktionen"), ein zweiter Name hier
 * wuerde doppelt vorgelesen.
 */
export function ClapIcon({
  className,
  filled = false,
  ref,
}: {
  className?: string
  /** Gefuellte Silhouette statt Kontur, fuer den aktiven Zustand. */
  filled?: boolean
  ref?: Ref<SVGSVGElement>
}) {
  /*
   * Die Hand im Ausgangsraster, Mittelpunkt (13.5, 12). Beide Fassungen
   * teilen ihn, damit dieselbe Platzierung fuer beide gilt.
   */
  const hand = filled ? (
    <>
      <path d="M11 8V3a1.5 1.5 0 0 1 3 0v5Z" />
      <path d="M14 9V2.5a1.5 1.5 0 0 1 3 0V9Z" />
      <path d="M17 8V7.5a1.5 1.5 0 0 1 3 0v7a6.5 6.5 0 0 1-13 0V8a1.5 1.5 0 0 1 3 0Z" />
    </>
  ) : (
    <>
      <path d="M11 5.5V3a1.5 1.5 0 0 1 3 0v5" />
      <path d="M14 6.5V2.5a1.5 1.5 0 0 1 3 0V9" />
      <path d="M17 7.5a1.5 1.5 0 0 1 3 0v7a6.5 6.5 0 0 1-13 0V8a1.5 1.5 0 0 1 3 0v3" />
    </>
  )

  return (
    <svg
      ref={ref}
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* Linke Hand: gespiegelt und zur Mitte geneigt. Die aeussere Gruppe
          bleibt leer, damit die Animation sie bewegen kann, ohne die
          Platzierung darin zu ueberschreiben. */}
      <g data-clap="left">
        <g transform="translate(7.3 13.5) rotate(22) scale(-0.6 0.6) translate(-13.5 -12)">
          {hand}
        </g>
      </g>
      <g data-clap="right">
        <g transform="translate(16.7 13.5) rotate(-22) scale(0.6 0.6) translate(-13.5 -12)">
          {hand}
        </g>
      </g>

      {/* Der Funkenkranz macht aus zwei Haenden erst das Klatschen. Er bleibt
          in beiden Fassungen ein Strich: gefuellt ergaeben die offenen Pfade
          Dreiecke. */}
      <g
        data-clap="burst"
        fill="none"
        stroke="currentColor"
        strokeWidth={filled ? 1.6 : 2}
      >
        <path d="M12 3.6V2" />
        <path d="m6.9 5.1-1-1.3" />
        <path d="m17.1 5.1 1-1.3" />
      </g>
    </svg>
  )
}
