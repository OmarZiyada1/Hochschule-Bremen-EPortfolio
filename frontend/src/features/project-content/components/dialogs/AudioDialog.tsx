import { zodResolver } from "@hookform/resolvers/zod"
import { useId, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type { StoredFileResponse } from "@/api/types"
import { Field, FieldError } from "@/components/ui/field"
import {
  audioDialogSchema,
  type AudioDialogValues,
} from "@/features/project-content/blockDialogs.schema"
import type { AudioBlockNode } from "@/features/project-content/blockTypes"
import { FileUploadField } from "@/features/project-content/components/FileUploadField"
import {
  BlockDialogShell,
  CaptionField,
  useFieldMessage,
} from "@/features/project-content/components/dialogs/BlockDialogShell"

/**
 * AUDIO: ausschliesslich die hochgeladene Datei (Contract 2.5 seit v51).
 *
 * <p><strong>Kein Feld fuer eine fremde Adresse</strong>, und das ist keine
 * Auslassung: eine Fremdadresse im Dokument braeche die Regel aus 3.15,
 * dass Dateien nie im Dokument liegen, und waere beim Rendern ein
 * ungepruefter Abruf gegen einen beliebigen Host. Der Server weist ein
 * mitgeschicktes {@code src} aktiv mit 400 ab.
 *
 * <p>Die Prototypzeichnung im Template zeigt daneben ein Feld „Oder
 * Audio-URL einfuegen"; es stammt aus der Zeit vor Contract v51 und
 * entsteht bewusst nicht.
 */
export function AudioDialog({
  projectId,
  open,
  onOpenChange,
  onInsert,
}: {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onInsert: (node: AudioBlockNode) => void
}) {
  const { t } = useTranslation()
  const messageOf = useFieldMessage()
  const ids = useId()
  const [file, setFile] = useState<StoredFileResponse | null>(null)

  const form = useForm<AudioDialogValues>({
    resolver: zodResolver(audioDialogSchema),
    defaultValues: { fileId: "", caption: "" },
  })

  const submit = form.handleSubmit((values) => {
    onInsert({
      type: "audioBlock",
      attrs: { fileId: values.fileId, caption: values.caption },
    })
    onOpenChange(false)
  })

  return (
    <BlockDialogShell
      open={open}
      onOpenChange={onOpenChange}
      titleKey="projectContent.dialogs.audio.title"
      descriptionKey="projectContent.dialogs.audio.description"
      onSubmit={submit}
    >
      <Controller
        name="fileId"
        control={form.control}
        render={({ fieldState }) => (
          <Field data-invalid={fieldState.invalid} className="gap-1.5">
            <FileUploadField
              projectId={projectId}
              accept="audio/mpeg,audio/wav,audio/ogg"
              label={t("projectContent.dialogs.audio.file")}
              hint={t("projectContent.dialogs.audio.fileHint")}
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
              <FieldError errors={[{ message: messageOf(fieldState.error) }]} />
            )}
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
