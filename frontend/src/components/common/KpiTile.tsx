import type { ReactNode } from "react"

import { Card, CardContent } from "@/components/ui/card"

/**
 * Kennzahlkachel der Startseite und der Administrationsseite: eine Zahl in
 * der Schriftrolle type-num-stat (--fs-num-stat) plus ihre Beschriftung.
 * Formatiert wird die Zahl beim Aufrufer ueber die i18n-Formatierung,
 * nicht hier: die Kachel weiss nicht, ob sie Projekte oder Prozent zeigt.
 */
export function KpiTile({
  value,
  label,
  className,
}: {
  value: ReactNode
  label: string
  className?: string
}) {
  return (
    <Card size="sm" className={className}>
      <CardContent className="flex flex-col gap-1">
        <p className="type-num-stat tabular-nums">{value}</p>
        <p className="type-body-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  )
}
