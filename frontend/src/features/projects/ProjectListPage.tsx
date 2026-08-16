import { FolderOpenIcon, SearchXIcon } from "lucide-react"
import { useEffect, useState, type MouseEvent } from "react"
import { useTranslation } from "react-i18next"
import { Link, useSearchParams } from "react-router-dom"

import { apiErrorMessageKey, isApiError } from "@/api/errors"
import type { ProjectListParams } from "@/api/queries/projects"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/EmptyState"
import { ProjectCard } from "@/components/common/ProjectCard"
import { SearchInput } from "@/components/common/SearchInput"
import { Alert, AlertTitle } from "@/components/ui/alert"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
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
import { cn } from "@/lib/utils"
import { FilterSidebar } from "@/features/projects/components/FilterSidebar"
import { useProjectList } from "@/features/projects/hooks/useProjectList"
import { paginationItems } from "@/features/projects/paginationItems"

/* Entprellzeit der Suche: kein Request je Tastenanschlag (Skill frontend-api). */
const SEARCH_DEBOUNCE_MS = 300

/**
 * Oeffentliche Projektbibliothek nach Template "Projekte (Oeffentlich)"
 * (Ticket KAN-31): Kopf mit Suche, ProjectCard-Grid mit Trefferzaehler und
 * Paginierung. Such- und Seitenzustand stehen in der URL, damit ein
 * Ergebnis teilbar ist und der Zurueck-Knopf funktioniert; die Seite haelt
 * keinen eigenen Ergebniszustand daneben.
 *
 * Bewusst kein Sortier-Element (Entscheidung zu KAN-31, wie im Template):
 * es gilt der Server-Standard updatedAt,desc (§6.6). Ein sort-Parameter in
 * der URL wird deshalb weder gelesen noch weitergereicht.
 *
 * Die Filter-Seitenleiste erscheint als Kommt-bald-Rahmen (FilterSidebar):
 * die Mehrfachauswahl entsteht mit KAN-64, entschieden in der
 * Klaerungsrunde zu diesem Ticket.
 *
 * Die Bibliothek zeigt fuer alle Rollen nur Veroeffentlichtes: die
 * Query-Fabrik verdrahtet status=PUBLISHED fest (Klaerungsrunde im Review
 * zu KAN-8, Contract v42). Ein Status-Badge erscheint deshalb nicht; wo
 * alles PUBLISHED ist, unterschiede es nichts.
 *
 * Der Such-Platzhalter weicht vom Template-Wortlaut ab ("Projekte
 * durchsuchen" statt "Projekt oder Studierende/n suchen"): q durchsucht nur
 * Titel und Kurzbeschreibung (§6.1), eine Personensuche verspraeche die
 * Seite sonst zu Unrecht (Klaerungsrunde zu KAN-31).
 */
