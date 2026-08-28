import { LifeBuoyIcon } from "lucide-react"
import { useState, type MouseEvent } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"

import { apiErrorMessageKey, isApiError } from "@/api/errors"
import type { SupportRequestResponse, SupportRequestStatus } from "@/api/types"
import { EmptyState } from "@/components/common/EmptyState"
import { SegmentedFilter } from "@/components/common/SegmentedFilter"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Alert, AlertTitle } from "@/components/ui/alert"
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
  ALL_SUPPORT_STATUSES,
  readAdminSupportState,
  supportQueryOf,
  SUPPORT_STATUSES,
  writeAdminSupportState,
  type SupportStatusFilterValue,
} from "@/features/administration/adminSupportFilters"
import { SupportRequestCard } from "@/features/administration/components/SupportRequestCard"
import {
  useDeleteSupportRequest,
  useOpenSupportRequestCount,
  useSupportRequests,
  useUpdateSupportRequestStatus,
} from "@/features/administration/hooks/useAdminSupport"
import { paginationItems } from "@/features/projects/paginationItems"

/**
 * Die Support-Verwaltung der Administrationsseite (Template „Kontakt &amp;
 * Support", Frames {@code Admin · Support} und {@code · Leerzustand};
 * KAN-85): eingegangene Anfragen lesen, ihren Stand setzen und sie loeschen.
 *
 * <p><strong>Der Frame zeigt weder Filter noch Blaetterleiste, diese Seite
 * hat beides.</strong> Der Endpoint ist nach §6.6 paginiert, und ohne
 * Blaetterleiste waere ab der einundzwanzigsten Anfrage nichts mehr
 * erreichbar; der Statusfilter steht daneben, weil die Nachbarseiten der
 * Administrationsseite ihn ebenfalls fuehren und ein Eingangsbuch ohne
 * „nur offene" nach kurzer Zeit unbenutzbar ist. Entschieden in der
 * Klaerungsrunde zu KAN-85.
 *
 * <p><strong>Die Zaehlung „N offen" ist ein eigener Aufruf.</strong> Sie
 * zaehlt alle offenen Anfragen und nicht die der angezeigten Seite; aus
 * {@code content.length} gebildet waere sie ab der zweiten Seite falsch
 * (§6.1).
 *
 * <p><strong>Ein Statuswechsel wird angesagt.</strong> Sichtbar aendert sich
 * nur eine Pille tief in der Liste, und wer die Seite nicht sieht, bekaeme
 * sonst keine Rueckmeldung darauf, dass die Schaltflaeche gewirkt hat
 * (SC 4.1.3).
 */
