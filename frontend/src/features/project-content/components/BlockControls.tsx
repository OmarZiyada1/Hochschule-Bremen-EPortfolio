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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Toggle } from "@/components/ui/toggle"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { BlockInsertBar } from "@/features/project-content/components/BlockInsertBar"
import {
  contentFor,
  type InsertKind,
} from "@/features/project-content/blockInsert"
import {
  blockNameAt,
  deleteBlock,
  insertBlockAfter,
  moveBlock,
} from "@/features/project-content/editorCommands"

/**
 * Die drei Bedienelemente eines Blocks: Einfuegen, Verschieben, Loeschen
 * (Figma {@code BlockControls}).
 *
 * <p><strong>Diese Komponente positioniert sich nicht selbst.</strong> Wo
 * sie steht, entscheidet ihr Verwender: am Zeiger haengt sie im Drag-Handle
 * von Tiptap, fuer die Tastatur steht sie in einer eigenen Leiste im Fluss
 * der Seite. Zuvor trug sie ihre Position als {@code style={{ top }}}
 * selbst, gespeist aus React-State, und lag damit bei jeder Bewegung
 * mindestens einen Bildaufbau hinter dem Zeiger.
 *
 * <p><strong>Verschieben geht auf zwei Wegen, und beide werden
 * gebraucht.</strong> Mit der Maus wird gezogen: das besorgt der
 * Drag-Handle und darunter ProseMirror selbst. Mit der Tastatur wird der
 * Block angehoben ({@code aria-pressed}), mit Pfeil hoch und runter
 * schrittweise verschoben, mit Enter abgelegt und mit Escape an die
 * Ausgangsposition zurueckgestellt. Eine reine Ziehbewegung genuegt nicht
 * (SC 2.1.1): sie ist fuer Tastatur- und Sprachbedienung unerreichbar.
 *
 * <p><strong>Jede Bewegung wird angesagt.</strong> Ohne Ansage ist die
 * Bedienung fuer einen Screenreader stumm. Die Live-Region liegt an der
 * Seite, diese Komponente ruft nur {@link BlockControlsProps.onAnnounce}.
 *
 * <p><strong>Loeschen fragt nach</strong> und benennt den Block im Text:
 * ein Bild oder eine Tabelle ist Arbeit, die sich nicht mit einem Klick
 * wiederherstellen laesst.
 */
export type BlockControlsProps = {
  editor: Editor
  /** Position des Blocks, ab 0. */
  index: number
  disabled: boolean
  /** Kleinere Schaltflaechen fuer den schmalen Streifen am Zeiger. */
  size?: "sm" | "default"
  onAnnounce: (message: string) => void
}

export function BlockControls({
  editor,
  index,
  disabled,
  size = "sm",
  onAnnounce,
}: BlockControlsProps) {
  const { t } = useTranslation()
  const [inserting, setInserting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  /* Die Position, an der der Block angehoben wurde. Nicht null heisst
     "angehoben"; Escape stellt sie wieder her. */
  const [pickedUpAt, setPickedUpAt] = useState<number | null>(null)
  const plusRef = useRef<HTMLButtonElement>(null)

  /* Erst beim Ansagen gelesen und nicht beim Rendern: die Zahl aendert
     sich mit jeder Transaktion, und der Editor rendert die Seite dabei
     bewusst nicht neu (Tiptap v3). Ein beim Rendern gemerkter Wert waere
     im Augenblick der Ansage veraltet. */
  const blockCount = () => editor.state.doc.childCount
  const name = blockNameAt(editor, index)
  const blockLabel =
    name === null
      ? t("projectContent.blockControls.blockFallback")
      : t(`projectContent.blockName.${name}`)
  const iconButton =
    size === "sm"
      ? "flex size-6 items-center justify-center rounded-control outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
      : "flex size-8 items-center justify-center rounded-control outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
  const gripSize =
    size === "sm"
      ? "size-6 min-w-0 cursor-grab px-0 active:cursor-grabbing data-pressed:bg-accent"
      : "size-8 min-w-0 cursor-grab px-0 active:cursor-grabbing data-pressed:bg-accent"

  const announcePosition = (position: number) => {
    onAnnounce(
      t("projectContent.blockControls.announce.position", {
        block: blockLabel,
        position: position + 1,
        count: blockCount(),
      })
    )
  }

  const onInsert = (kind: InsertKind) => {
    setInserting(false)
    insertBlockAfter(editor, index, contentFor(kind))
    onAnnounce(
      t("projectContent.insert.inserted", {
        block: t(`projectContent.insert.type.${kind}`),
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
          count: blockCount(),
        })
      )
      return
    }
    setPickedUpAt(null)
    onAnnounce(
      t("projectContent.blockControls.announce.dropped", {
        block: blockLabel,
        position: index + 1,
        count: blockCount(),
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
      if (moveBlock(editor, index, index + delta)) {
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
      moveBlock(editor, index, pickedUpAt)
      onAnnounce(
        t("projectContent.blockControls.announce.cancelled", {
          block: blockLabel,
          position: pickedUpAt + 1,
          count: blockCount(),
        })
      )
      setPickedUpAt(null)
    }
  }

  return (
    <div className="flex items-center gap-0.5 text-muted-foreground">
      <Popover open={inserting} onOpenChange={setInserting}>
        <Tooltip>
          <TooltipTrigger
            render={
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    ref={plusRef}
                    disabled={disabled}
                    /* Nicht als Ziehquelle: der Griff daneben ist es. */
                    draggable={false}
                    className={`${iconButton} hover:bg-muted hover:text-foreground`}
                  />
                }
              />
            }
          >
            <PlusIcon aria-hidden="true" className="size-4" />
            <span className="sr-only">{t("projectContent.insert.label")}</span>
          </TooltipTrigger>
          <TooltipContent>{t("projectContent.insert.label")}</TooltipContent>
        </Tooltip>
        <PopoverContent
          side="bottom"
          align="start"
          className="w-auto max-w-[min(28rem,calc(100vw-2rem))] flex-row overflow-x-auto rounded-pill p-1.5"
          finalFocus={plusRef}
        >
          <BlockInsertBar
            onSelect={onInsert}
            onClose={() => setInserting(false)}
          />
        </PopoverContent>
      </Popover>

      <Tooltip>
        <TooltipTrigger
          render={
            <Toggle
              size="sm"
              pressed={pickedUpAt !== null}
              disabled={disabled}
              onPressedChange={setPickedUp}
              onKeyDown={onGripKeyDown}
              className={gripSize}
            />
          }
        >
          <GripVerticalIcon aria-hidden="true" className="size-4" />
          <span className="sr-only">
            {pickedUpAt === null
              ? t("projectContent.blockControls.pickUp", { block: blockLabel })
              : t("projectContent.blockControls.drop", { block: blockLabel })}
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
                draggable={false}
                onClick={() => setConfirmDelete(true)}
                className={`${iconButton} hover:bg-muted hover:text-destructive`}
              />
            }
          >
            <Trash2Icon aria-hidden="true" className="size-4" />
            <span className="sr-only">
              {t("projectContent.blockControls.delete", { block: blockLabel })}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {t("projectContent.blockControls.delete", { block: blockLabel })}
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
            <AlertDialogCancel>{t("common.action.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDelete(false)
                deleteBlock(editor, index)
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
    </div>
  )
}
