import { FolderOpenIcon, SearchXIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useSearchParams } from "react-router-dom"

import { useAuth } from "@/api/auth/AuthContext"
import { EmptyState } from "@/components/common/EmptyState"
import { ErrorState } from "@/components/common/ErrorState"
import { ProjectCard } from "@/components/common/ProjectCard"
import { ProjectStatusFilter } from "@/components/common/ProjectStatusFilter"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { OwnProjectCardActions } from "@/features/portfolio/components/OwnProjectCardActions"
import { ProfileCard } from "@/features/portfolio/components/ProfileCard"
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
 * <p><strong>Jede angemeldete Rolle, und jede gleich.</strong> Das eigene
 * Profil pflegt jedes Konto (§3.2), und seit KAN-82 fuehrt auch jedes Konto
 * eigene Projekte: ADMIN ist die Obermenge und nicht mehr die Ausnahme.
 * Bis dahin stand hier ein Zweig, der einem Admin-Konto weder "Neues
 * Projekt" noch Statusfilter noch Liste zeigte, sondern allein die
 * Profilkarte. Er ist ersatzlos entfallen, denn er beschrieb eine Sperre,
 * die es nicht mehr gibt.
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
  const participantId = user?.id ?? ""

  const portfolio = useOwnPortfolio()
  /*
   * Die Abfrage wartet allein auf die eigene ID; eine Rollenbedingung stand
   * hier bis KAN-82 daneben und ist mit der Sperre entfallen. Seit KAN-83
   * fragt sie nach der Beteiligung und nicht mehr nach der Autorschaft: eine
   * Gruppenarbeit gehoert auch ins Portfolio ihrer Mitglieder (§3.2, seit
   * Contract v84).
   */
  const projects = useOwnProjects(
    { participantId, status: statusQueryValue(status) },
    participantId !== ""
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
    firstName: user.firstName,
    lastName: user.lastName,
  }

  return (
    <>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
        {/* 21.25rem sind die 340px der Profilkarte aus dem Template. */}
        <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[1fr_21.25rem] lg:items-start">
          <div className="flex flex-col gap-6">
            <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
              <div className="flex flex-col gap-2">
                <p className="type-overline text-primary">
                  {t("portfolio.myPortfolio.label")}
                </p>
                {/* Blau wie in der Vorlage; dieselbe Fuehrung wie in der
                  Projektbibliothek (Kommentar in tokens.css). */}
                <h1 className="type-h1 text-primary">
                  {t("portfolio.myPortfolio.title")}
                </h1>
              </div>
              <Button nativeButton={false} render={<Link to="/projects/new" />}>
                {t("portfolio.myPortfolio.newProject")}
              </Button>
            </header>

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

            {projects.error !== null && <ErrorState error={projects.error} />}

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
                      {/* Als Autor:in haengt die Handlung am Status
                        (KAN-69): DRAFT und REVISION bearbeiten, SUBMITTED
                        zurueckziehen, DRAFT zusaetzlich loeschen. APPROVED
                        und PUBLISHED bekommen bewusst keine, damit die
                        veroeffentlichte Karte ihre Reaktionszahl behaelt
                        (action-Slot der ProjectCard). Als blosses Mitglied
                        gibt es eine einzige Handlung, und zwar in jedem
                        Status: das Verlassen (KAN-83). */}
                      <ProjectCard
                        project={project}
                        showStatus
                        headingLevel={2}
                        action={
                          hasOwnCardAction(
                            project.status,
                            project.author?.id === user.id
                          ) ? (
                            <OwnProjectCardActions
                              project={project}
                              isAuthor={project.author?.id === user.id}
                              onDone={announce}
                            />
                          ) : undefined
                        }
                      />
                    </li>
                  ))}
                </ul>
              ))}
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
    </>
  )
}
