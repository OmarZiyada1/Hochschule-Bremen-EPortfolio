import { useTranslation } from "react-i18next"

import type { DashboardResponse } from "@/api/types"
import { KpiTile } from "@/components/common/KpiTile"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ALL_PROJECTS_ICON,
  OWN_PROJECT_STATUSES,
  PROJECT_STATUS_ICONS,
} from "@/features/portfolio/ownProjectStatus"

/** Sechs Platzhalter: die Summe und die fuenf Status. */
const SKELETON_TILES = [0, 1, 2, 3, 4, 5]

/* JSX braucht einen grossgeschriebenen Bezeichner, sonst liest es das Element
   als HTML-Tag. Der Wert selbst steht bei den Statussymbolen. */
const AllProjectsIcon = ALL_PROJECTS_ICON

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
 * <p><strong>Alle sechs Zahlen tragen denselben Textton</strong> (Vorgabe zur
 * Nacharbeit). Bis dahin nahm jede Kachel einen eigenen Ton aus der
 * Diagrammpalette, vergeben nach ihrer Position; nebeneinander las sich die
 * Reihe dadurch, als sage die Farbe etwas ueber den Status, obwohl sie nur
 * die Position abbildete. Sie sagt jetzt nichts mehr, und das ist die
 * ehrlichere Darstellung: die Beschriftung benennt den Status, die Zahl
 * zaehlt ihn (SC 1.4.1). Damit sehen die Kacheln zugleich genauso aus wie in
 * „Meine Reviews", und darum ging es bei der Vereinheitlichung.
 *
 * <p><strong>Die Kacheln kommen aus der gemeinsamen Huelle</strong>
 * ({@code KpiTile}, Variante {@code tile}) und nicht mehr aus einer eigenen
 * Kachel in dieser Datei. Bis zur Vereinheitlichung sah dieselbe Auskunft
 * hier anders aus als in „Meine Reviews": dort Symbol, Zahl und Wort
 * untereinander, hier Zahl und Wort zentriert und ohne Symbol. Jetzt tragen
 * beide Seiten denselben Aufbau, und das Symbol je Status kommt aus
 * {@link PROJECT_STATUS_ICONS}, damit es auf beiden Seiten dasselbe ist.
 *
 * <p><strong>Drei Spalten statt sechs.</strong> Die Kachel ist jetzt breit
 * statt hoch; sechs davon nebeneinander liessen der Beschriftung neben der
 * Zahl keinen Platz und brachen „Veroeffentlicht" in drei Zeilen. Sechs
 * Kennzahlen stehen deshalb in zwei Reihen zu dreien.
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
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {isPending ? (
            /* Sechs Skelette in der Form der Kacheln, kein Spinner: die
               Flaeche springt sonst, sobald die Zahlen eintreffen.

               Nachgemessen an der Variante tile: py-3.5 gibt 28px, die Zahl
               in type-num-stat zwischen 31px (schmales Fenster) und 38px,
               zusammen also 59 bis 66px. h-16 (64px) liegt darin; ein
               Restsprung von wenigen Pixeln bleibt, weil die Schriftgroesse
               selbst mit der Fensterbreite waechst. */
            SKELETON_TILES.map((index) => (
              <Skeleton key={index} className="h-16 rounded-card" />
            ))
          ) : (
            <>
              <KpiTile
                variant="tile"
                icon={<AllProjectsIcon aria-hidden="true" />}
                value={total === undefined ? "" : numberFormat.format(total)}
                label={t("administration.dashboard.projects.total")}
              />
              {OWN_PROJECT_STATUSES.map((status) => {
                const Icon = PROJECT_STATUS_ICONS[status]
                return (
                  <KpiTile
                    key={status}
                    variant="tile"
                    icon={<Icon aria-hidden="true" />}
                    value={
                      counts === undefined
                        ? ""
                        : numberFormat.format(counts[status])
                    }
                    label={t(`project.status.${status}`)}
                  />
                )
              })}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
