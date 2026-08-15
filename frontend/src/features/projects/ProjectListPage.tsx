import { FolderOpenIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { useAuth } from "@/api/auth/AuthContext"
import { apiErrorMessageKey, isApiError } from "@/api/errors"
import { EmptyState } from "@/components/common/EmptyState"
import { ProjectCard } from "@/components/common/ProjectCard"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { useProjectList } from "@/features/projects/hooks/useProjectList"

/**
 * Minimale Projektliste des Durchstichs (Ticket KAN-8): erste Seite aus
 * GET /projects mit echten Daten, sonst nichts. Die ausgestaltete
 * Projektbibliothek mit Filtern, Suche und Paginierung entsteht mit KAN-31.
 *
 * Wer welche Projekte sieht, entscheidet der Server (§5): PUBLIC nur
 * PUBLISHED, angemeldet je nach Rolle mehr. Der Client filtert nicht nach;
 * das Status-Badge erscheint nur angemeldet, weil oeffentlich alles
 * PUBLISHED ist und ein Badge dort nichts unterschiede (ProjectCard fuehrt
 * den Status aus demselben Grund als eigenen Slot).
 */
export default function ProjectListPage() {
  const { t } = useTranslation()
  const { isAuthenticated } = useAuth()
  const { data, isPending, error } = useProjectList()

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <h1 className="type-h1">{t("project.list.title")}</h1>

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
          <EmptyState
            icon={<FolderOpenIcon aria-hidden="true" />}
            title={t("project.list.empty.title")}
            description={t("project.list.empty.description")}
          />
        ) : (
          <>
            <p className="type-body-sm text-muted-foreground">
              {t("project.list.count", { count: data.totalElements })}
            </p>
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {data.content.map((project) => (
                <li key={project.id}>
                  <ProjectCard
                    title={project.title ?? ""}
                    summary={project.summary}
                    coverImageUrl={project.coverImageUrl}
                    projectType={project.projectType}
                    faculty={project.faculty}
                    author={
                      project.author
                        ? {
                            /* springdoc markiert kein required; ein Konto
                               ohne Namen gibt es fachlich nicht (wie in
                               AppLayout). */
                            firstName: project.author.firstName ?? "",
                            lastName: project.author.lastName ?? "",
                          }
                        : null
                    }
                    semester={project.semester}
                    reactionCount={project.reactionCount}
                    status={isAuthenticated ? project.status : undefined}
                    href={project.id ? `/projects/${project.id}` : undefined}
                    /* Die Kacheln liegen direkt unter dem Seiten-h1; ohne
                       Abschnittsueberschrift dazwischen ist Ebene 2 die
                       richtige (SC 1.3.1). */
                    headingLevel={2}
                  />
                </li>
              ))}
            </ul>
          </>
        ))}
    </div>
  )
}
