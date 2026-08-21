import type { Editor } from "@tiptap/react"
import { GripVerticalIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"

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
import { Toggle } from "@/components/ui/toggle"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  BlockInsertBar,
  type InsertKind,
} from "@/features/project-content/components/BlockInsertBar"
import { startBlockDrag } from "@/features/project-content/editorCommands"
import type { BlockNodeName } from "@/features/project-content/blockTypes"

/**
 * Die Bedienung links am Block: Einfuegen, Verschieben, Loeschen (Figma
 * {@code BlockControls}).
 *
 * <p>Ruhefarbe {@code muted-foreground}, damit sie den Text nicht
 * ueberstimmt; erst beim Zeiger darueber und im Fokus tritt sie hervor.
 *
 * <p><strong>Verschieben geht auf zwei Wegen, und beide werden
 * gebraucht.</strong> Mit der Maus wird gezogen, wie man es von jedem
 * Editor kennt: das ist der Weg, den fast alle nehmen. Mit der Tastatur
 * wird der Block angehoben ({@code aria-pressed}), mit Pfeil hoch und
 * runter schrittweise verschoben, mit Enter abgelegt und mit Escape an die
 * Ausgangsposition zurueckgestellt. Eine reine Ziehbewegung genuegt nicht
 * (SC 2.1.1): sie ist fuer Tastatur- und Sprachbedienung unerreichbar. Ein
 * Griff, der nur auf die Tastatur hoert, ist aber ebenso wenig genug: er
 * sieht aus wie ein Ziehgriff und tut beim Ziehen nichts.
 *
 * <p><strong>Das Ziehen laeuft ueber ProseMirror selbst.</strong> Der Griff
 * legt {@code view.dragging} an und markiert den Knoten; Ablegen, Cursor
 * und Rueckgaengig-Verlauf besorgt danach die Bibliothek. Ein eigener
 * Ablauf mit Zielberechnung waere ein zweites, schlechteres Drag-and-Drop
 * neben dem vorhandenen.
 *
 * <p><strong>Jede Bewegung wird angesagt.</strong> Ohne Ansage ist die
 * Bedienung fuer einen Screenreader stumm: es gaebe kein Zeichen dafuer,
 * dass sich etwas bewegt hat, und keinen Hinweis darauf, wo der Block jetzt
 * steht. Die Live-Region liegt an der Seite, diese Komponente ruft nur
 * {@link BlockControlsProps.onAnnounce}.
 *
 * <p><strong>Loeschen fragt nach</strong> und benennt den Block im Text:
 * ein Bild oder eine Tabelle ist Arbeit, die sich nicht mit einem Klick
 * wiederherstellen laesst.
 */
export type BlockControlsProps = {
  editor: Editor
  /** Position des aktiven Blocks, ab 0. */
  index: number
  /** Gesamtzahl der Bloecke, fuer die Ansage. */
  count: number
  /** Knotenname aus 2.5, fuer die Beschriftung. */
  name: BlockNodeName | null
  /** Abstand von der Oberkante der Schreibflaeche, in CSS-Pixeln. */
  top: number
  disabled: boolean
  onInsert: (kind: InsertKind) => void
  /** Verschiebt um eine Position; meldet, ob es geklappt hat. */
  onMove: (delta: -1 | 1) => boolean
  /** Verschiebt an die gemerkte Ausgangsposition zurueck (Escape). */
  onMoveTo: (index: number) => void
  onDelete: () => void
  onAnnounce: (message: string) => void
}

