import { FileQuestionIcon, InfoIcon, LockIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"

import { isApiError } from "@/api/errors"
import type { ProjectDetailResponse, ProjectUpdateRequest } from "@/api/types"
import { EmptyState } from "@/components/common/EmptyState"
import { ErrorState } from "@/components/common/ErrorState"
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useProjectDetail } from "@/features/projects/hooks/useProjectDetail"
import {
  useUpdateProject,
  useUploadCoverImage,
} from "@/features/projects/hooks/useProjectMetadataMutations"
import {
  ProjectMetadataForm,
  type SubmitIntent,
} from "@/features/projects/ProjectMetadataForm"
import { submitProject } from "@/api/queries/projects"
import { EditLockGate } from "@/features/project-content/components/EditLockGate"
import { missingForSubmit } from "@/features/project-content/submitRequirements"
import { useBreadcrumbTitle } from "@/routes/useBreadcrumb"
import { projectHref } from "@/features/projects/projectRoutes"
import { InfoHint } from "@/components/common/InfoHint"

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

  const [params] = useSearchParams()
  /*
   * Der Editor schickt mit ?submit=1 hierher, wenn jemand dort auf
   * Einreichen geklickt hat (§3.3, §4.1). Die sieben Pflichtangaben stehen
   * auf dieser Seite, und nur hier: ein Seitenpanel im Editor zeigte
   * dasselbe Formular ein zweites Mal, in schmalerer Spalte und mit einem
   * zweiten Speicherweg. Der Merker steht in der Adresse und nicht im
   * Navigationszustand, damit ein Neuladen den Weg nicht vergisst.
   */
  const submitting = params.get("submit") === "1"

  /*
   * Auf dem Einreichweg heisst die letzte Ebene des Brotkrumenpfades
   * „Einreichen" und nicht „Projekt-Metadaten": es ist dieselbe Seite, aber
   * ein anderer Schritt. Die Station davor (der Editor) kommt als Herkunft
   * mit dem Aufruf, siehe EditorPage. Das Band selbst zeichnet der
   * Anwendungsrahmen (KAN-80).
   */
  useBreadcrumbTitle(submitting ? t("project.metadata.breadcrumbSubmit") : null)

  const detail = useProjectDetail(projectId)
  const update = useUpdateProject(projectId)
  const uploadCover = useUploadCoverImage(projectId)

  const [conflict, setConflict] = useState(false)
  /*
   * 409 CHANGE_REQUESTS_OPEN beim Einreichen (§2.4, §4.1). Der Envelope
   * traegt zwar einen Text, aber die Person steht dann vor einer Sperre
   * ohne Weg: die offenen Aenderungswuensche stehen im Editor, in der
   * Kommentarspalte aus KAN-37. Deshalb ein eigener Zustand mit einem Weg
   * dorthin statt der blossen Meldung (Ticket KAN-37).
   */
  const [changeRequestsOpen, setChangeRequestsOpen] = useState(false)
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
  /**
   * Zurueck in den Editor, ohne zu speichern. Auf dem Einreichweg ist das
   * der richtige Abbruch: wer dort auf „Abbrechen" klickt, will zurueck an
   * den Text und nicht ins Portfolio.
   */
  const leaveToEditor = () => {
    if (dirty) {
      setConfirmLeave(true)
      return
    }
    void navigate(`/projects/${projectId}/editor`)
  }

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
    request: ProjectUpdateRequest,
    intent: SubmitIntent
  ): Promise<ProjectDetailResponse> => {
    /* Jeder neue Versuch beginnt ohne die alte Meldung: nach einem
       erfolgreichen „Nur speichern" stuende sie sonst weiter da, obwohl der
       Fehler nicht mehr aktuell ist (Befund des frontend-reviewers). */
    setChangeRequestsOpen(false)
    try {
      const updated = await update.mutateAsync(request)
      /*
       * Auf dem Einreichweg gibt es zwei Enden, und die Schaltflaeche sagt
       * welches: die zweite speichert nur und geht zurueck in den Editor.
       * Zuvor stand dort „Speichern und weiter zum Editor" und reichte
       * trotzdem ein, was eine falsche Zusage war.
       */
      if (!submitting || intent === "secondary") {
        void navigate(`/projects/${updated.id}/editor`)
        return updated
      }
      /*
       * Zwei Aufrufe, in dieser Reihenfolge: erst die Metadatenkarte, dann
       * der Uebergang (§6.1 trennt beides). Scheitert der zweite, sind die
       * Angaben trotzdem gespeichert, und das ist die richtige Richtung;
       * die Meldung dazu zeigt das Formular an sich selbst.
       */
      const submitted = await submitProject(updated.id)
      /*
       * Nicht auf die oeffentliche Seite: das ist der haeufigste Weg zu
       * einem frisch eingereichten eigenen Projekt, und dort gibt es seit
       * KAN-104 keine Handlung mehr, nicht einmal das Zurueckziehen. Der
       * Editor traegt beides, den Umschalter zwischen Vorschau und
       * Bearbeiten und die Handlungen des Zustandsautomaten (Befund des
       * frontend-reviewers).
       */
      void navigate(projectHref(submitted.id, submitted.status, "own"))
      return submitted
    } catch (saveError) {
      if (
        isApiError(saveError) &&
        saveError.errorCode === "PROJECT_VERSION_CONFLICT"
      ) {
        setConflict(true)
      }
      if (
        isApiError(saveError) &&
        saveError.errorCode === "CHANGE_REQUESTS_OPEN"
      ) {
        setChangeRequestsOpen(true)
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

  /*
   * Die Bearbeitungssperre gilt hier genauso wie im Editor (§6.9, KAN-86):
   * PUT /projects/{id} faellt mit unter sie, und ohne das Gatter fuellte
   * jemand das ganze Formular aus und liefe beim Speichern in einen 409.
   *
   * <p>Anders als beim Editor sitzt es innerhalb der Seite und nicht vor
   * ihr: hier gibt es nichts Teures aufzubauen, und die Frage nach der
   * Sperre gehoert dicht an die Stelle, an der geschrieben wird. Der
   * Ladeumriss ist derselbe wie unten im Formularbereich.
   */
  const lockFallback = (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <Skeleton className="h-10 w-1/2 rounded-control" />
      <div className="grid gap-8 lg:grid-cols-[3fr_4fr]">
        <Skeleton className="h-64 rounded-card" />
        <Skeleton className="h-64 rounded-card" />
      </div>
    </div>
  )

  return (
    <EditLockGate projectId={projectId} fallback={lockFallback}>
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
            <div className="flex items-center gap-1">
              <h1 className="type-h2 font-semibold text-primary">
                {submitting
                  ? t("projectContent.submit.title")
                  : t("project.metadata.heading")}
              </h1>
              {/*
               * Was das Einreichen ausloest, steht hinter einem „i" neben
               * der Ueberschrift. Der Kasten darunter sagte es bis dahin
               * mit, erscheint aber nur noch, wenn Angaben fehlen: der
               * Satz waere damit ausgerechnet im Regelfall verschwunden,
               * also genau dann, wenn jemand wirklich einreicht. Eingereicht
               * ist nicht mehr bearbeitbar (§4.1), und eine Rueckfrage gibt
               * es nicht (Befund des frontend-reviewers).
               */}
              {submitting && (
                <InfoHint
                  label={t("projectContent.submit.descriptionLabel")}
                  text={t("projectContent.submit.description")}
                />
              )}
            </div>

            {/*
             * Was zum Einreichen noch fehlt, steht ueber dem Formular und
             * nicht erst in der Serverantwort. Der Server bleibt
             * verbindlich mit 400 PROJECT_INCOMPLETE; diese Liste sagt es
             * vorher, statt die Autor:in mit Feldnamen zurueckzuschicken.
             *
             * <p><strong>Nur, wenn wirklich etwas fehlt.</strong> Sonst
             * stand hier ein Kasten, dessen Titel die Ueberschrift darueber
             * Wort fuer Wort wiederholte und dessen Satz sagte, was die
             * Schaltflaeche unten ohnehin sagt. Zwei Zeilen Text fuer eine
             * Auskunft, die niemand gesucht hat.
             */}
            {submitting &&
              project !== undefined &&
              missingForSubmit(project).length > 0 && (
                <Alert>
                  <InfoIcon aria-hidden="true" />
                  <AlertTitle>
                    {t("projectContent.submit.missingTitle")}
                  </AlertTitle>
                  <AlertDescription>
                    {t("projectContent.submit.missingDescription", {
                      fields: missingForSubmit(project)
                        .map((field) =>
                          t(`projectContent.submit.field.${field}`)
                        )
                        .join(", "),
                    })}
                  </AlertDescription>
                </Alert>
              )}

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
              <ErrorState error={error} />
            ) : (
              <>
                {changeRequestsOpen && (
                  <Alert variant="destructive" className="mb-6">
                    <AlertTitle>
                      {t("apiError.CHANGE_REQUESTS_OPEN")}
                    </AlertTitle>
                    <AlertDescription>
                      <Link
                        to={`/projects/${project.id}/editor`}
                        className="underline"
                      >
                        {t("project.metadata.changeRequestsOpenAction")}
                      </Link>
                    </AlertDescription>
                  </Alert>
                )}
                <ProjectMetadataForm
                  /* Nach einem Neuladen wegen Versionskonflikt traegt das
                   Projekt eine neue version. Der Schluessel setzt das
                   Formular damit auf den Serverstand zurueck, ohne dass es
                   dafuer einen Effekt braeuchte. */
                  key={`${project.id}-${project.version}`}
                  project={project}
                  disabled={!isEditable(project.status)}
                  /* Auf dem Einreichweg markiert das Formular die Schritte,
                     in denen eine Pflichtangabe aus §3.3 fehlt, und haelt
                     den obersten davon offen. Der Hinweis darueber zaehlt
                     sie auf; ohne die Markierung naennte er Felder, die in
                     zugeklappten Schritten stehen. */
                  highlightMissingForSubmit={submitting}
                  onUploadCoverImage={async (file) => {
                    const stored = await uploadCover.mutateAsync(file)
                    return stored.url
                  }}
                  onSubmit={submit}
                  onDirtyChange={setDirty}
                  submitLabel={
                    submitting ? t("project.metadata.saveAndSubmit") : undefined
                  }
                  submitPendingLabel={
                    submitting
                      ? t("project.metadata.saveAndSubmitPending")
                      : undefined
                  }
                  secondarySubmit={
                    submitting
                      ? { label: t("project.metadata.saveOnly") }
                      : undefined
                  }
                  onCancel={submitting ? leaveToEditor : leaveToPortfolio}
                />
              </>
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
                /* Dorthin, wo „Abbrechen" hinfuehrt: auf dem Einreichweg
                   zurueck an den Text, sonst ins Portfolio. */
                void navigate(
                  submitting ? `/projects/${projectId}/editor` : PORTFOLIO_PATH
                )
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
    </EditLockGate>
  )
}
