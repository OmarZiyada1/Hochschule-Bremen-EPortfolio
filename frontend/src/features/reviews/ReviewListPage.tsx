import { FolderOpenIcon } from "lucide-react"
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type RefObject,
} from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"

import type { ReviewListParams } from "@/api/queries/projects"
import type { ProjectCardResponse } from "@/api/types"
import { useApiErrorMessage } from "@/api/useApiErrorMessage"
import { EmptyState } from "@/components/common/EmptyState"
import { ErrorState } from "@/components/common/ErrorState"
import { FilterSelect } from "@/components/common/FilterSelect"
import { KpiTile } from "@/components/common/KpiTile"
import { ProjectStatusFilter } from "@/components/common/ProjectStatusFilter"
import { ProjectTableRow } from "@/components/common/ProjectTableRow"
import { SearchInput } from "@/components/common/SearchInput"
import { Card, CardContent } from "@/components/ui/card"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ALL_STATUSES,
  PROJECT_STATUS_ICONS,
  statusQueryValue,
} from "@/features/portfolio/ownProjectStatus"
import { paginationItems } from "@/features/projects/paginationItems"
import { NominationDialog } from "@/features/reviews/components/NominationDialog"
import { NominationPanel } from "@/features/reviews/components/NominationPanel"
import { ReviewRowMenu } from "@/features/reviews/components/ReviewRowMenu"
import {
  useNominateProject,
  useOwnNominations,
  useReviewCounts,
  useReviewFilterOptions,
  useReviewList,
  useTop10ProjectIds,
} from "@/features/reviews/hooks/useReviews"
import { useReviewWorkflow } from "@/features/reviews/hooks/useReviews"
import {
  readReviewState,
  REVIEW_STATUSES,
  writeReviewState,
} from "@/features/reviews/reviewFilters"

/* Entprellzeit der Suche: kein Request je Tastenanschlag (Skill frontend-api). */
const SEARCH_DEBOUNCE_MS = 300

/**
 * „Meine Reviews" nach Template (Ticket KAN-37): Kennzahlen, Filterkarte,
 * Statusleiste, Tabelle der zugewiesenen Projekte und die beiden
 * Nominierungskarten.
 *
 * <p><strong>Die Seite zeigt ausschliesslich eigene Zuweisungen.</strong>
 * Der Zuschnitt {@code editor=me} steckt in der Query-Fabrik und ist keine
 * Einstellung (§6.1); ohne Token antwortet der Server mit 401 und nicht mit
 * einer leeren Liste (§5). Ein Entwurf erscheint hier nicht: die Redaktion
 * liest nicht veroeffentlichte Projekte erst ab {@code SUBMITTED} (§5
 * Fussnote 11).
 *
 * <p><strong>Suche, Status, die drei Filter und die Seite stehen in der
 * Adresse</strong> und nicht in {@code useState}: ein Ergebnis ist sonst
 * weder teilbar noch uebersteht es den Zurueck-Knopf. Die Helfer dazu sind
 * reine Funktionen in {@code reviewFilters.ts}.
 *
 * <p><strong>Die Kennzahlen ignorieren Suche und Filter.</strong> Sie
 * beschreiben die Arbeitslast und nicht die aktuelle Trefferliste, und
 * kommen deshalb aus vier eigenen Abfragen statt aus der geladenen Seite
 * (Begruendung an {@code useReviewCounts}).
 *
 * <p><strong>Sie sehen aus wie die Kacheln des Dashboards</strong> (Vorgabe
 * zur Nacharbeit): Symbol oben rechts, Zahl links, Wort daneben. Aufbau und
 * Symbolzuordnung stehen deshalb nicht mehr hier, sondern in {@code KpiTile}
 * und in {@code PROJECT_STATUS_ICONS}; sonst saehe derselbe Status auf zwei
 * Seiten verschieden aus.
 */
