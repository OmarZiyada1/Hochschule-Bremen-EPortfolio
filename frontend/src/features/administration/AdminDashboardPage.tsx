import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { apiErrorMessageKey, isApiError } from "@/api/errors"
import type { DashboardResponse } from "@/api/types"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { FacultyDistributionCard } from "@/features/administration/components/FacultyDistributionCard"
import { ProjectStatusCard } from "@/features/administration/components/ProjectStatusCard"
import { UserStatisticsCard } from "@/features/administration/components/UserStatisticsCard"
import { useAdminDashboard } from "@/features/administration/hooks/useAdministration"
import { cn } from "@/lib/utils"

/**
 * Die Startansicht der Administrationsseite (Template „Dashboard", KAN-38):
 * Kennzahlen zum Bestand, untereinander die Projekte, die Nutzerstatistik und
 * die Verteilung je Fakultaet. Jede Karte nimmt die volle Breite (KAN-80).
 *
 * <p><strong>Bestandsgroessen, kein Verlauf.</strong> Alle Zahlen gelten zum
 * Zeitpunkt des Aufrufs; §6.1 sieht keine Zeitreihe vor. Eine Kachel mit
 * Trendpfeil oder Vormonatsvergleich haette keine Datenquelle und wird
 * deshalb nicht gebaut.
 *
 * <p><strong>Der Aktivitaets-Feed aus dem Template entfaellt.</strong>
 * {@code GET /admin/dashboard} liefert ausschliesslich Kennzahlen; eine
 * Ereignisliste ueber alle Projekte hinweg gibt es im Contract nicht. Er wird
 * gebaut, sobald eine Datenquelle dafuer festgelegt ist, und bis dahin nicht
 * als Attrappe (Frontend-Regel 10).
 *
 * <p><strong>Die Kurzlinks sind die Seitenleiste.</strong> Die
 * Confluence-Seite nennt „Kurzlinks zu Admin Projects, Users, Kategorien,
 * Studiengaenge, Top 10 Verwaltung" als Layout-Bereich; der Frame zeichnet
 * dafuer keine zweite Kachelreihe, sondern die Navigation links, die genau
 * diese Ziele fuehrt. Eine Reihe daneben sagte dasselbe ein zweites Mal.
 *
 * <p><strong>Der Seitenkopf traegt die offenen Top-10-Vorschlaege</strong>
 * (KAN-83). Sie sind der einzige Handlungsbedarf dieser Seite, alles andere
 * ist Bestand; deshalb stehen sie rechts neben der Ueberschrift und nicht in
 * einer Karte weiter unten. Begruendung im Einzelnen bei
 * {@link OpenNominationsIndicator}.
 *
 * <p><strong>Fehler und Leere sind zwei Zustaende, nicht einer.</strong> Bei
 * einer gescheiterten Abfrage steht die Meldung allein da; die drei Karten
 * entstehen gar nicht erst. Sonst zeigten sie sechs Kacheln ohne Zahl, sieben
 * Statistikzeilen ohne Wert und den Satz „Es sind keine Fakultaeten
 * hinterlegt", also eine Aussage ueber den Bestand, obwohl gar keine Antwort
 * vorliegt (Befund des frontend-reviewers). Ein 403 der Rollenschranke
 * erscheint als Meldung (§5).
 */
export default function AdminDashboardPage() {
  const { t, i18n } = useTranslation()
  const dashboard = useAdminDashboard()

  /* Zahlen formatiert die Bibliothek, nicht der Code: dreistellige Werte
     bekaemen sonst je nach Sprache einen anderen Trenner als auf der
     Startseite. */
  const numberFormat = new Intl.NumberFormat(i18n.language)

  return (
    <>
      <header className="flex flex-col gap-2">
        <p className="type-overline text-muted-foreground">
          {t("administration.label")}
        </p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="type-title text-primary">
            {t("administration.dashboard.title")}
          </h1>
          <OpenNominationsIndicator
            data={dashboard.data}
            isPending={dashboard.isPending}
            numberFormat={numberFormat}
          />
        </div>
        <p className="type-body-lg text-muted-foreground">
          {t("administration.dashboard.subtitle")}
        </p>
        <hr className="mt-2" />
      </header>

      {dashboard.error !== null && (
        <Alert variant="destructive">
          <AlertTitle>
            {isApiError(dashboard.error)
              ? t(apiErrorMessageKey(dashboard.error), {
                  defaultValue: dashboard.error.message,
                })
              : t("apiError.INTERNAL_ERROR")}
          </AlertTitle>
        </Alert>
      )}

      {dashboard.error === null && (
        <>
          {/* Drei Karten untereinander, jede ueber die volle Breite
              (Vorgabe zu KAN-80). Bis dahin teilten sich die Projektkacheln
              und die Nutzerstatistik eine Zeile im Verhaeltnis zwei zu eins;
              die sechs Kacheln standen dadurch auf einem Drittel weniger
              Platz und wurden zu Ziffernsaeulen. Beide Karten tragen
              inzwischen so viel, dass jede ihre eigene Zeile braucht: sechs
              Kennzahlen die eine, zwei Diagramme die andere. */}
          <ProjectStatusCard
            data={dashboard.data}
            isPending={dashboard.isPending}
            numberFormat={numberFormat}
          />

          <UserStatisticsCard
            data={dashboard.data}
            isPending={dashboard.isPending}
            numberFormat={numberFormat}
          />

          <FacultyDistributionCard
            data={dashboard.data?.projectsByFaculty}
            isPending={dashboard.isPending}
            numberFormat={numberFormat}
          />
        </>
      )}
    </>
  )
}

