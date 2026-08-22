import { useEditorState, type Editor } from "@tiptap/react"
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
 * <p>Es ist ein Menue und keine Leiste: dreizehn Vorgaenge nebeneinander
 * als Symbole waeren dreizehn Symbole, die niemand auseinanderhaelt. Im
 * Menue steht neben jedem Eintrag, was er tut.
 *
 * <p><strong>Sie fuehrt alles, was die Tabellen-Erweiterung kann</strong>
 * und was das Schema zulaesst: Zeilen und Spalten einfuegen und loeschen,
 * Kopfzeile, Kopfspalte und einzelne Kopfzelle umschalten, Zellen
 * verbinden, teilen und umschalten, Tabelle loeschen. Nicht hier stehen
 * {@code goToNextCell} und {@code goToPreviousCell}, die die Erweiterung
 * bereits auf Tab und Umschalt+Tab legt, {@code fixTables}, das eine
 * Reparatur und keine Handlung ist, und {@code setCellAttribute}: die
 * einzigen Zellattribute des Schemas sind {@code colspan} und
 * {@code rowspan}, und die setzen Verbinden und Teilen. Die Ausrichtung
 * innerhalb einer Zelle steht am Absatz und damit in der Auswahlleiste.
 *
 * <p><strong>Was gerade nicht geht, ist gesperrt und nicht
 * versteckt.</strong> „Zelle teilen" an einer einfachen Zelle oder
 * „Zellen verbinden" ohne Mehrfachauswahl waere sonst ein Eintrag, der
 * beim Klick nichts tut; ein verschwindender Eintrag wiederum aenderte bei
 * jedem Zellenwechsel die Laenge des Menues (SC 3.2.4).
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
    run: () => boolean
    can: () => boolean
    separated?: boolean
  }[] = [
    {
      key: "addRowBefore",
      run: () => editor.chain().focus().addRowBefore().run(),
      can: () => editor.can().addRowBefore(),
    },
    {
      key: "addRowAfter",
      run: () => editor.chain().focus().addRowAfter().run(),
      can: () => editor.can().addRowAfter(),
    },
    {
      key: "deleteRow",
      run: () => editor.chain().focus().deleteRow().run(),
      can: () => editor.can().deleteRow(),
    },
    {
      key: "addColumnBefore",
      run: () => editor.chain().focus().addColumnBefore().run(),
      can: () => editor.can().addColumnBefore(),
      separated: true,
    },
    {
      key: "addColumnAfter",
      run: () => editor.chain().focus().addColumnAfter().run(),
      can: () => editor.can().addColumnAfter(),
    },
    {
      key: "deleteColumn",
      run: () => editor.chain().focus().deleteColumn().run(),
      can: () => editor.can().deleteColumn(),
    },
    {
      key: "toggleHeaderRow",
      run: () => editor.chain().focus().toggleHeaderRow().run(),
      can: () => editor.can().toggleHeaderRow(),
      separated: true,
    },
    {
      key: "toggleHeaderColumn",
      run: () => editor.chain().focus().toggleHeaderColumn().run(),
      can: () => editor.can().toggleHeaderColumn(),
    },
    {
      key: "toggleHeaderCell",
      run: () => editor.chain().focus().toggleHeaderCell().run(),
      can: () => editor.can().toggleHeaderCell(),
    },
    {
      key: "mergeCells",
      run: () => editor.chain().focus().mergeCells().run(),
      can: () => editor.can().mergeCells(),
      separated: true,
    },
    {
      key: "splitCell",
      run: () => editor.chain().focus().splitCell().run(),
      can: () => editor.can().splitCell(),
    },
    {
      key: "mergeOrSplit",
      run: () => editor.chain().focus().mergeOrSplit().run(),
      can: () => editor.can().mergeOrSplit(),
    },
    {
      key: "deleteTable",
      run: () => editor.chain().focus().deleteTable().run(),
      can: () => editor.can().deleteTable(),
      separated: true,
    },
  ]

  /*
   * Ueber useEditorState und nicht beim Rendern gelesen: seit Tiptap v3
   * rendert eine Transaktion die Seite nicht mehr neu, und can() beim
   * Rendern zeigte sonst den Stand von vor dem letzten Zellenwechsel
   * (dieselbe Regel wie in Kopfzeile und Auswahlleiste).
   */
  const allowed = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      actions.map((action) => (current.isEditable ? action.can() : false)),
    /* b ist beim ersten Lauf null: dann gibt es nichts zu vergleichen. */
    equalityFn: (a, b) =>
      b !== null && a.length === b.length && a.every((v, i) => v === b[i]),
  })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="sm" disabled={disabled} />}
      >
        <TableIcon aria-hidden="true" />
        {t("projectContent.table.controls")}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto min-w-56">
        {actions.map((action, position) => (
          <div key={action.key}>
            {action.separated === true && <DropdownMenuSeparator />}
            <DropdownMenuItem
              disabled={disabled || allowed[position] !== true}
              onClick={() => action.run()}
            >
              {t(`projectContent.table.action.${action.key}`)}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
