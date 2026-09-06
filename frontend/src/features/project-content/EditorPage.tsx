import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { EditorContent, useEditor } from "@tiptap/react"
import { LockIcon, TriangleAlertIcon } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router-dom"

import { useAuth } from "@/api/auth/AuthContext"
import { isApiError } from "@/api/errors"
import { blockQueries } from "@/api/queries/blocks"
import { projectQueries, withdrawProject } from "@/api/queries/projects"
import type {
  BlockResponse,
  ProjectDetailResponse,
  ProjectUpdateRequest,
} from "@/api/types"
import { useApiErrorMessage } from "@/api/useApiErrorMessage"
import { useFileUrl } from "@/api/useFileUrl"
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { EditorContextProvider } from "@/features/project-content/EditorContext"
import { BlockDragHandle } from "@/features/project-content/components/BlockDragHandle"
import { BlockKeyboardBar } from "@/features/project-content/components/BlockKeyboardBar"
import { EditorHeader } from "@/features/project-content/components/EditorHeader"
import { EditorIntro } from "@/features/project-content/components/EditorIntro"
import { EditorSidebar } from "@/features/project-content/components/EditorSidebar"
import { TableControlsLayer } from "@/features/project-content/components/TableControlsLayer"
import { blocksToDoc } from "@/features/project-content/blockSerialization"
import { isProjectSide } from "@/features/projects/projectPermissions"
import type { ProjectDocument } from "@/features/project-content/blockTypes"
import { createEditorExtensions } from "@/features/project-content/editorSchema"
import { useProjectFileUrls } from "@/features/project-content/hooks/useProjectFileUrls"
import { printableBlocks } from "@/features/project-content/print/printableBlocks"
import { ProjectPrintView } from "@/features/project-content/print/ProjectPrintView"
import { usePrintProject } from "@/features/project-content/print/usePrintProject"
import type { BreadcrumbOriginState } from "@/routes/useBreadcrumb"
import { useAutosave } from "@/features/project-content/hooks/useAutosave"
import {
  toProjectIntroUpdateRequest,
  toProjectIntroValues,
  type ProjectIntroValues,
} from "@/features/projects/ProjectMetadataForm.schema"

/* Eine Liste, nicht bei jedem Rendern eine neue: sie steht in den
   Abhaengigkeiten der Dateiaufloesung des Druckbereichs. */
