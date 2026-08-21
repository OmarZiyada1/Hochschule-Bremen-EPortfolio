import type { Editor } from "@tiptap/react"
import { useEditorState } from "@tiptap/react"
import { ArrowLeftIcon, Redo2Icon, Undo2Icon } from "lucide-react"
import type { RefObject } from "react"
import { useTranslation } from "react-i18next"

import type { ProjectStatus } from "@/api/types"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { AutosaveStatus } from "@/features/project-content/components/AutosaveStatus"
import type { AutosaveState } from "@/features/project-content/hooks/useAutosave"

/**
 * Die Kopfzeile des Editors (Figma, Knoten {@code Topbar}): Zurueck links,
 * Rueckgaengig und Wiederholen mittig, die Workflow-Aktion rechts.
 *
 * <p><strong>Ohne PDF-Schaltflaeche.</strong> Das Template zeichnet sie,
 * aber den Export gibt es nicht: KAN-41 ist offen, und einen Endpoint
 * dafuer fuehrt Contract 6.1 nicht. Eine Schaltflaeche, die nichts tut,
 * waere eine Attrappe im ausgelieferten Code (Frontend-Regel 10). Sie kommt
 * mit KAN-41 an genau diese Stelle.
 *
 * <p><strong>Einreichen und Zurueckziehen sind derselbe Platz.</strong>
 * Welche der beiden erscheint, entscheidet der Status (4.1): aus
 * {@code DRAFT} und {@code REVISION} wird eingereicht, aus
 * {@code SUBMITTED} zurueckgezogen. In {@code APPROVED} und
 * {@code PUBLISHED} steht dort nichts: beide Uebergaenge liegen dann bei
 * der Redaktion.
 *
 * <p><strong>Und nur die Autor:in sieht sie ueberhaupt.</strong> §5 fuehrt
 * beide Aktionen als eigene Ressource, §4.1 nennt in der Spalte
 * „Ausfuehrende Rolle" die Autor:in. Ein Projektmitglied darf den Inhalt
 * bearbeiten, aber nicht einreichen; ihm eine Schaltflaeche zu zeigen, die
 * mit 403 endet, waere ein Weg ins Leere.
 *
 * <p><strong>Beide fragen nach, bevor etwas geschieht.</strong> Diese
 * Komponente meldet nur die Absicht; die Rueckfrage und den Aufruf fuehrt
 * {@code EditorPage} (Skill frontend-design, Abschnitt 5).
 *
 * <p>Der Speicherzustand steht neben der Aktion und nicht in der
 * Seitenleiste: er gehoert zu dem, was gerade geschrieben wird, und wandert
 * beim Blaettern nicht aus dem Blick.
 */
export function EditorHeader({
  editor,
  status,
  autosaveState,
  submitting,
  mayRunWorkflow,
  onSubmit,
  onWithdraw,
  onBack,
  workflowButtonRef,
  backButtonRef,
}: {
  editor: Editor | null
  status: ProjectStatus
  autosaveState: AutosaveState
  submitting: boolean
  /** Ob die anfragende Person die Autor:in ist (§5, §4.1). */
  mayRunWorkflow: boolean
  onSubmit: () => void
  onWithdraw: () => void
  /**
   * Der Weg zurueck. Als Handler und nicht als Link, weil die Seite vorher
   * fragen muss, ob noch etwas Ungespeichertes offen ist.
   */
  onBack: () => void
  /*
   * Rueckgabeziele des Fokus fuer die Dialoge der Seite. Ein gesteuerter
   * Dialog ohne Trigger laesst den Fokus beim Schliessen sonst auf body
   * fallen (SC 2.4.3).
   */
  workflowButtonRef?: RefObject<HTMLButtonElement | null>
  backButtonRef?: RefObject<HTMLButtonElement | null>
}) {
  const { t } = useTranslation()

  /*
   * useEditorState liefert null, solange kein Editor da ist; der
   * Standardwert steht deshalb hier und nicht nur im Selektor.
   *
   * Auf isDestroyed geprueft und nicht nur auf null: der Selektor laeuft
   * noch einmal, nachdem die Seite den Editor abgeraeumt hat (etwa beim
   * Neuladen im Konfliktfall oder beim Verlassen der Route). Zu diesem
   * Zeitpunkt gibt es das Editor-Objekt noch, aber seine View nicht mehr,
   * und can() greift auf sie zu.
   */
  const history = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      current === null || current.isDestroyed
        ? { canUndo: false, canRedo: false }
        : {
            canUndo: current.can().undo(),
            canRedo: current.can().redo(),
          },
  }) ?? { canUndo: false, canRedo: false }

  const canSubmit = status === "DRAFT" || status === "REVISION"
  const canWithdraw = status === "SUBMITTED"

  return (
    <header className="flex items-center justify-between gap-4 border-b border-border bg-card px-4 py-3 sm:px-8">
      {/*
       * Eine Schaltflaeche und kein Link: der Weg zurueck wird bewacht,
       * solange der Speichertakt noch etwas offen hat. Damit entfaellt auch
       * das nativeButton={false}, das ein Link-Button braeuchte.
       */}
      <Button ref={backButtonRef} variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeftIcon aria-hidden="true" />
        {t("projectContent.header.back")}
      </Button>

      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={!history.canUndo}
                onClick={() => editor?.chain().focus().undo().run()}
              />
            }
          >
            <Undo2Icon aria-hidden="true" />
            <span className="sr-only">{t("projectContent.header.undo")}</span>
          </TooltipTrigger>
          <TooltipContent>{t("projectContent.header.undo")}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={!history.canRedo}
                onClick={() => editor?.chain().focus().redo().run()}
              />
            }
          >
            <Redo2Icon aria-hidden="true" />
            <span className="sr-only">{t("projectContent.header.redo")}</span>
          </TooltipTrigger>
          <TooltipContent>{t("projectContent.header.redo")}</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex items-center gap-4">
        <AutosaveStatus state={autosaveState} />
        {mayRunWorkflow && canSubmit && (
          <Button
            ref={workflowButtonRef}
            onClick={onSubmit}
            disabled={submitting}
          >
            {t("projectContent.header.submit")}
          </Button>
        )}
        {mayRunWorkflow && canWithdraw && (
          <Button
            ref={workflowButtonRef}
            variant="secondary"
            onClick={onWithdraw}
            disabled={submitting}
          >
            {t("projectContent.header.withdraw")}
          </Button>
        )}
      </div>
    </header>
  )
}
