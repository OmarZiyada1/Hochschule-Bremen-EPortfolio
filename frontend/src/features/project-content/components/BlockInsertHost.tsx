import type { Editor } from "@tiptap/react"

import type { BlockNode } from "@/features/project-content/blockTypes"
import type { InsertKind } from "@/features/project-content/components/InsertMenu"
import { AudioDialog } from "@/features/project-content/components/dialogs/AudioDialog"
import { DocumentDialog } from "@/features/project-content/components/dialogs/DocumentDialog"
import { EmbedDialog } from "@/features/project-content/components/dialogs/EmbedDialog"
import { FormulaDialog } from "@/features/project-content/components/dialogs/FormulaDialog"
import { GalleryDialog } from "@/features/project-content/components/dialogs/GalleryDialog"
import { ImageDialog } from "@/features/project-content/components/dialogs/ImageDialog"
import { TableDialog } from "@/features/project-content/components/dialogs/TableDialog"
import { VideoDialog } from "@/features/project-content/components/dialogs/VideoDialog"

/**
 * Der eine Ort, an dem aus einer Auswahl in der Einfuegeleiste ein Block
 * wird.
 *
 * <p><strong>Drei Wege, und die Aufteilung folgt Contract 2.5.</strong>
 * {@code CODE} und {@code DIVIDER} haben keine Pflichtattribute und
 * entstehen unmittelbar. {@code TABLE} entsteht ueber einen Tiptap-Befehl,
 * weil eine Tabelle aus Zeilen und Zellen besteht und kein einzelner Knoten
 * mit Attributen ist. Die uebrigen sieben kommen als fertiger
 * {@link BlockNode} aus ihrem Dialog.
 *
 * <p>Ein Medienknoten ohne Pflichtattribute entsteht auf keinem dieser
 * Wege, und das ist der Zweck der Aufteilung:
 * {@code BlockService.replace} prueft die gesamte Liste, bevor es die erste
 * Zeile schreibt, und ein halbfertiger Knoten machte jeden weiteren
 * Autosave des ganzen Projekts unmoeglich.
 */

/** Was ohne Rueckfrage entsteht (2.5: keine Pflichtattribute). */
// eslint-disable-next-line react-refresh/only-export-components -- Die Zuordnung gehoert zum Host: sie beantwortet dieselbe Frage wie er, nur fuer die zwei Faelle ohne Dialog.
export function directNodeFor(kind: InsertKind): BlockNode | null {
  switch (kind) {
    case "code":
      return { type: "codeBlock", attrs: { language: null }, content: [] }
    case "divider":
      return { type: "horizontalRule" }
    default:
      return null
  }
}

export function BlockInsertHost({
  editor,
  projectId,
  kind,
  onClose,
  onInsert,
}: {
  editor: Editor
  projectId: string
  /** Der offene Dialog, oder {@code null}, wenn keiner offen ist. */
  kind: InsertKind | null
  onClose: () => void
  /** Fuegt den fertigen Knoten hinter dem aktiven Block ein. */
  onInsert: (node: BlockNode) => void
}) {
  const close = (open: boolean) => {
    if (!open) {
      onClose()
    }
  }

  switch (kind) {
    case "image":
      return (
        <ImageDialog
          projectId={projectId}
          open
          onOpenChange={close}
          onInsert={onInsert}
        />
      )
    case "gallery":
      return (
        <GalleryDialog
          projectId={projectId}
          open
          onOpenChange={close}
          onInsert={onInsert}
        />
      )
    case "video":
      return (
        <VideoDialog
          projectId={projectId}
          open
          onOpenChange={close}
          onInsert={onInsert}
        />
      )
    case "audio":
      return (
        <AudioDialog
          projectId={projectId}
          open
          onOpenChange={close}
          onInsert={onInsert}
        />
      )
    case "document":
      return (
        <DocumentDialog
          projectId={projectId}
          open
          onOpenChange={close}
          onInsert={onInsert}
        />
      )
    case "embed":
      return <EmbedDialog open onOpenChange={close} onInsert={onInsert} />
    case "formula":
      return <FormulaDialog open onOpenChange={close} onInsert={onInsert} />
    case "table":
      return (
        <TableDialog
          open
          onOpenChange={close}
          onInsert={({ rows, columns, withHeaderRow }) => {
            /*
             * Ueber den Befehl der Extension und nicht ueber einen von Hand
             * gebauten Knoten: TableKit legt Zeilen, Zellen und die
             * Kopfzeile in einem Zug an und setzt den Cursor in die erste
             * Zelle. Ein selbst zusammengesetzter Knoten muesste dieselbe
             * Struktur nachbilden und liefe bei der naechsten Version der
             * Bibliothek auseinander.
             */
            editor
              .chain()
              .focus()
              .insertTable({ rows, cols: columns, withHeaderRow })
              .run()
            onClose()
          }}
        />
      )
    case "code":
    case "divider":
    case null:
      /* Beide entstehen ohne Dialog (siehe directNodeFor); null heisst, dass
         gerade keiner offen ist. */
      return null
  }
}
