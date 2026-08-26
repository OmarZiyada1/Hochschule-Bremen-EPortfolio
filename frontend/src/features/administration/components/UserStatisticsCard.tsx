import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { Label, Pie, PieChart } from "recharts"

import type { DashboardResponse, Role, UserStatus } from "@/api/types"
import { Card, CardContent } from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { chartColor } from "@/lib/chartColors"

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

/*
 * Die Farben kommen aus der Diagrammpalette (lib/chartColors.ts), nicht aus
 * den Vordergrundtoenen der Badges. Die sind fuer Text auf einer blassen
 * Pille gebaut, also dunkel und satt; als grosse Kreissegmente sassen sie
 * schwer auf der Karte und waren zu dritt kaum auseinanderzuhalten.
 *
 * Die Rollen haben keine eigene Farbbedeutung und nehmen die Palette nach
 * ihrer Position: eine vierte Rolle bekaeme ohne Codeaenderung die naechste
 * Farbe.
 *
 * Der Kontostatus hat eine: er laeuft von Minze ueber Gelb nach Orange, also
 * von „aktiv" ueber „Registrierung offen" nach „deaktiviert". Die Zuordnung
 * bleibt deshalb ausgeschrieben, nimmt die Toene aber aus derselben Palette.
 * Record ueber den Enum-Typ und ohne Standardzweig, wie in UserStatusBadge:
 * ein vierter Wert bricht den Typecheck, statt still farblos zu bleiben.
 */
const STATUS_COLORS: Record<UserStatus, string> = {
  ACTIVE: chartColor(1),
  REGISTRATION_PENDING: chartColor(2),
  DEACTIVATED: chartColor(3),
}

