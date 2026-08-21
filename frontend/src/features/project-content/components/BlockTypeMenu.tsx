import type { Editor } from "@tiptap/react"
import { ChevronDownIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { HEADING_LEVELS } from "@/features/project-content/headingRendering"
import type { HeadingLevel } from "@/features/project-content/blockTypes"

/**
 * Gruppe 1 der Auswahlleiste: Text oder eine der sechs
 * Ueberschriftenebenen (Figma {@code SelectionToolbar/HeadingMenu}).
 *
 * <p><strong>Der Auslöser zeigt den Ist-Zustand</strong>, das Menue markiert
 * ihn zusaetzlich ueber {@code aria-checked}: nur im Auslöser stuende er
 * ausserhalb der Liste, und wer die Liste mit den Pfeiltasten durchgeht,
 * erfuehre nicht, wo er gerade steht.
 *
 * <p><strong>Die Beschriftungen heissen „Heading 1" bis „Heading 6"</strong>
 * und nicht „Ebene 2" bis „Ebene 7". Gespeichert wird die Gliederungsebene
 * des Beitrags, und die faengt bei 1 an; dass die Anzeige daraus ein
 * {@code h2} macht, ist eine Frage der Seite und keine, die eine Autor:in
 * beim Schreiben beantworten muss (Contract 2.5).
 */
export function BlockTypeMenu({
  editor,
  disabled,
}: {
  editor: Editor
  disabled: boolean
}) {
  const { t } = useTranslation()

  const level = HEADING_LEVELS.find((entry) =>
    editor.isActive("heading", { level: entry })
  )
  const current = level === undefined ? "paragraph" : String(level)

  const apply = (value: string) => {
    if (value === "paragraph") {
      editor.chain().focus().setParagraph().run()
      return
    }
    editor
      .chain()
      .focus()
      .setNode("heading", { level: Number(value) as HeadingLevel })
      .run()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-toolbar-item
        disabled={disabled}
        aria-label={t("projectContent.toolbar.blockType")}
        className="flex h-8 items-center gap-1 rounded-control px-2 text-sm outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
      >
        {level === undefined
          ? t("projectContent.toolbar.text")
          : t("projectContent.toolbar.heading", { level })}
        <ChevronDownIcon aria-hidden="true" className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto min-w-44">
        <DropdownMenuRadioGroup value={current} onValueChange={apply}>
          <DropdownMenuRadioItem value="paragraph">
            {t("projectContent.toolbar.text")}
          </DropdownMenuRadioItem>
          {HEADING_LEVELS.map((entry) => (
            <DropdownMenuRadioItem key={entry} value={String(entry)}>
              {t("projectContent.toolbar.heading", { level: entry })}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
