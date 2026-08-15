import type { ReactNode } from "react"

import type { ProjectReference, ProjectStatus } from "@/api/types"
import { StatusBadge } from "@/components/common/StatusBadge"
import { TableCell, TableRow } from "@/components/ui/table"
import { fullNameOf, type PersonName } from "@/lib/name"

/**
 * Projektzeile der Tabellenansichten (Figma "Table Data Row"): Meine
 * Reviews, Projekte der Administrationsseite und das Top-10-Protokoll.
 *
 * Die Spalten entsprechen ProjectCardResponse (§6.1); die Kopfzeile bleibt
 * die Primitive, weil ihre Beschriftungen zur Seite gehoeren und nicht zur
 * Zeile. Eine Huelle um TableHead traege kein Domaenenwissen und waere nur
 * eine zweite Stelle zum Pflegen, aus demselben Grund, aus dem der
 * Breadcrumb keine bekommt.
 *
 * actions ist ein Platz und keine fertige Aktion: welche Handlungen an
 * einer Zeile haengen, entscheidet die Rechtematrix je Seite (§5). Die
 * Zeile weiss davon nichts.
 */
export function ProjectTableRow({
  title,
  author,
  studyProgram,
  semester,
  status,
  href,
  actions,
}: {
  title: string
  author?: PersonName | null
  studyProgram?: ProjectReference | null
  semester?: string | null
  status?: ProjectStatus
  href?: string
  actions?: ReactNode
}) {
  return (
    <TableRow>
      <TableCell className="font-semibold">
        {href ? (
          <a href={href} className="hover:underline focus-visible:underline">
            {title}
          </a>
        ) : (
          title
        )}
      </TableCell>
      <TableCell>{author ? fullNameOf(author) : null}</TableCell>
      <TableCell className="text-muted-foreground">
        {studyProgram?.name}
      </TableCell>
      <TableCell className="text-muted-foreground">{semester}</TableCell>
      <TableCell>{status && <StatusBadge status={status} />}</TableCell>
      <TableCell className="text-right">{actions}</TableCell>
    </TableRow>
  )
}
