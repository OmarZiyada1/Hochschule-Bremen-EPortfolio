import type { Editor } from "@tiptap/react"
import { ChevronDownIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  CONTENT_COLOR_ROLES,
  type ContentColorRole,
} from "@/features/project-content/contentColors"
import { cn } from "@/lib/utils"

/**
 * Gruppe 4 der Auswahlleiste: Textfarbe und Hintergrund (Figma
 * {@code SelectionToolbar/ColorMenu}).
 *
 * <p><strong>Entweder Textfarbe oder Hintergrund, nie beides.</strong> Die
 * Schrift auf einer Hervorhebung bleibt {@code --foreground}; fuer eine
 * Kombination aus eigener Textfarbe und eigener Flaeche ist kein Kontrast
 * zugesichert (SC 1.4.3). Das Setzen der einen entfernt deshalb die andere
 * Mark.
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
}: {
  editor: Editor
  disabled: boolean
}) {
  const { t } = useTranslation()

  const activeText = CONTENT_COLOR_ROLES.find((role) =>
    editor.isActive("textStyle", { color: role })
  )
  const activeHighlight = CONTENT_COLOR_ROLES.find((role) =>
    editor.isActive("highlight", { color: role })
  )

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

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              data-toolbar-item
              disabled={disabled}
              className="flex h-8 items-center gap-1 rounded-control px-2 outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
            />
          }
        >
          <span
            aria-hidden="true"
            className={cn(
              "flex size-5 items-center justify-center rounded-pill border border-border font-semibold",
              activeText === undefined ? undefined : SWATCH[activeText].text,
              activeHighlight === undefined
                ? undefined
                : SWATCH[activeHighlight].highlight
            )}
          >
            A
          </span>
          <ChevronDownIcon aria-hidden="true" className="size-3.5" />
          <span className="sr-only">{t("projectContent.toolbar.color")}</span>
        </TooltipTrigger>
        <TooltipContent>{t("projectContent.toolbar.color")}</TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-auto min-w-56 p-2">
        {/*
         * Die Gruppe kommt aus der Primitive und nicht als eigenes
         * role="group": Base UI verbindet Beschriftung und Gruppe ueber
         * aria-labelledby, und ein GroupLabel ausserhalb einer Gruppe
         * wirft zur Laufzeit.
         */}
        <DropdownMenuGroup className="grid grid-cols-5 gap-1.5 pb-2">
          <DropdownMenuLabel className="type-overline col-span-5">
            {t("projectContent.toolbar.textColor")}
          </DropdownMenuLabel>
          <Swatch
            label={t("projectContent.toolbar.colorDefault")}
            active={activeText === undefined}
            onSelect={() => setText(null)}
            className="text-muted-foreground line-through"
          />
          {CONTENT_COLOR_ROLES.map((role) => (
            <Swatch
              key={role}
              label={t(`projectContent.toolbar.colorRole.${role}`)}
              active={activeText === role}
              onSelect={() => setText(role)}
              className={SWATCH[role].text}
            />
          ))}
        </DropdownMenuGroup>

        <DropdownMenuGroup className="grid grid-cols-5 gap-1.5">
          <DropdownMenuLabel className="type-overline col-span-5">
            {t("projectContent.toolbar.highlightColor")}
          </DropdownMenuLabel>
          <Swatch
            label={t("projectContent.toolbar.colorDefault")}
            active={activeHighlight === undefined}
            onSelect={() => setHighlight(null)}
            className="text-muted-foreground line-through"
          />
          {CONTENT_COLOR_ROLES.map((role) => (
            <Swatch
              key={role}
              label={t(`projectContent.toolbar.colorRole.${role}`)}
              active={activeHighlight === role}
              onSelect={() => setHighlight(role)}
              className={SWATCH[role].highlight}
              square
            />
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Ein Farbfeld. {@code aria-checked} und nicht {@code aria-pressed}: die
 * zehn Felder einer Gruppe schliessen einander aus, es ist eine Wahl und
 * kein Schalter.
 */
function Swatch({
  label,
  active,
  onSelect,
  className,
  square = false,
}: {
  label: string
  active: boolean
  onSelect: () => void
  className?: string
  square?: boolean
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      className={cn(
        "flex size-8 items-center justify-center border font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        square ? "rounded-control" : "rounded-pill",
        active ? "border-primary ring-2 ring-primary/40" : "border-border",
        className
      )}
    >
      <span aria-hidden="true">A</span>
      <span className="sr-only">{label}</span>
    </button>
  )
}
