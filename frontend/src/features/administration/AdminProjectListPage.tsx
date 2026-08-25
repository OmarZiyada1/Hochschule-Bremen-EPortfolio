import { FolderOpenIcon, RotateCcwIcon, SendIcon } from "lucide-react"
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type RefObject,
} from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"

import { apiErrorMessageKey, isApiError } from "@/api/errors"
import type { AdminProjectListParams } from "@/api/queries/projects"
import type {
  BulkStatusAction,
  ProjectBulkStatusResultResponse,
  ProjectCardResponse,
} from "@/api/types"
import { EmptyState } from "@/components/common/EmptyState"
import { FilterSelect } from "@/components/common/FilterSelect"
import { ProjectStatusFilter } from "@/components/common/ProjectStatusFilter"
import { ProjectTableRow } from "@/components/common/ProjectTableRow"
import { SearchInput } from "@/components/common/SearchInput"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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
  ADMIN_PROJECT_STATUSES,
  readAdminProjectState,
  writeAdminProjectState,
} from "@/features/administration/adminProjectFilters"
import { AdminProjectRowMenu } from "@/features/administration/components/AdminProjectRowMenu"
import { BulkStatusDialog } from "@/features/administration/components/BulkStatusDialog"
import { EditorAssignmentDialog } from "@/features/administration/components/EditorAssignmentDialog"
import {
  useAdminFilterOptions,
  useAdminProjectList,
  useBulkProjectStatus,
  useDeleteProject,
  useReassignEditors,
} from "@/features/administration/hooks/useAdministration"
import {
  ALL_STATUSES,
  statusQueryValue,
} from "@/features/portfolio/ownProjectStatus"
import { paginationItems } from "@/features/projects/paginationItems"

/* Entprellzeit der Suche: kein Request je Tastenanschlag (Skill frontend-api). */
const SEARCH_DEBOUNCE_MS = 300

/**
 * Die Projektverwaltung der Administrationsseite (Template „Admin Projects",
 * KAN-38): Suche, drei Auswahlfelder, Statusleiste, Tabelle mit
 * Mehrfachauswahl und Zeilenmenue.
 *
 * <p><strong>Die einzige Ansicht, die Entwuerfe fremder Projekte zeigt.</strong>
 * Die Liste laeuft ohne Statuseinschraenkung; ADMIN sieht alle Projekte in
 * allen Status (§5 Fussnote 11), waehrend die oeffentliche Bibliothek seit
 * Contract v42 fest auf {@code PUBLISHED} steht. Die Schranke liegt im Server:
 * ein Nicht-Admin bekaeme hier dieselbe Liste, die §5 ihm zugesteht.
 *
 * <p><strong>Spalten und Filter folgen dem Frame</strong> (Klaerungsrunde zu
 * KAN-38). Er zeichnet Projektname, Studierende, Studiengang, Semester, Fach
 * und Status, dazu Suche und drei Auswahlfelder; die frueher im Ticket
 * genannte Fakultaetsspalte und die Spalte „letzte Aenderung" entfallen. Fuer
 * letztere gibt es ohnehin kein Feld: {@code ProjectCardResponse} fuehrt
 * {@code publishedAt}, aber kein {@code updatedAt} (§6.1). Ebenso wenig kennt
 * {@code GET /projects} einen Zeitraumfilter.
 *
 * <p><strong>Suche, Status, Filter und Seite stehen in der Adresse</strong>
 * und nicht in {@code useState}: ein Ergebnis ist sonst weder teilbar noch
 * uebersteht es den Zurueck-Knopf. Die Helfer dazu sind reine Funktionen in
 * {@code adminProjectFilters.ts}.
 *
 * <p><strong>Die Auswahl gehoert nicht in die Adresse.</strong> Sie beschreibt
 * keinen teilbaren Ausschnitt, sondern eine begonnene Handlung, und sie wird
 * beim Blaettern und bei jedem Filterwechsel geleert: die ausgewaehlten Zeilen
 * sind dann nicht mehr zu sehen, und eine unsichtbare Auswahl per Sammelaktion
 * zu veroeffentlichen waere nicht zu verantworten.
 */
