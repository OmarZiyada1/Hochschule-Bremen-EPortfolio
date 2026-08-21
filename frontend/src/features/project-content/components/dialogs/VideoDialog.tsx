import { zodResolver } from "@hookform/resolvers/zod"
import { useId, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type { StoredFileResponse } from "@/api/types"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  videoDialogSchema,
  type VideoDialogValues,
} from "@/features/project-content/blockDialogs.schema"
import type { VideoBlockNode } from "@/features/project-content/blockTypes"
import { VIDEO_PROVIDERS } from "@/features/project-content/providers"
import { FileUploadField } from "@/features/project-content/components/FileUploadField"
import {
  BlockDialogShell,
  CaptionField,
  useFieldMessage,
} from "@/features/project-content/components/dialogs/BlockDialogShell"

/**
 * VIDEO: entweder die hochgeladene Datei oder die Einbettung, nie beides
 * und nie keines (Contract 2.5 seit v51).
 *
 * <p><strong>Die Quelle ist eine Umschaltung und keine zwei unabhaengigen
 * Felder.</strong> Waeren beide zugleich ausfuellbar, waere der ungueltige
 * Zustand ueberhaupt erreichbar, und die Person erfuehre erst beim
 * Speichern davon.
 *
 * <p><strong>Gespeichert wird keine URL.</strong> Persistiert werden
 * {@code provider} und {@code videoId}; die Einbettungsadresse entsteht erst
 * zur Anzeige ueber {@code embedUrlFor}. Eine vom Client gelieferte
 * Fremd-URL in der Datenbank waere ein unnoetiger Angriffspunkt, weil sie
 * beim Rendern in ein {@code iframe} gelangt. Die Providerliste ist enger
 * als die von EMBED, weil es die Ableitung nur fuer diese beiden gibt.
 */
export function VideoDialog({
  projectId,
  open,
  onOpenChange,
  onInsert,
}: {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onInsert: (node: VideoBlockNode) => void
}) {
  const { t } = useTranslation()
  const messageOf = useFieldMessage()
  const ids = useId()
  const [file, setFile] = useState<StoredFileResponse | null>(null)

  const form = useForm<VideoDialogValues>({
    resolver: zodResolver(videoDialogSchema),
    defaultValues: { source: "file", fileId: "", caption: "" },
  })

  /* useWatch statt form.watch: dieselbe Beobachtung, aber vertraeglich mit
     dem React Compiler (Muster aus KAN-33 und KAN-34). */
  const source = useWatch({ control: form.control, name: "source" })

  const submit = form.handleSubmit((values) => {
    if (values.source === "file") {
      onInsert({
        type: "videoBlock",
        attrs: { fileId: values.fileId, caption: values.caption },
      })
      onOpenChange(false)
      return
    }
    onInsert({
      type: "videoBlock",
      attrs: {
        provider: values.provider,
        videoId: values.videoId,
        caption: values.caption,
      },
    })
    onOpenChange(false)
  })

  return (
    <BlockDialogShell
      open={open}
      onOpenChange={onOpenChange}
      titleKey="projectContent.dialogs.video.title"
      descriptionKey="projectContent.dialogs.video.description"
      onSubmit={submit}
    >
      <Controller
        name="source"
        control={form.control}
        render={({ field }) => (
          <Field className="gap-1.5">
            <FieldLabel className="type-label-xs text-muted-foreground uppercase">
              {t("projectContent.dialogs.video.source")}
            </FieldLabel>
            <RadioGroup
              value={field.value}
              onValueChange={(next) => {
                /* Die Umschaltung setzt das Formular auf die Felder der
                   gewaehlten Quelle zurueck; sonst blieben Werte der anderen
                   stehen und gingen beim Absenden mit. */
                form.reset(
                  next === "file"
                    ? { source: "file", fileId: "", caption: "" }
                    : {
                        source: "embed",
                        provider: "youtube",
                        videoId: "",
                        caption: "",
                      }
                )
                setFile(null)
              }}
              aria-label={t("projectContent.dialogs.video.source")}
              className="flex flex-row gap-4"
            >
              <label className="type-body-sm flex items-center gap-2">
                <RadioGroupItem value="file" />
                {t("projectContent.dialogs.video.sourceFile")}
              </label>
              <label className="type-body-sm flex items-center gap-2">
                <RadioGroupItem value="embed" />
                {t("projectContent.dialogs.video.sourceEmbed")}
              </label>
            </RadioGroup>
          </Field>
        )}
      />

      {source === "file" ? (
        <Controller
          name="fileId"
          control={form.control}
          render={({ fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="gap-1.5">
              <FileUploadField
                projectId={projectId}
                accept="video/mp4,video/webm,video/ogg"
                label={t("projectContent.dialogs.video.file")}
                hint={t("projectContent.dialogs.video.fileHint")}
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
                <FieldError
                  errors={[{ message: messageOf(fieldState.error) }]}
                />
              )}
            </Field>
          )}
        />
      ) : (
        <>
          <Controller
            name="provider"
            control={form.control}
            render={({ field }) => (
              <Field className="gap-1.5">
                <FieldLabel
                  htmlFor={`${ids}-provider`}
                  className="type-label-xs text-muted-foreground uppercase"
                >
                  {t("projectContent.dialogs.video.provider")}
                </FieldLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id={`${ids}-provider`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VIDEO_PROVIDERS.map((provider) => (
                      <SelectItem key={provider} value={provider}>
                        {t(`projectContent.provider.${provider}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          />

          <Controller
            name="videoId"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1.5">
                <FieldLabel
                  htmlFor={field.name}
                  className="type-label-xs text-muted-foreground uppercase group-data-[invalid=true]/field:text-destructive"
                >
                  {t("projectContent.dialogs.video.videoId")}
                </FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  aria-invalid={fieldState.invalid}
                  /* Die Meldung gehoert in aria-describedby, sonst hoert man
                     „ungueltig" ohne den Grund (SC 3.3.1). */
                  aria-describedby={
                    fieldState.invalid
                      ? `${ids}-videoid-hint ${ids}-videoid-error`
                      : `${ids}-videoid-hint`
                  }
                />
                <FieldDescription id={`${ids}-videoid-hint`}>
                  {t("projectContent.dialogs.video.videoIdHint")}
                </FieldDescription>
                {fieldState.invalid && (
                  <FieldError
                    id={`${ids}-videoid-error`}
                    errors={[{ message: messageOf(fieldState.error) }]}
                  />
                )}
              </Field>
            )}
          />
        </>
      )}

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
