import { GripVerticalIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"
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
import type { BlockNodeName } from "@/features/project-content/blockTypes"
import {
  InsertMenu,
  type InsertKind,
} from "@/features/project-content/components/InsertMenu"

/**
 * Die Bedienung links am aktiven Block: Einfuegen, Verschieben, Loeschen
 * (Figma {@code BlockControls}).
 *
 * <p>Ruhefarbe {@code muted-foreground}, damit sie den Text nicht
 * ueberstimmt; erst beim Zeiger darueber und im Fokus tritt sie hervor.
 *
 * <p><strong>Verschieben ohne Ziehbewegung</strong> (SC 2.1.1). Der
 * Ziehgriff ist eine Schaltflaeche mit zwei Zustaenden: Enter oder
 * Leertaste hebt den Block an ({@code aria-pressed}), Pfeil hoch und runter
 * verschieben ihn schrittweise, Enter legt ihn ab, Escape bricht ab und
 * stellt die Ausgangsposition wieder her. Eine reine Maus-Ziehbewegung
 * genuegt nicht: sie ist fuer Tastatur- und Sprachbedienung unerreichbar,
 * und "einen Block verschieben" ist keine Handlung, die sich anders
 * erreichen liesse.
 *
 * <p><strong>Jede Bewegung wird angesagt.</strong> Ohne Ansage ist die
 * Bedienung fuer einen Screenreader stumm: es gaebe kein Zeichen dafuer,
 * dass sich etwas bewegt hat, und keinen Hinweis darauf, wo der Block jetzt
 * steht. Die Live-Region liegt an der Seite ({@code EditorPage}); diese
 * Komponente ruft nur {@link BlockControlsProps.onAnnounce}.
 *
 * <p><strong>Loeschen fragt nach</strong> und benennt den Block im Text
 * (Skill frontend-design, Abschnitt 5): ein Bild oder eine Tabelle ist
 * Arbeit, die sich nicht mit einem Klick wiederherstellen laesst.
 */

export type BlockControlsProps = {
  /** Position des aktiven Blocks, gezaehlt ab 0. */
  index: number
  /** Gesamtzahl der Bloecke, fuer die Ansage. */
  count: number
  /** Knotenname aus 2.5, fuer die Beschriftung der Rueckfrage. */
  name: BlockNodeName | null
  /** Abstand von der Oberkante der Schreibflaeche, in CSS-Pixeln. */
  top: number
  disabled: boolean
  onInsert: (kind: InsertKind) => void
  /** Verschiebt um eine Position; meldet, ob es geklappt hat. */
  onMove: (delta: -1 | 1) => boolean
  /** Verschiebt zurueck an die gemerkte Ausgangsposition (Escape). */
  onMoveTo: (index: number) => void
  onDelete: () => void
  onAnnounce: (message: string) => void
}

export function BlockControls({
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
  const [confirmDelete, setConfirmDelete] = useState(false)
  /* Die Position, an der der Block angehoben wurde. Nicht null heisst
     "angehoben"; Escape stellt sie wieder her. */
  const [pickedUpAt, setPickedUpAt] = useState<number | null>(null)

  const blockLabel =
    name === null
      ? t("projectContent.blockControls.blockFallback")
      : t(`projectContent.blockControls.blockName.${name}`)

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

  return (
    <div
      /* Absolut ueber der Schreibflaeche: im Fluss liesse ProseMirror das
         Element beim naechsten Tastenanschlag verschwinden, weil es das DOM
         der Flaeche selbst verwaltet. */
      style={{ top }}
      className="absolute -left-1 flex -translate-x-full items-center gap-1 text-muted-foreground"
    >
      <InsertMenu onSelect={onInsert} disabled={disabled} />

      <Tooltip>
        <TooltipTrigger
          render={
            <Toggle
              size="sm"
              pressed={pickedUpAt !== null}
              disabled={disabled}
              onPressedChange={setPickedUp}
              onKeyDown={onGripKeyDown}
              className="size-6 min-w-0 px-0 data-pressed:bg-accent"
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
                onClick={() => setConfirmDelete(true)}
                className="flex size-6 items-center justify-center rounded-control outline-none hover:bg-muted hover:text-destructive focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
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
            <AlertDialogCancel>
              {t("projectContent.blockControls.confirmDelete.cancel")}
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
    </div>
  )
}
