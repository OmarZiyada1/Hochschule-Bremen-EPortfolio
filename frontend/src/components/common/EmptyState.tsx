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
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <Empty className={className}>
      <EmptyHeader>
        {icon && <EmptyMedia variant="icon">{icon}</EmptyMedia>}
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  )
}