export default function ProjectListPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()

  const q = searchParams.get("q") ?? ""
  const pageParam = Number.parseInt(searchParams.get("page") ?? "1", 10)
  const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam

  const params: ProjectListParams = {}
  if (q !== "") {
    params.q = q
  }
  if (page > 1) {
    params.page = page - 1
  }
  const { data, isPending, error, isPlaceholderData } = useProjectList(params)

  /*
   * Das Suchfeld haelt nur den Tippzwischenstand; massgeblich ist die URL.
   * Aendert sie sich von aussen (Zurueck-Knopf), zieht der Render das Feld
   * nach, waehrend der Effekt darunter den entprellten Begriff
   * zurueckschreibt. replace statt push: nicht jeder Buchstabe ist ein
   * Historieneintrag. Das Nachziehen laeuft als Zustandsanpassung im
   * Render statt in einem Effekt (react-hooks/set-state-in-effect).
   */
  const [searchValue, setSearchValue] = useState(q)
  const [lastSyncedQ, setLastSyncedQ] = useState(q)
  if (q !== lastSyncedQ) {
    setLastSyncedQ(q)
    setSearchValue(q)
  }
  useEffect(() => {
    const handle = setTimeout(() => {
      if (searchValue === q) {
        return
      }
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          if (searchValue === "") {
            next.delete("q")
          } else {
            next.set("q", searchValue)
          }
          next.delete("page")
          return next
        },
        { replace: true }
      )
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [searchValue, q, setSearchParams])

  /*
   * Die Seitenzahlen sind echte Links auf die Ziel-URL (teilbar, Mittelklick
   * funktioniert); der Klick selbst navigiert ueber den Router, statt die
   * Seite neu zu laden.
   */
  function pageSearch(target: number): string {
    const next = new URLSearchParams(searchParams)
    if (target <= 1) {
      next.delete("page")
    } else {
      next.set("page", String(target))
    }
    const encoded = next.toString()
    return encoded === "" ? "/projects" : `/projects?${encoded}`
  }

  function goToPage(event: MouseEvent, target: number) {
    event.preventDefault()
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      if (target <= 1) {
        next.delete("page")
      } else {
        next.set("page", String(target))
      }
      return next
    })
  }

  const totalPages = data?.totalPages ?? 0
  const hasSearch = q !== ""

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <Breadcrumb className="inline-flex self-start rounded-control border px-3 py-2">
        <BreadcrumbList className="type-body-sm">
          <BreadcrumbItem>
            {/* Der Weg zurueck steht im Template in primary, die aktuelle
                Ebene in muted-foreground; die Registry haelt es genau
                umgekehrt (gleiche Abweichung wie im Login). */}
            <BreadcrumbLink
              render={<Link to="/" />}
              className="font-medium text-primary hover:text-primary-hover"
            >
              {t("common.nav.home")}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{t("common.nav.projects")}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="flex flex-col gap-2">
        <p className="type-overline tracking-widest text-primary uppercase">
          {t("project.list.label")}
        </p>
        {/* Blau, weil die Vorlage "Projekte (Oeffentlich)" den Seitentitel in
            primary fuehrt. Die Farbe steht hier und nicht an der Schriftrolle:
            Login und 404 fuehren dieselbe Rolle in foreground (Kommentar in
            tokens.css). */}
        <h1 className="type-h1 text-primary">{t("project.list.title")}</h1>
        <p className="type-body text-muted-foreground">
          {t("project.list.description")}
        </p>
      </header>

      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[16rem_1fr] lg:items-start">
        <FilterSidebar />

        <div className="flex flex-col gap-4">
          <SearchInput
            label={t("common.search.label")}
            labelHidden
            value={searchValue}
            onValueChange={setSearchValue}
            placeholder={t("project.list.searchPlaceholder")}
          />

          {/* Live-Region: die neue Trefferzahl wird angesagt, statt fuer
              Screenreader stumm zu wechseln (Skill frontend-design). */}
          <p aria-live="polite" className="type-body-sm text-muted-foreground">
            {data !== undefined
              ? t("project.list.count", { count: data.totalElements })
              : ""}
          </p>

          {isPending && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {/* Skeleton in der Form des Ergebnisses (Skill frontend-modul,
                  Abschnitt 5): Kachelflaechen, kein zentrierter Spinner. */}
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton key={index} className="h-80 rounded-xl" />
              ))}
            </div>
          )}

          {error !== null && (
            <Alert variant="destructive">
              <AlertTitle>
                {isApiError(error)
                  ? t(apiErrorMessageKey(error), { defaultValue: error.message })
                  : t("apiError.INTERNAL_ERROR")}
              </AlertTitle>
            </Alert>
          )}

          {data !== undefined &&
            (data.content.length === 0 ? (
              /* Drei Leerfaelle: eine Seitenzahl jenseits von totalPages
                 (veralteter geteilter Link) bekommt einen Ausweg zur letzten
                 Seite statt einer falschen Leermeldung (Review zu KAN-31);
                 mit Suchbegriff heisst leer "keine Treffer", ohne heisst es
                 "noch nichts veroeffentlicht". Unbekannte Filter-IDs ergeben
                 dieselbe leere Liste und keinen Fehler (§6.1). */
              data.totalElements > 0 ? (
                <EmptyState
                  icon={<FolderOpenIcon aria-hidden="true" />}
                  title={t("project.list.pageOutOfRange.title")}
                  description={t("project.list.pageOutOfRange.description")}
                  action={
                    <Button
                      variant="outline"
                      nativeButton={false}
                      render={<Link to={pageSearch(data.totalPages)} />}
                    >
                      {t("project.list.pageOutOfRange.action")}
                    </Button>
                  }
                />
              ) : hasSearch ? (
                <EmptyState
                  icon={<SearchXIcon aria-hidden="true" />}
                  title={t("project.list.noResults.title")}
                  description={t("project.list.noResults.description")}
                />
              ) : (
                <EmptyState
                  icon={<FolderOpenIcon aria-hidden="true" />}
                  title={t("project.list.empty.title")}
                  description={t("project.list.empty.description")}
                />
              )
            ) : (
              <>
                {/* Waehrend keepPreviousData die vorige Seite haelt, macht
                    aria-busy plus Abblendung den Wechsel sichtbar, statt zur
                    neuen Seitenzahl den alten Inhalt zu behaupten (Review zu
                    KAN-31). */}
                <ul
                  aria-busy={isPlaceholderData || undefined}
                  className={cn(
                    "grid gap-6 transition-opacity sm:grid-cols-2 lg:grid-cols-3",
                    isPlaceholderData && "opacity-60"
                  )}
                >
                  {data.content.map((project) => (
                    <li key={project.id}>
                      <ProjectCard
                        project={project}
                        /* Die Kacheln liegen unter dem Seiten-h1; die
                           Sidebar-Ueberschrift "Filter" ist ein Geschwister
                           auf Ebene 2, kein Elternteil. Ebene 2 bleibt
                           richtig (SC 1.3.1). */
                        headingLevel={2}
                      />
                    </li>
                  ))}
                </ul>

                {totalPages > 1 && (
                  <Pagination className="mt-2">
                    <PaginationContent>
                      <PaginationItem>
                        {page > 1 ? (
                          <PaginationPrevious
                            href={pageSearch(page - 1)}
                            onClick={(event) => goToPage(event, page - 1)}
                          />
                        ) : (
                          /* Ohne href ist der inaktive Schritt weder klick-
                             noch fokussierbar; aria-disabled sagt warum. */
                          <PaginationPrevious
                            aria-disabled="true"
                            className="pointer-events-none opacity-50"
                          />
                        )}
                      </PaginationItem>
                      {paginationItems(page, totalPages).map((item) =>
                        typeof item === "number" ? (
                          <PaginationItem key={item}>
                            <PaginationLink
                              href={pageSearch(item)}
                              onClick={(event) => goToPage(event, item)}
                              isActive={item === page}
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
                        {page < totalPages ? (
                          <PaginationNext
                            href={pageSearch(page + 1)}
                            onClick={(event) => goToPage(event, page + 1)}
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
            ))}
        </div>
      </div>
    </div>
  )
}
