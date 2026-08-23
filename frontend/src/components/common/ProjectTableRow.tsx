import type { ReactNode } from "react"

import type { ProjectReference, ProjectStatus } from "@/api/types"
import { StatusBadge } from "@/components/common/StatusBadge"
import { TableCell, TableRow } from "@/components/ui/table"
import { fullNameOf, type PersonName } from "@/lib/name"

/**
 * Projektzeile der Tabellenansichten (Figma "Table Data Row"): Meine
 * Reviews, Projekte der Administrationsseite und das Top-10-Protokoll.
 *
 * Die Spalte „Fach" kam mit KAN-37 dazu, zusammen mit dem Feld module an
 * der Kachel (Contract v68, §3.9): „Meine Reviews" zeigt sie nach Template,
 * und ohne das Feld waere sie nicht fuellbar gewesen. Sie ist optional wie
 * die uebrigen; wer sie nicht setzt, bekommt eine leere Zelle und keine
 * verschobene Tabelle.
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
  module,
  status,
  href,
  actions,
}: {
  title: string
  author?: PersonName | null
  studyProgram?: ProjectReference | null
  semester?: string | null
  module?: ProjectReference | null
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
      <TableCell className="text-muted-foreground">{module?.name}</TableCell>
      <TableCell>{status && <StatusBadge status={status} />}</TableCell>
      <TableCell className="text-right">{actions}</TableCell>
    </TableRow>
  )
}
