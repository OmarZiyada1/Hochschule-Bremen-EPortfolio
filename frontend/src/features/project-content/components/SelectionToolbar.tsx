import { BubbleMenu } from "@tiptap/react/menus"
import { useEditorState, type Editor } from "@tiptap/react"
import { NodeSelection } from "@tiptap/pm/state"
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
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { Toggle } from "@/components/ui/toggle"
import {
  Toolbar,
  ToolbarButton,
  ToolbarSeparator,
} from "@/components/ui/toolbar"
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
 * Pfeiltasten, {@code Home} und {@code End} (Roving-Tabindex, WAI-ARIA
 * Authoring Practices fuer {@code toolbar}). Zwoelf einzelne Tabstopps
 * zwischen Text und Leiste waeren fuer Tastaturbedienung unbenutzbar: wer
 * nach dem Markieren weiterschreiben will, muesste zwoelfmal Tab druecken.
 *
 * <p><strong>Das besorgt die Primitive und nicht mehr diese Datei.</strong>
 * Zuvor fuehrte die Leiste den Roving-Tabindex selbst: ein Effekt ohne
 * Abhaengigkeiten suchte bei jedem Rendern alle Eintraege per
 * {@code querySelectorAll} zusammen und schrieb {@code tabIndex} an jedes
 * Element neu. Base UI bringt {@code Toolbar} mit, samt Pfeiltasten,
 * Umlauf und der Behandlung deaktivierter, aber fokussierbarer Eintraege;
 * die Huelle dazu steht in {@code components/ui/toolbar.tsx}.
 *
 * <p><strong>Warum nicht {@code toggle-group} fuer die Gruppen.</strong>
 * Die Primitive bringt einen eigenen Roving-Tabindex mit und faengt die
 * Pfeiltasten innerhalb der Gruppe ab. Vier davon nebeneinander ergaeben
 * vier abgeschlossene Pfeilbereiche, also das Gegenteil der Zusage. Wo eine
 * Gruppe einen eigenen Fokusbereich haben <em>soll</em>, naemlich im
 * Ausrichtungsmenue, steht sehr wohl ein {@code toggle-group}.
 *
 * <p><strong>Der Zustand der Schaltflaechen kommt aus
 * {@code useEditorState}.</strong> Seit Tiptap v3 rendert der Editor die
 * Seite bei einer Transaktion nicht mehr neu; ein {@code editor.isActive()}
 * im Rendern zeigte deshalb den Stand der vorletzten Auswahl, und Fett sah
 * beim Markieren eines fetten Wortes nicht gedrueckt aus.
 *
 * <p>Alt+F10 fuehrt aus dem Text in die Leiste (die Seite faengt es ab),
 * Escape zurueck in den Text, ohne die Markierung zu verlieren.
 */

/** Die elf Auszeichnungen der Leiste, in der Reihenfolge des Templates. */
const MARKS: readonly {
  name: string
  icon: LucideIcon
  toggle: (editor: Editor) => void
}[] = [
  {
    name: "bold",
    icon: BoldIcon,
    toggle: (e) => e.chain().focus().toggleBold().run(),
  },
  {
    name: "italic",
    icon: ItalicIcon,
    toggle: (e) => e.chain().focus().toggleItalic().run(),
  },
  {
    name: "underline",
    icon: UnderlineIcon,
    toggle: (e) => e.chain().focus().toggleUnderline().run(),
  },
  {
    name: "strike",
    icon: StrikethroughIcon,
    toggle: (e) => e.chain().focus().toggleStrike().run(),
  },
  {
    name: "code",
    icon: CodeIcon,
    toggle: (e) => e.chain().focus().toggleCode().run(),
  },
  {
    name: "superscript",
    icon: SuperscriptIcon,
    toggle: (e) => e.chain().focus().toggleSuperscript().run(),
  },
  {
    name: "subscript",
    icon: SubscriptIcon,
    toggle: (e) => e.chain().focus().toggleSubscript().run(),
  },
]

const BLOCK_FORMATS: readonly {
  name: string
  icon: LucideIcon
  toggle: (editor: Editor) => void
}[] = [
  {
    name: "bulletList",
    icon: ListIcon,
    toggle: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    name: "orderedList",
    icon: ListOrderedIcon,
    toggle: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    name: "blockquote",
    icon: QuoteIcon,
    toggle: (e) => e.chain().focus().toggleBlockquote().run(),
  },
]

