import { MailIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"

import { useAuth } from "@/api/auth/AuthContext"
import { apiErrorMessageKey, isApiError } from "@/api/errors"
import { EmptyState } from "@/components/common/EmptyState"
import { SegmentedFilter } from "@/components/common/SegmentedFilter"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DEFAULT_NOMINATION_FILTER,
  readNominationFilter,
  writeNominationFilter,
} from "@/features/administration/adminTop10Filters"
import { Top10NominationList } from "@/features/administration/components/Top10NominationList"
import { Top10SectionNav } from "@/features/administration/components/Top10SectionNav"
import { Top10SlotEditor } from "@/features/administration/components/Top10SlotEditor"
import {
  useAdminNominations,
  useTop10Entries,
} from "@/features/administration/hooks/useAdminTop10"
import {
  buildSlots,
  freePositions,
  slotSignature,
} from "@/features/administration/top10Slots"
import {
  ALL_NOMINATION_STATUSES,
  NOMINATION_STATUSES,
} from "@/features/reviews/nominations"

/**
 * Die Top-10-Verwaltung der Administrationsseite (Template „Top 10
 * Verwaltung", Frame {@code Admin · Top 10}; KAN-40): Nominierungen
 * entscheiden, Plaetze kuratieren, Reihenfolge speichern.
 *
 * <p><strong>Zwei Bereiche, zwei Ressourcen.</strong> Oben die Vorschlaege
 * aus {@code GET /api/admin/top10-nominations}, unten die besetzten Plaetze
 * aus {@code GET /api/top10}. Sie haengen zusammen, sind aber nicht
 * dasselbe: eine angenommene Nominierung legt einen Eintrag an, ein Eintrag
 * kann aber auch ohne Vorschlag entstehen, naemlich ueber
 * {@code PUT /admin/top10}.
 *
 * <p><strong>Die freien Plaetze des Annahme-Dialogs kommen vom Server, nicht
 * aus dem Arbeitszustand des Editors.</strong> {@code accept} schreibt
 * sofort und raeumt keinen belegten Platz (409 {@code RESOURCE_IN_USE},
 * §3.11.1); ein Platz, der nur im ungespeicherten Entwurf frei ist, ist es
 * dort nicht. Die beiden Bereiche teilen sich deshalb bewusst keinen
 * Zustand.
 *
 * <p><strong>Der Statusfilter steht in der Adresse</strong>, der
 * Arbeitszustand der Plaetze nicht. Das ist kein Widerspruch: der Filter
 * beschreibt eine Ansicht und ist teilbar, ein halb umsortierter Zustand
 * beschreibt eine unfertige Handlung.
 */
export default function AdminTop10Page() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const filter = readNominationFilter(searchParams)

  const entries = useTop10Entries()
  const nominations = useAdminNominations(
    filter === ALL_NOMINATION_STATUSES ? undefined : filter
  )
  const [notice, setNotice] = useState("")

  const serverEntries = entries.data ?? []
  const free = freePositions(buildSlots(serverEntries))

  function messageOf(error: unknown): string {
    return isApiError(error)
      ? t(apiErrorMessageKey(error), { defaultValue: error.message })
      : t("apiError.INTERNAL_ERROR")
  }

  const statusOptions = [
    ...NOMINATION_STATUSES.map((status) => ({
      value: status,
      label: t(`top10.nominationStatus.${status}`),
    })),
    { value: ALL_NOMINATION_STATUSES, label: t("common.filter.all") },
  ]

  return (
    <>
      <header className="flex flex-col gap-2">
        <p className="type-overline tracking-widest text-muted-foreground uppercase">
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

      {/* Eine Live-Region fuer die ganze Seite und nicht je Zeile: die
          Zeile, die eine Entscheidung ausloest, verschwindet mit ihr, und
          eine Meldung darin waere nie zu hoeren (SC 4.1.3, Befund aus
          KAN-69). */}
      <p aria-live="polite" className="sr-only">
        {notice}
      </p>

      <section
        aria-labelledby="top10-nominations"
        className="flex flex-col gap-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="top10-nominations" className="type-h2 flex items-center gap-2">
            <MailIcon aria-hidden="true" className="size-5 text-primary" />
            {t("administration.top10.nominations.title")}
            {nominations.data !== undefined && (
              <span className="type-body-sm text-muted-foreground">
                {nominations.data.length}
              </span>
            )}
          </h2>
          <SegmentedFilter
            label={t("administration.top10.nominations.filterLabel")}
            options={statusOptions}
            value={filter}
            fallback={DEFAULT_NOMINATION_FILTER}
            onValueChange={(value) =>
              setSearchParams(
                (previous) => writeNominationFilter(previous, value),
                { replace: true }
              )
            }
          />
        </div>

        {nominations.error !== null && (
          <Alert variant="destructive">
            <AlertTitle>{messageOf(nominations.error)}</AlertTitle>
          </Alert>
        )}

        {nominations.isPending && (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {nominations.data?.length === 0 && (
          <EmptyState
            icon={<MailIcon aria-hidden="true" />}
            title={t("administration.top10.nominations.emptyTitle")}
            description={t(
              filter === DEFAULT_NOMINATION_FILTER
                ? "administration.top10.nominations.emptyPending"
                : "administration.top10.nominations.emptyFiltered"
            )}
          />
        )}

        {nominations.data !== undefined && nominations.data.length > 0 && (
          <Top10NominationList
            nominations={nominations.data}
            freePositions={free}
            isAdmin={user?.role === "ADMIN"}
            onNotice={setNotice}
          />
        )}
      </section>

      {entries.error !== null && (
        <Alert variant="destructive">
          <AlertTitle>{messageOf(entries.error)}</AlertTitle>
        </Alert>
      )}

      {entries.isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (
        /* Der key gleicht den Arbeitszustand mit dem Server ab: aendert
           sich der Stand, baut React den Editor mit dem frischen Stand neu
           auf; solange nur lokal umsortiert wird, bleibt er stehen. Das ist
           der von React vorgesehene Weg, den Zustand einer Teilansicht
           zurueckzusetzen, und er kommt ohne Effekt aus. */
        <Top10SlotEditor
          key={slotSignature(serverEntries)}
          entries={serverEntries}
          onNotice={setNotice}
        />
      )}
    </>
  )
}
