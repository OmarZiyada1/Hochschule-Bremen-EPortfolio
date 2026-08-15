import type { ReactNode } from "react"

import { RoleBadge, type Role } from "@/components/common/RoleBadge"
import { UserAvatar } from "@/components/common/UserAvatar"
import { TableCell, TableRow } from "@/components/ui/table"
import { fullNameOf, type PersonName } from "@/lib/name"

/**
 * Nutzerzeile der Administrationsseite (Figma "User Row"): Avatar, Name
 * und E-Mail, Rolle, Aktionen.
 *
 * Die gezeigte Adresse ist die Anmeldeadresse aus §3.1, nie hsbEmail: das
 * Feld verlaesst den Server nicht und steht deshalb auch in keiner Prop.
 *
 * actions ist wie in der Projektzeile nur ein Platz; welche Handlungen dort
 * erscheinen, entscheidet die Seite anhand der Rechtematrix (§5).
 */
export function UserTableRow({
  person,
  email,
  role,
  avatarUrl,
  actions,
}: {
  person: PersonName
  email: string
  role: Role
  avatarUrl?: string | null
  actions?: ReactNode
}) {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <UserAvatar person={person} imageUrl={avatarUrl} size="lg" />
          <div className="flex flex-col">
            <span className="font-semibold">{fullNameOf(person)}</span>
            <span className="type-caption text-muted-foreground">{email}</span>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <RoleBadge role={role} />
      </TableCell>
      <TableCell className="text-right">{actions}</TableCell>
    </TableRow>
  )
}
