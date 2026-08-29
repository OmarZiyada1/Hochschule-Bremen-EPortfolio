import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate } from "react-router-dom"

import { isApiError, type ApiError } from "@/api/errors"
import { ErrorState } from "@/components/common/ErrorState"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useCreateProject } from "@/features/projects/hooks/useProjectMetadataMutations"

/** Wohin der Weg zurueckfuehrt, wenn das Anlegen scheitert. */
const PORTFOLIO_PATH = "/my-portfolio"

/**
 * {@code /projects/new} (KAN-35): legt das Projekt an und fuehrt sofort auf
 * seine Metadatenseite.
 *
 * <p><strong>Ein Schritt, kein Formular davor.</strong> Das Projekt entsteht
 * mit einem vorlaeufigen Titel, und geaendert wird er dort, wo ohnehin alle
 * Metadaten stehen. Ein eigenes Anlegeformular haette dieselben Felder ein
 * zweites Mal gezeigt und die Metadatenseite zweimal hintereinander
 * geoeffnet.
 *
 * <p>Damit loest sich zugleich der Grund, aus dem das Titelbild vorher
 * gesperrt war: {@code POST /api/files} verlangt eine {@code projectId}
 * (§3.15), und ab der Metadatenseite gibt es sie.
 *
 * <p><strong>Der Aufruf feuert genau einmal.</strong> Die Anwendung laeuft
 * unter {@code StrictMode}, und der haengt Effekte im Entwicklungsbetrieb
 * zweimal ein. Ohne die Sperre entstuenden bei jedem Aufruf zwei Projekte,
 * und das faellt erst in der Projektliste auf. Ein Ref statt eines Zustands,
 * weil die Sperre kein Rendern ausloesen soll.
 *
 * <p>Die Route steht jedem angemeldeten Konto offen, seit KAN-82 auch einem
 * mit der Rolle ADMIN (§5, Zeile „Projekt anlegen"). Ein dennoch
 * eintreffendes <strong>403</strong> {@code NO_PERMISSION} erscheint
 * sichtbar, statt in einer leeren Seite zu enden: verbindlich entscheidet
 * der Server, nicht die Routenschranke.
 */
export default function NewProjectPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const create = useCreateProject()

  const startedRef = useRef(false)
  const [failure, setFailure] = useState<ApiError | null>(null)

  useEffect(() => {
    if (startedRef.current) {
      return
    }
    startedRef.current = true
    create
      .mutateAsync({ title: t("project.metadata.untitledTitle") })
      .then((created) => {
        /* replace, damit der Zurueck-Knopf des Browsers nicht auf eine
           Adresse fuehrt, die sofort wieder ein Projekt anlegen wuerde. */
        void navigate(`/projects/${created.id}/metadata`, { replace: true })
      })
      .catch((error: unknown) => {
        if (!isApiError(error)) {
          throw error
        }
        setFailure(error)
      })
  }, [create, navigate, t])

  return (
    <>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
        <h1 className="type-h2 font-semibold text-primary">
          {t("project.metadata.heading")}
        </h1>

        {failure === null ? (
          <>
            {/* Die Ansage gehoert in eine Live-Region: sichtbar laeuft nur
                ein Skelett, und ohne sie bliebe der Vorgang fuer
                Screenreader stumm (SC 4.1.3). */}
            <p role="status" className="type-body-sm text-muted-foreground">
              {t("project.metadata.creating")}
            </p>
            <div className="grid gap-8 lg:grid-cols-[3fr_4fr]">
              <Skeleton className="aspect-[7/4] w-full rounded-card" />
              <Skeleton className="h-64 rounded-control" />
            </div>
          </>
        ) : (
          <>
            <ErrorState error={failure} />
            <Link
              to={PORTFOLIO_PATH}
              className={buttonVariants({ variant: "secondary" })}
            >
              {t("project.metadata.backToPortfolio")}
            </Link>
          </>
        )}
      </div>
    </>
  )
}
