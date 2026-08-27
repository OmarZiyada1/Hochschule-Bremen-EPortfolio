import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import type { Role, UserStatus } from "@/api/types"
import { Pill } from "@/components/common/Pill"
import { RoleBadge } from "@/components/common/RoleBadge"
import { TruncatedLink, TruncatedText } from "@/components/common/TruncatedText"
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
 *
 * <p><strong>Jeder Texteintrag ist auf zwanzig Zeichen Breite
 * geklemmt</strong> (KAN-83): Name, Anmeldeadresse, HSB-Adresse und
 * Anlegezeitpunkt laufen ueber {@link TruncatedText} bzw.
 * {@link TruncatedLink}, die Begruendung und die Ausnahmen stehen dort.
 * Geklemmt und nicht geschnitten: Der volle Text steht im Dokument, ist also
 * markierbar, kopierbar und auffindbar, und der Name des Links ist genau das,
 * was auch zu sehen ist. Rolle und Status bleiben unangetastet, weil dort eine
 * Marke aus fester Auswahl steht und kein Datensatz.
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
          {/* min-w-0: Diese Spalte ist ein Flex-Element neben dem Avatar und
              haette sonst als Mindestbreite ihren eigenen Inhalt. Erst ohne
              diese Untergrenze darf der Deckel von zwanzig Zeichen darin
              ueberhaupt greifen (KAN-83). */}
          <div className="flex min-w-0 flex-col">
            <span className="font-semibold">
              {userId === undefined ? (
                <TruncatedText text={fullNameOf(person)} />
              ) : (
                <TruncatedLink
                  text={fullNameOf(person)}
                  to={`/portfolios/${userId}`}
                  state={origin}
                  className="hover:underline focus-visible:underline"
                />
              )}
            </span>
            <span className="type-caption text-muted-foreground">
              <TruncatedText text={email} />
            </span>
          </div>
        </div>
      </TableCell>
      {/* Ohne break-all: Die Adresse ist auf zwanzig Zeichen geklemmt und
          zieht die Spalte nicht mehr auf, und ein Umbruch mitten im Wort
          machte aus der einen Zeile wieder zwei. */}
      {hsbEmail !== undefined && (
        <TableCell>
          <TruncatedText text={hsbEmail} />
        </TableCell>
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
      {/* whitespace-nowrap bleibt an der Zelle: Ein Datum gehoert in eine
          Zeile. Die Klemmung greift hier ohnehin nie, weil das laengste
          Format der beiden Sprachen („27. Aug. 2026") deutlich unter zwanzig
          Zeichen bleibt. */}
      {createdAt !== undefined && (
        <TableCell className="whitespace-nowrap">
          <TruncatedText text={createdAt} />
        </TableCell>
      )}
      <TableCell className="text-right">{actions}</TableCell>
    </TableRow>
  )
}
