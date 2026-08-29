import { UserPlusIcon, UsersIcon } from "lucide-react"
import { useEffect, useRef, useState, type MouseEvent } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"

import { useAuth } from "@/api/auth/AuthContext"
import { isApiError } from "@/api/errors"
import type { AdminUserListParams } from "@/api/queries/admin"
import type { AdminUserResponse, UserStatus } from "@/api/types"
import { useApiErrorMessage } from "@/api/useApiErrorMessage"
import { EmptyState } from "@/components/common/EmptyState"
import { ErrorState } from "@/components/common/ErrorState"
import { FilterSelect } from "@/components/common/FilterSelect"
import { SearchInput } from "@/components/common/SearchInput"
import {
  SegmentedFilter,
  type SegmentedOption,
} from "@/components/common/SegmentedFilter"
import { UserTableRow } from "@/components/common/UserTableRow"
import { Button } from "@/components/ui/button"
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
  ADMIN_USER_ROLES,
  ADMIN_USER_STATUSES,
  ALL_ROLES,
  readAdminUserState,
  writeAdminUserState,
  type RoleFilterValue,
} from "@/features/administration/adminUserFilters"
import { AdminUserRowMenu } from "@/features/administration/components/AdminUserRowMenu"
import { ChangeRoleDialog } from "@/features/administration/components/ChangeRoleDialog"
import { CreateUserDialog } from "@/features/administration/components/CreateUserDialog"
import { ResetPasswordDialog } from "@/features/administration/components/ResetPasswordDialog"
import { UserDetailDialog } from "@/features/administration/components/UserDetailDialog"
import {
  useAdminUserList,
  useDeactivateUser,
  useUpdateUser,
} from "@/features/administration/hooks/useAdminUsers"
import { paginationItems } from "@/features/projects/paginationItems"
import { fullNameOf } from "@/lib/name"

/* Entprellzeit der Suche: kein Request je Tastenanschlag (Skill frontend-api). */
const SEARCH_DEBOUNCE_MS = 300

/**
 * Die Nutzerverwaltung der Administrationsseite (Template „Users", KAN-39):
 * Suche, Rollenleiste, Statusfilter, Tabelle und Zeilenmenue, dazu der
 * Dialog „Konto anlegen".
 *
 * <p><strong>Der einzige Ort, an dem die HSB-Adresse fremder Konten
 * steht</strong> (§3.1). Die eigene zeigt seit Contract v50 auch das
 * Profilformular; sonst fuehrt keine Ansicht sie, und deshalb scheidet
 * {@code GET /admin/users} auch als Quelle fuer Personenauswahlfelder aus.
 *
 * <p><strong>Die Spalten folgen {@code AdminUserResponse}, nicht dem
 * Frame.</strong> Der Frame zeichnet zwei Spalten, das Ticket nennt sechs;
 * entschieden ist das Ticket (Klaerungsrunde zu KAN-39). Gebaut wird, was
 * der Endpoint liefert: eine Spalte ohne Datenquelle waere eine Attrappe,
 * und umgekehrt bliebe der Kontostatus unsichtbar, obwohl die Seite nach ihm
 * filtert. Fakultaet, Studiengang und „letzter Login" gibt es weiterhin
 * nicht: §3.1 fuehrt am Konto keines davon.
 *
 * <p><strong>Suche, Rolle, Status und Seite stehen in der Adresse</strong>
 * und nicht in {@code useState}: ein Ergebnis ist sonst weder teilbar noch
 * uebersteht es den Zurueck-Knopf. Sortiert wird nicht: ohne
 * {@code sort}-Parameter steht die Liste alphabetisch nach Nachname und
 * Vorname (§6.6), und ein unbekanntes Sortierfeld ergaebe 400.
 */
