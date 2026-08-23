import {
  ArrowLeftIcon,
  FileQuestionIcon,
  FileTextIcon,
  HistoryIcon,
  LockIcon,
} from "lucide-react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useParams } from "react-router-dom"

import { useAuth } from "@/api/auth/AuthContext"
import { apiErrorMessageKey, isApiError } from "@/api/errors"
import { useFileUrl } from "@/api/useFileUrl"
import type { BlockResponse, ProjectDetailResponse } from "@/api/types"
import { CommentPanel } from "@/components/common/CommentPanel"
import { EmptyState } from "@/components/common/EmptyState"
import { StatusBadge } from "@/components/common/StatusBadge"
import { Alert, AlertTitle } from "@/components/ui/alert"
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
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { HistoryDialog } from "@/features/project-content/components/HistoryDialog"
import { ViewModeSwitch } from "@/features/project-content/components/ViewModeSwitch"
import { useProjectFileUrls } from "@/features/project-content/hooks/useProjectFileUrls"
import { ProjectContent } from "@/features/project-content/renderer/ProjectContent"
import { ProjectMetaSidebar } from "@/features/projects/components/ProjectMetaSidebar"
import { useProjectDetail } from "@/features/projects/hooks/useProjectDetail"
import { RevisionDialog } from "@/features/reviews/components/RevisionDialog"
import { useReviewWorkflow } from "@/features/reviews/hooks/useReviews"

/* Eine Liste, nicht bei jedem Rendern eine neue: sie steht in den
   Abhaengigkeiten der Bildaufloesung. */
const EMPTY_BLOCKS: readonly BlockResponse[] = []

/**
 * Der Review-Modus nach Template „Editor (Review-Modus)" (Ticket KAN-37):
 * links der gelesene Beitrag, rechts Umschalter, Status samt Aktionen,
 * Projektdaten und die Kommentarspalte.
 *
 * <p><strong>Er bleibt im Anwendungsrahmen</strong> und nicht im rahmenlosen
 * {@code EditorLayout}: das Template zeichnet NavBar und Ruecksprungleiste.
 *
 * <p><strong>Kein Editor.</strong> Der Inhalt laeuft ausschliesslich ueber
 * {@code ProjectContent} aus KAN-10, den JSON-Renderer ohne Tiptap. Aus
 * {@code features/project-content/} darf diese Seite nur ziehen, was kein
 * {@code @tiptap/*} und kein {@code prosemirror-*} nachzieht: den Renderer,
 * {@code useProjectFileUrls}, {@code HistoryDialog} und
 * {@code ViewModeSwitch}. Der Importwaechter
 * ({@code src/tests/features/project-content/rendererImports.test.ts})
 * prueft genau das, sonst kaeme das ProseMirror-Buendel ueber eine
 * Zwischendatei ins Hauptbuendel zurueck.
 *
 * <p><strong>Angeboten wird nur, was §4.1 im aktuellen Status
 * zulaesst</strong>, und nur, was das Vier-Augen-Prinzip nicht sperrt: wer
 * zur Projektseite gehoert, genehmigt und veroeffentlicht nicht, auch nicht
 * als zugewiesene Redaktion (§4.1 seit v61). Ein dauerhaft gesperrter Knopf
 * entsteht nicht; ein trotzdem eintreffendes 403 wird sichtbar behandelt.
 *
 * <p><strong>Kein Nominierungsknopf.</strong> Nominiert wird aus der
 * Reviewliste. Hier steht ein Projekt in aller Regel auf {@code SUBMITTED},
 * wo jede Nominierung nur 409 {@code PROJECT_NOT_PUBLISHED} ergaebe.
 */
