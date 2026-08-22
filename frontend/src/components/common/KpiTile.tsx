import type { ReactNode } from "react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/**
 * Kennzahlkachel der Startseite und der Administrationsseite (Figma
 * "Stat Card"): Symbol, Zahl in der Schriftrolle type-num-stat
 * (--fs-num-stat), Beschriftung und eine Zeile fuer die Veraenderung.
 *
 * Formatiert wird die Zahl beim Aufrufer ueber die i18n-Formatierung, nicht
 * hier: die Kachel weiss nicht, ob sie Projekte oder Prozent zeigt. Aus
 * demselben Grund ist trend eine fertige Zeichenkette und keine Zahl mit
 * Vorzeichen: ob eine Veraenderung gut oder schlecht ist, entscheidet die
 * Kennzahl, nicht die Kachel.
 *
 * Symbol und Veraenderung sind beide optional, weil nicht jede Kennzahl
 * eine Vergleichsperiode hat.
 *
 * Die Variante plain zeigt dieselbe Kennzahl ohne Kartenflaeche, zentriert
 * und mit Versalbeschriftung: so fuehrt die CTA-Sektion der Startseite ihre
 * drei Zahlen (Template "Startseite (Oeffentlich)", KAN-31). Gleiche
 * Domaene, andere Flaeche; deshalb eine Variante dieser Huelle und keine
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
  variant?: "card" | "plain"
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

  return (
    <Card className={cn("rounded-modal", className)}>
      <CardContent className="flex flex-col gap-1.5">
        {icon && (
          <span
            aria-hidden="true"
            className="flex size-10 items-center justify-center rounded-card text-primary [&>svg]:size-5"
          >
            {icon}
          </span>
        )}
        <p className="type-num-stat font-extrabold text-accent-foreground tabular-nums">
          {value}
        </p>
        <p className="type-body-sm font-medium text-muted-foreground">
          {label}
        </p>
        {trend && (
          <p className="type-label-xs text-muted-foreground">{trend}</p>
        )}
      </CardContent>
    </Card>
  )
}
