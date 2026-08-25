import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"

import type { DashboardResponse, Role, UserStatus } from "@/api/types"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

const ROLE_ORDER: Record<Role, number> = { ADMIN: 1, STUDENT: 2, EDITOR: 3 }
const STATUS_ORDER: Record<UserStatus, number> = {
  ACTIVE: 1,
  REGISTRATION_PENDING: 2,
  DEACTIVATED: 3,
}

const ROLES = (Object.keys(ROLE_ORDER) as Role[]).sort(
  (a, b) => ROLE_ORDER[a] - ROLE_ORDER[b]
)
const USER_STATUSES = (Object.keys(STATUS_ORDER) as UserStatus[]).sort(
  (a, b) => STATUS_ORDER[a] - STATUS_ORDER[b]
)

/**
 * Die Karte „Nutzerstatistik" (Template „Dashboard", KAN-38): je Zeile eine
 * Beschriftung links und ihre Zahl rechts.
 *
 * <p><strong>Vier Zeilen zeichnet der Frame, sieben stehen hier.</strong>
 * Gezeichnet sind {@code usersTotal} und die drei Rollen aus
 * {@code usersByRole}. Dazu kommen die drei Kontostatus aus
 * {@code usersByStatus} und die offenen Top-10-Vorschlaege
 * ({@code openNominations}), beide aus dem Ticketumfang und in der
 * Klaerungsrunde zu KAN-38 entschieden. Sie stehen unter einer Trennlinie und
 * nicht zwischen den Rollen: der Frame gruppiert nach Zugehoerigkeit, und ein
 * Kontostatus beantwortet eine andere Frage als eine Rolle.
 * {@code blocksByType} bleibt draussen, ebenfalls entschieden.
 *
 * <p><strong>Die offenen Vorschlaege sind der einzige Handlungsbedarf auf
 * dieser Seite</strong> und deshalb die einzige verlinkte Zeile: sie fuehrt in
 * die Top-10-Verwaltung, wo darueber entschieden wird (KAN-40).
 *
 * <p><strong>Eine Beschreibungsliste, keine Tabelle.</strong> Jede Zeile ist
 * ein Begriff mit genau einem Wert; {@code dl} sagt das aus, ein
 * {@code div}-Paar mit {@code justify-between} saehe nur so aus (SC 1.3.1).
 */
export function UserStatisticsCard({
  data,
  isPending,
  numberFormat,
}: {
  data: DashboardResponse | undefined
  isPending: boolean
  numberFormat: Intl.NumberFormat
}) {
  const { t } = useTranslation()

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <h2 className="type-label-xs font-medium tracking-widest text-muted-foreground uppercase">
          {t("administration.dashboard.users.title")}
        </h2>

        {isPending ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-6 rounded-control" />
            ))}
          </div>
        ) : (
          <dl className="flex flex-col gap-2.5">
            <StatRow
              label={t("administration.dashboard.users.total")}
              value={
                data === undefined ? "" : numberFormat.format(data.usersTotal)
              }
            />
            {/* rolePlural statt role: die Zeile zaehlt Konten, „Admins" und
                nicht „Admin". Ein zweiter Schluesselraum ueber demselben
                Enum, kein zweiter Text je Seite (Frontend-Regel 7). */}
            {ROLES.map((role) => (
              <StatRow
                key={role}
                label={t(`user.rolePlural.${role}`)}
                value={
                  data === undefined
                    ? ""
                    : numberFormat.format(data.usersByRole[role])
                }
              />
            ))}

            <Separator className="my-1" />

            {USER_STATUSES.map((status) => (
              <StatRow
                key={status}
                label={t(`user.status.${status}`)}
                value={
                  data === undefined
                    ? ""
                    : numberFormat.format(data.usersByStatus[status])
                }
              />
            ))}

            <Separator className="my-1" />

            <StatRow
              label={t("administration.dashboard.openNominations")}
              value={
                data === undefined
                  ? ""
                  : numberFormat.format(data.openNominations)
              }
              to="/administration/top10"
            />
          </dl>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Eine Zeile der Liste. Mit {@code to} wird die Beschriftung zum Link; der
 * Wert bleibt Text, damit die Zahl nicht mit angeklickt wird.
 */
function StatRow({
  label,
  value,
  to,
}: {
  label: string
  value: string
  to?: string
}) {
  return (
    /* Der Begriff traegt den Link, nicht die ganze Zeile: ein Linkziel, das
       die Zahl einschliesst, laese sich mit Screenreader als „Offene
       Vorschlaege 5" vor, und die 5 waere Teil des Linktextes. */
    <div className="flex items-baseline justify-between gap-4">
      <dt className="type-body-sm">
        {to ? (
          <Link
            to={to}
            className="text-primary hover:text-primary-hover hover:underline"
          >
            {label}
          </Link>
        ) : (
          label
        )}
      </dt>
      <dd className="type-body-sm font-semibold tabular-nums">{value}</dd>
    </div>
  )
}
