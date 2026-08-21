import { BubbleMenu } from "@tiptap/react/menus"
import type { Editor } from "@tiptap/react"
import {
  BoldIcon,
  CodeIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
  StrikethroughIcon,
  SubscriptIcon,
  SuperscriptIcon,
  UnderlineIcon,
  type LucideIcon,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { Separator } from "@/components/ui/separator"
import { Toggle } from "@/components/ui/toggle"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { AlignMenu } from "@/features/project-content/components/AlignMenu"
import { BlockTypeMenu } from "@/features/project-content/components/BlockTypeMenu"
import { ColorMenu } from "@/features/project-content/components/ColorMenu"
import { LinkDialog } from "@/features/project-content/components/LinkDialog"

/**
 * Die Auswahlleiste ueber markiertem Text (Figma
 * {@code sec:Selection Toolbar}).
 *
 * <p>Vier Gruppen mit senkrechten Trennern, in dieser Reihenfolge:
 * Blocktyp, Zeichenauszeichnung, Blockformat, Farbe.
 *
 * <p><strong>Ein Tabstopp fuer die ganze Leiste</strong>, innen die
 * Pfeiltasten (Roving-Tabindex, WAI-ARIA Authoring Practices fuer
 * {@code toolbar}). Zwoelf einzelne Tabstopps zwischen Text und Leiste
 * waeren fuer Tastaturbedienung unbenutzbar: wer nach dem Markieren
 * weiterschreiben will, muesste zwoelfmal Tab druecken.
 *
 * <p><strong>Warum nicht {@code toggle-group} fuer die Gruppen.</strong>
 * Die Primitive bringt einen eigenen Roving-Tabindex mit und faengt die
 * Pfeiltasten innerhalb der Gruppe ab. Vier davon nebeneinander ergaeben
 * vier Tabstopps und vier abgeschlossene Pfeilbereiche, also das Gegenteil
 * der Zusage. Die Leiste fuehrt den Roving-Tabindex deshalb selbst und
 * setzt darin die einzelne Primitive {@code toggle} ein. Wo eine Gruppe
 * einen eigenen Fokusbereich haben <em>soll</em>, naemlich im
 * Ausrichtungsmenue, steht sehr wohl ein {@code toggle-group}.
 *
 * <p>Alt+F10 fuehrt aus dem Text in die Leiste (die Seite faengt es ab),
 * Escape zurueck in den Text, ohne die Markierung zu verlieren.
 */
export function SelectionToolbar({
  editor,
  disabled,
}: {
  editor: Editor
  disabled: boolean
}) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const linkTriggerRef = useRef<HTMLButtonElement>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [active, setActive] = useState(0)

  /*
   * Genau ein Element der Leiste ist erreichbar; welches, wandert mit dem
   * Fokus. Ueber das DOM und nicht ueber Props, weil die drei Menues ihre
   * Auslöser selbst rendern und eine durchgereichte tabIndex-Zahl durch
   * jede von ihnen wandern muesste.
   */
  useEffect(() => {
    const items = itemsOf(containerRef.current)
    items.forEach((item, index) => {
      item.tabIndex = index === active ? 0 : -1
    })
  })

  const moveFocus = (next: number) => {
    const items = itemsOf(containerRef.current)
    if (items.length === 0) {
      return
    }
    const clamped = (next + items.length) % items.length
    setActive(clamped)
    items[clamped]?.focus()
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case "ArrowRight":
        event.preventDefault()
        moveFocus(active + 1)
        break
      case "ArrowLeft":
        event.preventDefault()
        moveFocus(active - 1)
        break
      case "Home":
        event.preventDefault()
        moveFocus(0)
        break
      case "End":
        event.preventDefault()
        moveFocus(itemsOf(containerRef.current).length - 1)
        break
      case "Escape":
        event.preventDefault()
        editor.commands.focus()
        break
      default:
        break
    }
  }

  return (
    <>
      <BubbleMenu
        editor={editor}
        options={{ placement: "top" }}
        /* Nicht ueber einem Medienknoten: dort gibt es keinen Text
           auszuzeichnen, und die Leiste verdeckte das Bild. */
        shouldShow={({ editor: current, from, to }) =>
          !disabled && from !== to && !current.state.selection.empty
        }
      >
        <div
          ref={containerRef}
          data-selection-toolbar
          role="toolbar"
          aria-label={t("projectContent.toolbar.label")}
          aria-orientation="horizontal"
          onKeyDown={onKeyDown}
          onFocusCapture={(event) => {
            const items = itemsOf(containerRef.current)
            const index = items.indexOf(event.target as HTMLElement)
            if (index >= 0) {
              setActive(index)
            }
          }}
          className="flex items-center gap-0.5 rounded-card border border-border bg-popover p-1 shadow-md"
        >
          <BlockTypeMenu editor={editor} disabled={disabled} />

          <ToolbarSeparator />

          <MarkButton
            editor={editor}
            disabled={disabled}
            icon={BoldIcon}
            name="bold"
            onToggle={() => editor.chain().focus().toggleBold().run()}
          />
          <MarkButton
            editor={editor}
            disabled={disabled}
            icon={ItalicIcon}
            name="italic"
            onToggle={() => editor.chain().focus().toggleItalic().run()}
          />
          <MarkButton
            editor={editor}
            disabled={disabled}
            icon={UnderlineIcon}
            name="underline"
            onToggle={() => editor.chain().focus().toggleUnderline().run()}
          />
          <MarkButton
            editor={editor}
            disabled={disabled}
            icon={StrikethroughIcon}
            name="strike"
            onToggle={() => editor.chain().focus().toggleStrike().run()}
          />
          <MarkButton
            editor={editor}
            disabled={disabled}
            icon={CodeIcon}
            name="code"
            onToggle={() => editor.chain().focus().toggleCode().run()}
          />
          <MarkButton
            editor={editor}
            disabled={disabled}
            icon={SuperscriptIcon}
            name="superscript"
            onToggle={() => editor.chain().focus().toggleSuperscript().run()}
          />
          <MarkButton
            editor={editor}
            disabled={disabled}
            icon={SubscriptIcon}
            name="subscript"
            onToggle={() => editor.chain().focus().toggleSubscript().run()}
          />
          <Tooltip>
            <TooltipTrigger
              render={
                <Toggle
                  ref={linkTriggerRef}
                  data-toolbar-item
                  size="sm"
                  disabled={disabled}
                  pressed={editor.isActive("link")}
                  onPressedChange={() => setLinkOpen(true)}
                  className="size-8 min-w-0 px-0"
                />
              }
            >
              <LinkIcon aria-hidden="true" />
              <span className="sr-only">
                {t("projectContent.toolbar.mark.link")}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {t("projectContent.toolbar.mark.link")}
            </TooltipContent>
          </Tooltip>

          <ToolbarSeparator />

          <MarkButton
            editor={editor}
            disabled={disabled}
            icon={ListIcon}
            name="bulletList"
            onToggle={() => editor.chain().focus().toggleBulletList().run()}
          />
          <MarkButton
            editor={editor}
            disabled={disabled}
            icon={ListOrderedIcon}
            name="orderedList"
            onToggle={() => editor.chain().focus().toggleOrderedList().run()}
          />
          <MarkButton
            editor={editor}
            disabled={disabled}
            icon={QuoteIcon}
            name="blockquote"
            onToggle={() => editor.chain().focus().toggleBlockquote().run()}
          />
          <AlignMenu editor={editor} disabled={disabled} />

          <ToolbarSeparator />

          <ColorMenu editor={editor} disabled={disabled} />
        </div>
      </BubbleMenu>

      <LinkDialog
        editor={editor}
        open={linkOpen}
        onOpenChange={(open) => {
          setLinkOpen(open)
          if (!open) {
            /* Der Fokus geht an den Auslöser zurueck; ohne das faellt er
               auf body (SC 2.4.3). */
            linkTriggerRef.current?.focus()
          }
        }}
      />
    </>
  )
}

/**
 * Eine Schaltflaeche der Leiste. {@code aria-pressed} kommt von der
 * Primitive; der zugaengliche Name steht als {@code sr-only}-Text und nicht
 * nur im Tooltip, denn auf Touch erscheint der Tooltip gar nicht.
 */
function MarkButton({
  editor,
  disabled,
  icon: Icon,
  name,
  onToggle,
}: {
  editor: Editor
  disabled: boolean
  icon: LucideIcon
  name: string
  onToggle: () => void
}) {
  const { t } = useTranslation()
  const label = t(`projectContent.toolbar.mark.${name}`)

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Toggle
            data-toolbar-item
            size="sm"
            disabled={disabled}
            pressed={editor.isActive(name)}
            onPressedChange={onToggle}
            className="size-8 min-w-0 px-0"
          />
        }
      >
        <Icon aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function ToolbarSeparator() {
  return (
    <Separator
      orientation="vertical"
      className="mx-1 h-5 data-vertical:self-center"
    />
  )
}

function itemsOf(container: HTMLElement | null): HTMLElement[] {
  if (container === null) {
    return []
  }
  return Array.from(
    container.querySelectorAll<HTMLElement>("[data-toolbar-item]")
  )
}
