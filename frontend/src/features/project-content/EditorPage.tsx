import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { EditorContent, useEditor, useEditorState } from "@tiptap/react"
import { LockIcon, TriangleAlertIcon } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router-dom"

import { useAuth } from "@/api/auth/AuthContext"
import { apiErrorMessageKey, isApiError } from "@/api/errors"
import { blockQueries } from "@/api/queries/blocks"
import { projectQueries, withdrawProject } from "@/api/queries/projects"
import type { ProjectDetailResponse } from "@/api/types"
import { VersionConflictDialog } from "@/components/common/VersionConflictDialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { Skeleton } from "@/components/ui/skeleton"
import { EditorContextProvider } from "@/features/project-content/EditorContext"
import { BlockDragHandle } from "@/features/project-content/components/BlockDragHandle"
import { BlockKeyboardBar } from "@/features/project-content/components/BlockKeyboardBar"
import { EditorHeader } from "@/features/project-content/components/EditorHeader"
import { EditorSidebar } from "@/features/project-content/components/EditorSidebar"
import { TableControls } from "@/features/project-content/components/TableControls"
import { blocksToDoc } from "@/features/project-content/blockSerialization"
import type { ProjectDocument } from "@/features/project-content/blockTypes"
import { createEditorExtensions } from "@/features/project-content/editorSchema"
import { useAutosave } from "@/features/project-content/hooks/useAutosave"

/**
 * Die Schreibflaeche des Editors auf {@code /projects/:projectId/editor}
 * (Figma {@code Template / Studierende · Editor}).
 *
 * <p><strong>Aufbau:</strong> Kopfzeile mit Zurueck, Rueckgaengig und
 * Wiederholen, der dauerhaften Formatierungsleiste, Speicherzustand,
 * Vorschau-Schalter und Workflow-Aktion; darunter links die Schreibflaeche
 * unter dem Projekttitel, rechts die Seitenleiste mit den
 * Projektinformationen. Das Template zeichnet die Formatierung als Blase
 * ueber markiertem Text; der Umzug in die Kopfzeile ist eine bewusste
 * Abweichung (Nutzerentscheidung, siehe EditorHeader).
 *
 * <p><strong>Die Schreibflaeche traegt dieselbe Klasse wie der
 * Renderer</strong> ({@code .project-content}), damit ein Beitrag beim
 * Schreiben aussieht wie danach. Das Schema kommt aus
 * {@code createEditorExtensions()}, also aus derselben einen Liste wie im
 * Lesepfad, nur um die Knotenansichten ergaenzt.
 *
 * <p><strong>Gelesen wird ueber {@code GET /projects/{id}/blocks}.</strong>
 * Solange {@code canSave} falsch ist, also Bloecke nicht dargestellt werden
 * konnten, wird <em>nicht</em> gespeichert: der PUT ersetzt die Liste
 * vollstaendig und loeschte genau die Bloecke, die diese Ansicht nicht
 * lesen kann. Stattdessen steht eine Meldung mit ihrer Zahl und ihren
 * Positionen auf der Seite.
 *
 * <p><strong>Inhaltsbearbeitung nur in {@code DRAFT} und
 * {@code REVISION}</strong> (§4.1). In jedem anderen Status ist die Flaeche
 * read-only und sagt sichtbar, warum.
 */