export default function ReviewListPage() {
  const { t, i18n } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  /* Zahlen formatiert die Bibliothek, nicht der Code: dreistellige Werte
     bekommen sonst je nach Sprache einen anderen Trenner als auf der
     Startseite. */
  const numberFormat = new Intl.NumberFormat(i18n.language)
  const state = readReviewState(searchParams)

  const params: ReviewListParams = {}
  if (state.q !== "") {
    params.q = state.q
  }
  if (state.page > 1) {
    params.page = state.page - 1
  }
  const status = statusQueryValue(state.status)
  if (status !== undefined) {
    params.status = status
  }
  if (state.studyProgram !== null) {
    params.studyProgram = state.studyProgram
  }
  if (state.semester !== null) {
    params.semester = state.semester
  }
  if (state.module !== null) {
    params.module = state.module
  }

  const list = useReviewList(params)
  const {
    counts,
    isPending: countsPending,
    isError: countsFailed,
  } = useReviewCounts()
  /* Der Inhalt der Nominierungskarte: die eigenen Vorschlaege in allen
     Staenden. */
  const { nominations, top10 } = useOwnNominations()
  /* Ob ein Projekt einen Platz belegt; der offene Vorschlag steht seit
     Contract v90 an der Kachel selbst (§3.11). */
  const inTop10 = useTop10ProjectIds()
  const options = useReviewFilterOptions()
  const nominate = useNominateProject()

  /*
   * Das Suchfeld haelt nur den Tippzwischenstand; massgeblich ist die URL.
   * Dasselbe Muster wie in der Projektbibliothek: replace statt push, damit
   * nicht jeder Buchstabe ein Historieneintrag wird.
   */
  const [searchDraft, setSearchDraft] = useState(state.q)
  const [lastQ, setLastQ] = useState(state.q)
  if (state.q !== lastQ) {
    setLastQ(state.q)
    setSearchDraft(state.q)
  }

  useEffect(() => {
    if (searchDraft === state.q) {
      return
    }
    const timer = window.setTimeout(() => {
      setSearchParams(
        (previous) => writeReviewState(previous, { q: searchDraft }),
        { replace: true }
      )
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [searchDraft, state.q, setSearchParams])

  /* Ein geoeffneter Dialog ist Komponentenzustand und gehoert nicht in die
     Adresse: er beschreibt keinen teilbaren Ausschnitt der Liste. */
  const [nominationFor, setNominationFor] =
    useState<ProjectCardResponse | null>(null)
  /* Der Ausloeser der zuletzt geoeffneten Zeile, fuer die Fokusrueckgabe. */
  const nominationTrigger = useRef<HTMLElement | null>(null)
  /* Fokusziel, wenn eine Zeile nach dem Abgeben der Zuweisung aus der
     Liste faellt (SC 2.4.3). */
  const table = useRef<HTMLTableElement | null>(null)
  const [notice, setNotice] = useState("")
  /*
   * Der Fehler eines Zeilenvorgangs braucht eine sichtbare Stelle. Die
   * Rueckfrage ist zu diesem Zeitpunkt geschlossen, und eine Meldung, die
   * allein in der Live-Region steht, erreicht sehende Personen nicht
   * (Befund des frontend-reviewers).
   */
  const [rowError, setRowError] = useState<string | null>(null)

  const rows = list.data?.content ?? []
  const totalPages = list.data?.totalPages ?? 0

  function pageSearch(target: number): string {
    const next = writeReviewState(searchParams, { page: target })
    const encoded = next.toString()
    return encoded === "" ? "/reviews" : `/reviews?${encoded}`
  }

  function goToPage(event: MouseEvent, target: number) {
    event.preventDefault()
    setSearchParams((previous) => writeReviewState(previous, { page: target }))
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <p className="type-overline text-muted-foreground">
          {t("project.list.label")}
        </p>
        <h1 className="type-title text-primary">{t("review.list.title")}</h1>
        <p className="type-body-lg text-muted-foreground">
          {t("review.list.subtitle")}
        </p>
        <hr className="mt-2" />
      </header>

      {/* Kennzahlen */}
      <Card>
        <CardContent className="flex flex-col gap-4">
          <h2 className="type-label-xs font-medium tracking-widest text-muted-foreground uppercase">
            {t("review.list.counts.title")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Skelette statt Kacheln mit Skelett-Wert: KpiTile rendert den
                Wert in einem p, und ein div darin ist ungueltiges Markup
                (Befund des frontend-reviewers). Dasselbe Muster wie auf der
                Startseite. */}
            {countsPending
              ? REVIEW_STATUSES.map((entry) => (
                  <Skeleton key={entry} className="h-17 rounded-modal" />
                ))
              : REVIEW_STATUSES.map((entry) => {
                  const Icon = PROJECT_STATUS_ICONS[entry]
                  return (
                    <KpiTile
                      key={entry}
                      icon={<Icon aria-hidden="true" />}
                      value={
                        countsFailed
                          ? /* Eine gescheiterte Zaehlabfrage ist keine Null: der
                           Strich sagt „unbekannt", die 0 sagte „keine". */
                            t("review.list.counts.unavailable")
                          : numberFormat.format(counts[entry] ?? 0)
                      }
                      label={t(`project.status.${entry}`)}
                    />
                  )
                })}
          </div>
        </CardContent>
      </Card>

      {/* Suche, Filter und Statusleiste */}
      <Card>
        <CardContent className="flex flex-col gap-4">
          {/* Ohne die drei Beschriftungen stehen alle vier
              Bedienelemente auf derselben Hoehe (h-11) und auf
              derselben Grundlinie; die frueheren Zeilen darueber
              schoben die Auswahlfelder gegen das Suchfeld. */}
          <div className="grid items-end gap-4 lg:grid-cols-4">
            <SearchInput
              label={t("review.list.search.label")}
              labelHidden
              placeholder={t("review.list.search.placeholder")}
              value={searchDraft}
              onValueChange={setSearchDraft}
            />
            <FilterSelect
              label={t("review.list.filter.studyProgramLabel")}
              labelHidden
              allLabel={t("review.list.filter.allStudyPrograms")}
              options={(options.studyPrograms.data ?? []).map((entry) => ({
                value: entry.id,
                label: entry.name,
              }))}
              value={state.studyProgram}
              onValueChange={(value) =>
                setSearchParams((previous) =>
                  writeReviewState(previous, { studyProgram: value })
                )
              }
            />
            <FilterSelect
              label={t("review.list.filter.semesterLabel")}
              labelHidden
              allLabel={t("review.list.filter.allSemesters")}
              options={(options.semesters.data ?? []).map((entry) => ({
                value: entry.id,
                label: entry.name,
              }))}
              value={state.semester}
              onValueChange={(value) =>
                setSearchParams((previous) =>
                  writeReviewState(previous, { semester: value })
                )
              }
            />
            <FilterSelect
              label={t("review.list.filter.moduleLabel")}
              labelHidden
              allLabel={t("review.list.filter.allModules")}
              options={(options.modules.data ?? []).map((entry) => ({
                value: entry.id,
                label: entry.name,
              }))}
              value={state.module}
              onValueChange={(value) =>
                setSearchParams((previous) =>
                  writeReviewState(previous, { module: value })
                )
              }
            />
          </div>

          <ProjectStatusFilter
            label={t("review.list.statusFilter")}
            statuses={REVIEW_STATUSES}
            value={state.status}
            onValueChange={(value) =>
              setSearchParams((previous) =>
                writeReviewState(previous, { status: value })
              )
            }
          />
        </CardContent>
      </Card>

      {/* Tabelle */}
      {list.error !== null && <ErrorState error={list.error} />}

      {list.isPending && (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="h-10 w-full rounded-control" />
            <Skeleton className="h-10 w-full rounded-control" />
            <Skeleton className="h-10 w-full rounded-control" />
          </CardContent>
        </Card>
      )}

      {rowError !== null && (
        <ErrorState message={rowError} />
      )}

      {list.data !== undefined && rows.length === 0 && (
        <EmptyState
          icon={<FolderOpenIcon aria-hidden="true" />}
          title={t("review.list.empty.title")}
          description={
            state.status === ALL_STATUSES && state.q === ""
              ? t("review.list.empty.description")
              : t("review.list.empty.filtered")
          }
        />
      )}

      {rows.length > 0 && (
        <Card>
          <CardContent className="overflow-x-auto">
            {/* tabIndex -1: nach dem Abgeben der Zuweisung faellt das
                Projekt womoeglich aus editor=me, und die Zeile samt
                Menueknopf verschwindet. Ohne dieses Ziel fiele der Fokus auf
                body und die naechste Tabulatorreihe begaenne wieder ganz
                oben (SC 2.4.3). */}
            <Table ref={table} tabIndex={-1} className="outline-none">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("review.list.column.project")}</TableHead>
                  <TableHead>{t("review.list.column.students")}</TableHead>
                  <TableHead>{t("project.detail.meta.studyProgram")}</TableHead>
                  <TableHead>{t("project.detail.meta.semester")}</TableHead>
                  <TableHead>{t("project.detail.meta.module")}</TableHead>
                  <TableHead>{t("review.list.column.status")}</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">
                      {t("review.list.column.actions")}
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((project) => (
                  <ReviewRow
                    key={project.id}
                    project={project}
                    inTop10={inTop10.has(project.id)}
                    onNominate={(trigger) => {
                      nominationTrigger.current = trigger.current
                      setNominationFor(project)
                    }}
                    onNotice={(message) => {
                      setNotice(message)
                      table.current?.focus()
                    }}
                    onError={setRowError}
                  />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Ohne Blaetterleiste waere ab der 21. Zuweisung der Rest der eigenen
          Arbeitsliste nicht mehr erreichbar, und die Seitenzahl in der
          Adresse haette kein Bedienelement (Befund des frontend-reviewers).
          Dasselbe Muster wie in der Projektbibliothek. */}
      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              {state.page > 1 ? (
                <PaginationPrevious
                  href={pageSearch(state.page - 1)}
                  onClick={(event) => goToPage(event, state.page - 1)}
                />
              ) : (
                <PaginationPrevious
                  aria-disabled="true"
                  className="pointer-events-none opacity-50"
                />
              )}
            </PaginationItem>
            {paginationItems(state.page, totalPages).map((item) =>
              typeof item === "number" ? (
                <PaginationItem key={item}>
                  <PaginationLink
                    href={pageSearch(item)}
                    onClick={(event) => goToPage(event, item)}
                    isActive={item === state.page}
                  >
                    {item}
                  </PaginationLink>
                </PaginationItem>
              ) : (
                <PaginationItem key={item}>
                  <PaginationEllipsis />
                </PaginationItem>
              )
            )}
            <PaginationItem>
              {state.page < totalPages ? (
                <PaginationNext
                  href={pageSearch(state.page + 1)}
                  onClick={(event) => goToPage(event, state.page + 1)}
                />
              ) : (
                <PaginationNext
                  aria-disabled="true"
                  className="pointer-events-none opacity-50"
                />
              )}
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {/* Ein Bereich fuer laufende wie erledigte Vorschlaege; die
          Standsleiste darin ersetzt den frueheren zweiten Kasten
          „Mein Nominierungs-Verlauf", der dieselben Zeilen ein zweites Mal
          zeigte. Volle Breite, weil er ohne Nachbarn steht. */}
      <NominationPanel
        nominations={nominations.data ?? []}
        top10={top10.data}
        isPending={nominations.isPending}
        error={nominations.error ?? top10.error ?? undefined}
      />

      {nominationFor !== null && (
        <NominationDialog
          open
          onOpenChange={(next) => {
            if (!next) {
              setNominationFor(null)
              nominate.reset()
            }
          }}
          projectTitle={nominationFor.title}
          finalFocus={nominationTrigger}
          pending={nominate.isPending}
          error={nominate.error}
          onSubmit={(proposedTier) => {
            nominate.mutate(
              { projectId: nominationFor.id, proposedTier },
              {
                onSuccess: () => {
                  setNominationFor(null)
                  setNotice(t("review.nomination.done"))
                },
              }
            )
          }}
        />
      )}

      {/* Eine Ansage je Vorgang: Nominierung und abgegebene Zuweisung
          aendern die Liste weiter oben, und ohne Live-Region bliebe beides
          fuer Screenreader unbemerkt (SC 4.1.3). */}
      <span className="sr-only" role="status">
        {notice}
      </span>
    </div>
  )
}

/**
 * Eine Zeile mit ihrem Menue. Eigene Komponente, weil das Abgeben der
 * Zuweisung eine Mutation je Projekt braucht und ein Hook nicht in einer
 * Schleife entstehen darf.
 */
function ReviewRow({
  project,
  inTop10,
  onNominate,
  onNotice,
  onError,
}: {
  project: ProjectCardResponse
  inTop10: boolean
  onNominate: (trigger: RefObject<HTMLElement | null>) => void
  onNotice: (message: string) => void
  /** Sichtbare Meldung ueber der Tabelle; die Live-Region genuegt nicht. */
  onError: (message: string | null) => void
}) {
  const { t } = useTranslation()
  const apiMessage = useApiErrorMessage()
  const { resign } = useReviewWorkflow(project.id)

  return (
    <ProjectTableRow
      title={project.title}
      href={`/projects/${project.id}`}
      author={project.author}
      studyProgram={project.studyProgram}
      semester={project.semester?.name}
      module={project.module}
      status={project.status}
      actions={
        <ReviewRowMenu
          project={project}
          inTop10={inTop10}
          resignPending={resign.isPending}
          onNominate={onNominate}
          onResign={() => {
            onError(null)
            resign.mutate(undefined, {
              onSuccess: (updated) =>
                onNotice(
                  t("review.list.resignDone", {
                    title: project.title,
                    status: t(`project.status.${updated.status}`),
                  })
                ),
              onError: (error) => {
                const message = apiMessage(error)
                /* Beides: sichtbar ueber der Tabelle und angesagt. */
                onError(message)
                onNotice(message)
              },
            })
          }}
        />
      }
    />
  )
}
