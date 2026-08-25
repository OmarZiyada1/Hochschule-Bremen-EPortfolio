import { useQuery } from "@tanstack/react-query"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CalendarIcon,
  PencilIcon,
} from "lucide-react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"

import { apiErrorMessageKey, isApiError } from "@/api/errors"
import { masterDataQueries } from "@/api/queries/masterData"
import type { SemesterResponse } from "@/api/types"
import { EmptyState } from "@/components/common/EmptyState"
import { SearchInput } from "@/components/common/SearchInput"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { MasterDataRowMenu } from "@/features/administration/components/MasterDataRowMenu"
import {
  readMasterDataSearch,
  writeMasterDataSearch,
} from "@/features/administration/masterDataSearch"
import { NameCreateForm } from "@/features/administration/components/NameCreateForm"
import { NameEditDialog } from "@/features/administration/components/NameEditDialog"
import { SEMESTER_NAME_MAX } from "@/features/administration/components/masterDataName.schema"
import {
  useCreateSemester,
  useDeleteSemester,
  useMoveSemester,
  useUpdateSemester,
} from "@/features/administration/hooks/useMasterDataAdmin"

/**
 * Die Semesterpflege der Administrationsseite (Template „Semester", Frames
 * {@code Admin · Semester} und {@code · Leerzustand}, KAN-39): Suche,
 * Anlegefeld, Tabelle mit Umschalter je Zeile und Zeilenmenue.
 *
 * <p><strong>Der Status ist ein Umschalter, kein Badge mit Zusatzaktion.</strong>
 * Er zeigt den Zustand und aendert ihn an derselben Stelle; geschaltet wird
 * ueber {@code PATCH /api/admin/semesters/{id}} mit {@code { active }}. Das
 * Feld ist ein gewoehnliches Attribut der Zeile und kein Zustandsuebergang
 * im Sinne von §4.1, deshalb gibt es dafuer auch keinen eigenen Endpoint.
 *
 * <p><strong>Deaktivieren ist kein Loeschen.</strong> Ein deaktiviertes
 * Semester bleibt an seinen Projekten stehen und bleibt ein gueltiger
 * Filterwert; es verschwindet nur aus der Auswahl beim Anlegen (§3.18).
 * Genau das sagt der Hinweis unter dem Anlegefeld.
 *
 * <p><strong>Die Reihenfolge ist ein Feld, keine Sortierung.</strong>
 * Alphabetisch stuende „SoSe 2026" vor „WiSe 2025/26"; {@code sortOrder}
 * setzt die Administration ueber die beiden Pfeile der Zeile. Uebernommen
 * wird die neue Ordnung erst mit der Antwort des Servers, nicht
 * optimistisch: sie betrifft immer zwei Zeilen, und der Endpoint schickt
 * die vollstaendige Liste zurueck. Am oberen und unteren Rand sind die
 * Pfeile gesperrt.
 *
 * <p><strong>Gesucht wird im Client.</strong> {@code GET /api/semesters} ist
 * PUBLIC, vollstaendig und ohne Paginierung (§6.1); einen Suchparameter
 * kennt der Endpoint nicht, und die Liste ist klein genug.
 */