/**
 * Die offenen Top-10-Vorschlaege im Seitenkopf: ein Punkt, die Zahl gross
 * daneben, darunter die Beschriftung (KAN-83).
 *
 * <p><strong>Warum im Kopf und nicht in einer Karte.</strong> Bis dahin stand
 * die Zahl in der Kopfzeile der Nutzerstatistik, also zwischen Ring, Kuchen
 * und Tabelle, und ging dort unter: wer die Seite betrat, sah zuerst sechs
 * Projektkacheln. Sie ist aber der einzige Handlungsbedarf dieser Seite,
 * alles andere ist Bestand. Im Kopf liegt sie in derselben Zeile wie die
 * Ueberschrift und damit in der ersten Blickachse.
 *
 * <p><strong>Bei null Vorschlaegen der ruhige Ton.</strong> Ausgeblendet wird
 * nichts: „nichts offen" ist selbst eine Auskunft, und eine Zeile, die kommt
 * und geht, laesst den Kopf springen. Sie verliert nur die Signalfarbe und
 * den Punkt davor. Ein Punkt ohne Anlass gewoehnt das Auge daran, ihn zu
 * uebersehen, und dann traegt er auch nicht mehr, wenn wirklich etwas offen
 * ist.
 *
 * <p><strong>Ziffer und Beschriftung sind ein Link.</strong> Zwei Links auf
 * dasselbe Ziel waeren zwei Stationen mit derselben Auskunft (SC 2.4.4). Den
 * zugaenglichen Namen traegt ein sr-only-Satz, der die Zahl im richtigen
 * Numerus nennt; die sichtbaren Teile sind {@code aria-hidden}, sonst laese
 * ein Screenreader „5 Offene Top-10-Vorschlaege" als zwei aneinander
 * geschobene Bruchstuecke vor.
 *
 * <p>Ohne Antwort (Fehlerfall) entsteht die Stelle gar nicht: eine 0 waere
 * eine Aussage ueber den Bestand, obwohl keine vorliegt. Waehrend des Ladens
 * steht ein Platzhalter derselben Groesse, damit der Kopf nicht springt.
 */
function OpenNominationsIndicator({
  data,
  isPending,
  numberFormat,
}: {
  data: DashboardResponse | undefined
  isPending: boolean
  numberFormat: Intl.NumberFormat
}) {
  const { t } = useTranslation()

  if (isPending) {
    return <Skeleton className="h-14 w-40" />
  }

  if (data === undefined) {
    return null
  }

  const count = data.openNominations
  /* Nicht „pending" nennen: das heisst in dieser Datei „laedt noch". */
  const hasOpen = count > 0

  return (
    <Link
      to="/administration/top10"
      className="group flex flex-col items-end gap-0.5 rounded-card"
    >
      <span className="sr-only">
        {t("administration.dashboard.openNominationsCount", { count })}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "type-num-stat flex items-center gap-2 font-extrabold tabular-nums",
          hasOpen ? "text-primary" : "text-muted-foreground"
        )}
      >
        {/* Reine Dekoration, deshalb ein leeres Element und kein Zeichen im
            Text: bg-current nimmt den Ton der Ziffer, es gibt also nur eine
            Stelle, an der die Farbe entschieden wird. */}
        {hasOpen && <span className="size-2.5 rounded-pill bg-current" />}
        {numberFormat.format(count)}
      </span>
      <span
        aria-hidden="true"
        className="type-body-sm text-muted-foreground group-hover:text-primary group-hover:underline"
      >
        {t("administration.dashboard.openNominations")}
      </span>
    </Link>
  )
}
