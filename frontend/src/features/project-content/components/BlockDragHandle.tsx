import DragHandle from "@tiptap/extension-drag-handle-react"
import type { Editor } from "@tiptap/react"
import { useState } from "react"

import { BlockControls } from "@/features/project-content/components/BlockControls"
import { blockIndexAtPos } from "@/features/project-content/editorCommands"

/**
 * Die Blockbedienung am Zeiger (KAN-36).
 *
 * <p><strong>Der Griff kommt aus {@code @tiptap/extension-drag-handle-react}
 * und ist nicht mehr selbst gebaut.</strong> Die frueher eigene Loesung
 * horchte auf {@code mousemove}, rechnete in jedem Bildaufbau
 * {@code posAtCoords}, mass danach in einem {@code useLayoutEffect} zweimal
 * mit {@code getBoundingClientRect} und setzte die Position ueber
 * React-State. Jeder dieser Schritte erzwingt einen Layoutdurchlauf, und
 * die Bedienung lief dem Zeiger dabei stets einen Bildaufbau hinterher. Die
 * offizielle Erweiterung positioniert ueber Floating UI ausserhalb von
 * React und bringt das Ziehen samt Ablegen und Rueckgaengig-Verlauf mit.
 *
 * <p><strong>Der Zustand liegt hier und nicht in der Seite.</strong>
 * {@code onNodeChange} feuert, sobald der Zeiger einen anderen Block
 * erreicht. Laege der Index im Zustand von {@code EditorPage}, rendere die
 * ganze Seite samt Kopfzeile, Seitenleiste, Dialogen und allen
 * Knotenansichten bei jeder Zeigerbewegung ueber eine Blockgrenze neu.
 *
 * <p><strong>Der Zeigerweg ersetzt den Tastaturweg nicht.</strong> Die
 * Erweiterung blendet den Griff mit {@code visibility: hidden} aus, solange
 * der Zeiger nicht ueber einem Block steht; ein so verstecktes Element ist
 * nicht fokussierbar. Fuer die Tastatur steht deshalb dieselbe Bedienung
 * ein zweites Mal in {@code BlockKeyboardBar} (SC 2.1.1).
 */
export function BlockDragHandle({
  editor,
  disabled,
  onAnnounce,
}: {
  editor: Editor
  disabled: boolean
  onAnnounce: (message: string) => void
}) {
  const [index, setIndex] = useState<number | null>(null)

  return (
    <DragHandle
      editor={editor}
      /* Links neben dem Block, oben buendig: der Platz dafuer steht in der
         linken Innenkante der Schreibflaeche (EditorPage). */
      computePositionConfig={{ placement: "left-start" }}
      onNodeChange={({ node, pos }) => {
        setIndex(node === null ? null : blockIndexAtPos(editor.state.doc, pos))
      }}
    >
      {index !== null && (
        <BlockControls
          editor={editor}
          index={index}
          disabled={disabled}
          onAnnounce={onAnnounce}
        />
      )}
    </DragHandle>
  )
}
