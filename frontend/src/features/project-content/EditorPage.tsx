import { useQuery } from "@tanstack/react-query"
import { EditorContent, useEditor } from "@tiptap/react"
import { FileQuestionIcon, LockIcon } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useParams } from "react-router-dom"

import { useAuth } from "@/api/auth/AuthContext"
import { apiErrorMessageKey, isApiError } from "@/api/errors"
import { blockQueries } from "@/api/queries/blocks"
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EditorFileUrlProvider } from "@/features/project-content/EditorFileUrlContext"
import {
  insertBlockAfter,
  moveBlock,
  removeBlock,
} from "@/features/project-content/blockCommands"
import { createBlockExtensions } from "@/features/project-content/blockSchema"
import {
  blocksToDoc,
  docToBlocks,
} from "@/features/project-content/blockSerialization"
import type {
  BlockNode,
  ProjectDocument,
} from "@/features/project-content/blockTypes"
import { BlockControls } from "@/features/project-content/components/BlockControls"
import {
  BlockInsertHost,
  directNodeFor,
} from "@/features/project-content/components/BlockInsertHost"
import { EditorHeader } from "@/features/project-content/components/EditorHeader"
import { EditorSidebar } from "@/features/project-content/components/EditorSidebar"
import type { InsertKind } from "@/features/project-content/components/InsertMenu"
import { SelectionToolbar } from "@/features/project-content/components/SelectionToolbar"
import { TableControls } from "@/features/project-content/components/TableControls"
import { useActiveBlock } from "@/features/project-content/hooks/useActiveBlock"
import { useAutosave } from "@/features/project-content/hooks/useAutosave"
import {
  useSubmitProject,
  useWithdrawFromEditor,
} from "@/features/project-content/hooks/useEditorWorkflow"
import {
  collectFileIds,
  useProjectFileUrls,
} from "@/features/project-content/hooks/useProjectFileUrls"
import { ProjectContent } from "@/features/project-content/renderer/ProjectContent"
import { useProjectDetail } from "@/features/projects/hooks/useProjectDetail"

/**
 * Der blockbasierte Editor (KAN-36), Route
 * {@code /projects/:projectId/editor}.
 *
 * <p>Aufbau nach Figma {@code Template / Studierende · Editor ·
 * Auswahlleiste}: Kopfzeile, links die Schreibflaeche unter dem
 * Projekttitel, rechts die Seitenleiste mit Vorschau-Schalter,
 * Statusbadge, Historie und Projektinformationen.
 *
 * <p><strong>Zwei Ressourcen, zwei Anfragen</strong> (Contract 6.1). Die
 * Metadaten kommen aus {@code GET /api/projects/{id}}, der Inhalt aus
 * {@code GET /api/projects/{id}/blocks}. Zusammengefasst wird das im
 * Client nicht: der Autosave schreibt Bloecke und darf die Metadatenkarte
 * nicht anfassen.
 *
 * <p><strong>Die Schreibflaeche traegt dieselbe Klasse wie der
 * Renderer</strong> ({@code .project-content}), damit ein Beitrag beim
 * Schreiben aussieht wie danach. Das Schema kommt ausschliesslich aus
 * {@code createBlockExtensions()}; eine zweite Extension-Liste waere ein
 * Befund.
 *
 * <p><strong>Nicht gespeichert wird in zwei Faellen.</strong> Erstens,
 * wenn der Status die Inhaltsbearbeitung sperrt (4.1): die Flaeche ist dann
 * read-only und sagt sichtbar warum. Zweitens, wenn beim Lesen Bloecke
 * verworfen werden mussten ({@code canSave === false}): der PUT ersetzt die
 * Liste vollstaendig und loeschte genau die Bloecke, die der Client nicht
 * darstellen konnte.
 */

/** Inhaltsbearbeitung nur in diesen beiden Status (4.1). */
function isEditable(status: string): boolean {
  return status === "DRAFT" || status === "REVISION"
}

