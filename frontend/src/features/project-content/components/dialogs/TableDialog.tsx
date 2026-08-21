import { zodResolver } from "@hookform/resolvers/zod"
import { useId } from "react"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"

import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  BlockDialogShell,
  useFieldMessage,
} from "@/features/project-content/components/dialogs/BlockDialogShell"

/**
 * TABLE: Zeilen- und Spaltenzahl, bevor die Tabelle entsteht
 * (Contract 2.5).
 *
 * <p><strong>Warum die Tabelle nicht direkt eingefuegt wird.</strong> Sie
 * hat zwar keine Pflichtattribute und koennte wie {@code CODE} und
 * {@code DIVIDER} unmittelbar entstehen. Eine Tabelle in fester
 * Vorgabegroesse trifft aber fast nie, und eine falsche Groesse
 * nachtraeglich zu berichtigen heisst, Zeile fuer Zeile einzufuegen oder zu
 * loeschen. Gefragt wird deshalb einmal am Anfang.
 *
 * <p>Die Kopfzeile ist ein Haekchen und keine Selbstverstaendlichkeit: eine
 * Tabelle ohne Kopfzeile gibt es, und Kopfzellen ohne Bedeutung waeren fuer
 * einen Screenreader eine falsche Zuordnung (SC 1.3.1).
 */

/**
 * Grenzen der Eingabe. Weder 2.5 noch der Server kennen eine Obergrenze;
 * sie steht hier als Bedienschranke: eine Tabelle mit fuenfzig Spalten ist
 * in einer Textspalte nicht lesbar, und wer sie wirklich braucht, fuegt
 * Spalten nach.
 */
const MIN_SIZE = 1
const MAX_ROWS = 50
const MAX_COLUMNS = 12

const tableDialogSchema = z.object({
  rows: z
    .number()
    .int()
    .min(MIN_SIZE, "validation.blockTable.outOfRange")
    .max(MAX_ROWS, "validation.blockTable.outOfRange"),
  columns: z
    .number()
    .int()
    .min(MIN_SIZE, "validation.blockTable.outOfRange")
    .max(MAX_COLUMNS, "validation.blockTable.outOfRange"),
  withHeaderRow: z.boolean(),
})

export type TableDialogValues = z.infer<typeof tableDialogSchema>

export function TableDialog({
  open,
  onOpenChange,
  onInsert,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onInsert: (values: TableDialogValues) => void
}) {
  const { t } = useTranslation()
  const messageOf = useFieldMessage()
  const ids = useId()

  const form = useForm<TableDialogValues>({
    resolver: zodResolver(tableDialogSchema),
    defaultValues: { rows: 3, columns: 3, withHeaderRow: true },
  })

  const submit = form.handleSubmit((values) => {
    onInsert(values)
    onOpenChange(false)
  })

  return (
    <BlockDialogShell
      open={open}
      onOpenChange={onOpenChange}
      titleKey="projectContent.dialogs.table.title"
      descriptionKey="projectContent.dialogs.table.description"
      onSubmit={submit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {(["rows", "columns"] as const).map((name) => (
          <Controller
            key={name}
            name={name}
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1.5">
                <FieldLabel
                  htmlFor={`${ids}-${name}`}
                  className="type-label-xs text-muted-foreground uppercase group-data-[invalid=true]/field:text-destructive"
                >
                  {t(`projectContent.dialogs.table.${name}`)}
                </FieldLabel>
                <Input
                  id={`${ids}-${name}`}
                  type="number"
                  inputMode="numeric"
                  min={MIN_SIZE}
                  max={name === "rows" ? MAX_ROWS : MAX_COLUMNS}
                  value={String(field.value)}
                  onChange={(event) =>
                    field.onChange(Number(event.target.value))
                  }
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && (
                  <FieldError
                    errors={[{ message: messageOf(fieldState.error) }]}
                  />
                )}
              </Field>
            )}
          />
        ))}
      </div>

      <Controller
        name="withHeaderRow"
        control={form.control}
        render={({ field }) => (
          <label className="type-body-sm flex items-center gap-2">
            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
            {t("projectContent.dialogs.table.withHeaderRow")}
          </label>
        )}
      />
    </BlockDialogShell>
  )
}
