import { zodResolver } from "@hookform/resolvers/zod"
import { Trash2Icon } from "lucide-react"
import { useId } from "react"
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  galleryDialogSchema,
  GALLERY_COLUMN_VALUES,
  type GalleryDialogValues,
} from "@/features/project-content/blockDialogs.schema"
import type {
  GalleryBlockNode,
  GalleryColumns,
} from "@/features/project-content/blockTypes"
import { FileUploadField } from "@/features/project-content/components/FileUploadField"
import {
  AltField,
  BlockDialogShell,
  CaptionField,
  useFieldMessage,
} from "@/features/project-content/components/dialogs/BlockDialogShell"

/**
 * GALLERY: mehrere Bilder als Raster (Contract 2.5).
 *
 * <p><strong>{@code items} ist ein Array aus {@code { fileId, alt }}</strong>
 * und keine blosse Liste von IDs. Der gemeinsame {@code caption} beschreibt
 * die Gruppe, ersetzt aber nicht die Beschreibung des einzelnen Bildes: wer
 * sich eine Galerie vorlesen laesst, erfuehre sonst zum dritten Bild nichts
 * (SC 1.1.1). Deshalb steht das Alternativtextfeld an jedem Eintrag und
 * nicht einmal am Dialog.
 *
 * <p>Die Liste muss nicht leer sein; der Server weist eine leere Galerie mit
 * 400 ab, und der Lesepfad verwuerfe den Block ganz.
 */
export function GalleryDialog({
  projectId,
  open,
  onOpenChange,
  onInsert,
}: {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onInsert: (node: GalleryBlockNode) => void
}) {
  const { t } = useTranslation()
  const messageOf = useFieldMessage()
  const ids = useId()

  const form = useForm<GalleryDialogValues>({
    resolver: zodResolver(galleryDialogSchema),
    defaultValues: { items: [], columns: "2", caption: "" },
  })
  const items = useFieldArray({ control: form.control, name: "items" })
  /* useWatch statt form.watch: dieselbe Beobachtung, aber vertraeglich mit
     dem React Compiler (Muster aus KAN-33 und KAN-34). */
  const itemValues = useWatch({ control: form.control, name: "items" })

  const submit = form.handleSubmit((values) => {
    onInsert({
      type: "galleryBlock",
      attrs: {
        items: values.items.map((item) => ({
          fileId: item.fileId,
          alt: item.decorative ? "" : item.alt.trim(),
        })),
        columns: Number(values.columns) as GalleryColumns,
        caption: values.caption,
      },
    })
    onOpenChange(false)
  })

  return (
    <BlockDialogShell
      open={open}
      onOpenChange={onOpenChange}
      titleKey="projectContent.dialogs.gallery.title"
      descriptionKey="projectContent.dialogs.gallery.description"
      onSubmit={submit}
    >
      {/* Ein Uploadfeld, das jedes Mal einen neuen Eintrag anhaengt. Ein
          Feld je Eintrag waere dieselbe Flaeche mehrfach und liesse offen,
          welches das naechste Bild aufnimmt. */}
      <FileUploadField
        projectId={projectId}
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        label={t("projectContent.dialogs.gallery.file")}
        hint={t("projectContent.dialogs.gallery.fileHint")}
        value={null}
        onUploaded={(stored) => {
          items.append({ fileId: stored.id, alt: "", decorative: false })
          void form.trigger("items")
        }}
        onClear={() => undefined}
      />

      <ol className="flex flex-col gap-4">
        {items.fields.map((entry, index) => (
          <li
            key={entry.id}
            className="flex flex-col gap-2 rounded-card border border-border p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="type-body-sm font-semibold">
                {t("projectContent.dialogs.gallery.item", {
                  position: index + 1,
                })}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => items.remove(index)}
              >
                <Trash2Icon aria-hidden="true" />
                <span className="sr-only">
                  {t("projectContent.dialogs.gallery.removeItem", {
                    position: index + 1,
                  })}
                </span>
              </Button>
            </div>
            <Controller
              name={`items.${index}.alt`}
              control={form.control}
              render={({ field, fieldState }) => (
                <AltField
                  id={`${ids}-alt-${index}`}
                  alt={field.value}
                  decorative={itemValues?.[index]?.decorative ?? false}
                  error={messageOf(fieldState.error)}
                  onAltChange={field.onChange}
                  onDecorativeChange={(next) =>
                    form.setValue(`items.${index}.decorative`, next, {
                      shouldValidate: true,
                    })
                  }
                />
              )}
            />
          </li>
        ))}
      </ol>

      {form.formState.errors.items?.message !== undefined && (
        <FieldError
          errors={[
            {
              message: t(form.formState.errors.items.message),
            },
          ]}
        />
      )}

      <Controller
        name="columns"
        control={form.control}
        render={({ field }) => (
          <Field className="gap-1.5">
            <FieldLabel className="type-label-xs text-muted-foreground uppercase">
              {t("projectContent.dialogs.gallery.columns")}
            </FieldLabel>
            <RadioGroup
              value={field.value}
              onValueChange={field.onChange}
              aria-label={t("projectContent.dialogs.gallery.columns")}
              className="flex flex-row gap-4"
            >
              {GALLERY_COLUMN_VALUES.map((columns) => (
                <label
                  key={columns}
                  className="type-body-sm flex items-center gap-2"
                >
                  <RadioGroupItem value={columns} />
                  {t("projectContent.dialogs.gallery.columnsOption", {
                    columns,
                  })}
                </label>
              ))}
            </RadioGroup>
          </Field>
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
    </BlockDialogShell>
  )
}