/**
 * Die Karte „Nutzerstatistik" (Template „Dashboard", KAN-38; als Diagramm
 * seit KAN-80): links ein Ring ueber die Rollen mit der Gesamtzahl in der
 * Mitte, rechts ein Kuchen ueber die Kontostatus.
 *
 * <p><strong>Warum zwei Diagramme und keine Zahlenliste.</strong> Bis KAN-80
 * standen hier sieben Zeilen „Beschriftung links, Zahl rechts". Die Zahlen
 * beantworten aber zwei verschiedene Fragen: „wie verteilen sich die Konten
 * auf die Rollen" und „wie viele sind einsatzbereit". Beides sind Anteile an
 * derselben Gesamtzahl, und genau das zeigt ein Ring beziehungsweise ein
 * Kuchen auf einen Blick, waehrend eine Liste es erst zusammenrechnen laesst.
 *
 * <p><strong>Die Gesamtzahl steht in der Mitte des Rings</strong> (Vorgabe zu
 * KAN-80). Sie ist die Summe der Rollen und zugleich {@code usersTotal} aus
 * §6.1; ausgegeben wird der gelieferte Wert und nicht die Summe, denn
 * {@code usersTotal} ist die verbindliche Zahl und schliesst jedes Konto ein.
 *
 * <p><strong>Der Ring ist nicht die Information.</strong> Beide Diagramme
 * sind {@code aria-hidden}, und die Tabelle darunter nennt jede Gruppe mit
 * ihrer Zahl im Klartext: eine Grafik allein waere fuer Screenreader und bei
 * abgeschalteten Farben nichts (SC 1.1.1, SC 1.4.1). Dieselbe Aufteilung wie
 * in {@code FacultyDistributionCard}.
 *
 * <p><strong>Die offenen Vorschlaege bleiben eine Zeile.</strong> Sie sind
 * kein Anteil an den Konten, sondern der einzige Handlungsbedarf auf dieser
 * Seite, und deshalb die einzige verlinkte Stelle: sie fuehrt in die
 * Top-10-Verwaltung, wo darueber entschieden wird (KAN-40).
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

  /*
   * Ein fehlender Schluessel ist ein Fehler und keine Null: der Server fuellt
   * jede Aufschluesselung ueber alle Enum-Werte auf (§6.1). Ein "?? 0" machte
   * aus einer kaputten Antwort stillschweigend eine plausible, dieselbe
   * Begruendung wie in ProjectStatusCard.
   */
  const roleSlices = ROLES.map((role) => ({
    key: role,
    label: t(`user.rolePlural.${role}`),
    value: data === undefined ? 0 : data.usersByRole[role],
    fill: `var(--color-${role})`,
  }))
  const statusSlices = USER_STATUSES.map((status) => ({
    key: status,
    label: t(`user.status.${status}`),
    value: data === undefined ? 0 : data.usersByStatus[status],
    fill: `var(--color-${status})`,
  }))

  const roleConfig = {
    value: { label: t("administration.dashboard.users.roles") },
    ...Object.fromEntries(
      ROLES.map((role, index) => [
        role,
        { label: t(`user.rolePlural.${role}`), color: chartColor(index) },
      ])
    ),
  } satisfies ChartConfig

  const statusConfig = {
    value: { label: t("administration.dashboard.users.statuses") },
    ...Object.fromEntries(
      USER_STATUSES.map((status) => [
        status,
        { label: t(`user.status.${status}`), color: STATUS_COLORS[status] },
      ])
    ),
  } satisfies ChartConfig

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <h2 className="type-label-xs font-medium tracking-widest text-muted-foreground uppercase">
          {t("administration.dashboard.users.title")}
        </h2>

        {isPending ? (
          <div className="grid gap-6 sm:grid-cols-2">
            <Skeleton className="h-56 rounded-card" />
            <Skeleton className="h-56 rounded-card" />
          </div>
        ) : (
          <>
            <div className="grid gap-6 sm:grid-cols-2">
              <SliceChart
                title={t("administration.dashboard.users.roles")}
                config={roleConfig}
                slices={roleSlices}
                centerValue={
                  data === undefined ? "" : numberFormat.format(data.usersTotal)
                }
                centerLabel={t("administration.dashboard.users.total")}
              />
              <SliceChart
                title={t("administration.dashboard.users.statuses")}
                config={statusConfig}
                slices={statusSlices}
              />
            </div>

            {/* Derselbe Inhalt als Tabelle, sichtbar nur fuer Hilfsmittel. */}
            <table className="sr-only">
              <caption>
                {t("administration.dashboard.users.tableCaption")}
              </caption>
              <thead>
                <tr>
                  <th scope="col">
                    {t("administration.dashboard.users.columnGroup")}
                  </th>
                  <th scope="col">
                    {t("administration.dashboard.users.columnCount")}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">
                    {t("administration.dashboard.users.total")}
                  </th>
                  <td>
                    {data === undefined
                      ? ""
                      : numberFormat.format(data.usersTotal)}
                  </td>
                </tr>
                {[...roleSlices, ...statusSlices].map((slice) => (
                  <tr key={slice.key}>
                    <th scope="row">{slice.label}</th>
                    <td>{numberFormat.format(slice.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <Separator />

            {/* Der Begriff traegt den Link, nicht die ganze Zeile: ein
                Linkziel, das die Zahl einschliesst, laese sich mit
                Screenreader als „Offene Vorschlaege 5" vor, und die 5 waere
                Teil des Linktextes. */}
            <div className="flex items-baseline justify-between gap-4">
              <span className="type-body-sm">
                <Link
                  to="/administration/top10"
                  className="text-primary hover:text-primary-hover hover:underline"
                >
                  {t("administration.dashboard.openNominations")}
                </Link>
              </span>
              <span className="type-body-sm font-semibold tabular-nums">
                {data === undefined
                  ? ""
                  : numberFormat.format(data.openNominations)}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

/** Winkel zwischen zwei Segmenten, in Grad. */
const SLICE_GAP_DEGREES = 3

/** Abrundung der Segmentenden im Ring, in Pixeln. */
const SLICE_CORNER_RADIUS = 6

/*
 * Die beiden Zeilen in der Mitte des Rings, gemessen in Pixeln von seinem
 * Mittelpunkt aus (Vorgabe zu KAN-80: die Zahl sass ein paar Pixel zu tief).
 *
 * <p><strong>Warum das gerechnet wird und nicht geschaetzt.</strong> Die Zahl
 * steht in text-2xl, also 24px, die Beschriftung in text-xs, also 12px. Damit
 * beide zusammen mittig sitzen, muss die Oberkante der Zahl so weit ueber dem
 * Mittelpunkt liegen wie die Unterkante der Beschriftung darunter. Mit 2px
 * Luft dazwischen ist der Block 24 + 2 + 12 = 38px hoch, reicht also von
 * minus 19 bis plus 19; die Mitte der Zahl liegt dann bei minus 7, die der
 * Beschriftung bei plus 13. Ein Pixel mehr nach oben, weil Ziffern bis zur
 * Versalhoehe reichen und die Beschriftung Unterlaengen hat: optisch wiegt
 * die untere Zeile leichter, als ihr Kasten sagt.
 */
const CENTER_VALUE_OFFSET = -8
const CENTER_LABEL_OFFSET = 12

/**
 * Ein Ring oder ein Kuchen ueber eine Aufschluesselung, mit Legende darunter.
 *
 * <p>Mit {@code centerValue} entsteht ein Ring und die Zahl steht in seiner
 * Mitte, ohne ein voller Kuchen. Ein Loch ohne Inhalt waere nur ein Loch, und
 * eine Zahl im Kuchen laege auf den Segmenten.
 *
 * <p><strong>Zwischen den Segmenten steht eine Luecke</strong> (Vorgabe zu
 * KAN-80). Bis dahin stiessen sie stumpf aneinander, und zwei benachbarte
 * Toene liefen ineinander, sobald ein Segment schmal wurde. Drei Grad
 * genuegen: sie sind bei jedem Anteil zu sehen und kosten bei zehn Segmenten
 * noch keine dreissig Grad des Kreises.
 *
 * <p><strong>Abgerundet wird nur der Ring.</strong> Im Kuchen laufen die
 * Segmente in der Mitte zu einer Spitze zusammen; ein Radius darauf schnitte
 * sie stumpf ab und die Mitte saehe ausgefranst aus. Der Ring hat an beiden
 * Enden eine Kante, und dort traegt die Rundung.
 *
 * <p><strong>Ein Segment mit dem Wert 0 wird nicht gezeichnet.</strong> Es
 * haette keinen Winkel, bekaeme aber trotzdem seine Luecke und stuende als
 * schmaler Strich da, der nichts bedeutet. Die Zahl bleibt in der Tabelle der
 * Karte; verloren geht sie also nicht, sie taucht nur nicht als Flaeche auf.
 *
 * <p><strong>Ein Kuchen ohne Daten wird gar nicht gezeichnet.</strong> Stehen
 * alle Werte auf 0, hat recharts keinen Winkel zu verteilen und malt einen
 * leeren Kreis; die Stelle bekommt stattdessen einen Satz. Das ist kein
 * Ausnahmefall auf Verdacht: eine frische Installation hat noch keine
 * deaktivierten Konten.
 */
function SliceChart({
  title,
  config,
  slices,
  centerValue,
  centerLabel,
}: {
  title: string
  config: ChartConfig
  slices: readonly { key: string; label: string; value: number }[]
  centerValue?: string
  centerLabel?: string
}) {
  const { t } = useTranslation()
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  const drawn = slices.filter((slice) => slice.value > 0)
  const isRing = centerValue !== undefined

  return (
    <div className="flex flex-col gap-1">
      <p className="type-label-xs text-center text-muted-foreground">{title}</p>

      {total === 0 ? (
        <p className="type-body-sm py-8 text-center text-muted-foreground">
          {t("administration.dashboard.users.emptyChart")}
        </p>
      ) : (
        /* aria-hidden, weil die Tabelle in der Karte denselben Inhalt
           zugaenglich fuehrt. accessibilityLayer ausdruecklich aus: recharts 3
           setzt sonst tabIndex und role="application" auf die SVG-Wurzel, und
           die Tastatur liefe in ein Element, das kein Screenreader ansagt
           (SC 4.1.2, axe-Regel aria-hidden-focus). */
        <div aria-hidden="true">
          <ChartContainer config={config} className="mx-auto h-56 w-full">
            <PieChart accessibilityLayer={false}>
              <ChartTooltip content={<ChartTooltipContent nameKey="key" />} />
              <Pie
                data={drawn}
                dataKey="value"
                nameKey="key"
                innerRadius={isRing ? 52 : 0}
                outerRadius={78}
                paddingAngle={SLICE_GAP_DEGREES}
                cornerRadius={isRing ? SLICE_CORNER_RADIUS : 0}
                /* Ohne Kontur: die Trennung machen die Luecken, und eine
                   Linie darum haette auf der Karte keinen Ton, der in beiden
                   Modi passt. */
                strokeWidth={0}
              >
                {isRing && (
                  <Label
                    content={({ viewBox }) => {
                      if (
                        viewBox === undefined ||
                        !("cx" in viewBox) ||
                        typeof viewBox.cx !== "number" ||
                        typeof viewBox.cy !== "number"
                      ) {
                        return null
                      }
                      return (
                        /* central und nicht middle: middle richtet in SVG an
                           der halben x-Hoehe aus und nicht an der Mitte der
                           Schriftflaeche, und der Block sass damit ein paar
                           Pixel zu tief. central nimmt die Mitte zwischen
                           Ober- und Unterlaenge, also das, was das Auge als
                           Mitte liest. */
                        <text
                          x={viewBox.cx}
                          y={viewBox.cy}
                          textAnchor="middle"
                          dominantBaseline="central"
                        >
                          <tspan
                            x={viewBox.cx}
                            y={viewBox.cy + CENTER_VALUE_OFFSET}
                            className="fill-foreground text-2xl font-bold"
                          >
                            {centerValue}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={viewBox.cy + CENTER_LABEL_OFFSET}
                            className="fill-muted-foreground text-xs"
                          >
                            {centerLabel}
                          </tspan>
                        </text>
                      )
                    }}
                  />
                )}
              </Pie>
              <ChartLegend
                content={<ChartLegendContent nameKey="key" />}
                className="flex-wrap gap-x-4 gap-y-1"
              />
            </PieChart>
          </ChartContainer>
        </div>
      )}
    </div>
  )
}
