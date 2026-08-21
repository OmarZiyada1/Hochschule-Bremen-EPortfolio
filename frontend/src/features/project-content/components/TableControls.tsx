import { useEditorState, type Editor } from "@tiptap/react"
import { BubbleMenu } from "@tiptap/react/menus"
import { TableIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/**
 * Die Tabellenbedienung: Zeilen und Spalten, Kopfzeile, Zellen verbinden
 * und teilen (Contract 2.5, Blocktyp TABLE).
 *
 * <p>Sie erscheint als eigene Blase, sobald der Cursor in einer Tabelle
 * steht, und verschwindet danach. Die Auswahlleiste bleibt daneben
 * zustaendig: eine Tabellenzelle traegt Absaetze und Listen und darf alle
 * Marks aus 2.5, also ist das Formatieren dort dasselbe wie im Fliesstext.
 *
 * <p><strong>{@code resizable: false} bleibt.</strong> Die Einstellung
 * steht in {@code blockSchema.ts}; mit {@code true} schriebe Tiptap
 * {@code colwidth} in jede Zelle, und ein Umschalten braeuchte danach eine
 * weitere Schemamigration nach 2.10. Deshalb gibt es hier keine
 * Spaltenbreite.
 *
 * <p><strong>Kopfzellen sind {@code th} mit {@code scope}</strong>, und das
 * ist keine Kosmetik: ohne die Zuordnung liest ein Screenreader eine
 * Tabelle als Folge zusammenhangloser Zellen (SC 1.3.1). Der Renderer setzt
 * {@code scope} aus der Stellung der Zelle; die Bedienung hier schaltet nur
 * um, welche Zeile beziehungsweise Spalte eine Kopfzeile ist.
 */
export function TableControls({ editor }: { editor: Editor }) {
  const { t } = useTranslation()

  const inTable = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      current !== null && !current.isDestroyed && current.isActive("table"),
  })

  const run = (action: (chain: ReturnType<Editor["chain"]>) => void) => () => {
    const chain = editor.chain().focus()
    action(chain)
  }

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="tableControls"
      shouldShow={({ editor: current }) =>
        current.isEditable && current.isActive("table")
      }
      options={{ placement: "top-start", offset: 8 }}
    >
      {inTable && (
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-control border border-border bg-popover px-2 py-1 text-sm font-medium shadow-md outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50">
            <TableIcon aria-hidden="true" className="size-3.5" />
            {t("projectContent.table.controls")}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-auto min-w-56">
            <DropdownMenuItem
              onClick={run((chain) => chain.addRowBefore().run())}
            >
              {t("projectContent.table.addRowBefore")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={run((chain) => chain.addRowAfter().run())}
            >
              {t("projectContent.table.addRowAfter")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={run((chain) => chain.deleteRow().run())}>
              {t("projectContent.table.deleteRow")}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={run((chain) => chain.addColumnBefore().run())}
            >
              {t("projectContent.table.addColumnBefore")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={run((chain) => chain.addColumnAfter().run())}
            >
              {t("projectContent.table.addColumnAfter")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={run((chain) => chain.deleteColumn().run())}
            >
              {t("projectContent.table.deleteColumn")}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={run((chain) => chain.toggleHeaderRow().run())}
            >
              {t("projectContent.table.toggleHeaderRow")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={run((chain) => chain.toggleHeaderColumn().run())}
            >
              {t("projectContent.table.toggleHeaderColumn")}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={run((chain) => chain.mergeCells().run())}
            >
              {t("projectContent.table.mergeCells")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={run((chain) => chain.splitCell().run())}
            >
              {t("projectContent.table.splitCell")}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              variant="destructive"
              onClick={run((chain) => chain.deleteTable().run())}
            >
              {t("projectContent.table.deleteTable")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </BubbleMenu>
  )
}
