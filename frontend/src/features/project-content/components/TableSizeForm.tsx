import { useId, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  DEFAULT_TABLE_SIZE,
  TABLE_MAX,
  TABLE_MIN,
  type TableSize,
} from "@/features/project-content/blockInsert"

/**
 * Die Groesse einer neuen Tabelle, bevor sie entsteht.
 *
 * <p><strong>Warum ein Formular und kein Raster zum Ueberfahren.</strong>
 * Das bekannte Raster, in dem man mit der Maus ueber Zellen faehrt, ist ein
 * reiner Zeigerweg: es braucht daneben eine zweite Bedienung fuer die
 * Tastatur (SC 2.1.1), und die waere genau dieses Formular. Zwei
 * Bedienungen fuer dieselbe Angabe sind eine zu viel. Zwei Zahlenfelder und
 * ein Kaestchen sind mit Zeiger, Tastatur und Sprache gleich gut zu
 * bedienen und sagen die Groesse ausserdem vor, statt sie nur zu zeigen.
 *
 * <p><strong>Die Kopfzeile zaehlt als Zeile.</strong> „Drei Zeilen mit
 * Kopfzeile" ergibt eine Kopfzeile und zwei Inhaltszeilen; das steht als
 * Beschreibung unter dem Kaestchen, damit niemand nachzaehlen muss.
 *
 * <p>Alles Weitere gehoert nicht hierher, sondern in die Tabellenbedienung:
 * Zeilen und Spalten spaeter einfuegen und loeschen, Kopfzeile und
 * Kopfspalte umschalten, Zellen verbinden und teilen.
 */
export function TableSizeForm({
  onInsert,
  onCancel,
}: {
  onInsert: (size: TableSize) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const fieldId = useId()
  const [size, setSize] = useState<TableSize>(DEFAULT_TABLE_SIZE)

  /* Als Text gefuehrt und erst beim Absenden gerundet: waehrend des Tippens
     ist das Feld kurz leer, und eine sofortige Umrechnung auf die
     Untergrenze schriebe der Person eine 1 in das Feld, das sie gerade
     leert. */
  const [rows, setRows] = useState(String(DEFAULT_TABLE_SIZE.rows))
  const [cols, setCols] = useState(String(DEFAULT_TABLE_SIZE.cols))

  const clamped = (value: string, fallback: number): number => {
    const parsed = Number.parseInt(value, 10)
    if (Number.isNaN(parsed)) {
      return fallback
    }
    return Math.min(TABLE_MAX, Math.max(TABLE_MIN, parsed))
  }

  return (
    <form
      className="flex w-64 flex-col gap-3 p-1"
      onSubmit={(event) => {
        event.preventDefault()
        onInsert({
          rows: clamped(rows, DEFAULT_TABLE_SIZE.rows),
          cols: clamped(cols, DEFAULT_TABLE_SIZE.cols),
          withHeaderRow: size.withHeaderRow,
        })
      }}
    >
      <p className="type-body-sm font-semibold">
        {t("projectContent.table.size.title")}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor={`${fieldId}-rows`}>
            {t("projectContent.table.size.rows")}
          </FieldLabel>
          <Input
            id={`${fieldId}-rows`}
            type="number"
            inputMode="numeric"
            min={TABLE_MIN}
            max={TABLE_MAX}
            autoFocus
            value={rows}
            onChange={(event) => setRows(event.target.value)}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor={`${fieldId}-cols`}>
            {t("projectContent.table.size.cols")}
          </FieldLabel>
          <Input
            id={`${fieldId}-cols`}
            type="number"
            inputMode="numeric"
            min={TABLE_MIN}
            max={TABLE_MAX}
            value={cols}
            onChange={(event) => setCols(event.target.value)}
          />
        </Field>
      </div>

      <Field orientation="horizontal">
        <Checkbox
          id={`${fieldId}-header`}
          checked={size.withHeaderRow}
          onCheckedChange={(checked) =>
            setSize((current) => ({ ...current, withHeaderRow: checked }))
          }
        />
        <FieldLabel htmlFor={`${fieldId}-header`} className="font-normal">
          {t("projectContent.table.size.headerRow")}
        </FieldLabel>
      </Field>
      <FieldDescription>
        {t("projectContent.table.size.headerRowHint")}
      </FieldDescription>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t("projectContent.table.size.back")}
        </Button>
        <Button type="submit" size="sm">
          {t("projectContent.table.size.insert")}
        </Button>
      </div>
    </form>
  )
}
