import { useTranslation } from "react-i18next"

import { apiErrorMessageKey, isApiError } from "@/api/errors"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { FacultyDistributionCard } from "@/features/administration/components/FacultyDistributionCard"
import { ProjectStatusCard } from "@/features/administration/components/ProjectStatusCard"
import { UserStatisticsCard } from "@/features/administration/components/UserStatisticsCard"
import { useAdminDashboard } from "@/features/administration/hooks/useAdministration"

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
        <h1 className="type-title text-primary">
          {t("administration.dashboard.title")}
        </h1>
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
