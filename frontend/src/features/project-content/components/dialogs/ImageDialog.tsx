import { zodResolver } from "@hookform/resolvers/zod"
import { useId, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type { StoredFileResponse } from "@/api/types"
import { Field, FieldLabel } from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  imageDialogSchema,
  IMAGE_WIDTH_VALUES,
  type ImageDialogValues,
} from "@/features/project-content/blockDialogs.schema"
import type {
  ImageBlockNode,
  ImageWidth,
} from "@/features/project-content/blockTypes"
import { FileUploadField } from "@/features/project-content/components/FileUploadField"
import {
  AltField,
  BlockDialogShell,
  CaptionField,
  useFieldMessage,
} from "@/features/project-content/components/dialogs/BlockDialogShell"

/**
 * IMAGE: ein einzelnes Bild (Contract 2.5).
 *
 * <p>Pflicht ist die {@code fileId}; {@code alt}, {@code caption} und
 * {@code width} sind freiwillig, wobei {@code alt} nur mit der
 * ausdruecklichen Angabe „schmueckend" leer bleiben darf (SC 1.1.1).
 *
 * <p><strong>Die Breite ist ein {@code radio-group} und kein Schieber.</strong>
 * 2.5 kennt genau drei Stufen, serverseitig gegen dieselbe Menge geprueft;
 * eine freie Prozentzahl loeste das Erscheinungsbild der Beitraege
 * untereinander auf und haette im Designsystem keine Entsprechung.
 */
export function ImageDialog({
  projectId,
  open,
  onOpenChange,
  onInsert,
}: {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onInsert: (node: ImageBlockNode) => void
}) {
  const { t } = useTranslation()
  const messageOf = useFieldMessage()
  const ids = useId()
  const [file, setFile] = useState<StoredFileResponse | null>(null)

  const form = useForm<ImageDialogValues>({
    resolver: zodResolver(imageDialogSchema),
    defaultValues: {
      fileId: "",
      alt: "",
      decorative: false,
      caption: "",
      width: "100",
    },
  })

  /* useWatch statt form.watch: dieselbe Beobachtung, aber vertraeglich mit
     dem React Compiler (Muster aus KAN-33 und KAN-34). */
  const decorative = useWatch({ control: form.control, name: "decorative" })

  const submit = form.handleSubmit((values) => {
    onInsert({
      type: "imageBlock",
      attrs: {
        fileId: values.fileId,
        /* Das Haekchen „schmueckend" schreibt die leere Zeichenkette, also
           die ausdrueckliche Aussage aus 2.5, und nicht den Text, der im
           gesperrten Feld stehen geblieben ist. */
        alt: values.decorative ? "" : values.alt.trim(),
        caption: values.caption,
        width: Number(values.width) as ImageWidth,
      },
    })
    onOpenChange(false)
  })

  return (
    <BlockDialogShell
      open={open}
      onOpenChange={onOpenChange}
      titleKey="projectContent.dialogs.image.title"
      descriptionKey="projectContent.dialogs.image.description"
      onSubmit={submit}
    >
      <Controller
        name="fileId"
        control={form.control}
        render={({ fieldState }) => (
          <Field data-invalid={fieldState.invalid} className="gap-1.5">
            <FileUploadField
              projectId={projectId}
              accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
              label={t("projectContent.dialogs.image.file")}
              hint={t("projectContent.dialogs.image.fileHint")}
              value={file}
              onUploaded={(stored) => {
                setFile(stored)
                form.setValue("fileId", stored.id, { shouldValidate: true })
              }}
              onClear={() => {
                setFile(null)
                form.setValue("fileId", "", { shouldValidate: true })
              }}
            />
            {fieldState.invalid && (
              <p className="type-body-sm text-destructive">
                {messageOf(fieldState.error)}
              </p>
            )}
          </Field>
        )}
      />

      <Controller
        name="alt"
        control={form.control}
        render={({ field, fieldState }) => (
          <AltField
            id={`${ids}-alt`}
            alt={field.value}
            decorative={decorative}
            error={messageOf(fieldState.error)}
            onAltChange={field.onChange}
            onDecorativeChange={(next) =>
              form.setValue("decorative", next, { shouldValidate: true })
            }
          />
        )}
      />

      <Controller
        name="caption"
        control={form.control}
        render={({ field }) => (
          <CaptionField
            id={`${ids}-caption`}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />

      <Controller
        name="width"
        control={form.control}
        render={({ field }) => (
          <Field className="gap-1.5">
            <FieldLabel className="type-label-xs text-muted-foreground uppercase">
              {t("projectContent.dialogs.image.width")}
            </FieldLabel>
            <RadioGroup
              value={field.value}
              onValueChange={field.onChange}
              aria-label={t("projectContent.dialogs.image.width")}
              className="flex flex-row gap-4"
            >
              {IMAGE_WIDTH_VALUES.map((width) => (
                <label
                  key={width}
                  className="type-body-sm flex items-center gap-2"
                >
                  <RadioGroupItem value={width} />
                  {t("projectContent.dialogs.image.widthOption", { width })}
                </label>
              ))}
            </RadioGroup>
          </Field>
        )}
      />
    </BlockDialogShell>
  )
}
