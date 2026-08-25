import { useTranslation } from "react-i18next"
import { Bar, BarChart, LabelList, XAxis, YAxis } from "recharts"

import type { FacultyProjectCountResponse } from "@/api/types"
import { Card, CardContent } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Die Karte „Projekt je Fakultaeten" (Template „Dashboard", KAN-38): je
 * Fakultaet ein waagerechter Balken mit ihrem Kuerzel links und ihrem
 * ausgeschriebenen Namen darunter.
 *
 * <p><strong>Die Datenquelle gibt es erst seit Contract v76.</strong> Bis
 * dahin zeichnete der Frame eine Karte, fuer die {@code GET /admin/dashboard}
 * nichts lieferte; sie waere nach Frontend-Regel 10 nicht baubar gewesen. Mit
 * {@code projectsByFaculty} steht jede Fakultaet darin, auch die ohne
 * Projekte, sortiert nach Kuerzel. Projekte ohne Fakultaet gehen nicht ein
 * (§3.3), die Summe der Balken ist deshalb kleiner als die Gesamtzahl aus der
 * Karte darueber; die Unterzeile sagt das.
 *
 * <p><strong>Der Balken ist nicht die Information.</strong> Neben jedem
 * Balken steht seine Zahl, und die Tabelle darunter im {@code sr-only}-Bereich
 * nennt Kuerzel, Namen und Anzahl im Klartext: eine Grafik allein waere fuer
 * Screenreader und bei abgeschalteten Farben nichts (SC 1.1.1, SC 1.4.1).
 */
export function FacultyDistributionCard({
  data,
  isPending,
  numberFormat,
}: {
  data: FacultyProjectCountResponse[] | undefined
  isPending: boolean
  numberFormat: Intl.NumberFormat
}) {
  const { t } = useTranslation()

  /* Eine einzige Reihe, deshalb eine einzige Konfigurationszeile. Die Farbe
     kommt aus der Tokenschicht und steht nicht als Hex daneben
     (Frontend-Regel 5). */
  const config = {
    count: {
      label: t("administration.dashboard.faculties.bar"),
      color: "var(--color-primary)",
    },
  } satisfies ChartConfig

  const rows = (data ?? []).map((entry) => ({
    abbreviation: entry.faculty.abbreviation ?? entry.faculty.name,
    name: entry.faculty.name,
    count: entry.count,
  }))

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="type-h3 text-primary">
            {t("administration.dashboard.faculties.title")}
          </h2>
          <p className="type-body-sm text-muted-foreground">
            {t("administration.dashboard.faculties.subtitle")}
          </p>
        </div>

        {isPending && <Skeleton className="h-64 w-full rounded-card" />}

        {!isPending && rows.length === 0 && (
          <p className="type-body-sm text-muted-foreground">
            {t("administration.dashboard.faculties.empty")}
          </p>
        )}

        {!isPending && rows.length > 0 && (
          <>
            {/* aria-hidden, weil die Tabelle darunter denselben Inhalt
                zugaenglich fuehrt. Ohne das laese ein Screenreader die von
                recharts erzeugten SVG-Knoten mit, und zwar ohne
                Beschriftung. */}
            <div aria-hidden="true">
              <ChartContainer
                config={config}
                /* Hoehe statt aspect-video: die Zahl der Fakultaeten
                   bestimmt sie, nicht ein Seitenverhaeltnis. Fuenf Zeilen
                   ergeben die Hoehe des Templates, sechs wachsen mit. */
                className="aspect-auto w-full"
                style={{ height: `${rows.length * 4}rem` }}
              >
                <BarChart
                  /*
                   * accessibilityLayer steht in recharts 3 auf true, auch ohne
                   * die Prop, und setzt dann tabIndex={0} samt
                   * role="application" auf die SVG-Wurzel. Innerhalb eines
                   * aria-hidden-Teilbaums ergaebe das den schlechtesten
                   * Zustand: die Tastatur laeuft in ein Element, das kein
                   * Screenreader ansagt (SC 4.1.2, axe-Regel
                   * aria-hidden-focus). Die zugaengliche Aussage traegt die
                   * Tabelle darunter, deshalb wird die Ebene hier ausdruecklich
                   * abgeschaltet und nicht bloss weggelassen.
                   */
                  accessibilityLayer={false}
                  data={rows}
                  layout="vertical"
                  margin={{ left: 0, right: 24, top: 4, bottom: 4 }}
                >
                  <YAxis
                    dataKey="abbreviation"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    width={40}
                  />
                  <XAxis type="number" hide />
                  <ChartTooltip
                    content={<ChartTooltipContent nameKey="name" />}
                  />
                  <Bar dataKey="count" fill="var(--color-count)" radius={4}>
                    <LabelList
                      dataKey="count"
                      position="right"
                      className="fill-foreground"
                    />
                  </Bar>
                </BarChart>
              </ChartContainer>
            </div>

            {/* Derselbe Inhalt als Tabelle, sichtbar nur fuer Hilfsmittel.
                Sie traegt zusaetzlich den ausgeschriebenen Namen, den die
                Achse aus Platzgruenden nicht zeigt. */}
            <table className="sr-only">
              <caption>
                {t("administration.dashboard.faculties.tableCaption")}
              </caption>
              <thead>
                <tr>
                  <th scope="col">
                    {t("administration.dashboard.faculties.columnFaculty")}
                  </th>
                  <th scope="col">
                    {t("administration.dashboard.faculties.columnCount")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.abbreviation}>
                    <th scope="row">
                      {row.abbreviation}, {row.name}
                    </th>
                    <td>{numberFormat.format(row.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Die sichtbare Liste der Namen unter dem Diagramm: die Achse
                zeigt nur das Kuerzel, der Frame nennt darunter den vollen
                Namen je Zeile. */}
            <ul className="flex flex-wrap gap-x-6 gap-y-1">
              {rows.map((row) => (
                <li
                  key={row.abbreviation}
                  className="type-label-xs text-muted-foreground"
                >
                  <span className="font-semibold">{row.abbreviation}</span>{" "}
                  {row.name}
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}