export default function ProjectReviewPage() {
  const { t } = useTranslation()
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { data, isPending, error } = useProjectDetail(projectId ?? "")

  /*
   * Ein Projekt im Review steht selten auf PUBLISHED; seine Medien
   * brauchen deshalb den angemeldeten Weg, sonst beantwortet der Server
   * jede Medienanfrage mit 401 und die Seite zeigt leere Stellen
   * (Begruendung an useProjectFileUrls). Beide Rueckgabewerte werden
   * durchgereicht: ohne fileState zeigt der Renderer keinen Ladezustand.
   */
  const needsToken = data !== undefined && data.status !== "PUBLISHED"
  const { resolveFileUrl, fileState } = useProjectFileUrls(
    data?.blocks ?? EMPTY_BLOCKS,
    needsToken
  )
  const cover = useFileUrl(data?.coverImageUrl, needsToken)

  const forbidden =
    error !== null && isApiError(error) && error.errorCode === "NO_PERMISSION"
  const notFound =
    error !== null &&
    isApiError(error) &&
    error.errorCode === "PROJECT_NOT_FOUND"

  return (
    <>
      <div className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-6xl px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link to="/reviews" />}
          >
            <ArrowLeftIcon aria-hidden="true" />
            {t("review.detail.back")}
          </Button>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
        {notFound && (
          <EmptyState
            headingLevel={1}
            icon={<FileQuestionIcon aria-hidden="true" />}
            title={t("project.detail.notFound.title")}
            description={t("project.detail.notFound.description")}
            action={
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link to="/reviews" />}
              >
                {t("review.detail.back")}
              </Button>
            }
          />
        )}

        {forbidden && (
          <EmptyState
            headingLevel={1}
            icon={<LockIcon aria-hidden="true" />}
            title={t("review.detail.forbidden.title")}
            description={t("review.detail.forbidden.description")}
            action={
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link to="/reviews" />}
              >
                {t("review.detail.back")}
              </Button>
            }
          />
        )}

        {error !== null && !forbidden && !notFound && (
          <>
            <h1 className="type-h2">{t("project.detail.error.title")}</h1>
            <Alert variant="destructive">
              <AlertTitle>
                {isApiError(error)
                  ? t(apiErrorMessageKey(error), {
                      defaultValue: error.message,
                    })
                  : t("apiError.INTERNAL_ERROR")}
              </AlertTitle>
            </Alert>
          </>
        )}

        {isPending && (
          <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[1fr_21.25rem] lg:items-start lg:gap-12">
            {/* Auch der Ladezustand traegt eine Ueberschrift: sonst hat die
                Seite fuer die Sprungnavigation eines Screenreaders bis zur
                Antwort gar keine (SC 1.3.1, SC 2.4.6). */}
            <h1 className="sr-only">{t("review.detail.loading")}</h1>
            <div className="flex flex-col gap-6">
              <Skeleton className="h-110 w-full rounded-xl" />
              <Skeleton className="h-12 w-3/4 rounded-control" />
              <Skeleton className="h-32 w-full rounded-control" />
            </div>
            <Skeleton className="h-160 rounded-xl" />
          </div>
        )}

        {data !== undefined && (
          <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[1fr_21.25rem] lg:items-start lg:gap-12">
            <Card className="min-w-0 [--card-spacing:--spacing(10)]">
              {cover.url !== null && (
                <img
                  src={cover.url}
                  alt=""
                  className="h-60 w-full object-cover sm:h-110"
                />
              )}
              <CardContent>
                <article className="flex min-w-0 flex-col gap-6">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="type-overline tracking-widest text-muted-foreground uppercase">
                        {t("project.list.label")}
                      </p>
                      <StatusBadge status={data.status} />
                    </div>
                    <h1 className="type-title min-w-0 text-primary">
                      {data.title}
                    </h1>
                  </div>

                  <hr />

                  {data.summary !== null && (
                    <section className="flex flex-col gap-3">
                      <h2 className="type-h2">
                        {t("project.detail.abstract")}
                      </h2>
                      <p className="type-body-lg">{data.summary}</p>
                    </section>
                  )}

                  <section className="flex flex-col gap-3">
                    <h2 className="type-h2">{t("project.detail.content")}</h2>
                    {(data.blocks ?? []).length === 0 ? (
                      <EmptyState
                        headingLevel={3}
                        icon={<FileTextIcon aria-hidden="true" />}
                        title={t("project.detail.empty.title")}
                        description={t("project.detail.empty.description")}
                      />
                    ) : (
                      <ProjectContent
                        blocks={data.blocks ?? EMPTY_BLOCKS}
                        resolveFileUrl={resolveFileUrl}
                        fileState={fileState}
                      />
                    )}
                  </section>
                </article>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-6">
              <ViewModeSwitch
                mode="review"
                alternate="review"
                onModeChange={(mode) => {
                  if (mode === "preview") {
                    /* from=review haengt der Detailseite den Rueckweg an:
                       ohne ihn waere die Vorschau eine Sackgasse, weil der
                       Umschalter dort nur fuer die Projektseite erscheint
                       (Befund des frontend-reviewers). */
                    void navigate(`/projects/${data.id}?from=review`)
                  }
                }}
              />

              <ReviewActionsCard project={data} />

              <Card>
                <CardContent>
                  <aside
                    aria-label={t("project.detail.meta.label")}
                    className="flex flex-col gap-6"
                  >
                    <ProjectMetaSidebar project={data} />
                  </aside>
                </CardContent>
              </Card>

              <CommentPanel project={data} context="review" />
            </div>
          </div>
        )}
      </div>
    </>
  )
}

/**
 * Statuskarte: aktueller Status, die im Status moeglichen Aktionen und der
 * Zugang zur Historie.
 *
 * <p>Der Verlauf laeuft ueber {@code HistoryDialog} aus
 * {@code features/project-content/}; eine zweite Fassung entsteht nicht,
 * und die vorhandene zieht nicht um.
 */
