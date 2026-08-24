import { MailIcon } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { resolveApiUrl } from "@/api/client"
import type { Role } from "@/api/types"
import { RoleBadge } from "@/components/common/RoleBadge"
import { UserAvatar } from "@/components/common/UserAvatar"
import { Card, CardContent } from "@/components/ui/card"
import { fullNameOf, type PersonName } from "@/lib/name"

/**
 * Die Profilkarte aus den Templates "My Portfolio" und "Portfolio
 * (extern)": Avatar, Name, Rolle, Biografie und die private E-Mail als
 * Kontaktweg, darunter Platz fuer eine Handlung.
 *
 * <p>Eine Karte fuer beide Seiten, weil beide Templates denselben Baustein
 * zeigen; zwei Fassungen derselben Karte driften zuverlaessig auseinander
 * (Skill frontend-design, Abschnitt 2). Sie liegt trotzdem im Feature und
 * nicht in components/common: ausserhalb dieser drei Ansichten gibt es
 * keinen Verwender.
 *
 * <p><strong>Die Rolle ist optional, und das hat einen Grund.</strong>
 * Unter "My Portfolio" kommt sie aus dem Auth-Kontext. Das oeffentliche
 * Profil hat sie nicht: GET /portfolios/{userId} liefert
 * nach §6.1 nur id, firstName, lastName und email. Das Template zeigt dort
 * einen Rollen-Badge, der Contract gibt ihn nicht her; entschieden wurde in
 * der Klaerungsrunde zu KAN-34 fuer den Contract, also entfaellt der Badge
 * dort. Eine Attrappe waere die schlechtere Antwort (Frontend-Regel 10).
 *
 * <p>Die private E-Mail steht bewusst auch im oeffentlichen Profil (§3.2):
 * ein Portfolio ohne Kontaktweg erfuellt seinen Zweck nur halb. Die
 * HSB-Adresse erscheint hier nie (§3.1).
 */
export function ProfileCard({
  person,
  email,
  biography,
  avatarUrl,
  role,
  action,
  headingLevel = 2,
}: {
  person: PersonName
  /** Private E-Mail als Kontaktweg (§3.2); fehlt sie, entfaellt der Block. */
  email?: string | null
  biography?: string | null
  /** Referenz der Form /api/files/{id} (§3.15.1), nie eine Speicheradresse. */
  avatarUrl?: string | null
  /** Nur wo die Antwort sie fuehrt; im oeffentlichen Profil undefined. */
  role?: Role
  /** Etwa der Knopf "Profil bearbeiten" unter "My Portfolio". */
  action?: ReactNode
  headingLevel?: 2 | 3
}) {
  const { t } = useTranslation()
  const Heading = `h${headingLevel}` as "h2" | "h3"
  const name = fullNameOf(person)

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 px-6 py-2">
        {/* 96px nach Template (Figma-Knoten "Avatar" der Profilkarte). */}
        <UserAvatar
          person={person}
          imageUrl={avatarUrl ? resolveApiUrl(avatarUrl) : null}
          size="xl"
        />

        <Heading className="type-h3 text-center font-semibold">{name}</Heading>

        {role !== undefined && <RoleBadge role={role} />}

        {/*
          SC 1.4.10: eine Biografie ohne Leerzeichen darf die Karte nicht
          sprengen. Ohne Umbruchregel laeuft eine einzige lange Zeichenkette
          ueber den Kartenrand hinaus und der Rest ist schlicht nicht
          lesbar. wrap-anywhere und nicht break-words, weil der Absatz in
          einer Flex-Spalte liegt: break-word bricht zwar die Zeile, laesst
          die min-content-Breite des Absatzes aber unveraendert, sodass die
          Spalte im schmalen Ansichtsfenster weiterhin aufgezogen wird.
          break-all scheidet aus, das ist die Regel fuer die Adresse
          darunter und zerteilt auch gewoehnliche Woerter.
        */}
        {biography && (
          <p className="type-body-sm w-full wrap-anywhere text-muted-foreground">
            {biography}
          </p>
        )}

        {email && (
          <div className="flex w-full flex-col gap-1">
            {/* Die Beschriftung sagt, welche der beiden Adressen das ist.
                Ohne sie liest sich die Zeile wie eine Dienstadresse, und
                genau die steht hier nie (§3.1). */}
            <p className="type-label-xs text-muted-foreground uppercase">
              {t("portfolio.emailLabel")}
            </p>
            <a
              href={`mailto:${email}`}
              className="type-body-sm flex items-center gap-2 font-medium text-primary underline-offset-4 hover:underline focus-visible:underline"
            >
              <MailIcon aria-hidden="true" className="size-4 shrink-0" />
              <span className="break-all">{email}</span>
            </a>
          </div>
        )}

        {action && <div className="w-full pt-1">{action}</div>}
      </CardContent>
    </Card>
  )
}
