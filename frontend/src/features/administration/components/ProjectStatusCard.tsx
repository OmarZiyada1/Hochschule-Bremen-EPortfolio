import { useTranslation } from "react-i18next"

import type { DashboardResponse, ProjectStatus } from "@/api/types"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { OWN_PROJECT_STATUSES } from "@/features/portfolio/ownProjectStatus"
import { cn } from "@/lib/utils"

/** Sechs Platzhalter: die Summe und die fuenf Status. */
const SKELETON_TILES = [0, 1, 2, 3, 4, 5]

const STATUS_TONE: Record<ProjectStatus, string> = {
  DRAFT: "text-status-draft-fg",
  SUBMITTED: "text-status-submitted-fg",
  APPROVED: "text-status-approved-fg",
  PUBLISHED: "text-status-published-fg",
  REVISION: "text-status-revision-fg",
}

/**
 * Die Karte „Alle Projekte im System" (Template „Dashboard", KAN-38): sechs
 * Kacheln, die Summe vorweg und dahinter die fuenf Status aus §2.2.
 *
 * <p><strong>Die Summe ist gerechnet, nicht geliefert.</strong> §6.1 kennt
 * keine Gesamtzahl der Projekte, wohl aber {@code projectsByStatus} mit jedem
 * Wert des Enums, auch den Nullen (Contract v26). Die Summe darueber ist
 * deshalb vollstaendig und nicht geschaetzt. Sie aus
 * {@code projectsByFaculty} zu bilden waere falsch: dort fehlen Projekte ohne
 * Fakultaet (§3.3).
 *
 * <p><strong>Ein fehlender Schluessel ist ein Fehler, keine Null.</strong>
 * Der Server fuellt auf; wer hier ein {@code ?? 0} schriebe, machte aus einer
 * kaputten Antwort stillschweigend eine plausible.
 *
 * <p>Die Farbe je Status kommt aus derselben Zuordnung wie das
 * {@code StatusBadge}, damit dieselbe Sache auf der Seite nicht zweimal
 * verschieden aussieht. Sie ist Beiwerk: die Beschriftung darunter benennt
 * den Status, die Farbe traegt keine eigene Aussage (SC 1.4.1).
 */
export function ProjectStatusCard({
  data,
  isPending,
  numberFormat,
}: {
  data: DashboardResponse | undefined
  isPending: boolean
  numberFormat: Intl.NumberFormat
}) {
  const { t } = useTranslation()

  const counts = data?.projectsByStatus
  const total =
    counts === undefined
      ? undefined
      : OWN_PROJECT_STATUSES.reduce((sum, status) => sum + counts[status], 0)

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <h2 className="type-label-xs font-medium tracking-widest text-muted-foreground uppercase">
          {t("administration.dashboard.projects.title")}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {isPending ? (
            /* Sechs Skelette in der Form der Kacheln, kein Spinner: die
               Flaeche springt sonst, sobald die Zahlen eintreffen. */
            SKELETON_TILES.map((index) => (
              <Skeleton key={index} className="h-22 rounded-card" />
            ))
          ) : (
            <>
              <CountTile
                value={total === undefined ? "" : numberFormat.format(total)}
                label={t("administration.dashboard.projects.total")}
                tone="text-accent-foreground"
              />
              {OWN_PROJECT_STATUSES.map((status) => (
                <CountTile
                  key={status}
                  value={
                    counts === undefined
                      ? ""
                      : numberFormat.format(counts[status])
                  }
                  label={t(`project.status.${status}`)}
                  tone={STATUS_TONE[status]}
                />
              ))}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Eine der sechs Kacheln: gerahmte Zahl mit Beschriftung darunter.
 *
 * <p>Bewusst nicht {@code KpiTile}: die Kachel aus KAN-29 traegt Symbol,
 * Veraenderungszeile und eine eigene Kartenflaeche und steht fuer sich; hier
 * liegen sechs Kacheln <em>innerhalb</em> einer Karte, gerahmt und zentriert.
 * Die Variante {@code plain} kommt der Sache naeher, hat aber keinen Rahmen
 * und setzt die Beschriftung in Versalien, was der Frame nicht tut. Eine
 * dritte Variante an der gemeinsamen Huelle waere die richtige Antwort, sobald
 * eine zweite Seite dieselbe Reihe zeigt; bis dahin bleibt sie hier.
 */
function CountTile({
  value,
  label,
  tone,
}: {
  value: string
  label: string
  tone: string
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-card border px-3 py-3.5 text-center">
      <p className={cn("type-num-stat font-extrabold tabular-nums", tone)}>
        {value}
      </p>
      <p className="type-label-xs text-muted-foreground">{label}</p>
    </div>
  )
}
