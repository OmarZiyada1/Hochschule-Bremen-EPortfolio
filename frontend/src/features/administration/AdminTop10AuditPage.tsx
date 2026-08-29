import { ScrollTextIcon } from "lucide-react"
import type { MouseEvent } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"

import { EmptyState } from "@/components/common/EmptyState"
import { ErrorState } from "@/components/common/ErrorState"
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
  auditQueryOf,
  readAdminTop10AuditState,
  writeAdminTop10AuditState,
  type AdminTop10AuditState,
} from "@/features/administration/adminTop10Filters"
import { AuditRangeFilter } from "@/features/administration/components/AuditRangeFilter"
import { Top10AuditList } from "@/features/administration/components/Top10AuditList"
import { Top10SectionNav } from "@/features/administration/components/Top10SectionNav"
import { useTop10Audit } from "@/features/administration/hooks/useAdminTop10"
import { paginationItems } from "@/features/projects/paginationItems"

/**
 * Das Top-10-Aenderungsprotokoll der Administrationsseite (Template „Top 10
 * Protokoll", Frame {@code Admin · Top 10 Protokoll}; KAN-40): wer wann
 * welches Projekt aufgenommen, entfernt oder umsortiert hat.
 *
 * <p><strong>Es liegt unter der Verwaltung, nicht daneben.</strong> Die
 * Route ist {@code /administration/top10/audit}, und die Seitenleiste
 * bekommt dafuer keinen achten Eintrag: das Protokoll zeigt den Verlauf der
 * Kuratierung und wird aus ihr heraus geoeffnet (KAN-38).
 *
 * <p><strong>Nur lesend.</strong> Das Protokoll ist unveraenderlich (§3.17);
 * es gibt keinen schreibenden Endpoint und kein Loeschen. Die Seite bietet
 * deshalb keine Bearbeitung an, auch keine ausgegraute.
 *
 * <p><strong>Sortiert wird nicht.</strong> Sortierbar ist ausschliesslich
 * {@code timestamp}, jedes andere Feld ergaebe 400 {@code VALIDATION_FAILED}
 * (§6.6); ohne {@code sort} gilt {@code timestamp,desc}, und genau das will
 * ein chronologisches Protokoll. Wer einschraenken will, nimmt die Filter.
 *
 * <p><strong>Fuenf Vorgaenge schreiben hier hinein</strong> (§3.17): das
 * Speichern der Reihenfolge, die Annahme einer Nominierung, der Entzug beim
 * Verlassen von PUBLISHED, das Loeschen eines Projekts und das Zurueckziehen
 * eines angenommenen Vorschlags. Die letzten drei tragen {@code REMOVED};
 * beim geloeschten Projekt bleibt der Verweis leer.
 */
export default function AdminTop10AuditPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const state = readAdminTop10AuditState(searchParams)
  const audit = useTop10Audit(auditQueryOf(state))

  const page = audit.data
  const totalPages = page?.totalPages ?? 0
  const filtered =
    state.from !== null || state.to !== null || state.admin !== null

  function applyChange(change: Partial<AdminTop10AuditState>) {
    setSearchParams((previous) => writeAdminTop10AuditState(previous, change), {
      replace: true,
    })
  }

  function pageSearch(target: number): string {
    const next = writeAdminTop10AuditState(searchParams, { page: target })
    const encoded = next.toString()
    return encoded === ""
      ? "/administration/top10/audit"
      : `/administration/top10/audit?${encoded}`
  }

  function goToPage(event: MouseEvent, target: number) {
    event.preventDefault()
    setSearchParams((previous) =>
      writeAdminTop10AuditState(previous, { page: target })
    )
  }

  return (
    <>
      <header className="flex flex-col gap-2">
        <p className="type-overline text-muted-foreground">
          {t("administration.label")}
        </p>
        <h1 className="type-title text-primary">
          {t("administration.top10.title")}
        </h1>
        <p className="type-body-lg text-muted-foreground">
          {t("administration.top10.subtitle")}
        </p>
        <hr className="mt-2" />
      </header>

      <Top10SectionNav />

      <Card>
        <CardContent>
          <AuditRangeFilter state={state} onChange={applyChange} />
        </CardContent>
      </Card>

      {/* Der 400 des Servers ist hier ein Eingabefehler und kein leeres
          Ergebnis: „from" nach „to" beantwortet er mit VALIDATION_FAILED
          (§6.1). Das Formular faengt den Fall vorab ab; eine von Hand
          geschriebene Adresse kommt trotzdem hier an. */}
      {audit.error !== null && <ErrorState error={audit.error} />}

      {audit.isPending && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {page !== undefined && page.content.length === 0 && (
        <EmptyState
          icon={<ScrollTextIcon aria-hidden="true" />}
          title={t("administration.top10.audit.emptyTitle")}
          description={t(
            filtered
              ? "administration.top10.audit.emptyFiltered"
              : "administration.top10.audit.emptyDescription"
          )}
        />
      )}

      {page !== undefined && page.content.length > 0 && (
        <>
          <p className="type-body-sm text-muted-foreground">
            {t("administration.top10.audit.total", {
              count: page.totalElements,
            })}
          </p>
          <Top10AuditList entries={page.content} />
        </>
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
    </>
  )
}
