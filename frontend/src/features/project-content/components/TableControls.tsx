import { useEditorState, type Editor } from "@tiptap/react"
import { TableIcon } from "lucide-react"
import { useState } from "react"
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
 * <p><strong>Sie sitzt an der Tabelle, oben rechts in ihrer Ecke</strong>,
 * und erscheint beim Zeigen darauf; wo genau, entscheidet
 * {@code TableControlsLayer}. Sie stand einmal an einer festen Stelle ueber
 * der Schreibflaeche, aus Sorge vor dem Nachmessen bei jedem Zellenwechsel:
 * dort war sie von der Tabelle, auf die sie wirkt, beliebig weit entfernt.
 * Gemessen wird trotzdem nichts, die Bedienung haengt im Rahmen der Tabelle.
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
/**
 * Der Zustand bei geschlossenem Menue: nichts erlaubt, weil nichts gerechnet
 * wurde. Eine Konstante und kein neues Array je Lauf, sonst meldete die
 * Gleichheitspruefung bei jeder Transaktion eine Aenderung.
 */
const NOTHING_ALLOWED: readonly boolean[] = []

export function TableControls({
  editor,
  position,
  onOpen,
}: {
  editor: Editor
  /**
   * Die wievielte Tabelle des Beitrags dies ist, ab 1.
   *
   * <p>Sie steht im zugaenglichen Namen, nicht im sichtbaren Text: bei
   * mehreren Tabellen stuenden sonst mehrere Schaltflaechen namens „Tabelle"
   * im Beitrag, und in der Elementliste eines Screenreaders waere keine von
   * der anderen zu unterscheiden. Der sichtbare Text bleibt kurz und im
   * Namen enthalten (SC 2.5.3).
   */
  position?: number
  /**
   * Wird beim Oeffnen des Menues gerufen, bevor die Eintraege ihren Zustand
   * lesen. Die Ebene setzt darin die Textmarke in ihre eigene Tabelle: die
   * Vorgaenge wirken auf die Tabelle an der Textmarke, und beim Zeigen auf
   * eine andere traefe sonst jeder Klick die falsche.
   */
  onOpen?: () => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

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
   *
   * <p><strong>Gerechnet wird nur bei offenem Menue.</strong> Jeder Eintrag
   * kostet einen Trockenlauf seines Kommandos, dreizehn also dreizehn, und
   * seit dem Umzug an die Tabelle steht diese Komponente einmal je Tabelle
   * im Beitrag. Bei jedem Tastendruck alle Tabellen durchzurechnen waere
   * Arbeit fuer eine Anzeige, die niemand sieht; geoeffnet wird das Menue
   * nach einem Klick, und bis es erscheint, ist neu gerechnet.
   */
  const allowed = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      open && current.isEditable
        ? actions.map((action) => action.can())
        : NOTHING_ALLOWED,
    /* b ist beim ersten Lauf null: dann gibt es nichts zu vergleichen. */
    equalityFn: (a, b) =>
      b !== null && a.length === b.length && a.every((v, i) => v === b[i]),
  })

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        /* Zuerst die Textmarke, dann oeffnen: die Eintraege lesen ihren
           Zustand aus der Auswahl, und die soll dann schon stimmen. */
        if (next) {
          onOpen?.()
        }
        setOpen(next)
      }}
    >
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            /* Ohne Schreibrecht gibt es nichts zu tun; gelesen wird es am
               Editor selbst und nicht als Prop durchgereicht, denn genau
               dieselbe Zusage steuert schon die Eintraege. */
            disabled={!editor.isEditable}
            aria-label={
              position === undefined
                ? undefined
                : t("projectContent.table.controlsFor", { position })
            }
            /* Der Weg aus dem Text hierher; die Schreibflaeche faengt die
               Taste ab (EditorPage). Ein Maschinen-Token, kein Text. */
            aria-keyshortcuts="Alt+F8"
          />
        }
      >
        <TableIcon aria-hidden="true" />
        {t("projectContent.table.controls")}
      </DropdownMenuTrigger>
      {/* Nach innen ausgerichtet: der Ausloeser steht am rechten Rand der
          Tabelle, ein nach rechts geoeffnetes Menue liefe aus der Spalte. */}
      <DropdownMenuContent align="end" className="w-auto min-w-56">
        {actions.map((action, index) => (
          <div key={action.key}>
            {action.separated === true && <DropdownMenuSeparator />}
            <DropdownMenuItem
              disabled={allowed[index] !== true}
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
