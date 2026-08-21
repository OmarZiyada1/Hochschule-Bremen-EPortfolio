import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import {
  formulaDialogSchema,
  type FormulaDialogValues,
} from "@/features/project-content/blockDialogs.schema"
import type { MathBlockNode } from "@/features/project-content/blockTypes"
import { LazyMathBlock } from "@/features/project-content/renderer/LazyMathBlock"
import {
  BlockDialogShell,
  useFieldMessage,
} from "@/features/project-content/components/dialogs/BlockDialogShell"

/**
 * FORMULA: eine Formel in KaTeX-Schreibweise (Contract 2.5).
 *
 * <p><strong>Rendern auf Knopfdruck, nicht bei jedem Zeichen.</strong> Eine
 * halb getippte Formel ist fast immer fehlerhaft, und eine Fehlermeldung,
 * die bei jedem Anschlag aufblitzt, ist keine Rueckmeldung, sondern
 * Flackern. Die Vorschau entsteht deshalb erst auf „Rendern" (so auch im
 * Template gezeichnet), und ein Fehler in der Schreibweise erscheint sofort
 * und an Ort und Stelle.
 *
 * <p>Gerendert wird ueber {@code LazyMathBlock}, also ueber denselben Weg
 * wie die Detailseite und die Vorschau. KaTeX kommt dynamisch nach; ein
 * zweiter Formelsatz im Editor waere ein zweites Aussehen derselben Formel.
 */
export function FormulaDialog({
  open,
  onOpenChange,
  onInsert,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onInsert: (node: MathBlockNode) => void
}) {
  const { t } = useTranslation()
  const messageOf = useFieldMessage()
  const [preview, setPreview] = useState<string | null>(null)

  const form = useForm<FormulaDialogValues>({
    resolver: zodResolver(formulaDialogSchema),
    defaultValues: { latex: "" },
  })

  const submit = form.handleSubmit((values) => {
    onInsert({ type: "mathBlock", attrs: { latex: values.latex } })
    onOpenChange(false)
  })

  return (
    <BlockDialogShell
      open={open}
      onOpenChange={onOpenChange}
      titleKey="projectContent.dialogs.formula.title"
      descriptionKey="projectContent.dialogs.formula.description"
      onSubmit={submit}
    >
      <Controller
        name="latex"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid} className="gap-1.5">
            <FieldLabel
              htmlFor={field.name}
              className="type-label-xs text-muted-foreground uppercase group-data-[invalid=true]/field:text-destructive"
            >
              {t("projectContent.dialogs.formula.latex")}
            </FieldLabel>
            <Textarea
              {...field}
              id={field.name}
              rows={3}
              spellCheck={false}
              className="font-mono"
              aria-invalid={fieldState.invalid}
              aria-describedby="formula-latex-hint"
            />
            <FieldDescription id="formula-latex-hint">
              {t("projectContent.dialogs.formula.latexHint")}
            </FieldDescription>
            {fieldState.invalid && (
              <FieldError errors={[{ message: messageOf(fieldState.error) }]} />
            )}
          </Field>
        )}
      />

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setPreview(form.getValues("latex"))}
        >
          {t("projectContent.dialogs.formula.render")}
        </Button>
      </div>

      {preview !== null && preview.trim() !== "" && (
        <div className="project-content rounded-card border border-border p-3">
          <LazyMathBlock latex={preview} />
        </div>
      )}
    </BlockDialogShell>
  )
}
