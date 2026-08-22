import { useEditorState, type Editor } from "@tiptap/react"
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
 * Rueckgaengig und Wiederholen mittig, rechts der Speicherzustand und die
 * Workflow-Aktion.
 *
 * <p><strong>Ohne PDF-Schaltflaeche.</strong> Das Template zeichnet sie,
 * aber den Export gibt es nicht: KAN-41 ist offen, und einen Endpoint dafuer
 * fuehrt Contract §6.1 nicht. Eine Schaltflaeche, die nichts tut, waere eine
 * Attrappe im ausgelieferten Code (Frontend-Regel 10). Sie kommt mit KAN-41
 * an genau diese Stelle.
 *
 * <p><strong>Einreichen und Zurueckziehen teilen sich den Platz.</strong>
 * Welche der beiden erscheint, entscheidet der Status (§4.1): aus
 * {@code DRAFT} und {@code REVISION} wird eingereicht, aus
 * {@code SUBMITTED} zurueckgezogen. In {@code APPROVED} und
 * {@code PUBLISHED} steht dort nichts, beide Uebergaenge liegen dann bei der
 * Redaktion.
 *
 * <p><strong>Und nur die Autor:in sieht sie ueberhaupt.</strong> §5 fuehrt
 * beide Aktionen als eigene Ressource, §4.1 nennt in der Spalte
 * „Ausfuehrende Rolle" die Autor:in. Ein Projektmitglied darf den Inhalt
 * bearbeiten, aber nicht einreichen; ihm eine Schaltflaeche zu zeigen, die
 * mit 403 endet, waere ein Weg ins Leere.
 *
 * <p><strong>Einreichen fuehrt zuerst in die Metadaten.</strong> §3.3
 * verlangt sieben Angaben, die im Editor gar nicht sichtbar sind; blind zu
 * senden hiesse, die Autor:in mit einer Liste fehlender Felder
 * zurueckzuschicken, statt sie dorthin zu fuehren, wo sie sie eintraegt.
 * Diese Komponente meldet nur die Absicht; den Weg fuehrt {@code EditorPage}.
 */
export function EditorHeader({
  editor,
  status,
  autosaveState,
  busy,
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
  busy: boolean
  /** Ob die anfragende Person die Autor:in ist (§5, §4.1). */
  mayRunWorkflow: boolean
  onSubmit: () => void
  onWithdraw: () => void
  /**
   * Der Weg zurueck. Als Handler und nicht als Link, weil die Seite vorher
   * den Speichertakt leeren muss.
   */
  onBack: () => void
  workflowButtonRef?: RefObject<HTMLButtonElement | null>
  backButtonRef?: RefObject<HTMLButtonElement | null>
}) {
  const { t } = useTranslation()

  /*
   * Ueber useEditorState und nicht durch blosses Lesen beim Rendern.
   *
   * <p><strong>Seit Tiptap v3 rendert der Editor die Seite bei einer
   * Transaktion nicht mehr neu</strong> ({@code shouldRerenderOnTransaction}
   * ist standardmaessig {@code false}). Ein {@code editor.can().undo()} im
   * Rendern lieferte deshalb den Stand des letzten Renderns: die
   * Schaltflaeche blieb waehrend des ganzen Tippens deaktiviert und wurde
   * erst wieder richtig, wenn irgendetwas anderes ein Rendern ausloeste,
   * in der Praxis der Speichertakt gut eine Sekunde spaeter. Genau das war
   * das „es dauert, bis es richtig angezeigt wird".
   *
   * <p>{@code can()} greift ausserdem auf die View zu. Nach dem Abraeumen
   * des Editors gibt es das Objekt noch, seine View aber nicht mehr, daher
   * die Pruefung auf {@code isDestroyed}.
   */
  const history = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      current === null || current.isDestroyed
        ? { canUndo: false, canRedo: false }
        : { canUndo: current.can().undo(), canRedo: current.can().redo() },
  })
  const canUndo = history?.canUndo ?? false
  const canRedo = history?.canRedo ?? false

  const canSubmit = status === "DRAFT" || status === "REVISION"
  const canWithdraw = status === "SUBMITTED"

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-card px-4 py-3 sm:px-8">
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
                disabled={!canUndo}
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
                disabled={!canRedo}
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
          <Button ref={workflowButtonRef} onClick={onSubmit} disabled={busy}>
            {t("projectContent.header.submit")}
          </Button>
        )}
        {mayRunWorkflow && canWithdraw && (
          <Button
            ref={workflowButtonRef}
            variant="secondary"
            onClick={onWithdraw}
            disabled={busy}
          >
            {t("projectContent.header.withdraw")}
          </Button>
        )}
      </div>
    </header>
  )
}