export default function EditorPage() {
  const { t } = useTranslation()
  const { projectId = "" } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const detail = useProjectDetail(projectId)
  const blocks = useQuery(blockQueries.list(projectId))
  const submit = useSubmitProject(projectId)
  const withdraw = useWithdrawFromEditor(projectId)

  const [conflict, setConflict] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [insertKind, setInsertKind] = useState<InsertKind | null>(null)
  const [announcement, setAnnouncement] = useState("")
  const [workflowError, setWorkflowError] = useState<string | null>(null)
  /**
   * Die Aktion, nach der gerade gefragt wird.
   *
   * <p>Einreichen und Zurueckziehen aendern, was andere sehen, und werden
   * deshalb erst nach einer Rueckfrage abgeschickt (Skill
   * {@code frontend-design}, Abschnitt 5). Ein Fehlklick schickte den
   * Beitrag sonst in die Redaktion, und das Zurueckholen ginge nur ueber den
   * zweiten Uebergang und stuende in der Statushistorie (3.12).
   */
  const [pendingAction, setPendingAction] = useState<
    "submit" | "withdraw" | null
  >(null)
  /**
   * Der zuletzt gezeigte Aktionsname, unabhaengig davon, ob der Dialog noch
   * offen ist.
   *
   * <p>Beim Abbrechen wird {@code pendingAction} sofort null, waehrend der
   * Inhalt noch die Ausblendung lang steht. Ohne den gehaltenen Wert saehe
   * man „Einreichung zurueckziehen?" fuer einen Wimpernschlag als „Projekt
   * einreichen?" verschwinden.
   */
  const [shownAction, setShownAction] = useState<"submit" | "withdraw">(
    "submit"
  )
  const openWorkflowDialog = (action: "submit" | "withdraw") => {
    setShownAction(action)
    setPendingAction(action)
  }
  /** Der Weg zurueck, wenn noch Ungespeichertes offen ist. */
  const [confirmLeave, setConfirmLeave] = useState(false)
  /**
   * Ob der Konfliktdialog bewusst weggeklickt wurde.
   *
   * <p>Ohne diesen Zustand liesse er sich nicht schliessen: er haengt auch
   * an {@code autosave.state === "conflict"}, und den loest allein
   * {@code reset()} im Neuladen-Zweig. „Eigene Fassung behalten" und Escape
   * traefen also auf einen modalen Dialog, der sofort wieder aufginge, und
   * aus der Sackgasse des 409 wuerde eine schlimmere: der Fokus bliebe
   * gefangen, und der eigene Text waere unerreichbar.
   */
  const [conflictDismissed, setConflictDismissed] = useState(false)
  /**
   * Ein Statuswechsel laeuft, einschliesslich des vorgezogenen
   * Speichertakts.
   *
   * <p>{@code submit.isPending} allein genuegt nicht: waehrend
   * {@code flush()} laeuft, ist die Mutation noch gar nicht gestartet, die
   * Schaltflaeche waere wieder bedienbar, und ein zweiter Durchlauf endete
   * in 409 {@code PROJECT_STATUS_TRANSITION_INVALID} fuer eine Aktion, die
   * in Wahrheit geklappt hat.
   */
  const [workflowRunning, setWorkflowRunning] = useState(false)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  /*
   * Rueckgabeziele des Fokus: ein gesteuerter Dialog ohne Trigger laesst
   * den Fokus beim Schliessen sonst auf body fallen, und die
   * Tastaturbedienung begaenne wieder am Seitenanfang (SC 2.4.3).
   */
  const workflowButtonRef = useRef<HTMLButtonElement | null>(null)
  const backButtonRef = useRef<HTMLButtonElement | null>(null)

  /*
   * Der Editor entsteht vor dem Speichertakt, sein onUpdate braucht ihn
   * aber. Der Ref ist die Bruecke: er wird gleich nach useAutosave gesetzt
   * und ist zu dem Zeitpunkt gefuellt, an dem die erste Aenderung
   * eintrifft. Ohne ihn stuende in onUpdate eine Bindung, die es beim
   * ersten Rendern noch nicht gibt.
   */
  const scheduleRef = useRef<() => void>(() => undefined)

  /*
   * Die gelesene Fassung: Dokument, Loecher und die Zusage, ob sie
   * zurueckgeschrieben werden darf. Einmal gerechnet und nicht bei jedem
   * Rendern erneut; die Serverantwort aendert sich nur beim Speichern.
   */
  const read = useMemo(
    () => (blocks.data === undefined ? null : blocksToDoc(blocks.data.blocks)),
    [blocks.data]
  )

  const project = detail.data

  /**
   * Wer hier was darf, entscheidet §5 und nicht der Status allein.
   *
   * <p><strong>Inhalt bearbeiten</strong> duerfen Autor:in und
   * Projektmitglieder (§5, Zeile „Inhalt bearbeiten"), und auch die nur in
   * {@code DRAFT} und {@code REVISION} (§4.1).
   * <strong>Einreichen und Zurueckziehen</strong> stehen dagegen allein der
   * Autor:in zu: §5 fuehrt beide als eigene Ressource, und §4.1 nennt in
   * der Spalte „Ausfuehrende Rolle" die Autor:in.
   *
   * <p><strong>Ohne diese Enge zeigte die Oberflaeche Wege, die der Server
   * verweigert.</strong> Ein Projektmitglied saehe „Einreichen" und liefe in
   * 403 {@code NO_PERMISSION}; die zugewiesene Redaktion, die ein Projekt in
   * {@code REVISION} lesen darf, saehe eine beschreibbare Flaeche, und jeder
   * Autosave endete im Fehlerzustand. Die Schranke liegt weiterhin im
   * Server; die Oberflaeche spiegelt sie nur (Befund des Contract-Abgleichs
   * zu KAN-36).
   */
  const isAuthor =
    project !== undefined && user !== null && project.author.id === user.id
  const isMember =
    project !== undefined &&
    user !== null &&
    project.members.some((member) => member.userId === user.id)
  const mayEditContent = isAuthor || isMember

  const statusEditable = project !== undefined && isEditable(project.status)
  const canSave =
    statusEditable && mayEditContent && read !== null && read.canSave

  /**
   * Der Inhalt fuer den Editor, mit einem leeren Absatz statt eines leeren
   * Dokuments.
   *
   * <p><strong>Sonst speichert schon das Oeffnen.</strong> Das Schema
   * verlangt {@code block+}; ein Dokument ohne Kinder ergaenzt ProseMirror
   * beim Aufbau um einen Absatz, und das ist eine Aenderung wie jede andere:
   * {@code onUpdate} feuert, der Speichertakt laeuft an, und ein frisch
   * angelegter Entwurf bekaeme allein vom Ansehen eine neue
   * {@code Project.version} (6.4). Mit dem Absatz von vornherein gibt es
   * nichts zu ergaenzen. Gespeichert wird er ohnehin nicht:
   * {@code docToBlocks} laesst den leeren Schlussabsatz weg.
   */
  const initialContent = useMemo(() => {
    if (read === null) {
      return undefined
    }
    return read.doc.content.length > 0
      ? read.doc
      : { type: "doc" as const, content: [{ type: "paragraph" as const }] }
  }, [read])

  const editor = useEditor(
    {
      extensions: createBlockExtensions(),
      content: initialContent,
      editable: canSave && !previewing,
      editorProps: {
        attributes: {
          /*
           * Rolle und Name der Schreibflaeche (SC 4.1.2). Beides
           * ausdruecklich: ProseMirror setzt von sich aus nur
           * contenteditable, und ohne Namen meldete ein Screenreader bloss
           * "Bearbeitungsbereich". aria-multiline sagt, dass Enter einen
           * Absatz macht und nicht absendet.
           *
           * Die Renderabbildung der Ueberschriften steht nicht hier,
           * sondern als HeadingNodeView in createBlockExtensions(): Tiptap
           * ueberschreibt editorProps.nodeViews mit der Sammlung seines
           * Extension-Managers, ein Eintrag an dieser Stelle bliebe also
           * wirkungslos.
           */
          role: "textbox",
          "aria-multiline": "true",
          "aria-label": t("projectContent.canvas.label"),
          class: "outline-none",
        },
      },
      onUpdate: () => scheduleRef.current(),
    },
    /* Neu aufgebaut, sobald eine andere Fassung gelesen wurde: nach einem
       Neuladen im Konfliktfall traegt sie eine neue version und andere IDs.
       Der Editor uebernimmt Inhalt nur beim Anlegen. */
    [read]
  )

  const readDocument = useCallback(
    (): ProjectDocument | null =>
      editor === null ? null : (editor.getJSON() as ProjectDocument),
    [editor]
  )

  const previousBlocks = useMemo(
    () =>
      (blocks.data?.blocks ?? []).map((block) => ({
        id: block.id,
        type: block.type,
      })),
    [blocks.data]
  )

  const autosave = useAutosave({
    projectId,
    enabled: canSave,
    version: blocks.data?.version ?? 0,
    blocks: previousBlocks,
    readDocument,
  })

  /* Nach dem Rendern gesetzt und nicht waehrend: ein Ref waehrend des
     Renderns zu beschreiben ist ein Seiteneffekt, den React bei einem
     abgebrochenen Rendern nicht zuruecknimmt. */
  useEffect(() => {
    scheduleRef.current = autosave.schedule
  }, [autosave.schedule])

  /* Die Dateien des Dokuments, ueber den Token geholt: ein img schickt
     keinen Authorization-Header, und ein Entwurf ist nicht oeffentlich. */
  const fileIds = useMemo(
    () => collectFileIds(blocks.data?.blocks ?? []),
    [blocks.data]
  )
  const resolveFileUrl = useProjectFileUrls(fileIds)

  const active = useActiveBlock(editor, canvasRef)

  const applyInsert = (node: BlockNode) => {
    if (editor === null || active === null) {
      return
    }
    insertBlockAfter(editor, active.index, node)
    setInsertKind(null)
  }

  /**
   * Der Weg zurueck auf die Metadatenseite.
   *
   * <p>Steht noch etwas aus, wird gefragt statt gegangen: ein Klick
   * innerhalb des Entprellfensters nimmt den Zeitgeber beim Verlassen mit,
   * der Takt feuert nie, und die letzten Aenderungen sind verloren (Skill
   * frontend-design, Abschnitt 5; Befund des Frontend-Reviews zu KAN-36).
   */
  const leaveEditor = () => {
    if (autosave.hasUnsavedChanges) {
      setConfirmLeave(true)
      return
    }
    void navigate(`/projects/${projectId}/metadata`)
  }

  const onInsertChosen = (kind: InsertKind) => {
    const direct = directNodeFor(kind)
    if (direct !== null) {
      applyInsert(direct)
      return
    }
    setInsertKind(kind)
  }

  /**
   * Einreichen oder Zurueckziehen, nach der Rueckfrage.
   *
   * <p>Erst wird der offene Speichertakt abgewartet: {@code flush} kehrt
   * seit dem Review zu KAN-36 auch dann erst zurueck, wenn ein bereits
   * laufender Takt fertig ist. Sonst traefe der Statuswechsel den Server vor
   * dem letzten Speichervorgang, und eingereicht waere ein Stand, den
   * niemand so gesehen hat.
   */
  const runWorkflow = async (action: "submit" | "withdraw") => {
    setWorkflowError(null)
    setPendingAction(null)
    setWorkflowRunning(true)
    try {
      /*
       * Erst weiter, wenn der Takt wirklich durchgekommen ist. {@code flush}
       * wirft nicht, sondern meldet das Ergebnis zurueck; ueber den Zustand
       * ginge es nicht, weil der nach dem Warten noch nicht im Rendern
       * steht. Ohne diese Schranke ginge der Beitrag nach einem 400, 409
       * oder 500 des PUT mit dem <em>alten</em> Serverinhalt an die
       * Redaktion, sichtbar fuer andere: eingereicht waere ein Stand, den
       * niemand so gesehen hat.
       */
      const result = await autosave.flush()
      if (!result.saved) {
        /* Beim Konflikt steht der Dialog ohnehin schon; er ist die
           Entscheidung, die hier fehlt. Sonst braucht es die Meldung. */
        if (!result.conflict) {
          setWorkflowError(t("projectContent.workflow.saveFirst"))
        }
        return
      }

      await (action === "submit"
        ? submit.mutateAsync()
        : withdraw.mutateAsync())
      await Promise.all([detail.refetch(), blocks.refetch()])
    } catch (caught) {
      if (isApiError(caught)) {
        if (caught.errorCode === "PROJECT_VERSION_CONFLICT") {
          setConflict(true)
          setConflictDismissed(false)
        } else {
          setWorkflowError(
            t(apiErrorMessageKey(caught), { defaultValue: caught.message })
          )
        }
      } else {
        setWorkflowError(t("apiError.INTERNAL_ERROR"))
      }
    } finally {
      setWorkflowRunning(false)
    }
  }

  const error = detail.error ?? blocks.error
  const forbidden =
    error !== null && isApiError(error) && error.errorCode === "NO_PERMISSION"
  const notFound =
    error !== null &&
    isApiError(error) &&
    error.errorCode === "PROJECT_NOT_FOUND"

  const backToPortfolio = (
    <Link to="/my-portfolio" className={buttonVariants({ variant: "secondary" })}>
      {t("projectContent.editor.backToPortfolio")}
    </Link>
  )

  if (notFound || forbidden) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <EmptyState
          headingLevel={1}
          icon={
            notFound ? (
              <FileQuestionIcon aria-hidden="true" />
            ) : (
              <LockIcon aria-hidden="true" />
            )
          }
          title={t(
            notFound
              ? "projectContent.editor.notFound.title"
              : "projectContent.editor.forbidden.title"
          )}
          description={t(
            notFound
              ? "projectContent.editor.notFound.description"
              : "projectContent.editor.forbidden.description"
          )}
          action={backToPortfolio}
        />
      </div>
    )
  }

  if (
    detail.isPending ||
    blocks.isPending ||
    project === undefined ||
    blocks.data === undefined ||
    read === null
  ) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8">
        <Skeleton className="h-12 w-1/2 rounded-control" />
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <Skeleton className="h-96 rounded-card" />
          <Skeleton className="h-96 rounded-card" />
        </div>
      </div>
    )
  }

  return (
    <>
      <EditorHeader
        editor={editor}
        status={project.status}
        autosaveState={autosave.state}
        submitting={workflowRunning}
        workflowButtonRef={workflowButtonRef}
        backButtonRef={backButtonRef}
        /* Nur die Autor:in reicht ein und zieht zurueck (§5, §4.1). */
        mayRunWorkflow={isAuthor}
        onSubmit={() => openWorkflowDialog("submit")}
        onWithdraw={() => openWorkflowDialog("withdraw")}
        onBack={leaveEditor}
      />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 lg:flex-row lg:px-8">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {/* Die einzige h1 der Seite ist der Projekttitel (2.5, 3.3); ein
              HEADING-Block ist deshalb immer eine Zwischenueberschrift. */}
          <h1 className="type-title font-semibold text-primary">
            {project.title}
          </h1>

          {!statusEditable && (
            <Alert>
              <AlertTitle>
                {t("projectContent.editor.locked.title")}
              </AlertTitle>
              <AlertDescription>
                {t("projectContent.editor.locked.description", {
                  status: t(`project.status.${project.status}`),
                })}
              </AlertDescription>
            </Alert>
          )}

          {/*
           * Die zweite Sperre aus §5: der Status laesst das Bearbeiten zu,
           * die anfragende Person gehoert aber nicht zum Projekt. Ohne
           * diesen Hinweis stuende dort eine stumme, nicht beschreibbare
           * Flaeche, und niemand erfuehre warum. Das trifft vor allem die
           * zugewiesene Redaktion, die ein Projekt in REVISION lesen darf.
           */}
          {statusEditable && !mayEditContent && (
            <Alert>
              <AlertTitle>
                {t("projectContent.editor.readOnly.title")}
              </AlertTitle>
              <AlertDescription>
                {t("projectContent.editor.readOnly.description")}
              </AlertDescription>
            </Alert>
          )}

          {read !== null && read.dropped.length > 0 && (
            <Alert variant="destructive">
              <AlertTitle>
                {t("projectContent.editor.dropped.title", {
                  count: read.dropped.length,
                })}
              </AlertTitle>
              <AlertDescription>
                {t("projectContent.editor.dropped.description", {
                  positions: read.dropped
                    .map((entry) => entry.orderIndex + 1)
                    .join(", "),
                })}
              </AlertDescription>
            </Alert>
          )}

          {workflowError !== null && (
            <Alert variant="destructive">
              <AlertTitle>{workflowError}</AlertTitle>
            </Alert>
          )}

          {autosave.state === "error" && autosave.error !== null && (
            <Alert variant="destructive">
              <AlertTitle>{t("projectContent.autosave.errorTitle")}</AlertTitle>
              <AlertDescription>
                {t(apiErrorMessageKey(autosave.error), {
                  defaultValue: autosave.error.message,
                })}
              </AlertDescription>
            </Alert>
          )}

          <EditorFileUrlProvider resolveFileUrl={resolveFileUrl}>
            {previewing ? (
              /* Die Vorschau laeuft ueber denselben Renderer wie die
                 oeffentliche Detailseite (KAN-10). Ein zweiter Renderer
                 zeigte frueher oder spaeter etwas anderes als die Seite,
                 die am Ende erscheint. */
              <ProjectContent
                blocks={documentToBlocks(readDocument(), blocks.data.blocks)}
                resolveFileUrl={resolveFileUrl}
              />
            ) : (
              <div ref={canvasRef} className="project-content relative pl-16">
                {editor !== null && (
                  <>
                    <SelectionToolbar editor={editor} />
                    <TableControls editor={editor} />
                    {active !== null && (
                      <BlockControls
                        index={active.index}
                        count={active.count}
                        name={active.name}
                        top={active.top}
                        disabled={!canSave}
                        onInsert={onInsertChosen}
                        onMove={(delta) =>
                          moveBlock(editor, active.index, active.index + delta)
                        }
                        onMoveTo={(target) =>
                          moveBlock(editor, active.index, target)
                        }
                        onDelete={() => removeBlock(editor, active.index)}
                        onAnnounce={setAnnouncement}
                      />
                    )}
                  </>
                )}
                <EditorContent editor={editor} />
              </div>
            )}
          </EditorFileUrlProvider>

          {/* Die Live-Region der Blockbewegungen. Sie steht immer im DOM,
              auch leer: eine erst beim Ereignis eingehaengte Region wird von
              manchen Screenreadern nicht mehr vorgelesen. */}
          <p role="status" aria-live="polite" className="sr-only">
            {announcement}
          </p>
        </div>

        <EditorSidebar
          project={project}
          previewing={previewing}
          onPreviewingChange={setPreviewing}
        />
      </div>

      {editor !== null && (
        <BlockInsertHost
          editor={editor}
          projectId={projectId}
          kind={insertKind}
          onClose={() => setInsertKind(null)}
          onInsert={applyInsert}
        />
      )}

      {/*
       * Der Konflikt des Speichertakts fuehrt in denselben Dialog wie der
       * eines Statuswechsels. Ohne das waere ein 409 im Autosave eine
       * Sackgasse: der Takt haelt an, in der Kopfzeile stuenden zwei Woerter,
       * und jeder weitere Tastenanschlag liefe ins Nichts, ohne dass jemand
       * die Wahl bekaeme (Befund des Frontend-Reviews zu KAN-36).
       */}
      <VersionConflictDialog
        open={(conflict || autosave.state === "conflict") && !conflictDismissed}
        finalFocus={workflowButtonRef}
        onKeepEditing={() => {
          setConflict(false)
          /*
           * Die eigene Fassung bleibt stehen, wird aber nicht mehr
           * gespeichert: der Takt bleibt angehalten, und der Zustand sagt
           * das sichtbar weiter (AutosaveStatus). Der Dialog schliesst
           * trotzdem, sonst waere der eigene Text unerreichbar.
           */
          setConflictDismissed(true)
        }}
        onReload={() => {
          setConflict(false)
          setConflictDismissed(false)
          void detail.refetch()
          void blocks.refetch().then((result) => {
            if (result.data !== undefined) {
              autosave.reset({
                version: result.data.version,
                blocks: result.data.blocks.map((block) => ({
                  id: block.id,
                  type: block.type,
                })),
              })
            }
          })
        }}
      />

      {/*
       * Rueckfrage vor jedem Statuswechsel (Skill frontend-design,
       * Abschnitt 5): Titel als Frage, der Gegenstand im Text beim Namen,
       * Abbrechen zuerst, die Handlung mit ihrem eigenen Verb. Kein
       * variant="destructive": beide Uebergaenge sind umkehrbar.
       */}
      <AlertDialog
        open={pendingAction !== null}
        onOpenChange={(next) => {
          if (!next) {
            setPendingAction(null)
          }
        }}
      >
        <AlertDialogContent
          className="rounded-modal"
          finalFocus={workflowButtonRef}
        >
          <AlertDialogHeader>
            {/* Die Texte lesen shownAction und nicht pendingAction; warum,
                steht oben an dessen Erklaerung. */}
            <AlertDialogTitle>
              {t(`projectContent.workflow.${shownAction}.title`)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(`projectContent.workflow.${shownAction}.description`, {
                title: project.title,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("projectContent.workflow.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const action = pendingAction
                if (action !== null) {
                  void runWorkflow(action)
                }
              }}
            >
              {t(`projectContent.workflow.${shownAction}.confirm`)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/*
       * Der Weg zurueck, den diese Seite selbst anbietet, wird bewacht:
       * innerhalb des Entprellfensters waeren bis zu anderthalb Sekunden
       * Arbeit noch nicht beim Server, und der Zeitgeber verschwindet beim
       * Verlassen. Brotkrume und Zurueck-Knopf des Browsers laufen
       * ungehindert weiter; dafuer braeuchte es useBlocker und einen
       * Data-Router in Anwendung und Testhuelle (dieselbe Grenze wie auf der
       * Metadatenseite).
       */}
      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent
          className="rounded-modal"
          finalFocus={backButtonRef}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("projectContent.leave.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("projectContent.leave.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("projectContent.leave.stay")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmLeave(false)
                /* Erst speichern, dann gehen: verwerfen will hier niemand,
                   und der Takt ist ohnehin nur Sekundenbruchteile entfernt. */
                void autosave.flush().finally(() => {
                  void navigate(`/projects/${projectId}/metadata`)
                })
              }}
            >
              {t("projectContent.leave.saveAndLeave")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/**
 * Das Dokument des Editors als Blockliste fuer die Vorschau.
 *
 * <p>Sie laeuft ueber {@code docToBlocks} und damit ueber genau denselben
 * Weg wie der Speichervorgang: die Vorschau zeigt, was gespeichert wuerde,
 * und nicht eine zweite Ableitung daneben. Fehlt der Editor noch, bleibt es
 * bei der zuletzt gelesenen Serverfassung.
 *
 * <p>Die IDs kommen aus der letzten Antwort; die Vorschau braucht sie nur
 * als Schluessel, aber eine erfundene ID waere in einer Ansicht, die auch
 * kommentiert werden soll, eine schlechte Angewohnheit.
 */
function documentToBlocks(
  document: ProjectDocument | null,
  fallback: Parameters<typeof ProjectContent>[0]["blocks"]
): Parameters<typeof ProjectContent>[0]["blocks"] {
  if (document === null) {
    return fallback
  }
  return docToBlocks(document, fallback).map((request, index) => ({
    id: request.id ?? `preview-${index}`,
    type: request.type,
    orderIndex: request.orderIndex,
    content: request.content as never,
    schemaVersion: request.schemaVersion ?? 0,
  }))
}
