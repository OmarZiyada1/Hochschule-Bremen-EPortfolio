import { cn } from "@/lib/utils"

/**
 * Ein Zaehler an einer Beschriftung: die Zahl in einem Kreis, daneben nichts
 * (Figma, Muster der Filterleiste).
 *
 * <p><strong>Ein Kreis und keine Ellipse</strong> (Vorgabe zu KAN-80): die
 * Zahl steht mittig in einer quadratischen Flaeche ({@code h-4.5} zu
 * {@code min-w-4.5}), statt aus einer Polsterung links und rechts eine
 * liegende Form zu machen. Ab zwei Ziffern wird daraus eine Pille, und das
 * ist richtig so: eine Zwoelf in einem Kreis von 18px waere nicht mehr
 * lesbar.
 *
 * <p><strong>{@code shrink-0} haelt ihn rund.</strong> Ohne das ist der
 * Zaehler ein schrumpfbares Flex-Kind: bei einer langen Beschriftung und
 * schmaler Leiste ging seine Breite unter das Mindestmass, waehrend
 * {@code h-4.5} die Hoehe hielt, und aus dem Kreis wurde ein stehendes Oval.
 * Genau das war auf schmalen Bildschirmen zu sehen.
 *
 * <p><strong>{@code primary} statt {@code surface-brand}</strong> (KAN-83):
 * im dunklen Modus faellt {@code surface-brand} mit der Kartenflaeche
 * zusammen, auf der die Filterleiste liegt, und zwar auf denselben Rohwert;
 * auch die Schriftrolle faellt zusammen. Uebrig blieb eine fette Ziffer ohne
 * jeden Kreis. Derselbe Fehler und dieselbe Loesung wie am Fortschrittsbalken
 * der Registrierung (Review zu KAN-33). {@code primary} ist die einzige
 * Markenrolle, die in beiden Modi zur Kartenflaeche Abstand haelt.
 *
 * <p><strong>Die nackte Ziffer ist fuer Hilfsmittel nichts.</strong>
 * Vorgelesen wird der ganze Satz aus {@code label}, die sichtbare Zahl ist
 * {@code aria-hidden} (SC 1.3.1). Uebersetzt wird beim Aufrufer: dieser
 * Baustein weiss nicht, was er zaehlt.
 *
 * <p><strong>Nicht die Registry-Primitive {@code badge}.</strong> Die ist auf
 * Text gebaut ({@code h-5 w-fit} mit waagerechter Polsterung) und ergibt eine
 * Ellipse; hier geht es um eine Zahl in einer runden Flaeche. Der Unterschied
 * ist die Form, nicht die Farbe, und deshalb hilft keine Variante davon.
 */
export function CountBadge({
  count,
  label,
  tone = "default",
  className,
}: {
  count: number
  /** Vorgelesener Satz, fertig uebersetzt, etwa „3 offene Anfragen". */
  label: string
  /**
   * {@code inverted} auf einer Flaeche, die selbst {@code bg-primary} traegt,
   * etwa dem aktiven Eintrag der Seitennavigation: dort verschwaende der
   * gewoehnliche Ton spurlos. Vordergrund- und Flaechenrolle tauschen, der
   * Kontrast bleibt derselbe (SC 1.4.3).
   */
  tone?: "default" | "inverted"
  className?: string
}) {
  return (
    <span
      className={cn(
        "type-label-xs inline-flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-pill px-1 leading-none font-bold normal-case",
        tone === "inverted"
          ? "bg-primary-foreground text-primary"
          : "bg-primary text-primary-foreground",
        className
      )}
    >
      <span className="sr-only">{label}</span>
      <span aria-hidden="true">{count}</span>
    </span>
  )
}
