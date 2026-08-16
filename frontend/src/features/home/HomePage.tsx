import { ArrowDownIcon } from "lucide-react"
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
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-24">
        <p className="type-overline tracking-widest text-muted-foreground uppercase">
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
          <ArrowDownIcon aria-hidden="true" className="size-4" />
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
            <p className="type-overline tracking-widest text-primary uppercase">
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
          <p className="type-overline tracking-widest text-primary uppercase">
            {t("home.cta.label")}
          </p>
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
          </Button>
        </div>
      </section>

      {/* Bewusst kein <nav>: ein Navigationsbereich ohne zugaenglichen Namen
          erschiene als zweites, unbenanntes "navigation" neben der
          Hauptnavigation. Zwei Links, die es nur im Entwicklungs-Build gibt,
          rechtfertigen keine Landmarke. */}
      {import.meta.env.DEV ? (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6">
          <Link className="type-body text-primary underline" to="/dev/tokens">
            {t("home.tokenGallery")}
          </Link>
          <Link
            className="type-body text-primary underline"
            to="/dev/components"
          >
            {t("home.componentGallery")}
          </Link>
        </div>
      ) : null}
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
      title={project.title ?? ""}
      author={
        project.author
          ? {
              firstName: project.author.firstName ?? "",
              lastName: project.author.lastName ?? "",
            }
          : null
      }
      studyProgram={project.studyProgram ?? null}
      coverImageUrl={project.coverImageUrl}
      href={project.id ? `/projects/${project.id}` : undefined}
      className="h-full"
    />
  )
}
