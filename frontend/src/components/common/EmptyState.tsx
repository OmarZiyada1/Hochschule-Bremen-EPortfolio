import type { ReactNode } from "react"

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

/**
 * Leerzustand einer Liste oder Ansicht: Erklaerung und, wo sinnvoll, eine
 * Handlung. Eine leere Flaeche ist kein Zustand, sondern ein uebersehener
 * Fall. Die Texte kommen beim Aufrufer aus i18n; diese Komponente legt nur
 * die Struktur fest, damit der Leerzustand ueberall gleich aussieht.
 *
 * EmptyTitle rendert wie jede Title-Primitive der Registry ein div. Die
 * Ueberschriftenebene ist deshalb Sache dieser Huelle, so wie ProjectCard sie
 * fuer CardTitle setzt: sonst findet die Sprungnavigation eines Screenreaders
 * auf einer gefilterten Liste ohne Treffer ueberhaupt nichts (SC 1.3.1,
 * Contract 2.5 beschraenkt die Ebenen auf 1 bis 3).
 *
 * Ebene 1 ist fuer Seiten gedacht, deren gesamter Inhalt der Leerzustand
 * ist, etwa die Kein-Zugriff-Seite aus KAN-7; in Listen und Abschnitten
 * bleibt es bei 2 oder 3.
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  headingLevel = 2,
  className,
}: {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
  /** Ebene der Ueberschrift, passend zur Seite darum herum. */
  headingLevel?: 1 | 2 | 3
  className?: string
}) {
  const Heading = `h${headingLevel}` as "h1" | "h2" | "h3"
  return (
    <Empty className={className}>
      <EmptyHeader>
        {icon && <EmptyMedia variant="icon">{icon}</EmptyMedia>}
        <EmptyTitle>
          <Heading>{title}</Heading>
        </EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  )
}