export function SelectionToolbar({
  editor,
  disabled,
}: {
  editor: Editor
  disabled: boolean
}) {
  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: "top" }}
      /*
       * Nicht ueber einem Medienknoten: dort gibt es keinen Text
       * auszuzeichnen, und die Leiste verdeckt das Bild.
       *
       * <p><strong>Geprueft wird die Art der Auswahl und nicht nur ihre
       * Laenge.</strong> Zuvor stand hier allein {@code from !== to}, und
       * das trifft auf eine NodeSelection ebenso zu: sie umfasst den ganzen
       * Knoten. Wer ein Bild einfuegte, bekam deshalb die Textleiste mit
       * Fett, Farbe und Ueberschriftenebenen darueber, und sie blieb
       * stehen, solange der Knoten ausgewaehlt war. Die Zusage im Kommentar
       * stand also da, die Bedingung dazu fehlte.
       */
      shouldShow={({ editor: current, from, to }) => {
        const { selection } = current.state
        if (disabled || selection.empty || from === to) {
          return false
        }
        /* Ein ausgewaehlter Knoten ist kein markierter Text. */
        if (selection instanceof NodeSelection) {
          return false
        }
        /* Und ebenso wenig eine Auswahl, die genau einen atomaren Knoten
           umschliesst, etwa nach dem Einfuegen ueber die Pille. */
        let onlyAtoms = true
        current.state.doc.nodesBetween(from, to, (node) => {
          if (node.isText) {
            onlyAtoms = false
          }
          return onlyAtoms
        })
        return !onlyAtoms
      }}
    >
      <SelectionToolbarBar editor={editor} disabled={disabled} />
    </BubbleMenu>
  )
}

/**
 * Die Leiste selbst, ohne die Blase darum.
 *
 * <p><strong>Getrennt, damit sie pruefbar bleibt.</strong> Die Blase ist
 * ausgeblendet, solange nichts markiert ist, und in jsdom nimmt ein Element
 * in einem versteckten Teilbaum keinen Fokus an: ein Test gegen die
 * vollstaendige {@link SelectionToolbar} koennte die Tastaturfuehrung
 * deshalb gar nicht ausloesen. Die Trennung kostet nichts und macht genau
 * die Zusage pruefbar, um die es geht.
 */
export function SelectionToolbarBar({
  editor,
  disabled,
}: {
  editor: Editor
  disabled: boolean
}) {
  const { t } = useTranslation()
  const linkTriggerRef = useRef<HTMLButtonElement>(null)
  const [linkOpen, setLinkOpen] = useState(false)

  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const result: Record<string, boolean> = {}
      for (const { name } of [...MARKS, ...BLOCK_FORMATS]) {
        result[name] = current.isActive(name)
      }
      result.link = current.isActive("link")
      return result
    },
  })

  return (
    <>
      <Toolbar
        data-selection-toolbar
        aria-label={t("projectContent.toolbar.label")}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault()
            editor.commands.focus()
          }
        }}
        className="rounded-card border border-border bg-popover p-1 shadow-md"
      >
        <BlockTypeMenu editor={editor} disabled={disabled} />

        <ToolbarSeparator />

        {MARKS.map(({ name, icon, toggle }) => (
          <MarkButton
            key={name}
            disabled={disabled}
            icon={icon}
            name={name}
            pressed={active?.[name] ?? false}
            onToggle={() => toggle(editor)}
          />
        ))}
        <Tooltip>
          <TooltipTrigger
            render={
              <ToolbarButton
                render={
                  <Toggle
                    ref={linkTriggerRef}
                    data-toolbar-item
                    size="sm"
                    disabled={disabled}
                    pressed={active?.link ?? false}
                    onPressedChange={() => setLinkOpen(true)}
                    className="size-8 min-w-0 px-0"
                  />
                }
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

        {BLOCK_FORMATS.map(({ name, icon, toggle }) => (
          <MarkButton
            key={name}
            disabled={disabled}
            icon={icon}
            name={name}
            pressed={active?.[name] ?? false}
            onToggle={() => toggle(editor)}
          />
        ))}
        <AlignMenu editor={editor} disabled={disabled} />

        <ToolbarSeparator />

        <ColorMenu editor={editor} disabled={disabled} />
      </Toolbar>

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
  disabled,
  icon: Icon,
  name,
  pressed,
  onToggle,
}: {
  disabled: boolean
  icon: LucideIcon
  name: string
  pressed: boolean
  onToggle: () => void
}) {
  const { t } = useTranslation()
  const label = t(`projectContent.toolbar.mark.${name}`)

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <ToolbarButton
            render={
              <Toggle
                data-toolbar-item
                size="sm"
                disabled={disabled}
                pressed={pressed}
                onPressedChange={onToggle}
                className="size-8 min-w-0 px-0"
              />
            }
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
