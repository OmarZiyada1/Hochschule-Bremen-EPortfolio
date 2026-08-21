import { useEditorState, type Editor } from "@tiptap/react"
import { ChevronDownIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToolbarItemProps } from "@/features/project-content/components/EditorToolbar"
import {
  CONTENT_COLOR_ROLES,
  type ContentColorRole,
} from "@/features/project-content/contentColors"
import { cn } from "@/lib/utils"

/**
 * Gruppe 4 der Auswahlleiste: Textfarbe und Hintergrund.
 *
 * <p><strong>Entweder oder, nie beides.</strong> Wird eine Textfarbe
 * gesetzt, faellt die Hervorhebung weg, und umgekehrt. Der Grund steht in
 * {@code contentColors.ts}: die Schrift auf einer Hervorhebung bleibt
 * {@code --foreground}, und fuer eine Kombination aus beidem ist kein
 * Kontrast von 4,5:1 zugesichert (SC 1.4.3).
 *
 * <p><strong>„Standard" ist kein Farbwert, sondern das Fehlen des
 * Marks.</strong> Es bekommt deshalb bewusst kein Token und keine Rolle: es
 * gibt nichts zu setzen. Im Menue steht es als zehntes Feld je Gruppe und
 * entfernt die jeweilige Mark.
 *
 * <p>Gespeichert wird der Rollenname, nie ein Hex-Wert (2.5). Diese Datei
 * kennt keinen einzigen Farbwert; die Vorschaufelder greifen ueber die
 * Brueckenklassen aus {@code tokens.css} auf die Tokenschicht zu, hell und
 * dunkel getrennt aufgeloest.
 */

/** Der Wert des Auswahlfelds: eine Rolle oder ausdruecklich keine. */
const NONE = "none"

/**
 * Klassen je Rolle, vollstaendig ausgeschrieben.
 *
 * <p>Zusammengesetzte Klassennamen (`text-content-text-${role}`) findet der
 * Scanner von Tailwind nicht, und die Farbe fehlte im Produktionsbuendel,
 * ohne dass es im Entwicklungsbetrieb auffiele. Deshalb steht hier ein
 * {@code Record} ueber den Rollentyp: eine zehnte Rolle im Contract bricht
 * damit den Typecheck.
 */
const SWATCH_CLASSES: Record<
  ContentColorRole,
  { readonly text: string; readonly highlight: string }
