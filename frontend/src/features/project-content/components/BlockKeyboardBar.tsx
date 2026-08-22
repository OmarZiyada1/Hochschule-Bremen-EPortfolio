import { useEditorState, type Editor } from "@tiptap/react"
import { useTranslation } from "react-i18next"

import { BlockControls } from "@/features/project-content/components/BlockControls"
import { activeBlockIndex } from "@/features/project-content/editorCommands"

/**
 * Die Blockbedienung fuer die Tastatur (KAN-36, SC 2.1.1).
 *
 * <p><strong>Warum es sie neben dem Drag-Handle gibt.</strong>
 * {@code @tiptap/extension-drag-handle} blendet seinen Griff aus, solange
 * der Zeiger nicht ueber einem Block steht, und zwar mit
 * {@code visibility: hidden}. Ein so ausgeblendetes Element nimmt keinen
 * Fokus an: wer nicht zeigen kann, kaeme an Einfuegen, Verschieben und
 * Loeschen also gar nicht heran. Die Erweiterung ist deshalb der richtige
 * Weg fuer den Zeiger und kein Ersatz fuer die Tastatur.
 *
 * <p><strong>Sie steht im Fluss und nicht absolut</strong>, unmittelbar vor
 * der Schreibflaeche, und ist damit von der Kopfzeile aus mit einem
 * Tabschritt erreichbar. Sichtbar wird sie erst im Fokus (dasselbe Muster
 * wie ein Sprunglink): der Zeigerweg zeigt seine Bedienung ohnehin am
 * Block, zwei gleichzeitig sichtbare waeren eine doppelte Bedienung fuer
 * dieselbe Sache.
 *
 * <p><strong>Sie folgt der Textmarke</strong>, nicht dem Zeiger. Welcher
 * Block gemeint ist, sagt {@code activeBlockIndex}, und der wird ueber
 * {@code useEditorState} verfolgt: der Editor rendert die Seite seit Tiptap
 * v3 bei einer Transaktion bewusst nicht neu, ein einfaches Lesen beim
 * Rendern liefe also der Cursorstelle hinterher.
 */
export function BlockKeyboardBar({
  editor,
  disabled,
  onAnnounce,
  barRef,
}: {
  editor: Editor
  disabled: boolean
  onAnnounce: (message: string) => void
  barRef?: React.RefObject<HTMLDivElement | null>
}) {
  const { t } = useTranslation()

  const index = useEditorState({
    editor,
    selector: ({ editor: current }) => activeBlockIndex(current),
  })

  if (index === null) {
    return null
  }

  return (
    <div
      ref={barRef}
      role="group"
      aria-label={t("projectContent.blockControls.keyboardBar", {
        position: index + 1,
        count: editor.state.doc.childCount,
      })}
      className="sr-only mb-2 focus-within:not-sr-only focus-within:flex focus-within:w-fit focus-within:items-center focus-within:gap-2 focus-within:rounded-card focus-within:border focus-within:border-border focus-within:bg-card focus-within:p-1.5"
    >
      <span className="type-caption px-1 text-muted-foreground">
        {t("projectContent.blockControls.keyboardBar", {
          position: index + 1,
          count: editor.state.doc.childCount,
        })}
      </span>
      <BlockControls
        editor={editor}
        index={index}
        disabled={disabled}
        size="default"
        onAnnounce={onAnnounce}
      />
    </div>
  )
}