export default function AdminSemesterListPage() {
  const { t } = useTranslation()
  /* Ohne Filter: die Verwaltung zeigt auch die deaktivierten Semester, das
     Metadatenformular liest dieselbe Liste in ihrer aktiven Variante. */
  const semesters = useQuery(masterDataQueries.semesters())
  const create = useCreateSemester()
  const update = useUpdateSemester()
  const remove = useDeleteSemester()
  const move = useMoveSemester()

  /* Der Suchbegriff steht in der Adresse und nicht in useState: ein
     Ergebnis ist sonst weder teilbar noch uebersteht es den
     Zurueck-Knopf (Skill frontend-modul, Abschnitt 3). */
  const [searchParams, setSearchParams] = useSearchParams()
  const search = readMasterDataSearch(searchParams)
  const [renameFor, setRenameFor] = useState<SemesterResponse | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)
  const [notice, setNotice] = useState("")
  const dialogTrigger = useRef<HTMLElement | null>(null)
  const table = useRef<HTMLTableElement | null>(null)

  const all = semesters.data ?? []
  const needle = search.trim().toLocaleLowerCase("de")
  const rows =
    needle === ""
      ? all
      : all.filter((entry) =>
          entry.name.toLocaleLowerCase("de").includes(needle)
        )
  const selectable = all.filter((entry) => entry.active).length

  function messageOf(error: unknown): string {
    return isApiError(error)
      ? t(apiErrorMessageKey(error), { defaultValue: error.message })
      : t("apiError.INTERNAL_ERROR")
  }

  function reportError(error: unknown) {
    const message = messageOf(error)
    setRowError(message)
    setNotice(message)
  }

  /**
   * Der 409 beim Loeschen meint etwas anderes als derselbe Code am Feld:
   * hier verweisen noch Projekte auf die Zeile (§3.18, §6.1). Wer sie
   * loswerden will, deaktiviert sie stattdessen.
   */
  function reportDeleteError(error: unknown, name: string) {
    const message =
      isApiError(error) && error.errorCode === "RESOURCE_IN_USE"
        ? t("administration.semesters.deleteBlocked", { name })
        : messageOf(error)
    setRowError(message)
    setNotice(message)
  }

  return (
    <>
      <header className="flex flex-col gap-2">
        <p className="type-overline tracking-widest text-muted-foreground uppercase">
          {t("administration.label")}
        </p>
        <h1 className="type-title text-primary">
          {t("administration.semesters.title")}
        </h1>
        <p className="type-body-lg text-muted-foreground">
          {semesters.data === undefined
            ? t("administration.semesters.subtitleLoading")
            : t("administration.semesters.subtitle", {
                count: all.length,
                selectable,
              })}
        </p>
        <hr className="mt-2" />
      </header>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {/* Im Leerzustand entfaellt das Suchfeld: es gaebe nichts zu
                durchsuchen, und der Frame zeigt dort nur das Anlegefeld. */}
            {all.length > 0 && (
              <SearchInput
                label={t("administration.semesters.search.label")}
                labelHidden
                placeholder={t("administration.semesters.search.placeholder")}
                value={search}
                onValueChange={(value) =>
                  setSearchParams(
                    (previous) => writeMasterDataSearch(previous, value),
                    { replace: true }
                  )
                }
              />
            )}
            <NameCreateForm
              className={all.length > 0 ? undefined : "lg:col-span-2"}
              label={t("administration.semesters.create.label")}
              placeholder={t("administration.semesters.create.placeholder")}
              maxLength={SEMESTER_NAME_MAX}
              tooLongMessageKey="validation.masterData.semesterNameTooLong"
              submitLabel={t("administration.semesters.create.submit")}
              pending={create.isPending}
              onSubmit={async (name) => {
                setRowError(null)
                await create.mutateAsync(name)
                setNotice(t("administration.semesters.created", { name }))
              }}
            />
          </div>
          <p className="type-body-sm text-muted-foreground">
            {t("administration.semesters.activeHint")}
          </p>
        </CardContent>
      </Card>

      {semesters.error !== null && (
        <Alert variant="destructive">
          <AlertTitle>{messageOf(semesters.error)}</AlertTitle>
        </Alert>
      )}

      {rowError !== null && (
        <Alert variant="destructive">
          <AlertTitle>{rowError}</AlertTitle>
        </Alert>
      )}

      {semesters.isPending && (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="h-10 w-full rounded-control" />
            <Skeleton className="h-10 w-full rounded-control" />
            <Skeleton className="h-10 w-full rounded-control" />
          </CardContent>
        </Card>
      )}

      {semesters.data !== undefined && rows.length === 0 && (
        <EmptyState
          icon={<CalendarIcon aria-hidden="true" />}
          title={
            all.length === 0
              ? t("administration.semesters.empty.title")
              : t("administration.semesters.empty.filteredTitle")
          }
          description={
            all.length === 0
              ? t("administration.semesters.empty.description")
              : t("administration.semesters.empty.filtered")
          }
        />
      )}

      {rows.length > 0 && (
        <Card>
          <CardContent className="overflow-x-auto">
            {/* tabIndex -1: Fokusziel, wenn eine Zeile unter dem Fokus neu
                gezeichnet wird, etwa nach dem Verschieben (SC 2.4.3). */}
            <Table
              ref={table}
              tabIndex={-1}
              className="focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <TableHeader>
                <TableRow>
                  <TableHead>
                    {t("administration.semesters.column.name")}
                  </TableHead>
                  <TableHead>
                    {t("administration.semesters.column.status")}
                  </TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">
                      {t("administration.semesters.column.actions")}
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((semester) => {
                  /* Die Raender beziehen sich auf die ganze Liste und nicht
                     auf das Suchergebnis: verschoben wird in der echten
                     Reihenfolge, nicht in der gefilterten Ansicht. */
                  const position = all.findIndex(
                    (entry) => entry.id === semester.id
                  )
                  const isFirst = position <= 0
                  const isLast = position === all.length - 1

                  return (
                    <TableRow key={semester.id}>
                      <TableCell id={`semester-${semester.id}-name`}>
                        {semester.name}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {/* Der erreichbare Name nennt Zeile und Statuswort:
                              das Wort allein stuende in jeder Zeile gleich da
                              (SC 2.4.6), der Zustand selbst kommt aus
                              aria-checked der Primitive. */}
                          <Switch
                            checked={semester.active}
                            disabled={update.isPending}
                            aria-labelledby={`semester-${semester.id}-name semester-${semester.id}-state`}
                            onCheckedChange={(checked) => {
                              setRowError(null)
                              update.mutate(
                                {
                                  semesterId: semester.id,
                                  request: { active: checked },
                                },
                                {
                                  onSuccess: () =>
                                    setNotice(
                                      t(
                                        checked
                                          ? "administration.semesters.activated"
                                          : "administration.semesters.deactivated",
                                        { name: semester.name }
                                      )
                                    ),
                                  onError: reportError,
                                }
                              )
                            }}
                          />
                          <span
                            id={`semester-${semester.id}-state`}
                            className="type-body-sm"
                          >
                            {t(
                              semester.active
                                ? "administration.semesters.state.active"
                                : "administration.semesters.state.inactive"
                            )}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {/* Die beiden Pfeile stehen in der Zeile und nicht im
                            Menue: Umsortieren heisst meist mehrmals
                            verschieben, und ein Menue, das sich nach jedem
                            Klick schliesst, machte aus einem Zug drei. Sie
                            aendern die Reihenfolge und sind keine
                            Zeilenaktion wie Umbenennen oder Loeschen. */}
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            /* Nur die Raender sperren, nicht die laufende
                               Anfrage: Base UI setzt am nativen Knopf das
                               echte disabled, und ein fokussierter Knopf,
                               der es bekommt, verliert den Fokus an body.
                               Genau das traefe die Bedienung, die hier die
                               haeufigste ist, das mehrfache Verschieben
                               (Befund des frontend-reviewers). Ein zweiter
                               Druck waehrend der Anfrage wird im Handler
                               verworfen. */
                            disabled={isFirst}
                            onClick={() => {
                              if (move.isPending) {
                                return
                              }
                              setRowError(null)
                              move.mutate(
                                { semesterId: semester.id, direction: "UP" },
                                {
                                  onSuccess: () =>
                                    setNotice(
                                      t("administration.semesters.moved", {
                                        name: semester.name,
                                      })
                                    ),
                                  onError: reportError,
                                }
                              )
                            }}
                          >
                            <ArrowUpIcon aria-hidden="true" />
                            {/* Der Name nennt die Zeile: sonst stuenden in der
                                Tabelle lauter gleichnamige Pfeile
                                nebeneinander (SC 2.4.6). */}
                            <span className="sr-only">
                              {t("administration.semesters.moveUpFor", {
                                name: semester.name,
                              })}
                            </span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={isLast}
                            onClick={() => {
                              if (move.isPending) {
                                return
                              }
                              setRowError(null)
                              move.mutate(
                                { semesterId: semester.id, direction: "DOWN" },
                                {
                                  onSuccess: () =>
                                    setNotice(
                                      t("administration.semesters.moved", {
                                        name: semester.name,
                                      })
                                    ),
                                  onError: reportError,
                                }
                              )
                            }}
                          >
                            <ArrowDownIcon aria-hidden="true" />
                            <span className="sr-only">
                              {t("administration.semesters.moveDownFor", {
                                name: semester.name,
                              })}
                            </span>
                          </Button>
                          <MasterDataRowMenu
                            name={semester.name}
                            pending={remove.isPending}
                            deleteLabel={t("administration.masterData.delete")}
                            deleteTitle={t(
                              "administration.semesters.deleteDialog.title"
                            )}
                            deleteDescription={t(
                              "administration.semesters.deleteDialog.description",
                              { name: semester.name }
                            )}
                            deleteConfirm={t(
                              "administration.masterData.deleteConfirm"
                            )}
                            items={[
                              {
                                key: "rename",
                                label: t("administration.masterData.rename"),
                                icon: <PencilIcon aria-hidden="true" />,
                                onSelect: (trigger) => {
                                  dialogTrigger.current = trigger.current
                                  setRenameFor(semester)
                                },
                              },
                            ]}
                            onDelete={() => {
                              setRowError(null)
                              remove.mutate(semester.id, {
                                onSuccess: () => {
                                  setNotice(
                                    t("administration.semesters.deleted", {
                                      name: semester.name,
                                    })
                                  )
                                  table.current?.focus()
                                },
                                onError: (error) =>
                                  reportDeleteError(error, semester.name),
                              })
                            }}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <NameEditDialog
        open={renameFor !== null}
        onOpenChange={(next) => {
          if (!next) {
            setRenameFor(null)
          }
        }}
        title={t("administration.semesters.renameDialog.title")}
        description={t("administration.semesters.renameDialog.description")}
        label={t("administration.semesters.create.label")}
        currentName={renameFor?.name ?? ""}
        maxLength={SEMESTER_NAME_MAX}
        tooLongMessageKey="validation.masterData.semesterNameTooLong"
        pending={update.isPending}
        finalFocus={dialogTrigger}
        onSubmit={async (name) => {
          if (renameFor === null) {
            return
          }
          setRowError(null)
          await update.mutateAsync({
            semesterId: renameFor.id,
            request: { name },
          })
          setNotice(t("administration.semesters.renamed", { name }))
        }}
      />

      {/* Umschalten, Verschieben, Umbenennen und Loeschen aendern die Tabelle
          weiter oben; ohne Live-Region bliebe das fuer Screenreader
          unbemerkt (SC 4.1.3). */}
      <span className="sr-only" role="status">
        {notice}
      </span>
    </>
  )
}
