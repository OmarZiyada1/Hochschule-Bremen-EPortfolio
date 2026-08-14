import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/**
 * Projektstatus nach API-Contract 2.2. Der Wert laeuft unveraendert durch
 * den Code; uebersetzt wird nur die Anzeige, ueber project.status.<WERT>.
 * Sobald KAN-30 die generierte schema.d.ts liefert, kommt der Typ von dort
 * und diese Definition entfaellt.
 */
export type ProjectStatus =
  "DRAFT" | "SUBMITTED" | "APPROVED" | "PUBLISHED" | "REVISION"

/*
 * Record ueber den Enum-Typ, bewusst ohne Standardzweig: ein sechster Status
 * bricht den Typecheck, sobald er im Typ steht, statt still auf Grau
 * zurueckzufallen. Solange ProjectStatus oben von Hand gefuehrt wird, greift
 * das erst beim Nachtragen; ab KAN-30 kommt der Typ aus der generierten
 * schema.d.ts und die Zusage traegt gegen den Contract selbst.
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
          von Status zu Farbe nur einmal aufgeschrieben ist. */}
      <span aria-hidden="true" className="size-1.5 rounded-pill bg-current" />
      {t(`project.status.${status}`)}
    </Badge>
  )
}