> = {
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

function activeRole(editor: Editor, mark: "textStyle" | "highlight"): string {
  const color: unknown = editor.getAttributes(mark).color
  return typeof color === "string" ? color : NONE
}

export function ColorMenu({ editor }: { editor: Editor }) {
  const { t } = useTranslation()
  const itemProps = useToolbarItemProps("color")

  /*
   * Ueber useEditorState und nicht unmittelbar am Editor gelesen: ein
   * Aufruf waehrend des Renderns ist kein Abonnement. Die Leiste darum
   * beobachtet nur Marks, Listen und Zitat; eine Transaktion, die daran
   * nichts aendert, rendert dieses Menue sonst nicht neu, und es zeigte
   * weiter den Stand von vorher (Befund des Frontend-Reviews zu KAN-36).
   */
  const roles = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      current === null || current.isDestroyed
        ? { text: NONE, highlight: NONE }
        : {
            text: activeRole(current, "textStyle"),
            highlight: activeRole(current, "highlight"),
          },
  }) ?? { text: NONE, highlight: NONE }

  const textRole = roles.text
  const highlightRole = roles.highlight

  /**
   * Textfarbe setzen und die Hervorhebung entfernen, oder beides loesen.
   *
   * <p><strong>Ueber {@code setMark} und nicht ueber {@code setColor}.</strong>
   * Der Befehl {@code setColor} gehoert zu {@code @tiptap/extension-color},
   * und das Paket ist bewusst nicht im Schema: sein Attribut schriebe
   * {@code style="color: #rrggbb"} und damit eine Farbe ausserhalb der
   * Tokenschicht (Frontend-Regel 5, Begruendung in {@code blockSchema.ts}).
   * Gesetzt wird deshalb das Attribut {@code color} des Marks
   * {@code textStyle} unmittelbar, und sein Wert ist ein Rollenname.
   */
  const applyText = (value: string) => {
    const chain = editor.chain().focus().unsetHighlight()
    if (value === NONE) {
      chain.unsetMark("textStyle").run()
      return
    }
    chain.setMark("textStyle", { color: value }).run()
  }

  /** Umgekehrt, und aus demselben Grund ueber {@code unsetMark}. */
  const applyHighlight = (value: string) => {
    const chain = editor.chain().focus().unsetMark("textStyle")
    if (value === NONE) {
      chain.unsetHighlight().run()
      return
    }
    chain.setHighlight({ color: value }).run()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        {...itemProps}
        aria-label={t("projectContent.toolbar.color.label")}
        className="flex h-7 items-center gap-0.5 rounded-control px-1 outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span
          aria-hidden="true"
          className={cn(
            "flex size-5 items-center justify-center rounded-full border border-border text-sm font-semibold",
            textRole !== NONE &&
              SWATCH_CLASSES[textRole as ContentColorRole].text,
            highlightRole !== NONE &&
              SWATCH_CLASSES[highlightRole as ContentColorRole].highlight
          )}
        >
          A
        </span>
        <ChevronDownIcon aria-hidden="true" className="size-3.5 shrink-0" />
      </DropdownMenuTrigger>
      {/*
       * Die Beschriftung steht <em>innerhalb</em> ihrer Gruppe und nicht
       * daneben: Base UI verlangt fuer die Verknuepfung von Gruppe und Name
       * den Kontext der Gruppe, und ausserhalb bricht sie zur Laufzeit ab.
       * Das Raster liegt deshalb eine Ebene tiefer, in einem eigenen div.
       */}
      <DropdownMenuContent className="w-auto min-w-0 p-2">
        <DropdownMenuRadioGroup value={textRole} onValueChange={applyText}>
          <DropdownMenuLabel className="type-overline px-0 pb-1 text-muted-foreground">
            {t("projectContent.toolbar.color.textGroup")}
          </DropdownMenuLabel>
          <div className="grid grid-cols-5 gap-1">
            <Swatch
              value={NONE}
              label={t("projectContent.toolbar.color.none")}
            />
            {CONTENT_COLOR_ROLES.map((role) => (
              <Swatch
                key={role}
                value={role}
                label={t(`projectContent.toolbar.color.role.${role}`)}
                className={SWATCH_CLASSES[role].text}
              />
            ))}
          </div>
        </DropdownMenuRadioGroup>

        <DropdownMenuRadioGroup
          value={highlightRole}
          onValueChange={applyHighlight}
        >
          <DropdownMenuLabel className="type-overline px-0 pt-3 pb-1 text-muted-foreground">
            {t("projectContent.toolbar.color.highlightGroup")}
          </DropdownMenuLabel>
          <div className="grid grid-cols-5 gap-1">
            <Swatch
              value={NONE}
              label={t("projectContent.toolbar.color.none")}
            />
            {CONTENT_COLOR_ROLES.map((role) => (
              <Swatch
                key={role}
                value={role}
                label={t(`projectContent.toolbar.color.role.${role}`)}
                className={SWATCH_CLASSES[role].highlight}
              />
            ))}
          </div>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Ein Feld des Rasters. Das {@code A} ist die Vorschau und wird nicht
 * vorgelesen; der Name der Rolle steht als {@code sr-only}-Text daneben,
 * damit die Auswahl ohne Farbwahrnehmung bedienbar bleibt (SC 1.4.1).
 *
 * <p>{@code pr-8} und die Hakenanzeige der Primitive passen zu einer
 * Listenzeile und nicht zu einem Raster: hier haelt {@code aria-checked}
 * den Zustand fuer die Bedienung, sichtbar macht ihn der Ring.
 */
function Swatch({
  value,
  label,
  className,
}: {
  value: string
  label: string
  className?: string
}) {
  return (
    <DropdownMenuRadioItem
      value={value}
      className={cn(
        "flex size-8 items-center justify-center rounded-full border border-border p-0 pr-0 text-sm font-semibold data-checked:ring-2 data-checked:ring-ring data-checked:ring-offset-2 data-checked:ring-offset-popover **:data-[slot=dropdown-menu-radio-item-indicator]:hidden",
        className
      )}
    >
      <span aria-hidden="true">A</span>
      <span className="sr-only">{label}</span>
    </DropdownMenuRadioItem>
  )
}
