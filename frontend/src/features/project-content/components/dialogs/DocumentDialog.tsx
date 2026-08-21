import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type { StoredFileResponse } from "@/api/types"
import { Field, FieldError } from "@/components/ui/field"
import {
  documentDialogSchema,
  type DocumentDialogValues,
} from "@/features/project-content/blockDialogs.schema"
import type { DocumentBlockNode } from "@/features/project-content/blockTypes"
import { FileUploadField } from "@/features/project-content/components/FileUploadField"
import {
  BlockDialogShell,
  useFieldMessage,
} from "@/features/project-content/components/dialogs/BlockDialogShell"

/**
 * DOCUMENT: eine Datei zum Herunterladen (Contract 2.5).
 *
 * <p><strong>Alle drei Attribute kommen aus der Antwort des Uploads</strong>
 * und werden nicht getippt: {@code fileId}, {@code fileName} und
 * {@code size}. Ein getippter Name waere ein zweiter, moeglicherweise
 * abweichender Name derselben Datei, und eine getippte Groesse eine blosse
 * Behauptung. Der Renderer nennt beides vor dem Klick, damit klar ist, was
 * geladen wird (SC 2.4.4).
 *
 * <p>Der Dialog hat deshalb genau ein Feld und keinen einzigen Freitext.
 */
export function DocumentDialog({
  projectId,
  open,
  onOpenChange,
  onInsert,
}: {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onInsert: (node: DocumentBlockNode) => void
}) {
  const { t } = useTranslation()
  const messageOf = useFieldMessage()
  const [file, setFile] = useState<StoredFileResponse | null>(null)

  const form = useForm<DocumentDialogValues>({
    resolver: zodResolver(documentDialogSchema),
    defaultValues: { fileId: "", fileName: "", size: 0 },
  })

  const submit = form.handleSubmit((values) => {
    onInsert({
      type: "documentBlock",
      attrs: {
        fileId: values.fileId,
        fileName: values.fileName,
        size: values.size,
      },
    })
    onOpenChange(false)
  })

  return (
    <BlockDialogShell
      open={open}
      onOpenChange={onOpenChange}
      titleKey="projectContent.dialogs.document.title"
      descriptionKey="projectContent.dialogs.document.description"
      onSubmit={submit}
    >
      <Controller
        name="fileId"
        control={form.control}
        render={({ fieldState }) => (
          <Field data-invalid={fieldState.invalid} className="gap-1.5">
            <FileUploadField
              projectId={projectId}
              accept="application/pdf"
              label={t("projectContent.dialogs.document.file")}
              hint={t("projectContent.dialogs.document.fileHint")}
              value={file}
              onUploaded={(stored) => {
                setFile(stored)
                form.setValue("fileId", stored.id)
                form.setValue("fileName", stored.fileName)
                form.setValue("size", stored.size, { shouldValidate: true })
              }}
              onClear={() => {
                setFile(null)
                form.setValue("fileId", "")
                form.setValue("fileName", "")
                form.setValue("size", 0, { shouldValidate: true })
              }}
            />
            {fieldState.invalid && (
              <FieldError errors={[{ message: messageOf(fieldState.error) }]} />
            )}
          </Field>
        )}
      />
    </BlockDialogShell>
  )
}