const EMPTY_BLOCKS: readonly BlockResponse[] = []

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
  const apiMessage = useApiErrorMessage()
  const { projectId = "" } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const surfaceRef = useRef<HTMLDivElement>(null)
  const keyboardBarRef = useRef<HTMLDivElement>(null)
  const backButtonRef = useRef<HTMLButtonElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  const [announcement, setAnnouncement] = useState("")
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  /* Die Projektinformationen als Schublade; nur schmal erreichbar. */
  const [infoOpen, setInfoOpen] = useState(false)
  /* Der Konflikt wurde gezeigt und weggedrueckt; der Takt bleibt trotzdem
     angehalten, bis die Seite neu gelesen hat. */
  const [conflictSeen, setConflictSeen] = useState(false)
  /*
   * Zaehlt die ausdruecklichen Neuladevorgaenge. Er ist der {@code key} der
   * Kopfpartie und damit ihr Ruecksetzer: „Serverstand laden" verspricht,
   * die eigenen Eingaben zu verwerfen, und der Inhalt tut das auch (der
   * Editor wird neu aufgebaut). Ohne diesen Zaehler blieben Titel und
   * Abstract stehen und gingen beim naechsten Takt mit der jetzt wieder
   * gueltigen Version hinaus: die fremde Aenderung waere ohne 409 und ohne
   * Meldung ueberschrieben (Befund des Frontend-Reviews).
   *
   * <p>Als Zaehler und nicht als {@code project.version}: die erhoeht sich
   * bei jeder Speicherung, und die Kopfpartie entstuende mitten im Tippen
   * neu und naehme den Fokus mit.
   */
  const [reloadCount, setReloadCount] = useState(0)

  const project = useQuery(projectQueries.detail(projectId))
  const blocks = useQuery(blockQueries.list(projectId))

  /*
   * Der Ausdruck (KAN-41).
   *
   * <p><strong>Gedruckt wird der Read-Only-Renderer, nicht die
   * Schreibflaeche.</strong> Video, Ton, Dokument und Einbettung stehen
   * dort bewusst als benannte Bedienkarte und nicht als Medium (Template
   * „Editor (Bearbeiten)"), dazu kommen Platzhaltertexte und die
   * Blockbedienung: ein Ausdruck davon zeigte Ablageflaechen statt des
   * Beitrags. {@code ProjectPrintView} rendert stattdessen dieselbe Ansicht
   * wie die Detailseite, und der Ausdruck ist an beiden Stellen derselbe.
   *
   * <p><strong>Der Stand kommt aus dem Dokument, nicht aus der
   * Abfrage.</strong> Der Speichertakt laeuft dem Tippen mit gut einer
   * Sekunde hinterher; ohne {@code printBlocks} bekaeme man das Blatt von
   * vorhin. Genommen wird er bei jedem Druck neu ({@code takePrintBlocks}),
   * auf beiden Wegen; vor dem ersten Druck steht der gelesene Stand darin.
   *
   * <p>Die Dateien laufen ueber denselben angemeldeten Weg wie in der
   * Vorschau (§3.15): ein Beitrag im Editor ist nicht veroeffentlicht, und
   * ohne Token beantwortet der Server jede Medienanfrage mit 401. Dieselben
   * Abfrageschluessel wie {@code useFileObjectUrl} der Knotenansichten, also
   * kein zweiter Abruf.
   */
  const [printBlocks, setPrintBlocks] = useState<BlockResponse[] | null>(null)
  const { print, printing } = usePrintProject()
  const printNeedsToken =
    project.data !== undefined && project.data.status !== "PUBLISHED"
  const printSource = printBlocks ?? blocks.data?.blocks ?? EMPTY_BLOCKS
  const printFiles = useProjectFileUrls(printSource, printNeedsToken)
  const printCover = useFileUrl(project.data?.coverImageUrl, printNeedsToken)

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
   * Die Kopfangaben haengen am Status und nicht an {@code canSave}: ein
   * Block, den diese Ansicht nicht lesen kann, ist ein Grund, den Inhalt
   * nicht zurueckzuschreiben (der PUT ersetzt die ganze Liste), aber
   * keiner, Titelbild, Titel und Kurzbeschreibung festzuhalten. Sie laufen
   * ueber einen anderen Endpoint (§6.1).
   *
   * <p><strong>Zweistufig wie am Server</strong> (§6.1, Zeile
   * {@code PUT /projects/{id}}: „Autor:in und Mitglieder, in DRAFT und
   * REVISION"; {@code ProjectPermissionService.mayEditMetadata}). Die Frage
   * nach der Zugehoerigkeit beantwortet
   * {@code features/projects/projectPermissions}; sie steht seit der
   * Nacharbeit an genau einer Stelle, weil dieselbe Bedingung im
   * Metadatenformular ein zweites Mal gebraucht wird und dort einmal
   * gefehlt hat. Der
   * Status allein genuegt nicht: eine zugewiesene Redaktion darf ein
   * Projekt in {@code REVISION} lesen und saehe sonst beschreibbare
   * Felder, deren Speicherung mit 403 endet, und zwar bei jedem
   * Entprellungsfenster neu (Befund der Contract-Pruefung).
   */
  const projectSide = isProjectSide(project.data, user?.id)
  const mayEditMetadata = statusEditable && projectSide

  /*
   * Der Stand, gegen den die Kopfangaben verglichen und geschrieben
   * werden: das zuletzt vom Server bestaetigte Projekt und die Frage, ob
   * ueberhaupt geschrieben werden darf. Als Ref, weil der Speichertakt
   * beides im Augenblick des Sendens braucht und nicht in der Fassung,
   * die beim letzten Rendern galt.
   */
  const metadataRef = useRef<{
    project: ProjectDetailResponse | null
    editable: boolean
  }>({ project: null, editable: false })
  useEffect(() => {
    metadataRef.current = {
      project: project.data ?? null,
      editable: mayEditMetadata,
    }
  })

  /* Der Lesezugriff auf die Kopfpartie; sie meldet ihn selbst an. */
  const readIntroRef = useRef<() => ProjectIntroValues | null>(() => null)
  const registerIntroRead = useCallback(
    (read: () => ProjectIntroValues | null) => {
      readIntroRef.current = read
    },
    []
  )

  /**
   * Die Metadatenkarte fuer den Takt, oder {@code null}, wenn nichts zu
   * tun ist.
   *
   * <p><strong>Verglichen wird gegen das Projekt selbst</strong> und nicht
   * gegen ein Merkmal im Takt: die Antwort jedes erfolgreichen PUT landet
   * im Cache und damit in {@code metadataRef}, der Vergleich laeuft also
   * immer gegen das, was der Server zuletzt bestaetigt hat. Ohne diesen
   * Vergleich schickte der erste Takt eines frisch geladenen Beitrags die
   * unveraenderte Karte los, und ein Entwurf bekaeme allein vom Ansehen
   * eine neue {@code version} (§6.4).
   */
  const readMetadata = useCallback((): Omit<
    ProjectUpdateRequest,
    "version"
  > | null => {
    const { project: current, editable } = metadataRef.current
    const values = readIntroRef.current()
    if (!editable || current === null || values === null) {
      return null
    }
    const wanted = toProjectIntroUpdateRequest(current, values)
    const saved = toProjectIntroUpdateRequest(
      current,
      toProjectIntroValues(current)
    )
    return JSON.stringify(wanted) === JSON.stringify(saved) ? null : wanted
  }, [])

  const onMetadataSaved = useCallback(
    (updated: ProjectDetailResponse) => {
      /* Zuerst in den Ref: der Takt kann unmittelbar noch einmal laufen,
         bevor React neu gerendert hat, und verglichen wird gegen den
         Serverstand. */
      metadataRef.current = { ...metadataRef.current, project: updated }
      queryClient.setQueryData(
        projectQueries.detail(projectId).queryKey,
        updated
      )
      /*
       * Die Listen tragen Titel und Teaser auf ihren Kacheln und werden
       * deshalb als veraltet vermerkt, aber nicht sofort nachgeladen: die
       * Antwort steht schon im Cache, und ein Refetch bei jedem Takt liefe
       * waehrend des Tippens dauernd.
       */
      void queryClient.invalidateQueries({
        queryKey: ["projects"],
        refetchType: "inactive",
      })
    },
    [projectId, queryClient]
  )

  /*
   * Ein Dokument ohne Kinder ergaenzt ProseMirror beim Aufbau um einen
   * Absatz, und das ist eine Aenderung wie jede andere: onUpdate feuert,
   * der Speichertakt liefe an, und ein frisch angelegter Entwurf bekaeme
   * allein vom Ansehen eine neue Project.version (§6.4). Mit dem Absatz von
   * vornherein gibt es nichts zu ergaenzen; gespeichert wird er ohnehin
   * nicht, docToBlocks laesst den leeren Schlussabsatz weg.
   *
   * Aus demselben Grund haengt der Schlussblock aus KAN-83 schon hier an und
   * nicht erst beim ersten Tastendruck: TrailingBlock arbeitet ueber
   * appendTransaction und laeuft deshalb erst mit der ersten Aenderung. Ein
   * Beitrag, der auf ein Bild endet, haette bis dahin keine Stelle zum
   * Hineinklicken, und eine stille Transaktion beim Oeffnen loeste denselben
   * Speicherlauf aus, den dieser Absatz vermeidet.
   */
  const initialContent = useMemo(() => {
    if (read === null) {
      return undefined
    }
    const content = [...read.doc.content]
    const last = content[content.length - 1]
    const endsOpen =
      last !== undefined &&
      last.type === "paragraph" &&
      (last.content === undefined || last.content.length === 0)
    if (!endsOpen) {
      content.push({ type: "paragraph" })
    }
    return { type: "doc", content } as ProjectDocument
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
        handleKeyDown: (view, event) => {
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
          /*
           * Alt+F8 fuehrt in die Tabellenbedienung. Sie haengt seit dem
           * Umzug an die Tabelle als Portal im Rahmen der Tabelle, also
           * innerhalb der Schreibflaeche, und dort belegt die
           * Tabellen-Erweiterung den Tabulator (goToNextCell, an der letzten
           * Zelle addRowAfter): mit Tab ist sie nie zu erreichen (SC 2.1.1).
           * Gemeint ist immer die Tabelle an der Textmarke, sie traegt
           * data-active. Gesucht wird im DOM dieses Editors und nicht im
           * ganzen Dokument, sonst traefe der Sprung bei zwei
           * Schreibflaechen die fremde. Steht die Marke in keiner Tabelle,
           * laeuft die Taste weiter, statt stumm geschluckt zu werden.
           */
          if (event.altKey && event.key === "F8") {
            const trigger = view.dom.querySelector<HTMLElement>(
              '[data-table-controls][data-active="true"] button'
            )
            if (trigger === null) {
              return false
            }
            event.preventDefault()
            trigger.focus()
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

  /*
   * Der Stand, der gedruckt wird: das Dokument der Schreibflaeche, nicht
   * die zuletzt gespeicherte Blockliste. Genommen wird er bei jedem Druck
   * neu, und zwar auf beiden Wegen: die Schaltflaeche ruft ihn selbst,
   * Strg+P ueber {@code beforeprint} (Effekt darunter). Sonst druckte, wer
   * einen Satz schreibt und sofort druckt, das Blatt von vorhin.
   */
  const takePrintBlocks = useCallback(() => {
    const doc = readDocument()
    setPrintBlocks(doc === null ? null : printableBlocks(doc))
  }, [readDocument])

  useEffect(() => {
    /* flushSync, weil der Browser unmittelbar nach diesem Ereignis den
       Seiteninhalt abgreift; ein spaeter eingeplantes Rendern kaeme zu
       spaet. Denselben Griff macht ProjectPrintView fuer den Druckbereich
       selbst. */
    const refresh = () => flushSync(takePrintBlocks)
    window.addEventListener("beforeprint", refresh)
    return () => {
      window.removeEventListener("beforeprint", refresh)
    }
  }, [takePrintBlocks])

  const autosave = useAutosave({
    projectId,
    enabled: mayWrite,
    version: blocks.data?.version ?? 0,
    blocks: blocks.data?.blocks ?? [],
    /* Der gelesene Stand als Bezugspunkt des Takts (KAN-86): dasselbe
       Dokument, mit dem die Schreibflaeche aufgebaut wird, und nicht der um
       den leeren Schlussabsatz ergaenzte Inhalt. Ohne ihn schriebe der erste
       Takt den unveraenderten Beitrag zurueck und erhoehte seine Version
       (§6.4). */
    baseline: read?.doc ?? null,
    readDocument,
    readMetadata,
    onMetadataSaved,
  })

  /* Stabil gehalten: die Kopfpartie meldet jede Aenderung hierueber, und
     eine bei jedem Rendern neue Funktion liesse ihren Effekt dauernd
     laufen. */
  const scheduleFromIntro = useCallback(() => {
    scheduleRef.current()
  }, [])

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
  const leaveTo = async (path: string, state?: BreadcrumbOriginState) => {
    await autosave.flush()
    void navigate(path, state ? { state } : undefined)
  }

  /*
   * Erst den Druckbereich mit dem aktuellen Dokument fuellen, dann drucken.
   *
   * <p>{@code flushSync} ist hier kein Beiwerk: {@code window.print()} haelt
   * den Ablauf an, bis der Druckdialog zurueck ist. Ein Rendern, das React
   * erst nach dem Ereignis einplant, kaeme also zu spaet, und gedruckt
   * wuerde der Stand von vor dem Klick.
   *
   * <p><strong>Zurueckgesetzt wird der Stand nicht.</strong> Er wird bei
   * jedem Druck neu genommen, auch bei Strg+P (Effekt oben). Ein
   * Zuruecksetzen unmittelbar nach {@code window.print()} waere sogar
   * falsch: in Chrome kehrt der Aufruf zurueck, bevor die Vorschau den
   * Seiteninhalt abgreift, und der Ausdruck fiele mitten im Vorgang auf den
   * zuletzt gespeicherten Stand zurueck.
   *
   * <p>Gespeichert wird dabei nicht: der Ausdruck zeigt, was auf der
   * Schreibflaeche steht, und ein Druckbefehl ist kein Anlass, den Server
   * anzufassen. Der Speichertakt laeuft ohnehin weiter.
   */
  const handlePrint = () => {
    flushSync(takePrintBlocks)
    void print()
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
              ? apiMessage(loadError)
              : t("projectContent.load.errorDescription")}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const detail: ProjectDetailResponse = project.data

  return (
    <EditorContextProvider value={{ projectId, editable: mayWrite, announce }}>
      <div className="flex flex-col">
        <EditorHeader
          editor={editor}
          onAnnounce={announce}
          status={detail.status}
          autosaveState={autosave.state}
          busy={withdraw.isPending}
          /*
           * Einreichen und Zurueckziehen liegen seit Contract v85 bei der
           * ganzen Projektseite und nicht mehr allein bei der Autor:in
           * (§4.1, §5, KAN-86): wer den Beitrag schreibt, gibt ihn auch zur
           * Pruefung. Bis dahin stand hier isAuthor, und ein Mitglied sah im
           * eigenen Editor keinen Weg nach vorn.
           */
          mayRunWorkflow={projectSide}
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
            /* Die Herkunft macht den Editor zur Station im Brotkrumenpfad
               der Metadatenseite (KAN-80): Der Weg zurueck in die
               Schreibflaeche steht damit im Pfad und nicht nur an den
               Schaltflaechen unten. */
            void leaveTo(`/projects/${projectId}/metadata?submit=1`, {
              breadcrumbFrom: `/projects/${projectId}/editor`,
            })
          }}
          onWithdraw={() => setWithdrawOpen(true)}
          onBack={() => void leaveTo("/my-portfolio")}
          onPreview={() => void leaveTo(`/projects/${projectId}`)}
          onPrint={handlePrint}
          printing={printing}
          onShowInfo={() => setInfoOpen(true)}
          menuButtonRef={menuButtonRef}
          backButtonRef={backButtonRef}
        />

        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 lg:flex-row">
          {/*
           * editor-content-column (project-content.css): Titel, Meldungen
           * und Blockinhalt teilen sich eine linke Achse; der Streifen der
           * Blockbedienung liegt links davon im Einzug der Spalte.
           */}
          <div className="editor-content-column flex min-w-0 flex-1 flex-col gap-4">
            {/*
             * Titelbild, Titel und Kurzbeschreibung stehen ueber dem
             * Beitrag und sind dort aenderbar. Sie sind Metadaten und
             * laufen ueber einen anderen Endpoint als der Inhalt (§6.1);
             * derselbe Speichertakt fuehrt beide nacheinander, weil sie
             * sich eine {@code Project.version} teilen (§6.4).
             *
             * <p><strong>Der key ist der Zaehler der Neuladevorgaenge</strong>
             * und nicht {@code id-version} wie im Metadatenformular: die
             * Version erhoeht sich bei jeder Speicherung, und die
             * Kopfpartie entstuende mitten im Tippen neu. „Serverstand
             * laden" muss sie dagegen verwerfen, sonst ueberschriebe sie
             * die fremde Aenderung, wegen der neu geladen wurde.
             */}
            <EditorIntro
              key={reloadCount}
              project={detail}
              editable={mayEditMetadata}
              onChange={scheduleFromIntro}
              onRegisterRead={registerIntroRead}
            />

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
                  {apiMessage(autosave.error)}
                </AlertDescription>
              </Alert>
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
             * erschien also nur ueber dem Text und nicht daneben; und die
             * Ablegelinie (extensions/BlockDropCursor, frueher
             * prosemirror-dropcursor) loescht sich bei drop und dragleave
             * auf view.dom, sonst erst nach ihrem Notnagel von fuenf
             * Sekunden. Wer im Streifen loslaesst, sah die Linie deshalb
             * noch sekundenlang stehen.
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

              {/*
               * Nach der Schreibflaeche und nicht davor: die Ebene haengt
               * ihre Bedienung als Portal in den Rahmen jeder Tabelle, und
               * den gibt es erst, wenn die Schreibflaeche im DOM steht.
               */}
              {editor !== null && mayWrite && (
                <TableControlsLayer editor={editor} />
              )}
            </div>
          </div>

          {/*
           * Breit steht die Seitenleiste neben der Schreibflaeche, schmal
           * gar nicht im Fluss: dort naehme sie der Schreibflaeche die
           * Breite, und die Angaben sind beim Schreiben nicht dauernd
           * gebraucht. Erreichbar bleibt sie ueber das Menue der Kopfzeile,
           * das sie als Schublade oeffnet (unten).
           */}
          <EditorSidebar
            project={detail}
            className="hidden lg:flex"
            onEditMetadata={() =>
              void leaveTo(`/projects/${projectId}/metadata`)
            }
          />
        </div>
      </div>

      {/* Der Druckbereich (KAN-41). Er haengt als Portal unmittelbar an
          body und ist am Bildschirm verborgen; im Ausdruck bleibt allein er
          stehen, also Kopfbereich und Beitrag ohne Kopfzeile, Seitenleiste
          und Blockbedienung. */}
      <ProjectPrintView
        project={detail}
        blocks={printSource}
        coverUrl={printCover.url}
        resolveFileUrl={printFiles.resolveFileUrl}
        fileState={printFiles.fileState}
      />

      {/*
       * Dieselbe Seitenleiste als Schublade, ueber die volle Breite.
       * Wiederverwendet und nicht nachgebaut: eine zweite Fassung derselben
       * Angaben liefe beim naechsten neuen Feld auseinander.
       */}
      <Sheet open={infoOpen} onOpenChange={setInfoOpen}>
        <SheetContent
          side="right"
          /*
           * Volle Breite und kein lg:hidden: die Schublade ist ohnehin nur
           * schmal erreichbar (der Ausloeser traegt lg:hidden). Waere das
           * Panel selbst versteckt, bliebe beim Verbreitern des Fensters
           * der abgedunkelte Ruecken stehen, waehrend der Inhalt
           * verschwindet: eine Sperre, die niemand mehr sieht (Befund des
           * Frontend-Reviews). w-full und nicht w-screen, denn ein
           * fixiertes Element rechnet 100 Prozent gegen das
           * Ansichtsfenster ohne Rollbalken.
           */
          className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-none"
          finalFocus={menuButtonRef}
        >
          <SheetHeader className="border-b border-border">
            {/* Die Schublade traegt den Namen der ganzen Leiste und nicht
                den ihres ersten Aufklappers: seit KAN-37 stehen darin
                Status, Projektinformationen und Kommentare, und
                „Projektinformationen" stuende sonst zweimal als
                Ueberschrift darin. */}
            <SheetTitle>{t("projectContent.sidebar.label")}</SheetTitle>
          </SheetHeader>
          <div className="scrollbar-slim overflow-y-auto p-4">
            <EditorSidebar
              project={detail}
              onEditMetadata={() => {
                setInfoOpen(false)
                void leaveTo(`/projects/${projectId}/metadata`)
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

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
          /* Verwirft auch die Kopfangaben: der Dialog verspricht, die
             eigenen Eingaben zugunsten des Serverstands aufzugeben. */
          setReloadCount((count) => count + 1)
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
        /*
         * Zurueck in die Kopfzeile, und zwar auf den Weg heraus: er ist das
         * einzige Bedienelement, das in jeder Breite sichtbar ist. Der
         * Einreichen-Knopf war es nicht mehr, seit er schmal im Menue
         * steht: ein Element mit display:none nimmt keinen Fokus an, und
         * die Tastaturbedienung begaenne nach dem Wegdruecken wieder ganz
         * vorn (SC 2.4.3, Befund des Frontend-Reviews).
         */
        finalFocus={backButtonRef}
      />
    </EditorContextProvider>
  )
}
