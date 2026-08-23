import { useEditorState, type Editor } from "@tiptap/react"
import { ChevronDownIcon, HighlighterIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ToolbarButton } from "@/components/ui/toolbar"
import {
  CONTENT_COLOR_ROLES,
  type ContentColorRole,
} from "@/features/project-content/contentColors"
import { cn } from "@/lib/utils"

/**
 * Gruppe 4 der Formatierungsleiste: Textfarbe und Hintergrund (Figma
 * {@code SelectionToolbar/ColorMenu}).
 *
 * <p><strong>Zwei eigene Schaltflaechen seit der Kopfzeilen-Leiste.</strong>
 * Textfarbe und Hintergrund lagen unter einem gemeinsamen Ausloeser; jede
 * der beiden oeffnet jetzt nur ihre eigene Farbauswahl. Wer eine
 * Hervorhebung will, sucht nicht mehr im unteren Teil eines gemeinsamen
 * Menues.
 *
 * <p><strong>Entweder Textfarbe oder Hintergrund, nie beides.</strong> Die
 * Schrift auf einer Hervorhebung bleibt {@code --foreground}; fuer eine
 * Kombination aus eigener Textfarbe und eigener Flaeche ist kein Kontrast
 * zugesichert (SC 1.4.3). Das Setzen der einen entfernt deshalb weiterhin
 * die andere Mark, auch ueber die getrennten Schaltflaechen hinweg.
 *
 * <p><strong>Standard ist keine Farbe, sondern das Fehlen der Mark.</strong>
 * Es bekommt darum bewusst kein Token und keine Flaeche, sondern das
 * durchgestrichene Feld.
 *
 * <p><strong>Die Farbfelder tragen Klassen und keine Farbwerte.</strong>
 * Sie kommen aus der Tokenbruecke ({@code --color-content-text-*}), also
 * aus derselben Quelle wie die Anzeige im Beitrag, und wechseln mit dem
 * hellen und dunklen Modus mit. Eine Zuordnung ueber
 * {@code `text-content-text-${role}`} waere kuerzer, aber Tailwind liest
 * Klassennamen statisch: die Regel entstuende gar nicht erst.
 */

const SWATCH: Record<ContentColorRole, { text: string; highlight: string }> = {
  neutral: {
    text: "text-content-text-neutral",
    highlight: "bg-content-highlight-neutral",
  },
  brown: {
    text: "text-content-text-brown",
    highlight: "bg-content-highlight-brown",
  },
  orange: {
    text: "text-content-text-orange",
    highlight: "bg-content-highlight-orange",
  },
  amber: {
    text: "text-content-text-amber",
    highlight: "bg-content-highlight-amber",
  },
  green: {
    text: "text-content-text-green",
    highlight: "bg-content-highlight-green",
  },
  blue: {
    text: "text-content-text-blue",
    highlight: "bg-content-highlight-blue",
  },
  purple: {
    text: "text-content-text-purple",
    highlight: "bg-content-highlight-purple",
  },
  pink: {
    text: "text-content-text-pink",
    highlight: "bg-content-highlight-pink",
  },
  red: { text: "text-content-text-red", highlight: "bg-content-highlight-red" },
}

