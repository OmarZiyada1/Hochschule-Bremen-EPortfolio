import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { EditorContent, useEditor } from "@tiptap/react"
import { LockIcon, TriangleAlertIcon } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router-dom"

import { useAuth } from "@/api/auth/AuthContext"
import { apiErrorMessageKey, isApiError } from "@/api/errors"
import { blockQueries } from "@/api/queries/blocks"
import { uploadProjectFile } from "@/api/queries/files"
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
import { BlockControls } from "@/features/project-content/components/BlockControls"
import type { InsertKind } from "@/features/project-content/components/BlockInsertBar"
import { EditorHeader } from "@/features/project-content/components/EditorHeader"
import { EditorSidebar } from "@/features/project-content/components/EditorSidebar"
import { SelectionToolbar } from "@/features/project-content/components/SelectionToolbar"
import { SubmitSheet } from "@/features/project-content/components/SubmitSheet"
import { TableControls } from "@/features/project-content/components/TableControls"
import { blocksToDoc } from "@/features/project-content/blockSerialization"
import type { ProjectDocument } from "@/features/project-content/blockTypes"
import { createEditorExtensions } from "@/features/project-content/editorSchema"
import {
  deleteBlock,
  insertBlockAfter,
  moveBlock,
} from "@/features/project-content/editorCommands"
import { useActiveBlock } from "@/features/project-content/hooks/useActiveBlock"
import { useAutosave } from "@/features/project-content/hooks/useAutosave"

