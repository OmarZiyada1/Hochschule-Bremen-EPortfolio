import { FolderOpenIcon, SearchXIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useSearchParams } from "react-router-dom"

import { useAuth } from "@/api/auth/AuthContext"
import { apiErrorMessageKey, isApiError } from "@/api/errors"
import { EmptyState } from "@/components/common/EmptyState"
import { ProjectCard } from "@/components/common/ProjectCard"
import { Alert, AlertTitle } from "@/components/ui/alert"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { OwnProjectCardActions } from "@/features/portfolio/components/OwnProjectCardActions"
import { ProfileCard } from "@/features/portfolio/components/ProfileCard"
import { ProjectStatusFilter } from "@/features/portfolio/components/ProjectStatusFilter"
import {
  useOwnPortfolio,
  useOwnProjects,
} from "@/features/portfolio/hooks/usePortfolio"
import {
  ALL_STATUSES,
  hasOwnCardAction,
  readStatusFilter,
  statusQueryValue,
  writeStatusFilter,
  type StatusFilterValue,
} from "@/features/portfolio/ownProjectStatus"
import { cn } from "@/lib/utils"

/**
 * "My Portfolio" nach dem gleichnamigen Template (KAN-34): eigene Projekte
 * anlegen, nach Status filtern und das eigene Profil einsehen.
 *
 * <p><strong>Jede angemeldete Rolle, aber nicht jede gleich.</strong> Das
 * eigene Profil pflegt jedes Konto, auch ADMIN: GET /api/portfolio/me ist
 * an keine Rolle gebunden (§3.2). Eigene Projekte anlegen duerfen nur
 * STUDENT und EDITOR (§5, Fussnote 10, serverseitig mit KAN-57). Ein
 * Admin-Konto sieht deshalb weder "Neues Projekt" noch den Statusfilter
 * noch die Projektliste, sondern allein die Profilkarte. Das ist
 * Bequemlichkeit und keine Sicherheitsmassnahme; verbindlich prueft der
 * Server (§5).
 *
 * <p>Der Statusfilter steht in der URL, damit die Auswahl teilbar ist und
 * den Zurueck-Knopf uebersteht. Er engt nur weiter ein: die
 * Sichtbarkeitsregel aus §5 steht immer mit UND davor.
 *
 * <p>Name, Rolle und private E-Mail der Profilkarte kommen aus dem
 * Auth-Kontext, Biografie und Avatar aus GET /api/portfolio/me. Die beiden
 * Felder liegen an zwei Entities, und dieser Schnitt zieht sich durch bis
 * ins Bearbeitungsformular (§6.1).
 */