export function ColorMenu({
  editor,
  disabled,
  kind,
}: {
  editor: Editor
  disabled: boolean
  /** Welche der beiden Farbauswahlen diese Schaltflaeche oeffnet. */
  kind: "text" | "highlight"
}) {
  const { t } = useTranslation()

  /* Ueber useEditorState, weil eine Transaktion die Seite seit Tiptap v3
     nicht mehr neu rendert; ohne das zeigte das Feld im Auslöser die Farbe
     der vorigen Auswahl. */
  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      text:
        CONTENT_COLOR_ROLES.find((role) =>
          current.isActive("textStyle", { color: role })
        ) ?? null,
      highlight:
        CONTENT_COLOR_ROLES.find((role) =>
          current.isActive("highlight", { color: role })
        ) ?? null,
    }),
  })
  const activeText = active?.text ?? null
  const activeHighlight = active?.highlight ?? null

  const setText = (role: ContentColorRole | null) => {
    const chain = editor.chain().focus().unsetMark("highlight")
    if (role === null) {
      chain.unsetMark("textStyle").run()
      return
    }
    chain.setMark("textStyle", { color: role }).run()
  }

  const setHighlight = (role: ContentColorRole | null) => {
    const chain = editor.chain().focus().unsetMark("textStyle")
    if (role === null) {
      chain.unsetMark("highlight").run()
      return
    }
    chain.setMark("highlight", { color: role }).run()
  }

  const isText = kind === "text"
  const label = isText
    ? t("projectContent.toolbar.textColor")
    : t("projectContent.toolbar.highlightColor")
  const activeRole = isText ? activeText : activeHighlight
  const select = isText ? setText : setHighlight

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <ToolbarButton
              render={
                <DropdownMenuTrigger
                  data-toolbar-item
                  disabled={disabled}
                  className="flex h-8 items-center gap-1 rounded-control px-2 outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
                />
              }
            />
          }
        >
          {/* Der Ausloeser zeigt die aktive Rolle: die Textfarbe als
              Schriftfarbe am A, das Highlight als Flaeche hinter dem
              Textmarker-Symbol (Nutzerwunsch: Highlighter statt zweitem A). */}
          {isText ? (
            <span
              aria-hidden="true"
              className={cn(
                "flex size-5 items-center justify-center rounded-pill border border-border font-semibold",
                activeRole === null ? undefined : SWATCH[activeRole].text
              )}
            >
              A
            </span>
          ) : (
            <span
              aria-hidden="true"
              className={cn(
                "flex size-5 items-center justify-center rounded-control",
                activeRole === null ? undefined : SWATCH[activeRole].highlight
              )}
            >
              <HighlighterIcon className="size-4" />
            </span>
          )}
          <ChevronDownIcon aria-hidden="true" className="size-3.5" />
          <span className="sr-only">{label}</span>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-auto min-w-56 p-2">
        {/*
         * Radiogruppe und Felder kommen aus der Primitive und nicht als
         * eigene role="radio"-Buttons (Review-Befund): erst damit gehoeren
         * die Felder zum Tastaturweg des Menues (Pfeiltasten, Home, End),
         * und die Beschriftung haengt ueber das GroupLabel an der Gruppe.
         */}
        <DropdownMenuRadioGroup
          value={activeRole ?? "default"}
          onValueChange={(value) =>
            select(value === "default" ? null : (value as ContentColorRole))
          }
          className="grid grid-cols-5 gap-1.5"
        >
          <DropdownMenuLabel className="type-overline col-span-5">
            {label}
          </DropdownMenuLabel>
          <Swatch
            value="default"
            label={t("projectContent.toolbar.colorDefault")}
            className="text-muted-foreground line-through"
            square={!isText}
          />
          {CONTENT_COLOR_ROLES.map((role) => (
            <Swatch
              key={role}
              value={role}
              label={t(`projectContent.toolbar.colorRole.${role}`)}
              className={SWATCH[role][isText ? "text" : "highlight"]}
              square={!isText}
            />
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Ein Farbfeld als echtes {@code menuitemradio}: die zehn Felder einer
 * Gruppe schliessen einander aus, es ist eine Wahl und kein Schalter.
 * Der gewaehlte Zustand ist als Ring sichtbar; der Haken-Indikator der
 * generierten Primitive ist ausgeblendet, weil er in einem Feld von 32
 * Pixeln ueber dem A laege und der Ring dasselbe sagt.
 */
function Swatch({
  value,
  label,
  className,
  square = false,
}: {
  value: string
  label: string
  className?: string
  square?: boolean
}) {
  return (
    <DropdownMenuRadioItem
      value={value}
      className={cn(
        "flex size-8 items-center justify-center border border-border p-0 font-semibold focus:ring-[3px] focus:ring-ring/50 aria-checked:border-primary aria-checked:ring-2 aria-checked:ring-primary/40 **:data-[slot='dropdown-menu-radio-item-indicator']:hidden",
        square ? "rounded-control" : "rounded-pill",
        className
      )}
    >
      <span aria-hidden="true">A</span>
      <span className="sr-only">{label}</span>
    </DropdownMenuRadioItem>
  )
}
