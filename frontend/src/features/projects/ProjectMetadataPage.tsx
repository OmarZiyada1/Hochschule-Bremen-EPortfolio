import { FileQuestionIcon, LockIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useParams } from "react-router-dom"

import { apiErrorMessageKey, isApiError } from "@/api/errors"
import type { ProjectDetailResponse, ProjectUpdateRequest } from "@/api/types"
import { BreadcrumbBar } from "@/components/common/BreadcrumbBar"
import { EmptyState } from "@/components/common/EmptyState"
import { VersionConflictDialog } from "@/components/common/VersionConflictDialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useProjectDetail } from "@/features/projects/hooks/useProjectDetail"
import {
  useUpdateProject,
  useUploadCoverImage,
} from "@/features/projects/hooks/useProjectMetadataMutations"
import { ProjectMetadataForm } from "@/features/projects/ProjectMetadataForm"

/** Wohin "Abbrechen" fuehrt: die eigene Projektliste. */
const PORTFOLIO_PATH = "/my-portfolio"

/**
 * Inhaltsbearbeitung ist nur in diesen beiden Status moeglich (§4.1); in
 * den uebrigen sperrt der Server {@code PUT /projects/{id}} vollstaendig,
 * den Titel eingeschlossen. Die Oberflaeche spiegelt die Regel, sie ersetzt
 * sie nicht.
 */
function isEditable(status: ProjectDetailResponse["status"]): boolean {
  return status === "DRAFT" || status === "REVISION"
}

/**
 * "Projekt-Metadaten" nach dem gleichnamigen Template (KAN-35), Route
 * {@code /projects/:projectId/metadata}.
 *
 * <p>Sie ist zugleich der zweite Schritt des Anlegens: {@code /projects/new}
 * legt das Projekt mit einem vorlaeufigen Titel an und fuehrt hierher
 * ({@code NewProjectPage}). Von hier geht es mit dem Speichern in den
 * Editor. Ein eigenes Anlegeformular gibt es bewusst nicht: es haette
 * dieselben Felder ein zweites Mal gezeigt.
 *
 * <p><strong>Die Seitenhuelle ist Sache dieser Route</strong>, nicht des
 * Formulars: Brotkrume und die einzige {@code h1} stehen hier.
 * {@code ProjectMetadataForm} bleibt ohne Huelle, damit der Editor es als
 * Dialog oeffnen kann, ohne die Brotkrume mitzubringen (KAN-36).
 *
 * <p><strong>Kein eigener Zurueck-Link.</strong> Den Weg ins Portfolio
 * traegt das Brotkrumenband; ein zweiter Link daneben sagt dasselbe ein
 * zweites Mal. Dieselbe Entscheidung wie auf der Profilseite (KAN-69).
 *
 * <p><strong>Der Versionskonflikt gehoert hierher</strong>, nicht ins
 * Formular. Nur diese Route kann neu laden, also entscheidet sie, und sie
 * zeigt dafuer {@code VersionConflictDialog} mit genau zwei Wegen. Ein
 * automatischer zweiter Versuch findet nirgends statt: er ueberschriebe die
 * fremde Aenderung, vor der die Versionspruefung schuetzt (§6.4).
 *
 * <p>403 {@code NO_PERMISSION} wird sichtbar behandelt und nicht umgeleitet:
 * wer angemeldet ist und trotzdem nicht darf, kommt durch erneutes Anmelden
 * nicht weiter. Den Weg zur Anmeldung bei 401 geht der QueryClient zentral
 * (KAN-30).
 */
