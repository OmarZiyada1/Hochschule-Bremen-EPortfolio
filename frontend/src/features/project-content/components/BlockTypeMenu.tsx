import { useEditorState, type Editor } from "@tiptap/react"
import { ChevronDownIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToolbarItemProps } from "@/features/project-content/components/EditorToolbar"
import type { HeadingLevel } from "@/features/project-content/blockTypes"

/**
 * Gruppe 1 der Auswahlleiste: der Blocktyp des Absatzes, in dem die
 * Auswahl steht.
 *
 * <p>Das Menue fuehrt {@code Text} und {@code Heading 1} bis
 * {@code Heading 6}. Sechs Ebenen seit Contract v63; die frueher engere
 * Menge verhinderte keinen Ebenensprung, sondern nur die Gliederung
 * laengerer Beitraege.
 *
 * <p><strong>Der aktuelle Eintrag ist im Menue markiert</strong>
 * ({@code aria-checked}) und steht nicht nur im Auslöser. Sonst traegt die
 * Liste keinen erkennbaren Ist-Zustand: wer sie mit einem Screenreader
 * durchgeht, hoerte sieben gleichwertige Eintraege. Dafuer steht hier
 * {@code DropdownMenuRadioGroup} und nicht eine Reihe von
 * {@code DropdownMenuItem}.
 *
 * <p><strong>Der gespeicherte Wert ist die Gliederung, nicht das
 * Element</strong> (2.5): die Anzeige schiebt jede Ebene um eine Stufe nach
 * unten, weil der Projekttitel die einzige {@code h1} der Seite bleibt
 * (3.3). Diese Komponente rechnet daran nichts um; sie setzt genau die
 * Ebene, die im Dokument steht.
 */

const HEADING_LEVELS: readonly HeadingLevel[] = [1, 2, 3, 4, 5, 6]

/** Der Wert des Auswahlfeldes: entweder Fliesstext oder eine Ebene. */
type BlockTypeValue = "paragraph" | `heading-${HeadingLevel}`

function currentValue(editor: Editor): BlockTypeValue {
  for (const level of HEADING_LEVELS) {
    if (editor.isActive("heading", { level })) {
      return `heading-${level}`
    }
  }
  return "paragraph"
}

export function BlockTypeMenu({ editor }: { editor: Editor }) {
  const { t } = useTranslation()
  const itemProps = useToolbarItemProps("block-type")

  /*
   * Ueber useEditorState und nicht unmittelbar am Editor gelesen: ein
   * Aufruf waehrend des Renderns ist kein Abonnement. Die Leiste darum
   * beobachtet nur Marks, Listen und Zitat; eine Transaktion, die daran
   * nichts aendert, rendert dieses Menue sonst nicht neu, und es zeigte
   * weiter den Stand von vorher (Befund des Frontend-Reviews zu KAN-36).
   */
  const value =
    useEditorState({
      editor,
      selector: ({ editor: current }): BlockTypeValue =>
        current === null || current.isDestroyed
          ? "paragraph"
          : currentValue(current),
    }) ?? "paragraph"
  const label =
    value === "paragraph"
      ? t("projectContent.toolbar.blockType.paragraph")
      : t("projectContent.toolbar.blockType.heading", {
          level: Number(value.slice("heading-".length)),
        })

  const apply = (next: string) => {
    const chain = editor.chain().focus()
    if (next === "paragraph") {
      chain.setParagraph().run()
      return
    }
    const level = Number(next.slice("heading-".length)) as HeadingLevel
    chain.setHeading({ level }).run()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        {...itemProps}
        aria-label={t("projectContent.toolbar.blockType.label")}
        className="flex h-7 min-w-24 items-center justify-between gap-1 rounded-control px-2 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span>{label}</span>
        <ChevronDownIcon aria-hidden="true" className="size-3.5 shrink-0" />
      </DropdownMenuTrigger>
      {/* w-auto hebt die Breite des Auslösers auf: die Eintraege sind
          laenger als das Feld, und ein Menue in Auslöserbreite bricht sie
          um. */}
      <DropdownMenuContent className="w-auto min-w-44">
        <DropdownMenuRadioGroup value={value} onValueChange={apply}>
          <DropdownMenuRadioItem value="paragraph">
            {t("projectContent.toolbar.blockType.paragraph")}
          </DropdownMenuRadioItem>
          {/* Alle Eintraege in derselben Groesse, wie im Template gezeichnet.
              Die Ebenen in ihrer jeweiligen Inhaltsgroesse zu zeigen waere
              eine Vorschau, machte die Liste aber ueber einen halben
              Bildschirm hoch und die tiefen Ebenen kaum unterscheidbar. */}
          {HEADING_LEVELS.map((level) => (
            <DropdownMenuRadioItem key={level} value={`heading-${level}`}>
              {t("projectContent.toolbar.blockType.heading", { level })}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
