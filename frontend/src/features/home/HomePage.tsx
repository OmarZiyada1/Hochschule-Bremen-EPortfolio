import { ArrowDownIcon, ArrowRightIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { apiErrorMessageKey, isApiError } from "@/api/errors"
import { KpiTile } from "@/components/common/KpiTile"
import { Top10Card } from "@/components/common/Top10Card"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { FeaturedTop10Card } from "@/features/home/components/FeaturedTop10Card"
import { Top10FreeSlot } from "@/features/home/components/Top10FreeSlot"
import {
  useFacultyCount,
  useProjectCount,
  useStudyProgramCount,
} from "@/features/home/hooks/useHomeStats"
import { useTop10List } from "@/features/home/hooks/useTop10List"
import { top10Slots, type Top10Slot } from "@/features/home/top10Slots"
import { peopleOfProject } from "@/lib/people"

/**
 * Oeffentliche Startseite nach Template "Startseite (Oeffentlich)"
 * (Ticket KAN-31): Hero mit zweifarbiger Display-Headline, Top-10-Sektion
 * aus GET /top10 und helle CTA-Sektion mit drei clientseitig abgeleiteten
 * Kennzahlen.
 *
 * Zwei benannte Template-Abweichungen aus der Klaerungsrunde bzw. den
 * Schreibregeln: die Gedankenstriche der Template-Texte sind umformuliert
 * (CLAUDE.md, Schreibstil), und die Jahreszahl der Bestenliste kommt aus
 * dem Datum statt fest "2026", weil der Contract kein Jahr am Eintrag kennt
 * (§3.11) und ein fest verdrahtetes Jahr im Januar falsch wuerde.
 *
 * <p><strong>Der Hero fuellt eine Fensterhoehe</strong> abzueglich der
 * Kopfleiste (KAN-80). Er empfaengt und traegt genau eine Aussage; alles
 * Weitere beginnt darunter. Die beiden Sektionen danach wachsen mit ihrem
 * Inhalt: die Top-10-Sektion mit ihren zehn Kacheln, die Abschlusssektion mit
 * ihren drei Kennzahlen. Die Abschlusssektion hatte zwischenzeitlich
 * ebenfalls eine volle Fensterhoehe und ist wieder auf ihre Polsterung
 * zurueckgenommen: drei Zahlen und ein Link in einem sonst leeren Bildschirm
 * lasen sich wie ein Ladefehler.
 *
 * <p>Gemessen wird in {@code svh} und nicht in {@code vh}: Auf dem Handy
 * meint {@code vh} die Hoehe ohne eingeblendete Browserleisten, und der
 * Abschnitt raegte beim Laden unter den Bildschirmrand. {@code min-h} statt
 * {@code h}, damit ein langer Text die Sektion waechst laesst, statt aus ihr
 * herauszulaufen. Der Abzug ist {@code --spacing-nav} aus index.css, dieselbe
 * Zahl, die die Kopfleiste hoch ist.
 */
export default function HomePage() {
  const { t, i18n } = useTranslation()
  const top10 = useTop10List()
  const projectCount = useProjectCount()
  const facultyCount = useFacultyCount()
  const studyProgramCount = useStudyProgramCount()

  const year = new Date().getFullYear()
  const numberFormat = new Intl.NumberFormat(i18n.resolvedLanguage)
  const slots = top10Slots(top10.data ?? [])

  const works = projectCount.data
  const faculties = facultyCount.data
  const programs = studyProgramCount.data
  const statsError =
    projectCount.error ?? facultyCount.error ?? studyProgramCount.error

  return (
    <div className="flex flex-col">
      <section className="mx-auto flex min-h-[calc(100svh-var(--spacing-nav))] w-full max-w-6xl flex-col justify-center px-4 py-16 sm:py-24">
        <p className="type-overline text-muted-foreground">
          {t("home.hero.label")}
        </p>
        <h1 className="type-display mt-4 max-w-3xl text-accent-foreground">
          {t("home.hero.titleLine1")}{" "}
          <span className="block text-primary">
            {t("home.hero.titleLine2")}
          </span>
        </h1>
        <p className="type-body-lg mt-6 max-w-md text-muted-foreground">
          {t("home.hero.subtitle")}
        </p>
        {/* Sprunglink in die Sektion darunter; ein schlichter Anker genuegt,
            der Router ist dafuer nicht zustaendig. */}
        <a
          href="#top10"
          className="type-body-sm mt-8 inline-flex items-center gap-2 font-medium text-primary underline-offset-4 hover:underline focus-visible:underline"
        >
          {/* Der Pfeil huepft, damit der Weg nach unten auffaellt (KAN-80).
              animate-bounce ist Tailwinds eigene Kurve; wer weniger Bewegung
              eingestellt hat, sieht sie nicht (Grundregel in tokens.css).

              Groesser als die Schrift daneben und nicht auf ihrer Groesse: er
              ist auf dieser Flaeche das einzige bewegte Element und der
              einzige Hinweis darauf, dass unterhalb des ersten Bildschirms
              noch etwas kommt. Auf 16px ging er neben der Zeile unter. */}
          <ArrowDownIcon
            aria-hidden="true"
            className="size-7 animate-bounce motion-reduce:animate-none"
          />
          {t("home.hero.exploreTop10")}
        </a>
      </section>

      <section
        id="top10"
        aria-labelledby="top10-heading"
        className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 pb-16"
      >
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="type-overline text-primary">
              {t("home.top10.label")}
            </p>
            <h2
              id="top10-heading"
              className="type-title mt-2 text-accent-foreground"
            >
              {t("home.top10.title", { year })}
            </h2>
          </div>
          <p className="type-body-sm max-w-sm text-muted-foreground">
            {t("home.top10.description")}
          </p>
        </div>

        {top10.error !== null && (
          <Alert variant="destructive" className="mt-8">
            <AlertTitle>
              {isApiError(top10.error)
                ? t(apiErrorMessageKey(top10.error), {
                    defaultValue: top10.error.message,
                  })
                : t("apiError.INTERNAL_ERROR")}
            </AlertTitle>
          </Alert>
        )}

        {top10.isPending && (
          <div className="mt-8 flex flex-col gap-6">
            {/* Skeleton in der Form des Ergebnisses: Featured-Flaeche und
                Kartenreihe, kein zentrierter Spinner. */}
            <Skeleton className="h-72 rounded-card" />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-80 rounded-card" />
              ))}
            </div>
          </div>
        )}

        {top10.data !== undefined && (
          <div className="mt-8 flex flex-col gap-6">
            {slots[0].entry !== undefined ? (
              <FeaturedTop10Card entry={slots[0].entry} />
            ) : (
              <Top10FreeSlot position={1} className="min-h-72" />
            )}
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {slots.slice(1, 5).map((slot) => (
                <li key={slot.position} className="h-full">
                  <Top10SlotTile slot={slot} variant="feature" />
                </li>
              ))}
            </ul>
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
              {slots.slice(5).map((slot) => (
                <li key={slot.position} className="h-full">
                  <Top10SlotTile slot={slot} variant="compact" />
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section aria-labelledby="cta-heading" className="bg-muted">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-5 px-4 py-16 text-center sm:py-20">
          <p className="type-overline text-primary">{t("home.cta.label")}</p>
          <h2 id="cta-heading" className="type-title text-accent-foreground">
            {t("home.cta.title")}
          </h2>

          {statsError !== null && (
            <Alert variant="destructive" className="max-w-lg text-left">
              <AlertTitle>
                {isApiError(statsError)
                  ? t(apiErrorMessageKey(statsError), {
                      defaultValue: statsError.message,
                    })
                  : t("apiError.INTERNAL_ERROR")}
              </AlertTitle>
            </Alert>
          )}

          {statsError === null &&
            (works !== undefined &&
            faculties !== undefined &&
            programs !== undefined ? (
              <>
                <p className="type-body max-w-lg text-muted-foreground">
                  {t("home.cta.description", {
                    works: numberFormat.format(works),
                    faculties: numberFormat.format(faculties),
                  })}
                </p>
                <div className="mt-2 flex flex-wrap items-start justify-center gap-10">
                  <KpiTile
                    variant="plain"
                    value={numberFormat.format(works)}
                    label={t("home.cta.statWorks")}
                  />
                  <KpiTile
                    variant="plain"
                    value={numberFormat.format(faculties)}
                    label={t("home.cta.statFaculties")}
                  />
                  <KpiTile
                    variant="plain"
                    value={numberFormat.format(programs)}
                    label={t("home.cta.statPrograms")}
                  />
                </div>
              </>
            ) : (
              <>
                <Skeleton className="h-5 w-72 max-w-full" />
                <div className="mt-2 flex flex-wrap items-start justify-center gap-10">
                  {Array.from({ length: 3 }, (_, index) => (
                    <Skeleton key={index} className="h-16 w-24" />
                  ))}
                </div>
              </>
            ))}

          <Button
            variant="link"
            nativeButton={false}
            render={<Link to="/projects" />}
          >
            {t("home.cta.openLibrary")}
            {/* Der Pfeil wandert waagerecht, wie der Pfeil im Hero senkrecht
                huepft (KAN-80). Er steht rechts vom Text und zeigt nach
                rechts, weil er weiterfuehrt und nicht zurueck; bewegt wird er
                nach links und wieder heraus, damit die Bewegung im Wortlaut
                „von rechts nach links" bleibt und die Schaltflaeche dabei
                nicht breiter wird. */}
            <ArrowRightIcon
              aria-hidden="true"
              className="size-4 animate-nudge-x motion-reduce:animate-none"
            />
          </Button>
        </div>
      </section>

      {/* Bis KAN-80 standen hier zwei Links auf die Pruefflaechen
          /dev/tokens und /dev/components. Sie sind weg: die Adressen sind
          bekannt und werden von Hand eingegeben, und die Startseite endet
          jetzt mit der Abschlusssektion statt mit zwei Entwicklungslinks
          darunter. Die Routen selbst bleiben (routes/index.tsx, nur im
          Entwicklungs-Build). */}
    </div>
  )
}

/**
 * Ein Platz der beiden Kartenreihen: besetzt als Top10Card in der Variante
 * der Reihe (feature vorn, compact hinten, Ticket KAN-31), unbesetzt als
 * leere Flaeche. Ein Eintrag ohne Projekt ist fachlich unmoeglich (§3.11)
 * und faellt auf den leeren Platz zurueck, statt eine halbe Kachel zu
 * zeigen.
 */
function Top10SlotTile({
  slot,
  variant,
}: {
  slot: Top10Slot
  variant: "feature" | "compact"
}) {
  const project = slot.entry?.project
  if (project === undefined) {
    return <Top10FreeSlot position={slot.position} />
  }
  return (
    <Top10Card
      variant={variant}
      position={slot.position}
      title={project.title}
      people={peopleOfProject(project)}
      studyProgram={project.studyProgram ?? null}
      coverImageUrl={project.coverImageUrl}
      href={project.id ? `/projects/${project.id}` : undefined}
      className="h-full"
    />
  )
}