export default function AdminUserListPage() {
  const { t, i18n } = useTranslation()
  const apiMessage = useApiErrorMessage()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const state = readAdminUserState(searchParams)

  const params: AdminUserListParams = {}
  if (state.q !== "") {
    params.q = state.q
  }
  if (state.role !== ALL_ROLES) {
    params.role = state.role
  }
  if (state.status !== null) {
    params.status = state.status
  }
  if (state.page > 1) {
    params.page = state.page - 1
  }

  const list = useAdminUserList(params)
  const update = useUpdateUser()
  const deactivate = useDeactivateUser()

  /*
   * Das Suchfeld haelt nur den Tippzwischenstand; massgeblich ist die URL.
   * Dasselbe Muster wie in der Projektverwaltung: replace statt push, damit
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
        (previous) => writeAdminUserState(previous, { q: searchDraft }),
        { replace: true }
      )
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [searchDraft, state.q, setSearchParams])

  const rows = list.data?.content ?? []
  const totalPages = list.data?.totalPages ?? 0
  const totalElements = list.data?.totalElements ?? 0

  /* Ein geoeffneter Dialog ist Komponentenzustand und gehoert nicht in die
     Adresse: er beschreibt keinen teilbaren Ausschnitt der Liste. */
  const [createOpen, setCreateOpen] = useState(false)
  const [detailFor, setDetailFor] = useState<string | null>(null)
  const [resetFor, setResetFor] = useState<AdminUserResponse | null>(null)
  const [roleFor, setRoleFor] = useState<AdminUserResponse | null>(null)
  const dialogTrigger = useRef<HTMLElement | null>(null)
  const createTrigger = useRef<HTMLButtonElement | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)
  const [notice, setNotice] = useState("")

  const dateFormat = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: "medium",
  })

  /**
   * Meldet einen Fehlschlag der Zeile sichtbar und hoerbar.
   *
   * <p>Ein 400 VALIDATION_FAILED bekommt hier einen eigenen Text: die
   * Zeilenaktionen haben kein Formular, und der allgemeine Satz „Bitte
   * pruefen Sie die markierten Felder" zeigte auf nichts. Gemeint ist der
   * Fall, den §6.5 beschreibt, also die am eigenen Konto gesperrte Rollen-
   * oder Statusaenderung; das Zeilenmenue blendet sie aus, verbindlich
   * bleibt aber der Server (Befund des contract-pruefers).
   */
  function reportError(error: unknown) {
    const message =
      isApiError(error) && error.errorCode === "VALIDATION_FAILED"
        ? t("administration.users.actionNotAllowed")
        : apiMessage(error)
    setRowError(message)
    setNotice(message)
  }

  /**
   * Meldet einen gelungenen Zeilenvorgang.
   *
   * <p>Ohne Fokussprung: Rollenwechsel, Aktivieren und Deaktivieren lassen
   * die Zeile und ihren Menueknopf stehen, und Base UI gibt den Fokus von
   * selbst dorthin zurueck. Ein Sprung an den Tabellenanfang naehme der
   * bedienenden Person ihre Stelle und koennte die Ansage der Live-Region
   * ueberdecken (Befund des frontend-reviewers).
   */
  function announce(message: string) {
    setRowError(null)
    setNotice(message)
  }

  function pageSearch(target: number): string {
    const next = writeAdminUserState(searchParams, { page: target })
    const encoded = next.toString()
    return encoded === ""
      ? "/administration/users"
      : `/administration/users?${encoded}`
  }

  function goToPage(event: MouseEvent, target: number) {
    event.preventDefault()
    setSearchParams((previous) =>
      writeAdminUserState(previous, { page: target })
    )
  }

  const roleOptions: SegmentedOption<RoleFilterValue>[] = [
    { value: ALL_ROLES, label: t("common.filter.all") },
    ...ADMIN_USER_ROLES.map((role) => ({
      value: role as RoleFilterValue,
      label: t(`user.rolePlural.${role}`),
    })),
  ]

  const filtered =
    state.q !== "" || state.role !== ALL_ROLES || state.status !== null

  return (
    <>
      <header className="flex flex-col gap-2">
        <p className="type-overline text-muted-foreground">
          {t("administration.label")}
        </p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="type-title text-primary">
            {t("administration.users.title")}
          </h1>
          <Button ref={createTrigger} onClick={() => setCreateOpen(true)}>
            <UserPlusIcon aria-hidden="true" />
            {t("administration.users.create.trigger")}
          </Button>
        </div>
        <p className="type-body-lg text-muted-foreground">
          {list.data === undefined
            ? t("administration.users.subtitleLoading")
            : t("administration.users.subtitle", {
                shown: rows.length,
                count: totalElements,
              })}
        </p>
        <hr className="mt-2" />
      </header>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="grid items-end gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
            <SearchInput
              label={t("administration.users.search.label")}
              labelHidden
              placeholder={t("administration.users.search.placeholder")}
              value={searchDraft}
              onValueChange={setSearchDraft}
            />
            <FilterSelect
              label={t("administration.users.filter.statusLabel")}
              labelHidden
              allLabel={t("administration.users.filter.allStatuses")}
              options={ADMIN_USER_STATUSES.map((status) => ({
                value: status,
                label: t(`user.status.${status}`),
              }))}
              value={state.status}
              onValueChange={(value) =>
                setSearchParams((previous) =>
                  writeAdminUserState(previous, {
                    /* FilterSelect gibt eine Zeichenkette zurueck; die
                       Optionen stammen aus ADMIN_USER_STATUSES und damit aus
                       §2.9, die Zusage ist hier also gedeckt. */
                    status: value as UserStatus | null,
                  })
                )
              }
            />
          </div>

          <SegmentedFilter
            label={t("administration.users.filter.roleLabel")}
            options={roleOptions}
            value={state.role}
            onValueChange={(value) =>
              setSearchParams((previous) =>
                writeAdminUserState(previous, { role: value })
              )
            }
            fallback={ALL_ROLES}
          />
        </CardContent>
      </Card>

      {list.error !== null && <ErrorState error={list.error} />}

      {rowError !== null && (
        <ErrorState message={rowError} />
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
          icon={<UsersIcon aria-hidden="true" />}
          title={t("administration.users.empty.title")}
          description={
            filtered
              ? t("administration.users.empty.filtered")
              : t("administration.users.empty.description")
          }
        />
      )}

      {rows.length > 0 && (
        <Card>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("administration.users.column.name")}</TableHead>
                  <TableHead>
                    {t("administration.users.column.hsbEmail")}
                  </TableHead>
                  <TableHead>{t("administration.users.column.role")}</TableHead>
                  <TableHead>
                    {t("administration.users.column.status")}
                  </TableHead>
                  <TableHead>
                    {t("administration.users.column.createdAt")}
                  </TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">
                      {t("administration.users.column.actions")}
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((account) => {
                  const isSelf = user?.id === account.id
                  return (
                    <UserTableRow
                      key={account.id}
                      person={account}
                      userId={account.id}
                      email={account.email}
                      hsbEmail={account.hsbEmail}
                      role={account.role}
                      status={account.status}
                      passwordChangeRequired={account.passwordChangeRequired}
                      createdAt={dateFormat.format(new Date(account.createdAt))}
                      actions={
                        <AdminUserRowMenu
                          account={account}
                          isSelf={isSelf}
                          pending={update.isPending || deactivate.isPending}
                          onShowDetails={(trigger) => {
                            dialogTrigger.current = trigger.current
                            setDetailFor(account.id)
                          }}
                          onResetPassword={(trigger) => {
                            dialogTrigger.current = trigger.current
                            setResetFor(account)
                          }}
                          onChangeRole={(trigger) => {
                            dialogTrigger.current = trigger.current
                            setRoleFor(account)
                          }}
                          onSetActive={() => {
                            setRowError(null)
                            update.mutate(
                              {
                                userId: account.id,
                                request: { status: "ACTIVE" },
                              },
                              {
                                onSuccess: () =>
                                  announce(
                                    t("administration.users.activated", {
                                      name: fullNameOf(account),
                                    })
                                  ),
                                onError: reportError,
                              }
                            )
                          }}
                          onDeactivate={() => {
                            setRowError(null)
                            deactivate.mutate(account.id, {
                              onSuccess: () =>
                                announce(
                                  t("administration.users.deactivated", {
                                    name: fullNameOf(account),
                                  })
                                ),
                              onError: reportError,
                            })
                          }}
                        />
                      }
                    />
                  )
                })}
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

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        finalFocus={createTrigger}
        onCreated={(account) =>
          setNotice(
            t("administration.users.created", { name: fullNameOf(account) })
          )
        }
      />

      <UserDetailDialog
        userId={detailFor}
        onOpenChange={(next) => {
          if (!next) {
            setDetailFor(null)
          }
        }}
        finalFocus={dialogTrigger}
      />

      <ChangeRoleDialog
        account={roleFor}
        onOpenChange={(next) => {
          if (!next) {
            setRoleFor(null)
          }
        }}
        pending={update.isPending}
        finalFocus={dialogTrigger}
        onSubmit={async (role) => {
          if (roleFor === null) {
            return
          }
          setRowError(null)
          await update.mutateAsync({
            userId: roleFor.id,
            request: { role },
          })
          announce(
            t("administration.users.roleChanged", {
              name: fullNameOf(roleFor),
              role: t(`user.role.${role}`),
            })
          )
        }}
      />

      <ResetPasswordDialog
        account={resetFor}
        onOpenChange={(next) => {
          if (!next) {
            setResetFor(null)
          }
        }}
        onDone={(account) =>
          setNotice(
            t("administration.users.passwordReset", {
              name: fullNameOf(account),
            })
          )
        }
        finalFocus={dialogTrigger}
      />

      {/* Eine Ansage je Vorgang: Rollenwechsel, Deaktivierung und Anlage
          aendern die Liste weiter oben, und ohne Live-Region bliebe das fuer
          Screenreader unbemerkt (SC 4.1.3). */}
      <span className="sr-only" role="status">
        {notice}
      </span>
    </>
  )
}
