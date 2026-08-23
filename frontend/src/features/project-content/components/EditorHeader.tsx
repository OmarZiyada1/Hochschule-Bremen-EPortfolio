import { useEditorState, type Editor } from "@tiptap/react"
import { ArrowLeftIcon, Redo2Icon, Undo2Icon } from "lucide-react"
import type { RefObject } from "react"
import { useTranslation } from "react-i18next"

import type { ProjectStatus } from "@/api/types"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { AutosaveStatus } from "@/features/project-content/components/AutosaveStatus"
import { SelectionToolbarBar } from "@/features/project-content/components/SelectionToolbar"
import { ViewModeSwitch } from "@/features/project-content/components/ViewModeSwitch"
import type { AutosaveState } from "@/features/project-content/hooks/useAutosave"

/**
 * Die Kopfzeile des Editors: Zurueck ganz links, dann Rueckgaengig und
 * Wiederholen, ein Trenner, die Formatierungsleiste, rechts Speicherzustand,
 * der Umschalter Vorschau/Bearbeiten und die Workflow-Aktion.
 *
 * <p><strong>Die Formatierungsleiste steht dauerhaft hier</strong> statt als
 * Blase ueber markiertem Text: die Werkzeuge sind immer sichtbar, die
 * Funktionen und ihre aktiven Zustaende kommen unveraendert aus
 * {@code SelectionToolbarBar} und folgen Textmarke und Auswahl. Ohne
 * Schreibrecht (§4.1, dazu zaehlt der read-only Blick auf eingereichte und
 * veroeffentlichte Beitraege) ist sie deaktiviert und nicht versteckt
 * (SC 3.2.4). Alt+F10 fuehrt weiter aus dem Text in die Leiste, Escape
 * zurueck; den Sprung faengt die Seite ab und trifft die Leiste ueber
 * {@code data-selection-toolbar}, egal wo sie steht.
 *
 * <p><strong>Der Umschalter Vorschau/Bearbeiten stand in der
 * Seitenleiste</strong> und steht jetzt hier, zwischen Formatierung und
 * Workflow-Aktion: er gehoert zur Bedienung des Editors, nicht zu den
 * Projektinformationen. Er fuehrt unveraendert auf die oeffentliche
 * Detailseite; die Seite leert vorher den Speichertakt.
 *
 * <p><strong>Der Speicherzustand bleibt in der Kopfzeile.</strong> Die
 * gewuenschte Reihenfolge nennt ihn nicht, aber er muss sichtbar bleiben
 * (ein stiller Fehlschlag des Autosave waere Datenverlust mit Ansage);
 * sein Platz ist vor dem Umschalter im rechten Block.
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
  mayWrite,
  onSubmit,
  onWithdraw,
  onBack,
  onPreview,
  workflowButtonRef,
  backButtonRef,
}: {
  editor: Editor | null
  status: ProjectStatus
  autosaveState: AutosaveState
  busy: boolean
  /** Ob die anfragende Person die Autor:in ist (§5, §4.1). */
  mayRunWorkflow: boolean
  /** Ob die Schreibflaeche beschreibbar ist; sonst ist die Leiste gesperrt. */
  mayWrite: boolean
  onSubmit: () => void
  onWithdraw: () => void
  /**
   * Der Weg zurueck. Als Handler und nicht als Link, weil die Seite vorher
   * den Speichertakt leeren muss.
   */
  onBack: () => void
  /** Wechselt in die oeffentliche Ansicht; die Seite speichert vorher. */
  onPreview: () => void
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
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-card px-4 py-3 sm:px-8">
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

      {/* Dieselbe Leiste wie zuvor in der Blase, nur ohne Rahmen und
          Flaeche: Rand und Schatten gehoeren zur schwebenden Fassung, in
          der Kopfzeile traegt der Header beides. flex-wrap, weil die
          Primitive selbst nicht umbricht und die Leiste sonst unterhalb
          von rund 600 px die Seite quer scrollen liesse (SC 1.4.10). Der
          Trenner steht bei der Leiste und entfaellt mit ihr. */}
      {editor !== null && (
        <>
          <Separator
            orientation="vertical"
            className="h-5 self-center"
            aria-hidden="true"
          />
          <SelectionToolbarBar
            editor={editor}
            disabled={!mayWrite}
            className="flex-wrap rounded-none border-0 bg-transparent p-0 shadow-none"
          />
        </>
      )}

      <div className="ms-auto flex flex-wrap items-center gap-3">
        <AutosaveStatus state={autosaveState} />
        <ViewModeSwitch
          mode="edit"
          onModeChange={(mode) => {
            if (mode === "preview") {
              onPreview()
            }
          }}
          className="rounded-none border-0 bg-transparent p-0"
        />
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