function ReviewActionsCard({ project }: { project: ProjectDetailResponse }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { approve, publish, requestRevision } = useReviewWorkflow(project.id)

  const [historyOpen, setHistoryOpen] = useState(false)
  const [revisionOpen, setRevisionOpen] = useState(false)
  const [notice, setNotice] = useState("")
  /*
   * Beide Freigabeschritte fragen vorher zurueck (Skill frontend-design,
   * Abschnitt 5): sie aendern die Sicht anderer. Das Veroeffentlichen macht
   * den Beitrag fuer alle sichtbar und laesst sich nur ueber „Zur
   * Ueberarbeitung" wieder einfangen. Nicht destruktiv eingefaerbt, es wird
   * nichts zerstoert.
   */
  const [confirm, setConfirm] = useState<"approve" | "publish" | null>(null)
  const approveRef = useRef<HTMLButtonElement | null>(null)
  const publishRef = useRef<HTMLButtonElement | null>(null)
  const revisionRef = useRef<HTMLButtonElement | null>(null)

  /*
   * Vier-Augen-Prinzip (§4.1 seit v61, §5 Fussnote 1): wer zur Projektseite
   * gehoert, gibt sie nicht frei, auch nicht als zugewiesene Redaktion. Fuer
   * ADMIN greift die Sperre nicht (§7, offener Punkt 7). Die Oberflaeche
   * blendet aus, was nicht greift; verbindlich bleibt der Server.
   */
  const onProjectSide =
    user !== null &&
    (project.author.id === user.id ||
      (project.members ?? []).some((member) => member.userId === user.id))
  const mayRelease = user?.role === "ADMIN" || !onProjectSide

  const mayApprove = project.status === "SUBMITTED" && mayRelease
  const mayPublish = project.status === "APPROVED" && mayRelease
  /* Die Ruecknahme ist keine Freigabe und traegt in §5 keine Fussnote 1. */
  const mayRequestRevision =
    project.status === "SUBMITTED" ||
    project.status === "APPROVED" ||
    project.status === "PUBLISHED"

  const failure = approve.error ?? publish.error ?? requestRevision.error
  const failed = isApiError(failure) ? failure : null

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <StatusBadge status={project.status} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setHistoryOpen(true)}
            disabled={project.statusHistory === null}
          >
            <HistoryIcon aria-hidden="true" />
            {t("review.detail.history")}
          </Button>
        </div>

        {!mayApprove && !mayPublish && !mayRequestRevision ? (
          <p className="type-body-sm text-muted-foreground">
            {onProjectSide && !mayRelease
              ? t("review.detail.actions.ownProject")
              : t("review.detail.actions.none")}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {mayApprove && (
              <Button
                ref={approveRef}
                disabled={approve.isPending}
                onClick={() => setConfirm("approve")}
              >
                {t("review.detail.actions.approve")}
              </Button>
            )}
            {mayPublish && (
              <Button
                ref={publishRef}
                disabled={publish.isPending}
                onClick={() => setConfirm("publish")}
              >
                {t("review.detail.actions.publish")}
              </Button>
            )}
            {mayRequestRevision && (
              <Button
                ref={revisionRef}
                variant="outline"
                onClick={() => setRevisionOpen(true)}
              >
                {t("review.detail.actions.requestRevision")}
              </Button>
            )}
            {onProjectSide && !mayRelease && (
              <p className="type-label-xs text-muted-foreground">
                {t("review.detail.actions.ownProject")}
              </p>
            )}
          </div>
        )}

        {failed !== null && (
          <Alert variant="destructive">
            <AlertTitle>
              {t(apiErrorMessageKey(failed), { defaultValue: failed.message })}
            </AlertTitle>
          </Alert>
        )}

        <AlertDialog
          open={confirm !== null}
          onOpenChange={(next) => {
            if (!next) {
              setConfirm(null)
            }
          }}
        >
          <AlertDialogContent
            className="rounded-modal"
            finalFocus={confirm === "publish" ? publishRef : approveRef}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t(`review.detail.actions.${confirm ?? "approve"}Dialog.title`)}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t(
                  `review.detail.actions.${confirm ?? "approve"}Dialog.description`,
                  { title: project.title }
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.action.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                disabled={approve.isPending || publish.isPending}
                onClick={() => {
                  const step = confirm
                  setConfirm(null)
                  if (step === "approve") {
                    approve.mutate(undefined, {
                      onSuccess: () =>
                        setNotice(t("review.detail.actions.approveDone")),
                    })
                  }
                  if (step === "publish") {
                    publish.mutate(undefined, {
                      onSuccess: () =>
                        setNotice(t("review.detail.actions.publishDone")),
                    })
                  }
                }}
              >
                {t(
                  `review.detail.actions.${confirm ?? "approve"}Dialog.confirm`
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <HistoryDialog
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          history={project.statusHistory}
        />

        <RevisionDialog
          open={revisionOpen}
          onOpenChange={(next) => {
            setRevisionOpen(next)
            if (!next) {
              requestRevision.reset()
            }
          }}
          pending={requestRevision.isPending}
          error={requestRevision.error}
          finalFocus={revisionRef}
          onSubmit={(reason) => {
            requestRevision.mutate(reason, {
              onSuccess: () => {
                setRevisionOpen(false)
                setNotice(t("review.detail.actions.revisionDone"))
              },
            })
          }}
        />

        <span className="sr-only" role="status">
          {notice}
        </span>
      </CardContent>
    </Card>
  )
}
