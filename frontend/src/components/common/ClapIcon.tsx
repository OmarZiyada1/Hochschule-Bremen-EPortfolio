import type { Ref } from "react"

import clapFilled from "@/assets/clap-filled.png"
import clapOutline from "@/assets/clap-outline.png"
import { cn } from "@/lib/utils"

/**
 * Zwei klatschende Haende, das Symbol der Reaktionszahl. Die Reaktion auf ein
 * Projekt ist ein Applaus wie auf der Referenzplattform der HfG Schwaebisch
 * Gmuend, kein Gefaellt-mir; das Herz an dieser Stelle war der Befund.
 *
 * <p>Es ist die zweite Ausnahme von der Regel, dass Symbole aus lucide-react
 * kommen, und die Ausnahme ist geprueft und nicht bequem: die Symbolnamen
 * beider verfuegbaren Fassungen wurden durchsucht (1.30.0 mit 2022, 1.31.0 mit
 * 2025 Symbolen), und ein Klatsch-Symbol gibt es in keiner. Zu "clap",
 * "applause" oder "hands" finden sich allein clapperboard, handshake und
 * heart-handshake.
 *
 * <p><strong>Herkunft: zwei Rastergrafiken von Flaticon</strong> (Symbolsatz
 * „Clapping" von Smashicons, kostenloser Download mit Namensnennung),
 * abgelegt als {@code assets/clap-filled.png} und
 * {@code assets/clap-outline.png}. Beide sind reines Schwarz auf
 * durchsichtigem Grund, die Form steckt allein im Alphakanal. Welche der
 * beiden die gefuellte ist, ist gemessen und nicht geraten: die eine deckt
 * 42,2 Prozent ihrer Flaeche mit Tinte, die andere 20,3 Prozent. Die
 * Namensnennung, die die kostenlose Flaticon-Lizenz verlangt, fuehrt
 * {@code NOTICE.md} im Wurzelverzeichnis; dort steht auch, warum sie nicht in
 * dieser Datei stehen kann und wo sie hingehoert.
 *
 * <p><strong>Eingebunden als CSS-Maske und nicht als {@code img}.</strong> Ein
 * {@code img} traegt seine Farbe im Bild. Die Grafiken sind reines Schwarz;
 * im Dunkelmodus stuende ein schwarzes Symbol auf dunklem Grund, und der
 * aktive Zustand koennte nicht {@code text-primary} annehmen. Frontend-Regel 5
 * verlangt ausserdem, dass Farbe aus der Tokenschicht kommt. Die Maske loest
 * beides ohne Verlust: {@code mask-image} nimmt den Alphakanal der PNG als
 * Form, {@code background-color: currentColor} gibt die Farbe. Gefaerbt wird
 * damit weiter ueber die Textfarbe des Elternelements, genau wie zuvor ueber
 * {@code fill="currentColor"}; die Aufrufe brauchen keine andere Klasse.
 *
 * <p><strong>Kein nachgezeichneter Vektor.</strong> Eine automatische
 * Nachzeichnung einer kantengeglaetteten Rastergrafik weicht sichtbar vom
 * Original ab, und von Hand nachzuzeichnen hiesse, fremde Grafik nachzubauen.
 * Als Maske bleibt die Zeichnung pixelgenau die gelieferte.
 *
 * <p><strong>Am Element steht nur die Quelle als Inline-Stil.</strong> Der
 * Dateiname entsteht erst beim Bauen, weil Vite beide Grafiken mit einem Hash
 * ausliefert; er ist also keine Konstante, die in eine Klasse passt. Eine URL
 * ist keine Farbe, Frontend-Regel 5 ist davon nicht beruehrt. Alles Uebrige
 * (Anzeigeart, Wiederholung, Position, Groessenanpassung der Maske und die
 * Faerbung) steht genau einmal als {@code .clap-icon} in {@code index.css},
 * dort auch in der {@code -webkit-}-Schreibweise fuer aeltere WebKit-Fassungen.
 *
 * <p><strong>Die Groesse bleibt von aussen bestimmbar.</strong> Die Vorgabe
 * {@code size-4} laeuft ueber {@code cn} und faellt weg, sobald der Aufruf
 * eine eigene {@code size-*}-Klasse mitbringt. Sie ist noetig, seit das
 * Element ein {@code span} ist: die Regel
 * {@code [&_svg:not([class*='size-'])]:size-4} aus {@code button.tsx} traf
 * bisher jedes Symbol im Knopf, greift auf ein {@code span} aber nicht mehr.
 *
 * <p><strong>Die Marke {@code data-clap} ist ein Angriffspunkt fuer die
 * Animation</strong> und keine Gestaltung: sie benennt im DOM das Element, das
 * {@link ReactionPanel} beim Klatschen aufpoppen laesst (GSAP). Seit die
 * Grafik eine Maske ist, gibt es kein Innenleben mehr, an dem eine Bewegung
 * ansetzen koennte; bewegt wird das Symbol als Ganzes.
 *
 * <p>Ohne Titel und mit aria-hidden: die Zahl daneben traegt ihren Sinn schon
 * als vorgelesener Satz ("128 Reaktionen"), ein zweiter Name hier wuerde
 * doppelt vorgelesen.
 */
export function ClapIcon({
  className,
  filled = false,
  ref,
}: {
  className?: string
  /** Gefuellte Silhouette statt Kontur, fuer den aktiven Zustand. */
  filled?: boolean
  ref?: Ref<HTMLSpanElement>
}) {
  const mask = `url(${filled ? clapFilled : clapOutline})`

  return (
    <span
      ref={ref}
      data-clap="icon"
      aria-hidden="true"
      className={cn("clap-icon size-4", className)}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    />
  )
}
