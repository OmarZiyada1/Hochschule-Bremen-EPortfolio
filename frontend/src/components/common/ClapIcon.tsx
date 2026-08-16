/**
 * Klatschende Hand, das Symbol der Reaktionszahl (Figma "Project Card",
 * Ebene "icon"). Die Reaktion auf ein Projekt ist ein Applaus wie auf der
 * Referenzplattform der HfG Schwaebisch Gmuend, kein Gefaellt-mir; das Herz
 * an dieser Stelle war der Befund.
 *
 * Sie ist die zweite Ausnahme von der Regel, dass Symbole aus lucide-react
 * kommen, und die Ausnahme ist geprueft und nicht bequem: die Symbolnamen
 * beider verfuegbaren Fassungen wurden durchsucht (1.30.0 mit 2022, 1.31.0
 * mit 2025 Symbolen), und ein Klatsch-Symbol gibt es in keiner. Zu "clap",
 * "applause" oder "hands" finden sich allein clapperboard, handshake und
 * heart-handshake. Ein Aktualisieren des Pakets loest das Problem also
 * nicht, und ein danebenliegendes lucide-Symbol (thumbs-up, party-popper)
 * waere eine stille Abweichung von der Vorlage.
 *
 * Die Pfade stehen unveraendert wie in Figma, nur vom dortigen 14er-Raster
 * auf die 24er-viewBox von lucide umgerechnet (Faktor 24/14). Strichstaerke
 * 2, runde Enden und Ecken sowie currentColor entsprechen damit exakt den
 * uebrigen Symbolen; die Kachel setzt die Groesse wie bei jedem
 * lucide-Symbol ueber eine size-Klasse.
 *
 * Ohne Titel und mit aria-hidden: die Zahl daneben traegt ihren Sinn schon
 * als vorgelesener Satz ("128 Reaktionen"), ein zweiter Name hier wuerde
 * doppelt vorgelesen.
 */
export function ClapIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* Drei Finger, von innen nach aussen */}
      <path d="M11 5.5V3a1.5 1.5 0 0 1 3 0v5" />
      <path d="M14 6.5V2.5a1.5 1.5 0 0 1 3 0V9" />
      {/* Daumen und Handflaeche in einem Zug */}
      <path d="M17 7.5a1.5 1.5 0 0 1 3 0v7a6.5 6.5 0 0 1-13 0V8a1.5 1.5 0 0 1 3 0v3" />
      {/* Bewegungsstriche: sie machen aus der Hand erst das Klatschen */}
      <path d="m5 3 1.5 2" />
      <path d="m3 8 2 .5" />
      <path d="m5 13 1.5-1" />
    </svg>
  )
}
