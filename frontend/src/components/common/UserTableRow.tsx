import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import type { Role, UserStatus } from "@/api/types"
import { Pill } from "@/components/common/Pill"
import { RoleBadge } from "@/components/common/RoleBadge"
import { UserAvatar } from "@/components/common/UserAvatar"
import { UserStatusBadge } from "@/components/common/UserStatusBadge"
import { TableCell, TableRow } from "@/components/ui/table"
import { fullNameOf, type PersonName } from "@/lib/name"
import { useBreadcrumbOrigin } from "@/routes/useBreadcrumb"

/**
 * Nutzerzeile der Administrationsseite (Figma "User Row"): Avatar, Name
 * und E-Mail, Rolle, Aktionen.
 *
 * Die gezeigte Adresse in {@code email} ist die Anmeldeadresse aus §3.1.
 *
 * actions ist wie in der Projektzeile nur ein Platz; welche Handlungen dort
 * erscheinen, entscheidet die Seite anhand der Rechtematrix (§5).
 *
 * <p><strong>Drei Spalten sind seit KAN-39 zuschaltbar</strong>, und die
 * Zeile bleibt ohne sie genau die alte: {@code hsbEmail}, {@code status} und
 * {@code createdAt} erscheinen nur, wenn die Seite sie mitgibt. Erweitert
 * statt daneben nachgebaut, weil eine zweite Nutzerzeile beim naechsten
 * Feinschliff auseinanderliefe (Befund aus KAN-7).
 *
 * <p><strong>hsbEmail steht ausschliesslich in der
 * Nutzerverwaltung.</strong> §3.1 laesst die HSB-Adresse fremder Konten
 * genau dort ausgeben; jede andere Ansicht dieser Zeile laesst die Prop weg,
 * und dann gibt es die Spalte nicht.
 *
 * <p><strong>Der Name fuehrt zum Portfolio</strong> (KAN-80), sobald der
 * Aufrufer die {@code userId} mitgibt. Namen sind in dieser Anwendung
 * ueberall Wege zu einer Person, an der Projektkachel wie hier; die Zeile
 * ohne ID bleibt reiner Text, denn ein Link ohne Ziel ist keiner. Anders als
 * die Projektzeile wird die Nutzerzeile <strong>nicht</strong> als Ganzes
 * anklickbar: Sie traegt Auswahl und Menue, und ein Klick daneben oeffnete
 * eine fremde Seite mitten in der Verwaltung.
 */
export function UserTableRow({
  person,
  userId,
  email,
  role,
  avatarUrl,
  hsbEmail,
  status,
  passwordChangeRequired = false,
  createdAt,
  actions,
}: {
  person: PersonName
  /** ID der Person; ohne sie bleibt der Name unverlinkter Text. */
  userId?: string
  email: string
  role: Role
  avatarUrl?: string | null
  /** Hochschuladresse, nur in der Nutzerverwaltung (§3.1). */
  hsbEmail?: string
  /** Kontostatus (§2.9). Ohne Angabe entfaellt die Spalte. */
  status?: UserStatus
  /**
   * Traegt das Konto noch ein administrativ gesetztes Initialpasswort
   * (§6.7)? Wirkt nur zusammen mit {@code status}: der Hinweis steht als
   * zweite Marke in derselben Zelle, weil er den Status naeher bestimmt und
   * keine eigene Spalte fuellt.
   */
  passwordChangeRequired?: boolean
  /** Anlegezeitpunkt, bereits in der Sprache der lesenden Person. */
  createdAt?: string
  actions?: ReactNode
}) {
  const { t } = useTranslation()
  const origin = useBreadcrumbOrigin()

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <UserAvatar person={person} imageUrl={avatarUrl} size="lg" />
          <div className="flex flex-col">
            <span className="font-semibold">
              {userId === undefined ? (
                fullNameOf(person)
              ) : (
                <Link
                  to={`/portfolios/${userId}`}
                  state={origin}
                  className="hover:underline focus-visible:underline"
                >
                  {fullNameOf(person)}
                </Link>
              )}
            </span>
            <span className="type-caption text-muted-foreground">{email}</span>
          </div>
        </div>
      </TableCell>
      {hsbEmail !== undefined && (
        <TableCell className="break-all">{hsbEmail}</TableCell>
      )}
      <TableCell>
        <RoleBadge role={role} />
      </TableCell>
      {status !== undefined && (
        <TableCell>
          <div className="flex flex-wrap items-center gap-1.5">
            <UserStatusBadge status={status} />
            {passwordChangeRequired && (
              <Pill tone="warning">{t("user.passwordChangeRequired")}</Pill>
            )}
          </div>
        </TableCell>
      )}
      {createdAt !== undefined && (
        <TableCell className="whitespace-nowrap">{createdAt}</TableCell>
      )}
      <TableCell className="text-right">{actions}</TableCell>
    </TableRow>
  )
}
