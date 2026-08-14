import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/**
 * Badge fuer Kategorie, Modul, Studiengang und Fakultaet. Bewusst
 * einfarbig ueber --badge-neutral-*: Fakultaeten werden nicht farblich
 * codiert, unterschieden wird allein ueber die Beschriftung (Confluence
 * "Designentscheidungen", Abschnitt 2.4). Es gibt deshalb auch keine
 * Stelle, die facultyId auf eine Farbe abbildet.
 */
export function Tag({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <Badge className={cn("bg-badge-neutral-bg text-badge-neutral-fg", className)}>
      {children}
    </Badge>
  )
}