export default function AdminSupportListPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()

  const state = readAdminSupportState(searchParams)
  const requests = useSupportRequests(supportQueryOf(state))
  const openCount = useOpenSupportRequestCount()

  const updateStatus = useUpdateSupportRequestStatus()
  const remove = useDeleteSupportRequest()

  /** Die Anfrage, zu der die Rueckfrage offen steht, oder {@code null}. */
  const [pendingDelete, setPendingDelete] =
    useState<SupportRequestResponse | null>(null)

  /**
   * Der Text der Live-Region. Er steht als Zustand da und nicht als
   * abgeleiteter Wert: angesagt werden soll die einzelne Handlung, nicht
   * jeder Zustand, in dem die Liste gerade ist.
   */
  const [announcement, setAnnouncement] = useState("")

  const page = requests.data
  const totalPages = page?.totalPages ?? 0
  const filtered = state.status !== ALL_SUPPORT_STATUSES
  const busy = updateStatus.isPending || remove.isPending

  function pageSearch(target: number): string {
    const next = writeAdminSupportState(searchParams, { page: target })
    const encoded = next.toString()
    return encoded === ""
      ? "/administration/support"
      : `/administration/support?${encoded}`
  }

  function goToPage(event: MouseEvent, target: number) {
    event.preventDefault()
    setSearchParams((previous) =>
      writeAdminSupportState(previous, { page: target })
    )
  }

  function changeStatus(
    request: SupportRequestResponse,
    target: SupportRequestStatus
  ) {
    updateStatus.mutate(
      { id: request.id, status: target },
      {
        onSuccess: () =>
          setAnnouncement(
            t("administration.support.announce.status", {
              subject: request.subject,
              status: t(`support.status.${target}`),
            })
          ),
      }
    )
  }

  function confirmDelete() {
    if (pendingDelete === null) {
      return
    }
    const subject = pendingDelete.subject
    remove.mutate(pendingDelete.id, {
      onSuccess: () => {
        setPendingDelete(null)
        setAnnouncement(
          t("administration.support.announce.deleted", { subject })
        )
      },
    })
  }

  const writeError = updateStatus.error ?? remove.error

  return (
    <>
      <header className="flex flex-col gap-2">
        <p className="type-overline text-muted-foreground">
          {t("administration.label")}
        </p>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="type-title text-primary">
            {t("administration.support.title")}
          </h1>
          {/* Die Zahl steht rechts auf der Hoehe der Ueberschrift, wie im
              Frame. Solange sie laedt, steht dort nichts: eine 0, die
              gleich zu 3 wird, ist schlechter als ein Moment Leere. */}
          {openCount.data !== undefined && (
            <p className="type-body-sm text-muted-foreground">
              {t("administration.support.openCount", {
                count: openCount.data,
              })}
            </p>
          )}
        </div>
        <p className="type-body-lg text-muted-foreground">
          {t("administration.support.subtitle")}
        </p>
        <hr className="mt-2" />
      </header>

      <SegmentedFilter
        label={t("administration.support.filterLabel")}
        value={state.status}
        fallback={ALL_SUPPORT_STATUSES}
        onValueChange={(next: SupportStatusFilterValue) =>
          setSearchParams(
            (previous) => writeAdminSupportState(previous, { status: next }),
            { replace: true }
          )
        }
        options={[
          { value: ALL_SUPPORT_STATUSES, label: t("common.filter.all") },
          ...SUPPORT_STATUSES.map((status) => ({
            value: status,
            label: t(`support.status.${status}`),
          })),
        ]}
      />

      {/* Ein Fehler beim Lesen ist etwas anderes als ein leeres Ergebnis und
          steht deshalb ueber der Liste, nicht an ihrer Stelle. */}
      {requests.error !== null && (
        <Alert variant="destructive">
          <AlertTitle>
            {isApiError(requests.error)
              ? t(apiErrorMessageKey(requests.error), {
                  defaultValue: requests.error.message,
                })
              : t("apiError.INTERNAL_ERROR")}
          </AlertTitle>
        </Alert>
      )}

      {/* Der Fehler eines Schreibvorgangs, etwa 409 nach einem zweiten Klick
          oder nach der Aenderung durch eine zweite Person. */}
      {writeError !== null && (
        <Alert variant="destructive">
          <AlertTitle>
            {isApiError(writeError)
              ? t(apiErrorMessageKey(writeError), {
                  defaultValue: writeError.message,
                })
              : t("apiError.INTERNAL_ERROR")}
          </AlertTitle>
        </Alert>
      )}

      {requests.isPending && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      )}

      {page !== undefined && page.content.length === 0 && (
        <EmptyState
          icon={<LifeBuoyIcon aria-hidden="true" />}
          title={t("administration.support.emptyTitle")}
          description={t(
            filtered
              ? "administration.support.emptyFiltered"
              : "administration.support.emptyDescription"
          )}
        />
      )}

      {page !== undefined && page.content.length > 0 && (
        <ul className="flex flex-col gap-4">
          {page.content.map((request) => (
            <li key={request.id}>
              <SupportRequestCard
                request={request}
                disabled={busy}
                onChangeStatus={(target) => changeStatus(request, target)}
                onDelete={() => setPendingDelete(request)}
              />
            </li>
          ))}
        </ul>
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

      {/*
        Die Ansage der Statuswechsel und des Loeschens. Sie steht ausserhalb
        der Liste, damit sie beim Neuzeichnen der Karten nicht mitentfernt
        wird: eine Live-Region, die im selben Takt verschwindet, in dem sie
        etwas zu sagen haette, sagt nichts (SC 4.1.3).
      */}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null)
          }
        }}
      >
        <AlertDialogContent className="rounded-modal">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("administration.support.confirmDelete.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete === null
                ? ""
                : t("administration.support.confirmDelete.description", {
                    subject: pendingDelete.subject,
                    name: pendingDelete.name,
                  })}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.action.cancel")}</AlertDialogCancel>
            {/* AlertDialogAction schliesst nicht von sich aus; ueber das
                Schliessen entscheidet der Erfolg, damit ein Fehler an
                derselben Stelle steht, an der die Handlung ausgeloest
                wurde. */}
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={confirmDelete}
            >
              {t("administration.support.confirmDelete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
