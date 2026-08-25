import { useTranslation } from "react-i18next"

import type { DashboardResponse } from "@/api/types"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { OWN_PROJECT_STATUSES } from "@/features/portfolio/ownProjectStatus"
import { chartTextColor } from "@/lib/chartColors"
import { cn } from "@/lib/utils"

/** Sechs Platzhalter: die Summe und die fuenf Status. */
const SKELETON_TILES = [0, 1, 2, 3, 4, 5]

/*
 * Die Zahl je Kachel traegt einen kuehlen Ton aus der Diagrammpalette
 * (lib/chartColors.ts), vergeben nach der Position in der Reihe: die Summe
 * nimmt den ersten Eintrag, danach folgen die fuenf Status in der
 * Reihenfolge des Zustandsautomaten (§4.1).
 *
 * <p><strong>Nicht mehr die Toene der Status-Badges</strong> (Vorgabe zu
 * KAN-80). Bis dahin standen hier ein Grau, ein Braun und ein dunkles Rot;
 * die Reihe las sich als Warnung, obwohl sie nur zaehlt. Damit loest sich
 * die Kachel bewusst vom StatusBadge: das Badge sagt, in welchem Zustand ein
 * einzelnes Projekt ist, und dafuer traegt es seine gewohnte Bedeutung
 * weiter. Die Kachel sagt, wie viele es sind, und gehoert damit zu den
 * Diagrammen darunter, mit denen sie sich jetzt eine Palette teilt.
 *
 * <p>{@code chartTextColor} und nicht {@code chartColor}: die Zahl ist Text
 * und braucht Kontrast. Genommen wird die dunklere Stufe derselben Familie,
 * gemessen zwischen 5,4 und 8,1:1 gegen die weisse Kartenflaeche und zwischen
 * 5,7 und 8,0:1 auf der dunklen Karte.
 */
const TILE_COLORS = [0, 1, 2, 3, 4, 5].map((index) => chartTextColor(index))

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
 * <p>Die Farbe je Kachel kommt seit KAN-80 aus der Diagrammpalette und nicht
 * mehr aus der Zuordnung des {@code StatusBadge}; die Begruendung steht an
 * {@link TILE_COLORS}. Sie ist Beiwerk: die Beschriftung darunter benennt
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
                color={TILE_COLORS[0]}
              />
              {OWN_PROJECT_STATUSES.map((status, index) => (
                <CountTile
                  key={status}
                  value={
                    counts === undefined
                      ? ""
                      : numberFormat.format(counts[status])
                  }
                  label={t(`project.status.${status}`)}
                  /* Um eins versetzt: die Summe hat den ersten Eintrag. */
                  color={TILE_COLORS[index + 1]}
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
  color,
}: {
  value: string
  label: string
  /** Schriftfarbe der Zahl als CSS-Wert aus der Diagrammpalette. */
  color: string
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-card border px-3 py-3.5 text-center">
      {/* Die Farbe kommt als Stil und nicht als Klasse: sie wird nach der
          Position vergeben, und ein zur Laufzeit gebauter Klassenname stuende
          in keiner Datei, die Tailwind durchsucht. Die Werte selbst bleiben
          in der Tokenschicht (Frontend-Regel 5). */}
      <p
        className={cn("type-num-stat font-extrabold tabular-nums")}
        style={{ color }}
      >
        {value}
      </p>
      <p className="type-label-xs text-muted-foreground">{label}</p>
    </div>
  )
}
