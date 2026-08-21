import type { Editor } from "@tiptap/react"
import { TableIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/**
 * Die Tabellenbedienung (Contract 2.5).
 *
 * <p><strong>Sie erscheint nur, wenn der Cursor in einer Tabelle
 * steht</strong>, und dann an einer festen Stelle ueber der Schreibflaeche.
 * Eine Bedienung, die an der Tabelle klebt, muesste bei jedem
 * Zellenwechsel neu vermessen werden und stuende bei einer breiten Tabelle
 * ausserhalb des Sichtfelds.
 *
 * <p>Es ist ein Menue und keine Leiste: zehn Vorgaenge nebeneinander als
 * Symbole waeren zehn Symbole, die niemand auseinanderhaelt. Im Menue steht
 * neben jedem Eintrag, was er tut.
 *
 * <p>Kopfzellen sind {@code th} mit {@code scope}, {@code colspan} und
 * {@code rowspan} laufen unveraendert durch das Schema. Die Groesse der
 * Spalten wird nicht gespeichert ({@code resizable: false}), sonst schriebe
 * Tiptap {@code colwidth} in jede Zelle, und das braeuchte eine weitere
 * Schemaversion.
 */
export function TableControls({
  editor,
  disabled,
}: {
  editor: Editor
  disabled: boolean
}) {
  const { t } = useTranslation()

  const actions: readonly {
    key: string
    run: () => void
    separated?: boolean
  }[] = [
    {
      key: "addRowBefore",
      run: () => editor.chain().focus().addRowBefore().run(),
    },
    {
      key: "addRowAfter",
      run: () => editor.chain().focus().addRowAfter().run(),
    },
    { key: "deleteRow", run: () => editor.chain().focus().deleteRow().run() },
    {
      key: "addColumnBefore",
      run: () => editor.chain().focus().addColumnBefore().run(),
      separated: true,
    },
    {
      key: "addColumnAfter",
      run: () => editor.chain().focus().addColumnAfter().run(),
    },
    {
      key: "deleteColumn",
      run: () => editor.chain().focus().deleteColumn().run(),
    },
    {
      key: "toggleHeaderRow",
      run: () => editor.chain().focus().toggleHeaderRow().run(),
      separated: true,
    },
    {
      key: "mergeCells",
      run: () => editor.chain().focus().mergeCells().run(),
    },
    { key: "splitCell", run: () => editor.chain().focus().splitCell().run() },
    {
      key: "deleteTable",
      run: () => editor.chain().focus().deleteTable().run(),
      separated: true,
    },
  ]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="sm" disabled={disabled} />}
      >
        <TableIcon aria-hidden="true" />
        {t("projectContent.table.controls")}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto min-w-56">
        {actions.map((action) => (
          <div key={action.key}>
            {action.separated === true && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={action.run}>
              {t(`projectContent.table.action.${action.key}`)}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
