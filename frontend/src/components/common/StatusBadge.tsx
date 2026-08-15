import { useTranslation } from "react-i18next"

import type { ProjectStatus } from "@/api/types"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/*
 * Record ueber den Enum-Typ, bewusst ohne Standardzweig: ein sechster Status
 * bricht den Typecheck, sobald er im Typ steht, statt still auf Grau
 * zurueckzufallen. Der Typ kommt seit KAN-30 aus der generierten
 * schema.d.ts, die Zusage traegt damit gegen den Contract selbst (2.2).
 * Die Tokennamen tragen woertlich die Enum-Werte in
 * Kleinschreibung, deshalb braucht die Zuordnung keine Uebersetzungstabelle.
 * Jedes Paar nutzt sein eigenes -fg, nie muted-foreground: das sieht fast
 * gleich aus, verliert aber die geprüfte Kontrastzusage von 6,4 bis 7,2:1.
 */
const statusClasses: Record<ProjectStatus, string> = {
  DRAFT: "bg-status-draft-bg text-status-draft-fg",
  SUBMITTED: "bg-status-submitted-bg text-status-submitted-fg",
  APPROVED: "bg-status-approved-bg text-status-approved-fg",
  PUBLISHED: "bg-status-published-bg text-status-published-fg",
  REVISION: "bg-status-revision-bg text-status-revision-fg",
}

export function StatusBadge({
  status,
  className,
}: {
  status: ProjectStatus
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <Badge className={cn(statusClasses[status], className)}>
      {/* Der Punkt aus dem Design ist Zierat und wird nicht vorgelesen. Er
          traegt ueber bg-current die Farbe des Labels, damit die Zuordnung
          von Status zu Farbe nur einmal aufgeschrieben ist. shrink-0, weil
          das Badge eine Flex-Zeile mit whitespace-nowrap ist: in einer engen
          Tabellenspalte ist der Punkt sonst das einzige nachgebende Element
          und verschwindet, waehrend der Text stehen bleibt. */}
      <span
        aria-hidden="true"
        className="size-1.5 shrink-0 rounded-pill bg-current"
      />
      {t(`project.status.${status}`)}
    </Badge>
  )
}
