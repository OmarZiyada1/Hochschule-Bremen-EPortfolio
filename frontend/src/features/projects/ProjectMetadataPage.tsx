import { ArrowLeftIcon, FileQuestionIcon, LockIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useParams } from "react-router-dom"

import { useAuth } from "@/api/auth/AuthContext"
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
  useCreateProject,
  useUpdateProject,
  useUploadCoverImage,
} from "@/features/projects/hooks/useProjectMetadataMutations"
import { ProjectMetadataForm } from "@/features/projects/ProjectMetadataForm"
import { toProjectCreateRequest } from "@/features/projects/ProjectMetadataForm.schema"

/** Wohin "Zurueck" und "Abbrechen" fuehren: die eigene Projektliste. */
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
 * "Projekt-Metadaten" nach dem gleichnamigen Template (KAN-35), fuer beide
 * Routen: {@code /projects/new} und {@code /projects/:projectId/metadata}.
 *
 * <p><strong>Anlegen laeuft in zwei Schritten</strong> (Klaerungsrunde zu
 * KAN-35). Auf {@code /projects/new} steht dasselbe Formular, aber ohne
 * Titelbild: {@code POST /api/files} verlangt eine {@code projectId}, und
 * die gibt es vor dem Anlegen nicht. Absenden legt das Projekt an und fuehrt
 * auf die Metadaten-Route, wo das Titelbild nachgetragen werden kann oder
 * eben nicht. Von dort geht es weiter in den Editor.
 *
 * <p><strong>Die Seitenhuelle ist Sache dieser Route</strong>, nicht des
 * Formulars: Brotkrume, Zurueck-Weg und die einzige {@code h1} stehen hier.
 * {@code ProjectMetadataForm} bleibt ohne Huelle, damit der Editor es als
 * Dialog oeffnen kann, ohne die Brotkrume mitzubringen (KAN-36).
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
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const creating = projectId === undefined

  const detail = useProjectDetail(projectId ?? "", !creating)
  const create = useCreateProject()
  const update = useUpdateProject(projectId ?? "")
  const uploadCover = useUploadCoverImage(projectId ?? "")

  const [conflict, setConflict] = useState(false)
  /* Ungespeicherte Eingaben: der Weg zurueck fragt dann vorher nach
     (Skill frontend-design, Abschnitt 5). */
  const [dirty, setDirty] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)

  const error = creating ? null : detail.error
  const forbidden =
    error !== null && isApiError(error) && error.errorCode === "NO_PERMISSION"
  const notFound =
    error !== null &&
    isApiError(error) &&
    error.errorCode === "PROJECT_NOT_FOUND"

  /*
   * Der leere Entwurf fuer die Anlege-Route. Er ist kein Serverstand,
   * sondern der Ausgangspunkt eines Formulars, das denselben Vertrag
   * bedient wie auf der Bearbeiten-Route: ein project, ein onSubmit, ein
   * Body-Bauer. Die Alternative waere ein zweites Formular mit eigenen
   * Standardwerten gewesen, also genau die zweite Wahrheit, die dieses
   * Ticket vermeidet.
   *
   * version 0 entspricht dem Default der Entity (§3.3); benutzt wird sie
   * nicht, denn POST /projects kennt kein Optimistic Locking und die Route
   * laesst das Feld beim Umbau auf den Create-Request weg.
   */
  const emptyDraft: ProjectDetailResponse = {
    id: "",
    title: "",
    summary: null,
    coverImageUrl: null,
    status: "DRAFT",
    projectType: null,
    degree: null,
    semester: null,
    category: null,
    faculty: null,
    studyProgram: null,
    module: null,
    author: {
      id: user?.id ?? "",
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      avatarUrl: null,
    },
    members: [],
    tags: [],
    blocks: [],
    reactionCount: 0,
    editors: [],
    statusHistory: null,
    version: 0,
    publishedAt: null,
    createdAt: "",
    updatedAt: "",
  }

  const project = creating ? emptyDraft : detail.data

  /**
   * Der Weg zurueck ins Portfolio, über „Abbrechen“ wie über den Zurück-Link.
   *
   * <p>Traegt das Formular ungespeicherte Eingaben, wird vorher gefragt
   * (Skill frontend-design, Abschnitt 5); sonst geht es direkt weiter, denn
   * ein Klick mehr ohne Grund ist auch keine Freundlichkeit. Dasselbe
   * Muster wie in {@code PasswordChangeSection} aus KAN-69.
   *
   * <p><strong>Bewacht sind die Wege, die diese Seite selbst anbietet.</strong>
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
   * Der eine Schreibweg des Formulars. Er unterscheidet die beiden Routen,
   * das Formular selbst tut es nicht.
   *
   * <p>Beim Anlegen faellt {@code version} weg: {@code ProjectCreateRequest}
   * kennt sie nicht, es gibt noch keinen Stand, gegen den zu pruefen waere.
   * Der Rest des Bodys ist derselbe, den {@code toProjectUpdateRequest}
   * gebaut hat.
   */
  const submit = async (
    request: ProjectUpdateRequest
  ): Promise<ProjectDetailResponse> => {
    if (creating) {
      const created = await create.mutateAsync(toProjectCreateRequest(request))
      /* replace, damit der Zurueck-Knopf des Browsers nicht auf ein
         Anlegeformular fuehrt, dessen Projekt es inzwischen gibt. */
      void navigate(`/projects/${created.id}/metadata`, { replace: true })
      return created
    }

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
            action={
              <Link
                to={PORTFOLIO_PATH}
                className={buttonVariants({ variant: "secondary" })}
              >
                {t("project.metadata.backToPortfolio")}
              </Link>
            }
          />
        ) : forbidden ? (
          <EmptyState
            headingLevel={1}
            icon={<LockIcon aria-hidden="true" />}
            title={t("project.metadata.forbidden.title")}
            description={t("project.metadata.forbidden.description")}
            action={
              <Link
                to={PORTFOLIO_PATH}
                className={buttonVariants({ variant: "secondary" })}
              >
                {t("project.metadata.backToPortfolio")}
              </Link>
            }
          />
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <Link
                to={PORTFOLIO_PATH}
                className="type-body-sm inline-flex w-fit items-center gap-2 text-primary underline-offset-4 hover:underline"
                onClick={(event) => {
                  /* Ein echter Link bleibt er trotzdem: Rechtsklick und
                     „in neuem Tab öffnen“ funktionieren weiter, nur der
                     gewoehnliche Klick laeuft durch die Rueckfrage. */
                  if (dirty) {
                    event.preventDefault()
                    setConfirmLeave(true)
                  }
                }}
              >
                <ArrowLeftIcon aria-hidden="true" className="size-4" />
                {t("project.metadata.backToPortfolio")}
              </Link>
              <h1 className="type-h2 font-semibold text-primary">
                {t("project.metadata.heading")}
              </h1>
            </div>

            {!creating && detail.isPending ? (
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
              <div>
                <ProjectMetadataForm
                  /* Nach einem Neuladen wegen Versionskonflikt traegt das
                     Projekt eine neue version. Der Schluessel setzt das
                     Formular damit auf den Serverstand zurueck, ohne dass es
                     dafuer einen Effekt braeuchte. */
                  key={`${project.id}-${project.version}`}
                  project={project}
                  disabled={!isEditable(project.status)}
                  submitLabel={
                    creating
                      ? t("project.metadata.submitCreate")
                      : t("project.metadata.submit")
                  }
                  onUploadCoverImage={
                    creating
                      ? undefined
                      : async (file) => {
                          const stored = await uploadCover.mutateAsync(file)
                          return stored.url
                        }
                  }
                  onSubmit={submit}
                  onDirtyChange={setDirty}
                  onCancel={leaveToPortfolio}
                />
              </div>
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
                  project?.title === undefined || project.title === ""
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
