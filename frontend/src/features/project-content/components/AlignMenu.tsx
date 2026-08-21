import type { Editor } from "@tiptap/react"
import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignLeftIcon,
  AlignRightIcon,
  type LucideIcon,
} from "lucide-react"
import { useTranslation } from "react-i18next"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { ContentTextAlign } from "@/features/project-content/blockTypes"

const ALIGNMENTS: readonly { value: ContentTextAlign; icon: LucideIcon }[] = [
  { value: "left", icon: AlignLeftIcon },
  { value: "center", icon: AlignCenterIcon },
  { value: "right", icon: AlignRightIcon },
  { value: "justify", icon: AlignJustifyIcon },
]

/**
 * Das Ausrichtungsmenue der Auswahlleiste (Figma
 * {@code SelectionToolbar/AlignMenu}).
 *
 * <p><strong>Hier steht ein {@code toggle-group} und nicht wie in der
 * Leiste einzelne {@code toggle}.</strong> Die Leiste fuehrt ihren
 * Roving-Tabindex selbst, damit sie <em>einen</em> Tabstopp hat; dieses
 * Menue dagegen ist ein eigener Fokusbereich, den man betritt und wieder
 * verlaesst, und genau dafuer bringt die Primitive ihren eigenen
 * Roving-Tabindex mit.
 *
 * <p><strong>Blocksatz an einer Ueberschrift ist deaktiviert, nicht
 * versteckt</strong> (Contract 2.5 seit v63). Eine verschwindende
 * Schaltflaeche aenderte Breite und Reihenfolge der Gruppe, und die Person
 * suchte anschliessend ein Feld, das eben noch da war (SC 3.2.4). Der
 * Tooltip nennt den Grund.
 *
 * <p>Gemeldet wird {@code aria-disabled} und nicht {@code disabled}: so
 * bleibt die Schaltflaeche anfokussierbar und ihre Begruendung erreichbar.
 * Das Ausfuehren faengt der Klick-Handler ab, und der Server weist ein
 * {@code justify} am {@code HEADING} ohnehin mit 400 zurueck.
 */
export function AlignMenu({
  editor,
  disabled,
}: {
  editor: Editor
  disabled: boolean
}) {
  const { t } = useTranslation()
  const isHeading = editor.isActive("heading")

  const current =
    ALIGNMENTS.find((entry) => editor.isActive({ textAlign: entry.value }))
      ?.value ?? "left"

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              data-toolbar-item
              disabled={disabled}
              className="flex size-8 items-center justify-center rounded-control outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
            />
          }
        >
          <AlignLeftIcon aria-hidden="true" className="size-4" />
          <span className="sr-only">
            {t("projectContent.toolbar.align.label")}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {t("projectContent.toolbar.align.label")}
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-auto p-1">
        <ToggleGroup
          value={[current]}
          aria-label={t("projectContent.toolbar.align.label")}
          onValueChange={(values) => {
            const next = values[0]
            if (next === undefined) {
              return
            }
            editor.chain().focus().setTextAlign(next).run()
          }}
        >
          {ALIGNMENTS.map(({ value, icon: Icon }) => {
            const blocked = value === "justify" && isHeading
            return (
              <Tooltip key={value}>
                <TooltipTrigger
                  render={
                    <ToggleGroupItem
                      value={value}
                      aria-disabled={blocked}
                      className={blocked ? "opacity-50" : undefined}
                      onClick={(event) => {
                        if (blocked) {
                          event.preventDefault()
                        }
                      }}
                    />
                  }
                >
                  <Icon aria-hidden="true" />
                  <span className="sr-only">
                    {t(`projectContent.toolbar.align.${value}`)}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {blocked
                    ? t("projectContent.toolbar.align.justifyBlocked")
                    : t(`projectContent.toolbar.align.${value}`)}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </ToggleGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