export default function ProjectMetadataPage() {
  const { t } = useTranslation()
  const { projectId = "" } = useParams()
  const navigate = useNavigate()

  const detail = useProjectDetail(projectId)
  const update = useUpdateProject(projectId)
  const uploadCover = useUploadCoverImage(projectId)

  const [conflict, setConflict] = useState(false)
  /* Ungespeicherte Eingaben: der Weg zurueck fragt dann vorher nach
     (Skill frontend-design, Abschnitt 5). */
  const [dirty, setDirty] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)

  const error = detail.error
  const forbidden =
    error !== null && isApiError(error) && error.errorCode === "NO_PERMISSION"
  const notFound =
    error !== null &&
    isApiError(error) &&
    error.errorCode === "PROJECT_NOT_FOUND"

  const project = detail.data

  /**
   * Der Weg zurueck ins Portfolio ueber "Abbrechen".
   *
   * <p>Traegt das Formular ungespeicherte Eingaben, wird vorher gefragt
   * (Skill frontend-design, Abschnitt 5); sonst geht es direkt weiter, denn
   * ein Klick mehr ohne Grund ist auch keine Freundlichkeit.
   *
   * <p><strong>Bewacht ist der Weg, den diese Seite selbst anbietet.</strong>
   * Brotkrume, Kopfleiste und der Zurueck-Knopf des Browsers laufen
   * ungehindert weiter: dafuer braeuchte es {@code useBlocker} und damit
   * einen Data-Router in Anwendung und Testhuelle, und das ist eigene
   * Arbeit (Skill frontend-design, Abschnitt 5, Geltungsbereich).
   */
  const leaveToPortfolio = () => {
    if (dirty) {
      setConfirmLeave(true)
      return
    }
    void navigate(PORTFOLIO_PATH)
  }

  /**
   * Der Schreibweg des Formulars: {@code PUT /api/projects/{id}}, danach in
   * den Editor.
   */
  const submit = async (
    request: ProjectUpdateRequest
  ): Promise<ProjectDetailResponse> => {
    try {
      const updated = await update.mutateAsync(request)
      void navigate(`/projects/${updated.id}/editor`)
      return updated
    } catch (saveError) {
      if (
        isApiError(saveError) &&
        saveError.errorCode === "PROJECT_VERSION_CONFLICT"
      ) {
        setConflict(true)
      }
      /* Weiterwerfen: das Formular ordnet 400 VALIDATION_FAILED den Feldern
         zu und zeigt alles Uebrige als Meldung an sich selbst. Nur den
         Versionskonflikt behandelt es bewusst nicht, den zeigt der Dialog
         hier. */
      throw saveError
    }
  }

  const backToPortfolio = (
    <Link
      to={PORTFOLIO_PATH}
      className={buttonVariants({ variant: "secondary" })}
    >
      {t("project.metadata.backToPortfolio")}
    </Link>
  )

  return (
    <>
      <BreadcrumbBar
        items={[
          { label: t("common.nav.home"), to: "/" },
          { label: t("common.nav.myPortfolio"), to: PORTFOLIO_PATH },
          { label: t("project.metadata.breadcrumb") },
        ]}
      />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
        {notFound ? (
          <EmptyState
            headingLevel={1}
            icon={<FileQuestionIcon aria-hidden="true" />}
            title={t("project.metadata.notFound.title")}
            description={t("project.metadata.notFound.description")}
            action={backToPortfolio}
          />
        ) : forbidden ? (
          <EmptyState
            headingLevel={1}
            icon={<LockIcon aria-hidden="true" />}
            title={t("project.metadata.forbidden.title")}
            description={t("project.metadata.forbidden.description")}
            action={backToPortfolio}
          />
        ) : (
          <>
            <h1 className="type-h2 font-semibold text-primary">
              {t("project.metadata.heading")}
            </h1>

            {detail.isPending ? (
              <div className="grid gap-8 lg:grid-cols-[3fr_4fr]">
                <div className="flex flex-col gap-4">
                  <Skeleton className="aspect-[7/4] w-full rounded-card" />
                  <Skeleton className="h-10 rounded-control" />
                  <Skeleton className="h-20 rounded-control" />
                </div>
                <div className="flex flex-col gap-4">
                  <Skeleton className="h-64 rounded-control" />
                  <Skeleton className="h-40 rounded-control" />
                </div>
              </div>
            ) : project === undefined ? (
              /* Kein Ladezustand, kein bekannter Fehlercode: der Envelope
                 traegt trotzdem einen Text (§6.2), und der erscheint. Eine
                 leere Flaeche waere der uebersehene Fall. */
              <Alert variant="destructive">
                <AlertTitle>
                  {error !== null && isApiError(error)
                    ? t(apiErrorMessageKey(error), {
                        defaultValue: error.message,
                      })
                    : t("apiError.INTERNAL_ERROR")}
                </AlertTitle>
              </Alert>
            ) : (
              <ProjectMetadataForm
                /* Nach einem Neuladen wegen Versionskonflikt traegt das
                   Projekt eine neue version. Der Schluessel setzt das
                   Formular damit auf den Serverstand zurueck, ohne dass es
                   dafuer einen Effekt braeuchte. */
                key={`${project.id}-${project.version}`}
                project={project}
                disabled={!isEditable(project.status)}
                onUploadCoverImage={async (file) => {
                  const stored = await uploadCover.mutateAsync(file)
                  return stored.url
                }}
                onSubmit={submit}
                onDirtyChange={setDirty}
                onCancel={leaveToPortfolio}
              />
            )}
          </>
        )}
      </div>

      {/*
       * Rueckfrage vor dem Verwerfen (Skill frontend-design, Abschnitt 5):
       * Titel als Frage, der Gegenstand im Text beim Namen, Abbrechen
       * zuerst, die Handlung mit ihrem eigenen Verb. Kein
       * variant="destructive": verworfen werden ungespeicherte Eingaben,
       * zerstoert wird nichts, was schon Bestand hat.
       */}
      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("project.metadata.leave.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("project.metadata.leave.description", {
                title:
                  project === undefined || project.title === ""
                    ? t("project.metadata.leave.untitled")
                    : project.title,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("project.metadata.leave.stay")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmLeave(false)
                void navigate(PORTFOLIO_PATH)
              }}
            >
              {t("project.metadata.leave.discard")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <VersionConflictDialog
        open={conflict}
        onKeepEditing={() => setConflict(false)}
        onReload={() => {
          setConflict(false)
          /* Serverstand holen; der Schluessel am Formular setzt es danach
             auf die neuen Werte zurueck. */
          void detail.refetch()
        }}
      />
    </>
  )
}
