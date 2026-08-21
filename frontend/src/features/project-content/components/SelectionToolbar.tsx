import { useEditorState, type Editor } from "@tiptap/react"
import { BubbleMenu } from "@tiptap/react/menus"
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
} from "lucide-react"
import { useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { AlignMenu } from "@/features/project-content/components/AlignMenu"
import { BlockTypeMenu } from "@/features/project-content/components/BlockTypeMenu"
import { ColorMenu } from "@/features/project-content/components/ColorMenu"
import { LinkDialog } from "@/features/project-content/components/LinkDialog"
import {
  EditorToolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarSeparator,
} from "@/features/project-content/components/EditorToolbar"

/**
 * Die Auswahlleiste ueber markiertem Text (Figma
 * {@code sec:Selection Toolbar}, Confluence „Template: Editor
 * (Bearbeiten)").
 *
 * <p>Vier Gruppen in dieser Reihenfolge, getrennt durch senkrechte Striche:
 * Blocktyp, Zeichenauszeichnung, Blockformat, Farbe. Sie erscheint, sobald
 * Text markiert ist, und verschwindet ohne Auswahl.
 *
 * <p><strong>Alle acht Auszeichnungen stehen bereits im Schema</strong>
 * (Contract 2.5, KAN-10); es kommt keine Mark hinzu. Der Link ist eine Mark
 * und kein Block, weshalb er in dieser Gruppe steht und nicht in der
 * Einfuegeleiste.
 *
 * <p><strong>Warum {@code useEditorState} und nicht der Editor
 * unmittelbar.</strong> Die Leiste haengt an Auswahl und aktiven Marks, und
 * beides aendert sich bei jedem Tastenanschlag. Ohne einen abgeleiteten
 * Zustand rendert sie bei jeder Transaktion neu, auch wenn sich an ihr
 * nichts geaendert hat; der Hook vergleicht das Ergebnis und rendert nur
 * dann.
 */

/** Die sieben Auszeichnungen ohne Attribut, in der Reihenfolge des Templates. */
const MARKS: readonly {
  name: string
  icon: ReactNode
  toggle: (editor: Editor) => void
}[] = [
  {
    name: "bold",
    icon: <BoldIcon aria-hidden="true" />,
    toggle: (editor) => editor.chain().focus().toggleBold().run(),
  },
  {
    name: "italic",
    icon: <ItalicIcon aria-hidden="true" />,
    toggle: (editor) => editor.chain().focus().toggleItalic().run(),
  },
  {
    name: "underline",
    icon: <UnderlineIcon aria-hidden="true" />,
    toggle: (editor) => editor.chain().focus().toggleUnderline().run(),
  },
  {
    name: "strike",
    icon: <StrikethroughIcon aria-hidden="true" />,
    toggle: (editor) => editor.chain().focus().toggleStrike().run(),
  },
  {
    name: "code",
    icon: <CodeIcon aria-hidden="true" />,
    toggle: (editor) => editor.chain().focus().toggleCode().run(),
  },
  {
    name: "superscript",
    icon: <SuperscriptIcon aria-hidden="true" />,
    toggle: (editor) => editor.chain().focus().toggleSuperscript().run(),
  },
  {
    name: "subscript",
    icon: <SubscriptIcon aria-hidden="true" />,
    toggle: (editor) => editor.chain().focus().toggleSubscript().run(),
  },
]

type ToolbarState = {
  marks: Record<string, boolean>
  link: boolean
  href: string
  bulletList: boolean
  orderedList: boolean
  blockquote: boolean
}

/** Der Zustand ohne Editor: nichts ist aktiv. */
const EMPTY_STATE: ToolbarState = {
  marks: {},
  link: false,
  href: "",
  bulletList: false,
  orderedList: false,
  blockquote: false,
}

/**
 * Die Blase, in der die Leiste erscheint.
 *
 * <p>Sie ist bewusst duenn: {@code BubbleMenu} haengt ihr Kind an die View
 * des Editors und entscheidet ueber die Positionierung. Der Inhalt steht in
 * {@link SelectionToolbarContent} und laesst sich damit einzeln pruefen,
 * ohne dass eine Positionsberechnung im Spiel waere, die es in jsdom nicht
 * gibt.
 */
export function SelectionToolbar({ editor }: { editor: Editor }) {
  return (
    <BubbleMenu
      editor={editor}
      /*
       * Nur bei wirklich markiertem Text, und nur solange geschrieben werden
       * darf. Die Voreinstellung zeigte die Leiste auch an einem leeren
       * Absatz und ueber einem markierten Medienknoten, wo keine der vier
       * Gruppen etwas zu tun haette.
       */
      shouldShow={({ editor: current, from, to }) =>
        current.isEditable && from !== to && !current.state.selection.empty
      }
      options={{ placement: "top", offset: 8 }}
    >
      <SelectionToolbarContent editor={editor} />
    </BubbleMenu>
  )
}

export function SelectionToolbarContent({ editor }: { editor: Editor }) {
  const { t } = useTranslation()

  /*
   * Auf isDestroyed geprueft: der Selektor laeuft noch einmal, nachdem die
   * Seite den Editor abgeraeumt hat (Neuladen im Konfliktfall, Verlassen
   * der Route). Zu dem Zeitpunkt gibt es das Editor-Objekt noch, aber seine
   * View nicht mehr, und isActive greift auf sie zu.
   */
  const state =
    useEditorState({
      editor,
      selector: ({ editor: current }): ToolbarState =>
        current === null || current.isDestroyed
          ? EMPTY_STATE
          : {
              marks: Object.fromEntries(
                MARKS.map((mark) => [mark.name, current.isActive(mark.name)])
              ),
              link: current.isActive("link"),
              href:
                typeof current.getAttributes("link").href === "string"
                  ? (current.getAttributes("link").href as string)
                  : "",
              bulletList: current.isActive("bulletList"),
              orderedList: current.isActive("orderedList"),
              blockquote: current.isActive("blockquote"),
              /* Die drei Menues lesen ihren Zustand selbst; hier steht nur,
                 was die Umschalter brauchen. */
            },
    }) ?? EMPTY_STATE

  /**
   * Die Textauswahl zum Zeitpunkt des Oeffnens.
   *
   * <p>Der Dialog nimmt den Fokus, und die Auswahl im Editor faellt damit
   * auf den Cursor zusammen. {@code setLink} traefe danach kein einziges
   * Zeichen. Gemerkt werden deshalb die Positionen, und beim Anwenden wird
   * die Auswahl wiederhergestellt.
   */
  const [linkRange, setLinkRange] = useState<{
    from: number
    to: number
  } | null>(null)

  const openLinkDialog = () => {
    const { from, to } = editor.state.selection
    setLinkRange({ from, to })
  }

  const applyLink = (href: string) => {
    if (linkRange === null) {
      return
    }
    editor
      .chain()
      .focus()
      .setTextSelection(linkRange)
      .setLink({ href })
      .run()
  }

  const removeLink = () => {
    if (linkRange === null) {
      return
    }
    editor.chain().focus().setTextSelection(linkRange).unsetLink().run()
  }

  return (
    <>
      <EditorToolbar
        label={t("projectContent.toolbar.label")}
        /* Escape gibt den Fokus an die Auswahl zurueck: focus() ohne
           Argument stellt die letzte Auswahl wieder her, die Markierung
           geht also nicht verloren. */
        onEscape={() => editor.chain().focus().run()}
        /* Und Alt+F10 fuehrt aus dem Text in die Leiste. */
        activateOn={editor.isDestroyed ? null : editor.view.dom}
      >
        <BlockTypeMenu editor={editor} />

        <ToolbarSeparator />

        <ToolbarGroup label={t("projectContent.toolbar.marks.group")}>
          {MARKS.map((mark) => (
            <ToolbarButton
              key={mark.name}
              id={`mark-${mark.name}`}
              label={t(`projectContent.toolbar.marks.${mark.name}`)}
              icon={mark.icon}
              pressed={state.marks[mark.name]}
              onPressedChange={() => mark.toggle(editor)}
            />
          ))}
          {/* Der Link oeffnet einen Dialog, statt umzuschalten: die Adresse
              muss von irgendwoher kommen. aria-pressed meldet trotzdem, ob
              die Auswahl bereits verlinkt ist, denn genau das ist der
              Zustand, den die Schaltflaeche anzeigt. */}
          <ToolbarButton
            id="mark-link"
            label={t("projectContent.toolbar.marks.link")}
            icon={<LinkIcon aria-hidden="true" />}
            pressed={state.link}
            onPressedChange={openLinkDialog}
          />
        </ToolbarGroup>

        <ToolbarSeparator />

        <ToolbarGroup label={t("projectContent.toolbar.blockFormat.group")}>
          <ToolbarButton
            id="format-bullet-list"
            label={t("projectContent.toolbar.blockFormat.bulletList")}
            icon={<ListIcon aria-hidden="true" />}
            pressed={state.bulletList}
            onPressedChange={() =>
              editor.chain().focus().toggleBulletList().run()
            }
          />
          <ToolbarButton
            id="format-ordered-list"
            label={t("projectContent.toolbar.blockFormat.orderedList")}
            icon={<ListOrderedIcon aria-hidden="true" />}
            pressed={state.orderedList}
            onPressedChange={() =>
              editor.chain().focus().toggleOrderedList().run()
            }
          />
          <ToolbarButton
            id="format-blockquote"
            label={t("projectContent.toolbar.blockFormat.blockquote")}
            icon={<QuoteIcon aria-hidden="true" />}
            pressed={state.blockquote}
            onPressedChange={() =>
              editor.chain().focus().toggleBlockquote().run()
            }
          />
          <AlignMenu editor={editor} />
        </ToolbarGroup>

        <ToolbarSeparator />

        <ColorMenu editor={editor} />
      </EditorToolbar>

      {linkRange !== null && (
        <LinkDialog
          open
          initialHref={state.href}
          onOpenChange={(next) => {
            if (!next) {
              setLinkRange(null)
            }
          }}
          onSubmit={applyLink}
          onRemove={state.link ? removeLink : undefined}
        />
      )}
    </>
  )
}