export function BlockControls({
  editor,
  index,
  count,
  name,
  top,
  disabled,
  onInsert,
  onMove,
  onMoveTo,
  onDelete,
  onAnnounce,
}: BlockControlsProps) {
  const { t } = useTranslation()
  const [inserting, setInserting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const plusRef = useRef<HTMLButtonElement>(null)
  /* Die Position, an der der Block angehoben wurde. Nicht null heisst
     "angehoben"; Escape stellt sie wieder her. */
  const [pickedUpAt, setPickedUpAt] = useState<number | null>(null)

  const blockLabel =
    name === null
      ? t("projectContent.blockControls.blockFallback")
      : t(`projectContent.blockName.${name}`)

  const announcePosition = (position: number) => {
    onAnnounce(
      t("projectContent.blockControls.announce.position", {
        block: blockLabel,
        position: position + 1,
        count,
      })
    )
  }

  const setPickedUp = (next: boolean) => {
    if (disabled) {
      return
    }
    if (next) {
      setPickedUpAt(index)
      onAnnounce(
        t("projectContent.blockControls.announce.pickedUp", {
          block: blockLabel,
          position: index + 1,
          count,
        })
      )
      return
    }
    setPickedUpAt(null)
    onAnnounce(
      t("projectContent.blockControls.announce.dropped", {
        block: blockLabel,
        position: index + 1,
        count,
      })
    )
  }

  const onGripKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (pickedUpAt === null) {
      return
    }
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault()
      const delta = event.key === "ArrowUp" ? -1 : 1
      if (onMove(delta)) {
        announcePosition(index + delta)
      } else {
        onAnnounce(
          t("projectContent.blockControls.announce.edge", { block: blockLabel })
        )
      }
      return
    }
    if (event.key === "Escape") {
      event.preventDefault()
      onMoveTo(pickedUpAt)
      onAnnounce(
        t("projectContent.blockControls.announce.cancelled", {
          block: blockLabel,
          position: pickedUpAt + 1,
          count,
        })
      )
      setPickedUpAt(null)
    }
  }

  const onDragStart = (event: React.DragEvent<HTMLButtonElement>) => {
    if (disabled || !startBlockDrag(editor, index, event.dataTransfer)) {
      event.preventDefault()
    }
  }

  return (
    <div
      /* Absolut ueber der Schreibflaeche: im Fluss liesse ProseMirror das
         Element beim naechsten Tastenanschlag verschwinden, weil es das DOM
         der Flaeche selbst verwaltet. */
      style={{ top }}
      contentEditable={false}
      className="absolute -left-2 flex -translate-x-full items-center gap-0.5 text-muted-foreground"
    >
      {inserting ? (
        <BlockInsertBar
          onSelect={(kind) => {
            setInserting(false)
            onInsert(kind)
          }}
          onClose={() => {
            setInserting(false)
            plusRef.current?.focus()
          }}
        />
      ) : (
        <>
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  ref={plusRef}
                  disabled={disabled}
                  onClick={() => setInserting(true)}
                  className="flex size-6 items-center justify-center rounded-control outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
                />
              }
            >
              <PlusIcon aria-hidden="true" className="size-4" />
              <span className="sr-only">
                {t("projectContent.insert.label")}
              </span>
            </TooltipTrigger>
            <TooltipContent>{t("projectContent.insert.label")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Toggle
                  size="sm"
                  draggable={!disabled}
                  onDragStart={onDragStart}
                  pressed={pickedUpAt !== null}
                  disabled={disabled}
                  onPressedChange={setPickedUp}
                  onKeyDown={onGripKeyDown}
                  className="size-6 min-w-0 cursor-grab px-0 active:cursor-grabbing data-pressed:bg-accent"
                />
              }
            >
              <GripVerticalIcon aria-hidden="true" className="size-4" />
              <span className="sr-only">
                {pickedUpAt === null
                  ? t("projectContent.blockControls.pickUp", {
                      block: blockLabel,
                    })
                  : t("projectContent.blockControls.drop", {
                      block: blockLabel,
                    })}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {t("projectContent.blockControls.moveHint")}
            </TooltipContent>
          </Tooltip>

          <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setConfirmDelete(true)}
                    className="flex size-6 items-center justify-center rounded-control outline-none hover:bg-muted hover:text-destructive focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
                  />
                }
              >
                <Trash2Icon aria-hidden="true" className="size-4" />
                <span className="sr-only">
                  {t("projectContent.blockControls.delete", {
                    block: blockLabel,
                  })}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {t("projectContent.blockControls.delete", {
                  block: blockLabel,
                })}
              </TooltipContent>
            </Tooltip>
            <AlertDialogContent className="rounded-modal">
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t("projectContent.blockControls.confirmDelete.title")}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t("projectContent.blockControls.confirmDelete.description", {
                    block: blockLabel,
                    position: index + 1,
                  })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>
                  {t("common.action.cancel")}
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setConfirmDelete(false)
                    onDelete()
                    onAnnounce(
                      t("projectContent.blockControls.announce.deleted", {
                        block: blockLabel,
                      })
                    )
                  }}
                >
                  {t("projectContent.blockControls.confirmDelete.confirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  )
}
