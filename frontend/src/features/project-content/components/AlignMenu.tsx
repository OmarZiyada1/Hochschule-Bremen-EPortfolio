import { useEditorState, type Editor } from "@tiptap/react"
import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignLeftIcon,
  AlignRightIcon,
} from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useToolbarItemProps } from "@/features/project-content/components/EditorToolbar"
import type { ContentTextAlign } from "@/features/project-content/blockTypes"

/**
 * Die Ausrichtung, als Untermenue der dritten Gruppe.
 *
 * <p><strong>Vier Werte am Absatz, drei an der Ueberschrift</strong>
 * (Contract 2.5 seit v63). Der Blocksatz erscheint bei markierter
 * Ueberschrift <strong>deaktiviert</strong> und nicht versteckt: eine
 * verschwindende Schaltflaeche aenderte Breite und Reihenfolge der Gruppe,
 * und die Person sucht anschliessend ein Feld, das eben noch da war
 * (SC 3.2.4). Gemeldet wird {@code aria-disabled} und nicht
 * {@code disabled}, damit sie anfokussierbar und damit erklaerbar bleibt.
 *
 * <p><strong>Hier steht ein {@code toggle-group}, in der Leiste
 * nicht.</strong> Der Unterschied ist Absicht: das Menue ist ein eigener
 * Fokusbereich, in dem die Pfeiltasten zwischen genau diesen vier
 * Schaltflaechen wechseln sollen. Genau das leistet der Roving-Tabindex der
 * Primitive. In der Leiste selbst laeuft der Fokus dagegen ueber
 * Gruppengrenzen hinweg, weshalb sie ihn selbst fuehrt
 * ({@code EditorToolbar}).
 */

const ALIGNMENTS: readonly {
  value: ContentTextAlign
  icon: ReactNode
}[] = [
  { value: "left", icon: <AlignLeftIcon aria-hidden="true" /> },
  { value: "center", icon: <AlignCenterIcon aria-hidden="true" /> },
  { value: "right", icon: <AlignRightIcon aria-hidden="true" /> },
  { value: "justify", icon: <AlignJustifyIcon aria-hidden="true" /> },
]

function activeAlignment(editor: Editor): ContentTextAlign | null {
  for (const { value } of ALIGNMENTS) {
    if (editor.isActive({ textAlign: value })) {
      return value
    }
  }
  return null
}

/**
 * Ob die Auswahl <strong>irgendeine</strong> Ueberschrift beruehrt.
 *
 * <p><strong>Nicht {@code editor.isActive("heading")}.</strong> Der meldet
 * nur dann {@code true}, wenn die gesamte Auswahl in einer Ueberschrift
 * liegt. Bei Strg+A oder einer Auswahl ueber Absatz und Ueberschrift hinweg
 * meldet er {@code false}, der Blocksatz waere anklickbar, und
 * {@code setTextAlign} schriebe {@code justify} in jeden Ueberschriftknoten
 * der Auswahl: der Server weist das seit Contract v63 mit 400
 * {@code BLOCK_CONTENT_INVALID} ab, und weil der PUT die ganze Blockliste
 * ersetzt, scheiterte danach <em>jeder</em> weitere Autosave des Projekts,
 * bis jemand den Blocksatz von Hand zuruecknimmt.
 */
function touchesHeading(editor: Editor): boolean {
  const { from, to } = editor.state.selection
  let found = false
  editor.state.doc.nodesBetween(from, to, (node) => {
    if (node.type.name === "heading") {
      found = true
    }
    return !found
  })
  return found
}

export function AlignMenu({ editor }: { editor: Editor }) {
  const { t } = useTranslation()
  const itemProps = useToolbarItemProps("align")

  /*
   * Ueber useEditorState und nicht unmittelbar am Editor gelesen: ein
   * Aufruf waehrend des Renderns ist kein Abonnement. Die Leiste darum
   * beobachtet nur Marks, Listen und Zitat; eine Transaktion, die daran
   * nichts aendert, rendert dieses Menue sonst nicht neu, und es zeigte
   * weiter den Stand von vorher (Befund des Frontend-Reviews zu KAN-36).
   */
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      current === null || current.isDestroyed
        ? { headingSelected: false, alignment: null }
        : {
            /*
             * touchesHeading und nicht isActive: bei einer Auswahl ueber
             * mehrere Bloecke meldet isActive false, sobald nicht die ganze
             * Auswahl in der Ueberschrift liegt. Der Blocksatz waere dann
             * anklickbar und schriebe justify in jede Ueberschrift der
             * Auswahl, was der Server seit v63 mit 400 abweist.
             */
            headingSelected: touchesHeading(current),
            alignment: activeAlignment(current),
          },
  }) ?? { headingSelected: false, alignment: null }

  const headingSelected = state.headingSelected
  const current = state.alignment
  const currentIcon =
    ALIGNMENTS.find((entry) => entry.value === current)?.icon ??
    ALIGNMENTS[0].icon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        {...itemProps}
        aria-label={t("projectContent.toolbar.align.label")}
        className="flex size-7 items-center justify-center rounded-control outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:size-3.5"
      >
        {currentIcon}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-auto min-w-0 p-1">
        <ToggleGroup
          aria-label={t("projectContent.toolbar.align.label")}
          value={current === null ? [] : [current]}
          onValueChange={(next) => {
            const value = next[0] as ContentTextAlign | undefined
            if (value === undefined) {
              editor.chain().focus().unsetTextAlign().run()
              return
            }
            if (value === "justify" && headingSelected) {
              return
            }
            editor.chain().focus().setTextAlign(value).run()
          }}
        >
          {ALIGNMENTS.map(({ value, icon }) => {
            const blocked = value === "justify" && headingSelected
            return (
              <ToggleGroupItem
                key={value}
                value={value}
                size="sm"
                aria-disabled={blocked || undefined}
                aria-describedby={
                  blocked ? "align-justify-heading-hint" : undefined
                }
              >
                {icon}
                <span className="sr-only">
                  {t(`projectContent.toolbar.align.${value}`)}
                </span>
              </ToggleGroupItem>
            )
          })}
        </ToggleGroup>
        {/*
         * Der Grund fuer die Sperre steht am Element und nicht nur im
         * Tooltip: ein deaktivierter Knopf ohne Erklaerung ist eine
         * Sackgasse. Sichtbar erscheint der Satz nur, wenn er zutrifft.
         */}
        {headingSelected && (
          <p
            id="align-justify-heading-hint"
            className="type-caption max-w-56 px-1.5 pt-1 text-muted-foreground"
          >
            {t("projectContent.toolbar.align.justifyBlockedOnHeading")}
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