export default function MyPortfolioPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  /* Der Ausgang einer Kartenhandlung wird hier angesagt und nicht in der
     Kachel: beim Loeschen verschwindet die Kachel und mit ihr jede Meldung,
     die in ihr stuende (Befund aus dem Review zu KAN-69). Die laufende
     Nummer unterscheidet zwei gleichlautende Meldungen voneinander. */
  const [actionDone, setActionDone] = useState<{
    id: number
    message: string
  } | null>(null)

  function announce(message: string) {
    setActionDone((previous) => ({ id: (previous?.id ?? 0) + 1, message }))
  }

  const status = readStatusFilter(searchParams)
  /*
   * §5, Fussnote 10: die Projektanlage steht STUDENT und EDITOR offen,
   * ADMIN nicht. Record-frei, weil es genau eine Ausnahme gibt und ein
   * Record ueber drei Rollen hier nur Umweg waere.
   */
  const mayOwnProjects = user?.role === "STUDENT" || user?.role === "EDITOR"
  const authorId = user?.id ?? ""

  const portfolio = useOwnPortfolio()
  const projects = useOwnProjects(
    { authorId, status: statusQueryValue(status) },
    mayOwnProjects && authorId !== ""
  )

  function applyStatus(next: StatusFilterValue) {
    setSearchParams((previous) => writeStatusFilter(previous, next))
  }

  /* RequireAuth laesst niemanden ohne Sitzung hierher; der Zweig deckt nur
     den Moment ab, in dem die Umleitung noch nicht gerendert ist. */
  if (user === null) {
    return null
  }

  const person = {
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <Breadcrumb className="inline-flex self-start rounded-control border px-3 py-2">
        <BreadcrumbList className="type-body-sm">
          <BreadcrumbItem>
            <BreadcrumbLink
              render={<Link to="/" />}
              className="font-medium text-primary hover:text-primary-hover"
            >
              {t("common.nav.home")}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{t("portfolio.breadcrumb")}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* 21.25rem sind die 340px der Profilkarte aus dem Template. */}
      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[1fr_21.25rem] lg:items-start">
        <div className="flex flex-col gap-6">
          <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
            <div className="flex flex-col gap-2">
              <p className="type-overline tracking-widest text-primary uppercase">
                {t("portfolio.myPortfolio.label")}
              </p>
              {/* Blau wie in der Vorlage; dieselbe Fuehrung wie in der
                  Projektbibliothek (Kommentar in tokens.css). */}
              <h1 className="type-h1 text-primary">
                {t("portfolio.myPortfolio.title")}
              </h1>
            </div>
            {mayOwnProjects && (
              <Button nativeButton={false} render={<Link to="/projects/new" />}>
                {t("portfolio.myPortfolio.newProject")}
              </Button>
            )}
          </header>

          {mayOwnProjects ? (
            <>
              {/* Ohne sichtbare Ueberschrift: der Schalter beschriftet sich
                  selbst, seine sechs Werte sagen, wonach gefiltert wird.
                  Den zugaenglichen Namen traegt die Gruppe als aria-label,
                  sonst waere sie eine Reihe unbeschrifteter Knoepfe. Er
                  scrollt bewusst mit: er steht direkt ueber der Liste und
                  ist damit dort, wo er gebraucht wird. */}
              <ProjectStatusFilter
                value={status}
                onValueChange={applyStatus}
                label={t("portfolio.myPortfolio.filterLabel")}
              />

              {/*
               * Die Region steht dauerhaft im Baum, damit die Ansage beim
               * Fuellen greift. Leer ist sie sr-only und damit kein
               * Flex-Element mehr: sonst kostete sie dauerhaft die
               * Spaltenluecke zwischen Filter und Liste. Der key sorgt
               * dafuer, dass auch zweimal derselbe Satz zweimal angesagt
               * wird (beides Befunde aus dem Review zu KAN-69).
               */}
              <p
                key={actionDone?.id}
                role="status"
                className={cn(
                  "type-body-sm text-muted-foreground",
                  actionDone === null && "sr-only"
                )}
              >
                {actionDone?.message}
              </p>

              {projects.isPending && (
                <div className="grid gap-6 sm:grid-cols-2">
                  {/* Skeleton in der Form des Ergebnisses, kein zentrierter
                      Spinner (Skill frontend-modul, Abschnitt 5). */}
                  {Array.from({ length: 4 }, (_, index) => (
                    <Skeleton key={index} className="h-80 rounded-xl" />
                  ))}
                </div>
              )}

              {projects.error !== null && (
                <Alert variant="destructive">
                  <AlertTitle>
                    {isApiError(projects.error)
                      ? t(apiErrorMessageKey(projects.error), {
                          defaultValue: projects.error.message,
                        })
                      : t("apiError.INTERNAL_ERROR")}
                  </AlertTitle>
                </Alert>
              )}

              {projects.data !== undefined &&
                (projects.data.content.length === 0 ? (
                  /* Zwei Leerfaelle: mit gesetztem Filter heisst leer "in
                     diesem Status nichts", ohne heisst es "noch kein
                     Projekt" und bekommt den Weg zur Anlage. */
                  status === ALL_STATUSES ? (
                    <EmptyState
                      icon={<FolderOpenIcon aria-hidden="true" />}
                      title={t("portfolio.myPortfolio.empty.title")}
                      description={t("portfolio.myPortfolio.empty.description")}
                      action={
                        <Button
                          nativeButton={false}
                          render={<Link to="/projects/new" />}
                        >
                          {t("portfolio.myPortfolio.newProject")}
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      icon={<SearchXIcon aria-hidden="true" />}
                      title={t("portfolio.myPortfolio.noResults.title")}
                      description={t(
                        "portfolio.myPortfolio.noResults.description"
                      )}
                      action={
                        <Button
                          variant="outline"
                          onClick={() => applyStatus(ALL_STATUSES)}
                        >
                          {t("portfolio.myPortfolio.noResults.action")}
                        </Button>
                      }
                    />
                  )
                ) : (
                  <ul className="grid gap-6 sm:grid-cols-2">
                    {projects.data.content.map((project) => (
                      <li key={project.id}>
                        {/* Hier zeigt der Status etwas: anders als in der
                            Bibliothek stehen eigene Entwuerfe und
                            Einreichungen nebeneinander (§5, v42). Die
                            Kacheln liegen unter dem Seiten-h1, also
                            Ebene 2 (SC 1.3.1). */}
                        {/* Die Handlung haengt am Status (KAN-69): DRAFT
                            und REVISION bearbeiten, SUBMITTED zurueckziehen,
                            DRAFT zusaetzlich loeschen. APPROVED und
                            PUBLISHED bekommen bewusst keine, damit die
                            veroeffentlichte Karte ihre Reaktionszahl
                            behaelt (action-Slot der ProjectCard). */}
                        <ProjectCard
                          project={project}
                          showStatus
                          headingLevel={2}
                          action={
                            hasOwnCardAction(project.status) ? (
                              <OwnProjectCardActions
                                project={project}
                                onDone={announce}
                              />
                            ) : undefined
                          }
                        />
                      </li>
                    ))}
                  </ul>
                ))}
            </>
          ) : (
            /* Kein Leerzustand, sondern eine Auskunft: dieses Konto hat
               keine eigenen Projekte und bekommt auch keine (§5). */
            <p className="type-body text-muted-foreground">
              {t("portfolio.myPortfolio.noProjectsForRole")}
            </p>
          )}
        </div>

        {/* Bleibt beim Scrollen der Projektliste stehen. Moeglich, weil die
            Gitterzeile items-start fuehrt: ohne das zoege der Rasterplatz
            die Karte auf volle Hoehe und sticky haette nichts, woran es
            kleben koennte. */}
        <aside className="lg:sticky lg:top-4">
          {portfolio.isPending ? (
            <Skeleton className="h-96 rounded-xl" />
          ) : (
            /* Ein Fehler beim Profil laesst die Karte nicht verschwinden:
               Name, Rolle und Adresse stehen im Auth-Kontext, nur Biografie
               und Bild fehlen dann. */
            <ProfileCard
              person={person}
              email={user.email}
              biography={portfolio.data?.biography}
              avatarUrl={portfolio.data?.avatarUrl}
              role={user.role}
              action={
                <Button
                  nativeButton={false}
                  className="w-full"
                  render={<Link to="/my-portfolio/profile" />}
                >
                  {t("portfolio.myPortfolio.editProfile")}
                </Button>
              }
            />
          )}
        </aside>
      </div>
    </div>
  )
}
