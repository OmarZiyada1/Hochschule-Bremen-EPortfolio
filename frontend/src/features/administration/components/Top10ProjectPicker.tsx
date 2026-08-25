import { useQuery } from "@tanstack/react-query"
import { PlusIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { apiErrorMessageKey, isApiError } from "@/api/errors"
import { projectQueries } from "@/api/queries/projects"
import type { ProjectCardResponse } from "@/api/types"
import { EmptyState } from "@/components/common/EmptyState"
import { SearchInput } from "@/components/common/SearchInput"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { fullNameOf } from "@/lib/name"

/**
 * Wartezeit vor der Suchanfrage, wie bei der PersonCombobox (KAN-35) und in
 * der Projektbibliothek (KAN-64): lang genug, dass ein durchgetippter Titel
 * einen Request kostet und nicht einen je Zeichen.
 */
const SEARCH_DEBOUNCE_MS = 300

/** So viele Treffer zeigt die Auswahl; wer mehr sehen will, tippt genauer. */
const RESULT_SIZE = 5

/**
 * Die Suche, mit der weitere Projekte auf einen freien Platz kommen (Frame
 * {@code Admin · Top 10} und Template „Top 10 Verwaltung", KAN-40).
 *
 * <p><strong>Nur veroeffentlichte Projekte.</strong>
 * {@code projectQueries.list} setzt {@code status=PUBLISHED} fest; ein
 * Entwurf auf der oeffentlichen Startseite waere ein Sichtbarkeitsleck, das
 * die gesamte Statuslogik unterliefe (§3.11.1 Regel 1). Der Server weist
 * einen anderen Status ohnehin ab, hier steht dieselbe Zusage im
 * Bedienelement.
 *
 * <p><strong>Gesucht wird serverseitig.</strong> {@code q} durchsucht Titel,
 * Kurzbeschreibung und den Namen der Autor:in (§6.1, seit Contract v47).
 * Alle veroeffentlichten Projekte zu laden und im Browser zu filtern waere
 * weder schnell noch vollstaendig.
 *
 * <p><strong>Ohne Suchbegriff steht hier nichts.</strong> Eine ungefragte
 * Liste der neuesten Projekte saehe wie eine Empfehlung aus, und eine
 * Empfehlung gibt diese Ansicht nicht ab: kuratiert wird von Hand.
 *
 * <p><strong>Aufgenommen wird in den Arbeitszustand, nicht in die
 * Liste.</strong> Der Knopf setzt das Projekt auf den ersten freien Platz;
 * hinaus geht es erst mit „Reihenfolge speichern". Bereits vergebene
 * Projekte und der Fall „alle zehn Plaetze belegt" sind gesperrt, statt in
 * ein 400 {@code VALIDATION_FAILED} zu laufen.
 */
export function Top10ProjectPicker({
  onAdd,
  isSelected,
  full,
}: {
  onAdd: (project: ProjectCardResponse) => void
  /** Steht dieses Projekt schon auf einem Platz? */
  isSelected: (projectId: string) => boolean
  /** Sind alle zehn Plaetze belegt? Dann ist ein elfter nicht anlegbar. */
  full: boolean
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")

  /* Der Suchbegriff bleibt bewusst Komponentenzustand und wandert nicht in
     die Adresse: er beschreibt keinen Ansichtszustand, sondern einen
     Zwischenschritt beim Zusammenstellen der Liste. Geteilt oder
     wiederhergestellt werden soll die Auswahl, nicht die Suche danach. */
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search])

  const query = useQuery({
    ...projectQueries.list({ q: debounced, size: RESULT_SIZE }),
    enabled: debounced.trim() !== "",
  })

  const results = query.data?.content ?? []

  return (
    <div className="flex flex-col gap-3">
      <SearchInput
        label={t("administration.top10.picker.label")}
        placeholder={t("administration.top10.picker.placeholder")}
        value={search}
        onValueChange={setSearch}
      />

      {full && (
        <Alert>
          <AlertTitle>{t("administration.top10.picker.full")}</AlertTitle>
        </Alert>
      )}

      {query.error !== null && (
        <Alert variant="destructive">
          <AlertTitle>
            {isApiError(query.error)
              ? t(apiErrorMessageKey(query.error), {
                  defaultValue: query.error.message,
                })
              : t("apiError.INTERNAL_ERROR")}
          </AlertTitle>
        </Alert>
      )}

      {query.isFetching && debounced.trim() !== "" && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {!query.isFetching && debounced.trim() !== "" && results.length === 0 && (
        <EmptyState
          headingLevel={3}
          title={t("administration.top10.picker.emptyTitle")}
          description={t("administration.top10.picker.emptyDescription", {
            query: debounced,
          })}
        />
      )}

      {results.length > 0 && (
        <ul className="flex flex-col gap-2">
          {results.map((project) => {
            const already = isSelected(project.id)
            return (
              <li
                key={project.id}
                className="flex items-center justify-between gap-3 rounded-control border p-3"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="type-body-sm font-medium">
                    {project.title}
                  </span>
                  <span className="type-body-sm text-muted-foreground">
                    {fullNameOf(project.author)}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={already || full}
                  onClick={() => onAdd(project)}
                >
                  <PlusIcon aria-hidden="true" />
                  {/* Der zugaengliche Name nennt das Projekt: sonst
                      stuenden hier fuenf gleichnamige Knoepfe
                      untereinander (SC 2.4.6). */}
                  <span className="sr-only">
                    {t(
                      already
                        ? "administration.top10.picker.alreadyAdded"
                        : "administration.top10.picker.add",
                      { title: project.title }
                    )}
                  </span>
                  <span aria-hidden="true">
                    {t(
                      already
                        ? "administration.top10.picker.addedShort"
                        : "administration.top10.picker.addShort"
                    )}
                  </span>
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
