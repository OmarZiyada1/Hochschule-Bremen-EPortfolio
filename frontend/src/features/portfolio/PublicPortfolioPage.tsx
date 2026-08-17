import { FolderOpenIcon, UserXIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link, useParams } from "react-router-dom"

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
import { ProfileCard } from "@/features/portfolio/components/ProfileCard"
import { usePublicPortfolio } from "@/features/portfolio/hooks/usePortfolio"
import { fullNameOf } from "@/lib/name"

/**
 * Das oeffentliche Profil einer Person nach Template "Portfolio (extern)"
 * (KAN-34): Profilkopf und die veroeffentlichten Arbeiten.
 *
 * <p>Ohne Anmeldung erreichbar, weil §5 veroeffentlichte Inhalte fuer alle
 * lesbar macht. Die Projektliste ist nicht gespeichert, sondern eine
 * Abfrage auf die Projekte dieser Person im Status PUBLISHED (§3.2); sie
 * ist bewusst nicht paginiert, weil §6.1 fuer diese Zeile eine schlichte
 * Liste fuehrt.
 *
 * <p><strong>Kein Rollen-Badge.</strong> Das Template zeigt einen,
 * GET /portfolios/{userId} liefert aber kein role-Feld
 * (§6.1). Entschieden wurde in der Klaerungsrunde zu KAN-34 fuer den
 * Contract; eine erfundene Rolle waere eine Attrappe (Frontend-Regel 10).
 *
 * <p>Die private E-Mail steht hier bewusst (§3.2), die HSB-Adresse nie
 * (§3.1). Eine unbekannte ID ergibt 404 RESOURCE_NOT_FOUND und wird als
 * eigener Zustand gezeigt, nicht als rohe Fehlermeldung.
 */
export default function PublicPortfolioPage() {
  const { t } = useTranslation()
  const { userId } = useParams()
  const { data, isPending, error } = usePublicPortfolio(userId ?? "")

  const notFound =
    error !== null && isApiError(error) && error.errorCode === "RESOURCE_NOT_FOUND"

  const person = data?.user
    ? {
        firstName: data.user.firstName ?? "",
        lastName: data.user.lastName ?? "",
      }
    : null

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

      {notFound && (
        <EmptyState
          headingLevel={1}
          icon={<UserXIcon aria-hidden="true" />}
          title={t("portfolio.public.notFound.title")}
          description={t("portfolio.public.notFound.description")}
          action={
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link to="/projects" />}
            >
              {t("portfolio.public.notFound.action")}
            </Button>
          }
        />
      )}

      {error !== null && !notFound && (
        <Alert variant="destructive">
          <AlertTitle>
            {isApiError(error)
              ? t(apiErrorMessageKey(error), { defaultValue: error.message })
              : t("apiError.INTERNAL_ERROR")}
          </AlertTitle>
        </Alert>
      )}

      {isPending && (
        <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[1fr_21.25rem] lg:items-start">
          <div className="flex flex-col gap-6">
            <Skeleton className="h-10 w-80 max-w-full rounded-control" />
            <div className="grid gap-6 sm:grid-cols-2">
              {Array.from({ length: 2 }, (_, index) => (
                <Skeleton key={index} className="h-80 rounded-xl" />
              ))}
            </div>
          </div>
          <Skeleton className="h-80 rounded-xl" />
        </div>
      )}

      {data !== undefined && person !== null && (
        <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[1fr_21.25rem] lg:items-start">
          <div className="flex flex-col gap-6">
            <h1 className="type-h1 text-primary">
              {t("portfolio.public.title", { name: fullNameOf(person) })}
            </h1>

            {data.projects === undefined || data.projects.length === 0 ? (
              <EmptyState
                icon={<FolderOpenIcon aria-hidden="true" />}
                title={t("portfolio.public.empty.title")}
                description={t("portfolio.public.empty.description")}
              />
            ) : (
              <ul className="grid gap-6 sm:grid-cols-2">
                {data.projects.map((project) => (
                  <li key={project.id}>
                    {/* Ohne Status-Badge: hier ist alles PUBLISHED, dort
                        unterschiede er nichts (wie in der Bibliothek). */}
                    <ProjectCard project={project} headingLevel={2} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <aside>
            <ProfileCard
              person={person}
              email={data.user?.email}
              biography={data.biography}
              avatarUrl={data.avatarUrl}
            />
          </aside>
        </div>
      )}
    </div>
  )
}