export default function EditorPage() {
  const { t } = useTranslation()
  const { projectId = "" } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const surfaceRef = useRef<HTMLDivElement>(null)
  const keyboardBarRef = useRef<HTMLDivElement>(null)
  const workflowButtonRef = useRef<HTMLButtonElement>(null)
  const backButtonRef = useRef<HTMLButtonElement>(null)

  const [announcement, setAnnouncement] = useState("")
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  /* Der Konflikt wurde gezeigt und weggedrueckt; der Takt bleibt trotzdem
     angehalten, bis die Seite neu gelesen hat. */
  const [conflictSeen, setConflictSeen] = useState(false)

  const project = useQuery(projectQueries.detail(projectId))
  const blocks = useQuery(blockQueries.list(projectId))

  const announce = useCallback((message: string) => {
    setAnnouncement(message)
  }, [])

  /*
   * Die gelesene Fassung: Dokument, Loecher und die Zusage, ob sie
   * zurueckgeschrieben werden darf. Einmal gerechnet und nicht bei jedem
   * Rendern erneut; sie aendert sich nur mit einer neuen Serverantwort.
   */
  const read = useMemo(
    () => (blocks.data === undefined ? null : blocksToDoc(blocks.data.blocks)),
    [blocks.data]
  )

  const status = project.data?.status ?? "DRAFT"
  const statusEditable = status === "DRAFT" || status === "REVISION"
  const mayWrite = statusEditable && (read?.canSave ?? false)

  /*
   * Ein Dokument ohne Kinder ergaenzt ProseMirror beim Aufbau um einen
   * Absatz, und das ist eine Aenderung wie jede andere: onUpdate feuert,
   * der Speichertakt liefe an, und ein frisch angelegter Entwurf bekaeme
   * allein vom Ansehen eine neue Project.version (§6.4). Mit dem Absatz von
   * vornherein gibt es nichts zu ergaenzen; gespeichert wird er ohnehin
   * nicht, docToBlocks laesst den leeren Schlussabsatz weg.
   */
  const initialContent = useMemo(() => {
    if (read === null) {
      return undefined
    }
    return read.doc.content.length > 0
      ? read.doc
      : ({ type: "doc", content: [{ type: "paragraph" }] } as ProjectDocument)
  }, [read])

  const scheduleRef = useRef<() => void>(() => undefined)

  const editor = useEditor(
    {
      extensions: createEditorExtensions(),
      content: initialContent,
      editable: mayWrite,
      editorProps: {
        attributes: {
          class: "outline-none",
        },
        handleKeyDown: (_view, event) => {
          /* Alt+F10 fuehrt aus dem Text in die Auswahlleiste (WAI-ARIA
             Authoring Practices fuer toolbar). Escape fuehrt dort zurueck. */
          if (event.altKey && event.key === "F10") {
            event.preventDefault()
            document
              .querySelector<HTMLElement>(
                "[data-selection-toolbar] [data-toolbar-item]"
              )
              ?.focus()
            return true
          }
          /*
           * Alt+F9 fuehrt in die Blockbedienung. Sie braucht einen eigenen
           * Weg, weil der Griff am Zeiger ausgeblendet ist, solange niemand
           * zeigt, und ein mit visibility versteckter Knopf keinen Fokus
           * annimmt (SC 2.1.1).
           */
          if (event.altKey && event.key === "F9") {
            event.preventDefault()
            keyboardBarRef.current
              ?.querySelector<HTMLElement>("button")
              ?.focus()
            return true
          }
          return false
        },
      },
      onUpdate: () => scheduleRef.current(),
    },
    /* Neu aufgebaut, sobald eine andere Fassung gelesen wurde: nach einem
       Neuladen im Konfliktfall traegt sie eine neue version und andere IDs.
       Der Editor uebernimmt Inhalt nur beim Anlegen. */
    [read, mayWrite]
  )

  const readDocument = useCallback(
    (): ProjectDocument | null =>
      editor === null || editor.isDestroyed
        ? null
        : (editor.getJSON() as ProjectDocument),
    [editor]
  )

  const autosave = useAutosave({
    projectId,
    enabled: mayWrite,
    version: blocks.data?.version ?? 0,
    blocks: blocks.data?.blocks ?? [],
    readDocument,
  })

  /*
   * Der Editor entsteht vor dem Speichertakt, sein onUpdate braucht ihn
   * aber. Der Ref ist die Bruecke, und er wird im Effekt gesetzt und nicht
   * beim Rendern: waehrend des Renderns ist eine Ref-Zuweisung eine
   * Nebenwirkung, die React zu Recht beanstandet. Bis zum ersten Effekt
   * kann onUpdate nicht gefeuert haben, denn dafuer muesste die
   * Schreibflaeche schon im DOM stehen.
   */
  useEffect(() => {
    scheduleRef.current = autosave.schedule
  }, [autosave.schedule])

  /*
   * Ob der Cursor in einer Tabelle steht. Ueber useEditorState und nicht
   * durch Lesen beim Rendern: seit Tiptap v3 rendert eine Transaktion die
   * Seite nicht mehr neu, die Tabellenleiste erschien und verschwand
   * deshalb erst, wenn irgendetwas anderes ein Rendern ausloeste.
   */
  const inTable = useEditorState({
    editor,
    selector: ({ editor: current }) => current?.isActive("table") ?? false,
  })

  const withdraw = useMutation({
    mutationFn: () => withdrawProject(projectId),
    onSuccess: (updated) => {
      queryClient.setQueryData(
        projectQueries.detail(projectId).queryKey,
        updated
      )
      announce(t("projectContent.withdraw.done"))
    },
  })

  /** Vor jedem Weg aus der Seite heraus wird der Speichertakt geleert. */
  const leaveTo = async (path: string) => {
    await autosave.flush()
    void navigate(path)
  }

  if (project.isPending || blocks.isPending) {
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

  const loadError = project.error ?? blocks.error
  if (loadError !== null || project.data === undefined) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <h1 className="type-h2 mb-4">{t("projectContent.load.errorTitle")}</h1>
        <Alert variant="destructive">
          <TriangleAlertIcon aria-hidden="true" />
          <AlertTitle>{t("projectContent.load.errorTitle")}</AlertTitle>
          <AlertDescription>
            {isApiError(loadError)
              ? t(apiErrorMessageKey(loadError), {
                  defaultValue: loadError.message,
                })
              : t("projectContent.load.errorDescription")}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const detail: ProjectDetailResponse = project.data
  const isAuthor = user !== null && detail.author?.id === user.id

  return (
    <EditorContextProvider value={{ projectId, editable: mayWrite, announce }}>
      <div className="flex flex-col">
        <EditorHeader
          editor={editor}
          status={detail.status}
          autosaveState={autosave.state}
          busy={withdraw.isPending}
          mayRunWorkflow={isAuthor}
          mayWrite={mayWrite}
          /*
           * Einreichen fuehrt auf die Metadatenseite und nicht in ein
           * Seitenpanel. §3.3 verlangt sieben Angaben, die im Editor nicht
           * sichtbar sind; sie stehen auf genau einer Seite, und die ist
           * es. Ein Panel daneben zeigte dasselbe Formular ein zweites Mal
           * in schmalerer Spalte, mit eigener Brotkrume und eigenem
           * Speicherweg. Der Stand wird vorher gesichert: ohne das ginge
           * beim Seitenwechsel verloren, was seit dem letzten Takt
           * geschrieben wurde.
           */
          onSubmit={() => {
            void leaveTo(`/projects/${projectId}/metadata?submit=1`)
          }}
          onWithdraw={() => setWithdrawOpen(true)}
          onBack={() => void leaveTo("/my-portfolio")}
          onPreview={() => void leaveTo(`/projects/${projectId}`)}
          workflowButtonRef={workflowButtonRef}
          backButtonRef={backButtonRef}
        />

        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 lg:flex-row">
          {/*
           * editor-content-column (project-content.css): Titel, Meldungen
           * und Blockinhalt teilen sich eine linke Achse; der Streifen der
           * Blockbedienung liegt links davon im Einzug der Spalte.
           */}
          <div className="editor-content-column flex min-w-0 flex-1 flex-col gap-4">
            <h1 className="type-h1">{detail.title}</h1>

            {!statusEditable && (
              <Alert>
                <LockIcon aria-hidden="true" />
                <AlertTitle>{t("projectContent.readOnly.title")}</AlertTitle>
                <AlertDescription>
                  {t("projectContent.readOnly.description", {
                    status: t(`project.status.${detail.status}`),
                  })}
                </AlertDescription>
              </Alert>
            )}

            {read !== null && !read.canSave && (
              <Alert variant="destructive">
                <TriangleAlertIcon aria-hidden="true" />
                <AlertTitle>{t("projectContent.dropped.title")}</AlertTitle>
                <AlertDescription>
                  {t("projectContent.dropped.description", {
                    count: read.dropped.length,
                    positions: read.dropped
                      .map((entry) => entry.orderIndex + 1)
                      .join(", "),
                  })}
                </AlertDescription>
              </Alert>
            )}

            {autosave.state === "error" && autosave.error !== null && (
              <Alert variant="destructive">
                <TriangleAlertIcon aria-hidden="true" />
                <AlertTitle>{t("projectContent.autosave.error")}</AlertTitle>
                <AlertDescription>
                  {t(apiErrorMessageKey(autosave.error), {
                    defaultValue: autosave.error.message,
                  })}
                </AlertDescription>
              </Alert>
            )}

            {editor !== null && inTable === true && (
              <div className="flex">
                <TableControls editor={editor} disabled={!mayWrite} />
              </div>
            )}

            {/*
             * Der Rahmen bleibt relativ: das Drag-Handle-Plugin haengt
             * seinen Rahmen in das Elternelement der Schreibflaeche und
             * positioniert darin absolut.
             *
             * <p><strong>Der Platz fuer die Blockbedienung liegt an der
             * Schreibflaeche selbst</strong> und nicht an diesem Rahmen
             * (project-content.css, .ProseMirror). Lag er hier, endete das
             * DOM des Editors am rechten Rand des Streifens, und zwei
             * Dinge gingen verloren, die beide daran haengen: der
             * Drag-Handle horcht auf mousemove ueber view.dom, der Griff
             * erschien also nur ueber dem Text und nicht daneben; und
             * prosemirror-dropcursor loescht seine Linie bei drop und
             * dragleave auf view.dom, sonst erst nach seinem Notnagel von
             * fuenf Sekunden. Wer im Streifen loslaesst, sah die Linie
             * deshalb noch sekundenlang stehen.
             */}
            {editor !== null && mayWrite && (
              <BlockKeyboardBar
                editor={editor}
                disabled={!mayWrite}
                onAnnounce={announce}
                barRef={keyboardBarRef}
              />
            )}

            <div ref={surfaceRef} className="project-content relative">
              {editor !== null && mayWrite && (
                <BlockDragHandle
                  editor={editor}
                  disabled={!mayWrite}
                  onAnnounce={announce}
                />
              )}

              <EditorContent editor={editor} />
            </div>
          </div>

          <EditorSidebar
            project={detail}
            onEditMetadata={() =>
              void leaveTo(`/projects/${projectId}/metadata`)
            }
          />
        </div>
      </div>

      {/*
       * Eine Live-Region fuer die ganze Seite. Sie ist immer im DOM und
       * wechselt nur ihren Inhalt; erschiene sie erst mit der Meldung,
       * laese ein Screenreader sie unter Umstaenden gar nicht vor.
       */}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <AlertDialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <AlertDialogContent className="rounded-modal">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("projectContent.withdraw.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("projectContent.withdraw.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.action.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setWithdrawOpen(false)
                withdraw.mutate()
              }}
            >
              {t("projectContent.header.withdraw")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/*
       * Der Konflikt kommt seit dem Wegfall des Einreichpanels nur noch
       * aus dem Speichertakt. „Weiter bearbeiten" druckt ihn weg, und der
       * Zustand des Takts bleibt dabei stehen: er ist angehalten, und das
       * soll er auch (§6.4). Ohne das eigene Merkmal ginge der Dialog im
       * selben Augenblick wieder auf.
       */}
      <VersionConflictDialog
        open={autosave.state === "conflict" && !conflictSeen}
        onReload={() => {
          setConflictSeen(false)
          /* Beide Schluessel ausdruecklich: der Inhalt liegt seit KAN-36
             bewusst nicht mehr unter ["projects", …], damit ihn eine
             fremde Invalidierung nicht mitreisst (api/queries/blocks.ts).
             Das Neuladen hier ist die eine Stelle, die ihn wirklich neu
             lesen soll. */
          void queryClient.invalidateQueries({ queryKey: ["projects"] })
          void queryClient.invalidateQueries({
            queryKey: blockQueries.list(projectId).queryKey,
          })
        }}
        onKeepEditing={() => setConflictSeen(true)}
        finalFocus={workflowButtonRef}
      />
    </EditorContextProvider>
  )
}