/**
 * Die Schreibflaeche des Editors auf {@code /projects/:projectId/editor}
 * (Figma {@code Template / Studierende · Editor}).
 *
 * <p><strong>Aufbau nach dem Template:</strong> Kopfzeile mit Zurueck,
 * Rueckgaengig, Speicherzustand und Workflow-Aktion; darunter links die
 * Schreibflaeche unter dem Projekttitel, rechts die Seitenleiste mit dem
 * Vorschau-Schalter und den Projektinformationen.
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
  const workflowButtonRef = useRef<HTMLButtonElement>(null)
  const backButtonRef = useRef<HTMLButtonElement>(null)

  const [announcement, setAnnouncement] = useState("")
  const [submitOpen, setSubmitOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [conflictOpen, setConflictOpen] = useState(false)
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
            surfaceRef.current
              ?.querySelector<HTMLElement>(
                "[data-selection-toolbar] [data-toolbar-item]"
              )
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

  const activeBlock = useActiveBlock(editor, surfaceRef)

  const withdraw = useMutation({
    mutationFn: () => withdrawProject(projectId),
    onSuccess: (updated) => {
      queryClient.setQueryData(projectQueries.detail(projectId).queryKey, updated)
      announce(t("projectContent.withdraw.done"))
    },
  })

  /** Vor jedem Weg aus der Seite heraus wird der Speichertakt geleert. */
  const leaveTo = async (path: string) => {
    await autosave.flush()
    void navigate(path)
  }

  const onInsert = (kind: InsertKind) => {
    if (editor === null || activeBlock === null) {
      return
    }
    insertBlockAfter(editor, activeBlock.index, contentFor(kind))
    announce(t("projectContent.insert.inserted", {
      block: t(`projectContent.insert.type.${kind}`),
    }))
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
    <EditorContextProvider
      value={{ projectId, editable: mayWrite, announce }}
    >
      <div className="flex flex-col">
        <EditorHeader
          editor={editor}
          status={detail.status}
          autosaveState={autosave.state}
          busy={withdraw.isPending}
          mayRunWorkflow={isAuthor}
          onSubmit={() => {
            void autosave.flush().then((saved) => {
              if (saved) {
                setSubmitOpen(true)
              }
            })
          }}
          onWithdraw={() => setWithdrawOpen(true)}
          onBack={() => void leaveTo("/my-portfolio")}
          workflowButtonRef={workflowButtonRef}
          backButtonRef={backButtonRef}
        />

        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 lg:flex-row">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <h1 className="type-h1">{detail.title}</h1>

            {!statusEditable && (
              <Alert>
                <LockIcon aria-hidden="true" />
                <AlertTitle>
                  {t("projectContent.readOnly.title")}
                </AlertTitle>
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

            {editor !== null && editor.isActive("table") && (
              <div className="flex">
                <TableControls editor={editor} disabled={!mayWrite} />
              </div>
            )}

            {/*
             * Die Bedienung liegt absolut ueber der Flaeche, deshalb ist der
             * Rahmen relativ und laesst links Platz fuer sie.
             */}
            <div ref={surfaceRef} className="project-content relative pl-10">
              {editor !== null && activeBlock !== null && mayWrite && (
                <BlockControls
                  editor={editor}
                  index={activeBlock.index}
                  count={activeBlock.count}
                  name={activeBlock.name}
                  top={activeBlock.top}
                  disabled={!mayWrite}
                  onInsert={onInsert}
                  onMove={(delta) =>
                    moveBlock(
                      editor,
                      activeBlock.index,
                      activeBlock.index + delta
                    )
                  }
                  onMoveTo={(target) =>
                    moveBlock(editor, activeBlock.index, target)
                  }
                  onDelete={() => deleteBlock(editor, activeBlock.index)}
                  onAnnounce={announce}
                />
              )}

              {editor !== null && (
                <SelectionToolbar editor={editor} disabled={!mayWrite} />
              )}

              <EditorContent editor={editor} />
            </div>
          </div>

          <EditorSidebar
            project={detail}
            onPreview={() => void leaveTo(`/projects/${projectId}`)}
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

      <SubmitSheet
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        project={detail}
        onUploadCoverImage={async (file) => {
          const stored = await uploadProjectFile(file, projectId)
          return stored.url
        }}
        onSubmitted={(submitted) => {
          queryClient.setQueryData(
            projectQueries.detail(projectId).queryKey,
            submitted
          )
          announce(t("projectContent.submit.done"))
        }}
        onVersionConflict={() => setConflictOpen(true)}
      />

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
       * Der Konflikt kommt aus zwei Richtungen: vom Speichertakt und vom
       * Einreichweg. „Weiter bearbeiten" muss beide wegdruecken koennen,
       * und der Zustand des Takts bleibt dabei stehen: er ist angehalten,
       * und das soll er auch (§6.4). Ohne das eigene Merkmal ginge der
       * Dialog im selben Augenblick wieder auf.
       */}
      <VersionConflictDialog
        open={(conflictOpen || autosave.state === "conflict") && !conflictSeen}
        onReload={() => {
          setConflictOpen(false)
          setConflictSeen(false)
          void queryClient.invalidateQueries({ queryKey: ["projects"] })
        }}
        onKeepEditing={() => {
          setConflictOpen(false)
          setConflictSeen(true)
        }}
        finalFocus={workflowButtonRef}
      />
    </EditorContextProvider>
  )
}

/** Der Knoten, den ein Eintrag der Einfuegeleiste anlegt (Contract 2.5). */
function contentFor(kind: InsertKind): Record<string, unknown> {
  switch (kind) {
    case "image":
      return { type: "imageBlock" }
    case "gallery":
      return { type: "galleryBlock" }
    case "video":
      return { type: "videoBlock" }
    case "audio":
      return { type: "audioBlock" }
    case "document":
      return { type: "documentBlock" }
    case "embed":
      return { type: "embedBlock" }
    case "formula":
      return { type: "mathBlock" }
    case "code":
      return { type: "codeBlock" }
    case "divider":
      return { type: "horizontalRule" }
    case "table":
      /* Drei mal drei mit Kopfzeile, wie im Template. */
      return {
        type: "table",
        content: [
          headerRow(3),
          bodyRow(3),
          bodyRow(3),
        ],
      }
  }
}

function headerRow(cells: number): Record<string, unknown> {
  return {
    type: "tableRow",
    content: Array.from({ length: cells }, () => ({
      type: "tableHeader",
      content: [{ type: "paragraph" }],
    })),
  }
}

function bodyRow(cells: number): Record<string, unknown> {
  return {
    type: "tableRow",
    content: Array.from({ length: cells }, () => ({
      type: "tableCell",
      content: [{ type: "paragraph" }],
    })),
  }
}