export default function AdminProjectListPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const state = readAdminProjectState(searchParams)

  const params: AdminProjectListParams = {}
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

  const list = useAdminProjectList(params)
  const options = useAdminFilterOptions()
  const bulk = useBulkProjectStatus()
  const remove = useDeleteProject()
  const reassign = useReassignEditors()

  /*
   * Das Suchfeld haelt nur den Tippzwischenstand; massgeblich ist die URL.
   * Dasselbe Muster wie in „Meine Reviews": replace statt push, damit nicht
   * jeder Buchstabe ein Historieneintrag wird.
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
        (previous) => writeAdminProjectState(previous, { q: searchDraft }),
        { replace: true }
      )
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [searchDraft, state.q, setSearchParams])

  const rows = list.data?.content ?? []
  const totalPages = list.data?.totalPages ?? 0
  const totalElements = list.data?.totalElements ?? 0

  /* Die Auswahl haelt IDs und nicht Zeilen: eine Zeile, die durch das
     Neuladen verschwindet, soll die Auswahl nicht mit einem veralteten
     Objekt weiterschleppen. */
  const [selected, setSelected] = useState<string[]>([])
  const selectionKey = searchParams.toString()
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey)
  if (selectionKey !== lastSelectionKey) {
    setLastSelectionKey(selectionKey)
    setSelected([])
  }

  const selectableIds = rows.map((project) => project.id)
  const selectedOnPage = selected.filter((id) => selectableIds.includes(id))
  const allOnPageSelected =
    selectableIds.length > 0 && selectedOnPage.length === selectableIds.length

  /* Ein geoeffneter Dialog ist Komponentenzustand und gehoert nicht in die
     Adresse: er beschreibt keinen teilbaren Ausschnitt der Liste. */
  const [statusDialog, setStatusDialog] = useState<{
    action: BulkStatusAction
    projects: ProjectCardResponse[]
  } | null>(null)
  const [editorsFor, setEditorsFor] = useState<ProjectCardResponse | null>(null)
  const dialogTrigger = useRef<HTMLElement | null>(null)
  /*
   * Fokusziel, wenn das auslesende Element unter dem Fokus verschwindet: nach
   * dem Loeschen faellt die Zeile samt Menueknopf weg, nach einem
   * Sammelwechsel raeumt sich die Auswahl und mit ihr die Leiste, in der der
   * Knopf stand. Ohne dieses Ziel landet der Fokus auf body und die naechste
   * Tabulatorreihe begaenne wieder ganz oben (SC 2.4.3). Dasselbe Muster wie
   * in „Meine Reviews".
   */
  const table = useRef<HTMLTableElement | null>(null)
  const [results, setResults] = useState<
    ProjectBulkStatusResultResponse[] | undefined
  >(undefined)
  const [rowError, setRowError] = useState<string | null>(null)
  const [notice, setNotice] = useState("")

  function openStatusDialog(
    action: BulkStatusAction,
    projects: ProjectCardResponse[],
    trigger?: RefObject<HTMLElement | null>
  ) {
    dialogTrigger.current = trigger?.current ?? null
    setResults(undefined)
    bulk.reset()
    setStatusDialog({ action, projects })
  }

  function pageSearch(target: number): string {
    const next = writeAdminProjectState(searchParams, { page: target })
    const encoded = next.toString()
    return encoded === ""
      ? "/administration/projects"
      : `/administration/projects?${encoded}`
  }

  function goToPage(event: MouseEvent, target: number) {
    event.preventDefault()
    setSearchParams((previous) =>
      writeAdminProjectState(previous, { page: target })
    )
  }

  /*
   * Die Zahl der ausgewaehlten Zeilen wandert in die dauerhafte Live-Region am
   * Seitenende und nicht in die Sammelleiste: eine Region, die zusammen mit
   * ihrem Inhalt in den Baum kommt, sagt bei den gaengigen Screenreadern
   * nichts an (Befund des frontend-reviewers). Angesagt wird je Klick, nicht
   * je Tastendruck, das ist unkritisch.
   */
  function announceSelection(count: number) {
    setNotice(
      count === 0
        ? t("administration.projects.bulk.cleared")
        : t("administration.projects.bulk.selected", { count })
    )
  }

  function messageOf(error: unknown): string {
    return isApiError(error)
      ? t(apiErrorMessageKey(error), { defaultValue: error.message })
      : t("apiError.INTERNAL_ERROR")
  }

  const selectedProjects = rows.filter((project) =>
    selected.includes(project.id)
  )

  return (
    <>
      <header className="flex flex-col gap-2">
        <p className="type-overline tracking-widest text-muted-foreground uppercase">
          {t("administration.label")}
        </p>
        <h1 className="type-title text-primary">
          {t("administration.projects.title")}
        </h1>
        <p className="type-body-lg text-muted-foreground">
          {list.data === undefined
            ? t("administration.projects.subtitleLoading")
            : t("administration.projects.subtitle", { count: totalElements })}
        </p>
        <hr className="mt-2" />
      </header>

      {/* Suche, Filter und Statusleiste */}
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="grid items-end gap-4 lg:grid-cols-4">
            <SearchInput
              label={t("administration.projects.search.label")}
              labelHidden
              placeholder={t("administration.projects.search.placeholder")}
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
                  writeAdminProjectState(previous, { studyProgram: value })
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
                  writeAdminProjectState(previous, { semester: value })
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
                  writeAdminProjectState(previous, { module: value })
                )
              }
            />
          </div>

          {/* Alle fuenf Status, DRAFT eingeschlossen: die Administration
              sieht auch Entwuerfe (§5 Fussnote 11). */}
          <ProjectStatusFilter
            label={t("administration.projects.statusFilter")}
            statuses={ADMIN_PROJECT_STATUSES}
            value={state.status}
            onValueChange={(value) =>
              setSearchParams((previous) =>
                writeAdminProjectState(previous, { status: value })
              )
            }
          />
        </CardContent>
      </Card>

      {/* Die Sammelleiste erscheint erst mit einer Auswahl und nennt deren
          Umfang: eine dauerhaft sichtbare Leiste mit gesperrten Knoepfen
          saehe nach einer Handlung aus, die es gerade nicht gibt. */}
      {selectedOnPage.length > 0 && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3">
            {/* Kein role="status" hier: diese Zeile entsteht zusammen mit der
                Leiste, und eine Live-Region, die im selben Moment in den Baum
                kommt, in dem sie Inhalt bekommt, sagt nichts an. Angesagt wird
                ueber die dauerhafte Region am Seitenende. */}
            <p className="type-body-sm font-semibold">
              {t("administration.projects.bulk.selected", {
                count: selectedOnPage.length,
              })}
            </p>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => openStatusDialog("publish", selectedProjects)}
              >
                <SendIcon aria-hidden="true" />
                {t("administration.projects.action.publish")}
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  openStatusDialog("request-revision", selectedProjects)
                }
              >
                <RotateCcwIcon aria-hidden="true" />
                {t("administration.projects.action.requestRevision")}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setSelected([])
                  announceSelection(0)
                }}
              >
                {t("administration.projects.bulk.clear")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {list.error !== null && (
        <Alert variant="destructive">
          <AlertTitle>{messageOf(list.error)}</AlertTitle>
        </Alert>
      )}

      {rowError !== null && (
        <Alert variant="destructive">
          <AlertTitle>{rowError}</AlertTitle>
        </Alert>
      )}

      {list.isPending && (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="h-10 w-full rounded-control" />
            <Skeleton className="h-10 w-full rounded-control" />
            <Skeleton className="h-10 w-full rounded-control" />
          </CardContent>
        </Card>
      )}

      {list.data !== undefined && rows.length === 0 && (
        <EmptyState
          icon={<FolderOpenIcon aria-hidden="true" />}
          title={t("administration.projects.empty.title")}
          description={
            /* „Noch nichts angelegt" darf nur dastehen, wenn wirklich nichts
               eingeschraenkt ist: mit gesetztem Studiengang, Semester oder
               Fach waere der Satz schlicht falsch. */
            state.status === ALL_STATUSES &&
            state.q === "" &&
            state.studyProgram === null &&
            state.semester === null &&
            state.module === null
              ? t("administration.projects.empty.description")
              : t("administration.projects.empty.filtered")
          }
        />
      )}

      {rows.length > 0 && (
        <Card>
          <CardContent className="overflow-x-auto">
            {/* tabIndex -1: siehe die Begruendung an table weiter oben. */}
            <Table ref={table} tabIndex={-1} className="outline-none">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-0">
                    {/* checked und indeterminate sind bei Base UI zwei
                        getrennte Props: eine teilweise gefuellte Auswahl ist
                        weder gesetzt noch leer, und aria-checked="mixed"
                        entsteht erst aus dieser Kombination.

                        Sichtbar reicht das nicht: die Primitive zeigt ihren
                        Haken auch bei indeterminate, und data-checked greift
                        dabei nicht, sodass sich Teil- und Vollauswahl allein
                        durch die Fuellung unterscheiden. Die generierte Datei
                        wird nicht angefasst (Frontend-Regel 11), also steht
                        die Kennzeichnung hier: der Haken verschwindet und ein
                        Balken tritt an seine Stelle. */}
                    <Checkbox
                      className="data-indeterminate:border-primary data-indeterminate:bg-primary data-indeterminate:text-primary-foreground data-indeterminate:before:absolute data-indeterminate:before:h-0.5 data-indeterminate:before:w-2 data-indeterminate:before:rounded-pill data-indeterminate:before:bg-current data-indeterminate:[&>[data-slot=checkbox-indicator]]:hidden"
                      checked={allOnPageSelected}
                      indeterminate={
                        selectedOnPage.length > 0 && !allOnPageSelected
                      }
                      onCheckedChange={(checked) => {
                        const next = checked ? selectableIds : []
                        setSelected(next)
                        announceSelection(next.length)
                      }}
                      aria-label={t("administration.projects.bulk.selectAll")}
                    />
                  </TableHead>
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
                  <ProjectTableRow
                    key={project.id}
                    title={project.title}
                    href={`/projects/${project.id}`}
                    author={project.author}
                    studyProgram={project.studyProgram}
                    semester={project.semester?.name}
                    module={project.module}
                    status={project.status}
                    selection={
                      <Checkbox
                        checked={selected.includes(project.id)}
                        onCheckedChange={(checked) => {
                          setSelected((previous) => {
                            const next = checked
                              ? [...previous, project.id]
                              : previous.filter((id) => id !== project.id)
                            announceSelection(next.length)
                            return next
                          })
                        }}
                        aria-label={t(
                          "administration.projects.bulk.selectRow",
                          {
                            title: project.title,
                          }
                        )}
                      />
                    }
                    actions={
                      <AdminProjectRowMenu
                        project={project}
                        deletePending={remove.isPending}
                        onChangeStatus={(action, trigger) =>
                          openStatusDialog(action, [project], trigger)
                        }
                        onAssignEditors={(trigger) => {
                          dialogTrigger.current = trigger.current
                          reassign.reset()
                          setEditorsFor(project)
                        }}
                        onDelete={() => {
                          setRowError(null)
                          remove.mutate(project.id, {
                            onSuccess: () => {
                              setNotice(
                                t("administration.projects.deleteDone", {
                                  title: project.title,
                                })
                              )
                              table.current?.focus()
                            },
                            onError: (error) => {
                              const message = messageOf(error)
                              setRowError(message)
                              setNotice(message)
                            },
                          })
                        }}
                      />
                    }
                  />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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

      {statusDialog !== null && (
        <BulkStatusDialog
          open
          onOpenChange={(next) => {
            if (!next) {
              setStatusDialog(null)
              setResults(undefined)
              bulk.reset()
              /* Nach einem gelaufenen Wechsel ist die Auswahl verbraucht:
                 die Zeilen stehen jetzt in einem anderen Status, und eine
                 stehengebliebene Auswahl liefe beim naechsten Klick in
                 lauter 409. */
              if (results !== undefined) {
                setSelected([])
                /* Die Sammelleiste, aus der der Dialog kam, ist danach weg;
                   finalFocus liefe ins Leere (SC 2.4.3). */
                table.current?.focus()
              }
            }
          }}
          action={statusDialog.action}
          projectTitles={statusDialog.projects.map((project) => project.title)}
          pending={bulk.isPending}
          error={bulk.error}
          results={results}
          finalFocus={dialogTrigger}
          onSubmit={(reason) => {
            bulk.mutate(
              {
                projectIds: statusDialog.projects.map((project) => project.id),
                action: statusDialog.action,
                ...(reason === undefined ? {} : { reason }),
              },
              {
                onSuccess: (response) => {
                  setResults(response.results)
                  setNotice(
                    t("administration.projects.statusDialog.summary", {
                      succeeded: response.results.filter(
                        (entry) => entry.success
                      ).length,
                      total: response.results.length,
                    })
                  )
                },
              }
            )
          }}
        />
      )}

      {editorsFor !== null && (
        <EditorAssignmentDialog
          open
          onOpenChange={(next) => {
            if (!next) {
              setEditorsFor(null)
              reassign.reset()
            }
          }}
          projectId={editorsFor.id}
          projectTitle={editorsFor.title}
          pending={reassign.isPending}
          error={reassign.error}
          finalFocus={dialogTrigger}
          onSubmit={(editorIds) => {
            reassign.mutate(
              { projectId: editorsFor.id, editorIds },
              {
                onSuccess: () => {
                  setEditorsFor(null)
                  setNotice(
                    t("administration.projects.editorsDialog.done", {
                      title: editorsFor.title,
                    })
                  )
                },
              }
            )
          }}
        />
      )}

      {/* Eine Ansage je Vorgang: Loeschen, Statuswechsel und Zuweisung
          aendern die Liste weiter oben, und ohne Live-Region bliebe das fuer
          Screenreader unbemerkt (SC 4.1.3). */}
      <span className="sr-only" role="status">
        {notice}
      </span>
    </>
  )
}
