import type { ReactNode } from "react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/**
 * Kennzahlkachel der Startseite, der Administrationsseite und von „Meine
 * Reviews" (Figma "Stat Card").
 *
 * <p><strong>Ein Aufbau fuer alle Kennzahlen</strong> (Vorgabe zur
 * Nacharbeit): Symbol oben rechts in der Ecke, die Zahl gross links, das
 * Wort dazu rechts daneben auf halber Hoehe. Bis dahin stand auf dem
 * Dashboard eine zentrierte Saeule aus Zahl und Wort ohne Symbol und in
 * „Meine Reviews" ein Stapel aus Symbol, Zahl und Wort; dieselbe Auskunft
 * sah damit auf zwei Seiten verschieden aus. Die Schriftrollen sind
 * unveraendert: {@code type-num-stat} fuer die Zahl,
 * {@code type-body-sm} fuer die Beschriftung, und die Zahl traegt ueberall
 * denselben Textton.
 *
 * <p>Formatiert wird die Zahl beim Aufrufer ueber die i18n-Formatierung, nicht
 * hier: die Kachel weiss nicht, ob sie Projekte oder Prozent zeigt. Aus
 * demselben Grund ist trend eine fertige Zeichenkette und keine Zahl mit
 * Vorzeichen: ob eine Veraenderung gut oder schlecht ist, entscheidet die
 * Kennzahl, nicht die Kachel.
 *
 * <p>Symbol und Veraenderung sind beide optional, weil nicht jede Kennzahl
 * eine Vergleichsperiode hat.
 *
 * <p><strong>Drei Varianten, eine Huelle.</strong> {@code card} steht fuer
 * sich auf einer eigenen Kartenflaeche („Meine Reviews"). {@code tile} ist
 * dieselbe Kachel gerahmt statt auf eigener Flaeche, fuer die Reihen
 * <em>innerhalb</em> einer Karte (Dashboard); sie kam mit der
 * Vereinheitlichung dazu und loest die frueher dort eingebaute eigene
 * Kachel ab. {@code plain} zeigt dieselbe Kennzahl ohne Flaeche, zentriert
 * und mit Versalbeschriftung: so fuehrt die CTA-Sektion der Startseite ihre
 * drei Zahlen (Template "Startseite (Oeffentlich)", KAN-31). Gleiche
 * Domaene, andere Flaeche; deshalb Varianten dieser Huelle und keine
 * zweite Komponente daneben (Skill frontend-shadcn, Abschnitt 1).
 */
export function KpiTile({
  value,
  label,
  icon,
  trend,
  variant = "card",
  className,
}: {
  value: ReactNode
  label: string
  icon?: ReactNode
  trend?: string
  variant?: "card" | "tile" | "plain"
  className?: string
}) {
  if (variant === "plain") {
    return (
      <div
        className={cn(
          "flex flex-col items-center gap-1 text-center",
          className
        )}
      >
        <p className="type-num-stat font-extrabold text-accent-foreground tabular-nums">
          {value}
        </p>
        <p className="type-label-xs font-medium tracking-widest text-muted-foreground uppercase">
          {label}
        </p>
        {trend && (
          <p className="type-label-xs text-muted-foreground">{trend}</p>
        )}
      </div>
    )
  }

  /*
   * Zwei Spalten und das Symbol in der Ecke. Das Symbol steht als drittes
   * Flex-Kind mit ml-auto und self-start und nicht absolut positioniert: so
   * braucht die Kachel kein Innenabstandsmass, das zur Groesse des Symbols
   * passen muss, und die Beschriftung kann nie darunter geraten.
   */
  const body = (
    <div className="flex items-center gap-3">
      {/* Ein Textton fuer jede Kennzahl, auf jeder Seite (Vorgabe zur
          Nacharbeit). Eine Kachel bekam frueher ihre Farbe von aussen, und
          die Reihe auf dem Dashboard las sich dadurch, als sage die Farbe
          etwas ueber den Status; sie bildete nur die Position ab. */}
      <p className="type-num-stat font-extrabold text-accent-foreground tabular-nums">
        {value}
      </p>
      {/* min-w-0 laesst die Spalte unter ihre Inhaltsbreite schrumpfen, statt
          die Kachel breiter zu machen; wrap-anywhere bricht dann auch dort,
          wo kein Leerzeichen steht. Beides zusammen, weil min-w-0 allein ein
          langes Wort nicht bricht, sondern ueberlaufen laesst: derselbe
          Mechanismus wie im Inhaltsverzeichnis. */}
      <div className="flex min-w-0 flex-col">
        <p className="type-body-sm font-medium wrap-anywhere text-muted-foreground">
          {label}
        </p>
        {trend && (
          <p className="type-label-xs text-muted-foreground">{trend}</p>
        )}
      </div>
      {icon && (
        <span
          aria-hidden="true"
          className="ml-auto flex shrink-0 self-start text-primary [&>svg]:size-5"
        >
          {icon}
        </span>
      )}
    </div>
  )

  if (variant === "tile") {
    return (
      <div className={cn("rounded-card border px-4 py-3.5", className)}>
        {body}
      </div>
    )
  }

  return (
    <Card className={cn("rounded-modal", className)}>
      <CardContent>{body}</CardContent>
    </Card>
  )
}
