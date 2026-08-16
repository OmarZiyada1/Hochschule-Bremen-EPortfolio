import { FolderOpenIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

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
 * Die Bibliothek zeigt fuer alle Rollen nur Veroeffentlichtes: die
 * Query-Fabrik verdrahtet status=PUBLISHED fest (Klaerungsrunde im Review
 * zu KAN-8, Contract v42). Ein Status-Badge erscheint deshalb nicht; wo
 * alles PUBLISHED ist, unterschiede es nichts. Eigene Entwuerfe zeigt
 * spaeter "Mein Portfolio" (KAN-34), dort schaltet die Seite showStatus zu.
 */
export default function ProjectListPage() {
  const { t } = useTranslation()
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
                    project={project}
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
