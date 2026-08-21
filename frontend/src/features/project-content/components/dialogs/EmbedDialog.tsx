import { zodResolver } from "@hookform/resolvers/zod"
import { useId } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  embedDialogSchema,
  EMBED_HEIGHT_DEFAULT,
  EMBED_HEIGHT_MAX,
  EMBED_HEIGHT_MIN,
  type EmbedDialogValues,
} from "@/features/project-content/blockDialogs.schema"
import type { EmbedBlockNode } from "@/features/project-content/blockTypes"
import {
  ALLOWED_EMBED_HOSTS,
  EMBED_PROVIDERS,
} from "@/features/project-content/providers"
import {
  BlockDialogShell,
  useFieldMessage,
} from "@/features/project-content/components/dialogs/BlockDialogShell"

/**
 * EMBED: ein fremder Inhalt im {@code iframe} (Contract 2.5).
 *
 * <p><strong>Provider und Host werden vorab geprueft</strong>, gegen
 * dieselbe Liste, die der Lesepfad fuehrt ({@code providers.ts}). Das ist
 * ein Hinweis und kein Ersatz: verbindlich prueft der Server und antwortet
 * mit 400 {@code EMBED_PROVIDER_NOT_ALLOWED} (6.2). Der Grund fuer die
 * Vorabpruefung ist Freundlichkeit, nicht Sicherheit: wer eine Adresse
 * eintippt, soll nicht erst nach dem Speichern erfahren, dass sie nicht
 * durchgeht.
 *
 * <p><strong>Der Providername allein genuegt nicht.</strong> Je Anbieter
 * gilt eine Host-Allowlist, und ausschliesslich {@code https}: ein
 * passender Providername mit fremdem Host waere sonst der bequeme Weg an
 * der Pruefung vorbei. Die zulaessigen Hosts stehen als Hinweis am Feld.
 *
 * <p>EMBED kennt fuenf Anbieter, VIDEO nur zwei. Der Unterschied hat einen
 * Grund: bei VIDEO leitet der Server die Einbettungsadresse selbst ab, und
 * diese Ableitung gibt es nur fuer die beiden Videoanbieter.
 */
export function EmbedDialog({
  open,
  onOpenChange,
  onInsert,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onInsert: (node: EmbedBlockNode) => void
}) {
  const { t } = useTranslation()
  const messageOf = useFieldMessage()
  const ids = useId()

  const form = useForm<EmbedDialogValues>({
    resolver: zodResolver(embedDialogSchema),
    defaultValues: {
      provider: "figma",
      embedUrl: "",
      height: EMBED_HEIGHT_DEFAULT,
    },
  })

  /* useWatch statt form.watch: dieselbe Beobachtung, aber vertraeglich mit
     dem React Compiler (Muster aus KAN-33 und KAN-34). */
  const provider = useWatch({ control: form.control, name: "provider" })

  const submit = form.handleSubmit((values) => {
    onInsert({
      type: "embedBlock",
      attrs: {
        provider: values.provider,
        embedUrl: values.embedUrl.trim(),
        height: values.height,
      },
    })
    onOpenChange(false)
  })

  return (
    <BlockDialogShell
      open={open}
      onOpenChange={onOpenChange}
      titleKey="projectContent.dialogs.embed.title"
      descriptionKey="projectContent.dialogs.embed.description"
      onSubmit={submit}
    >
      <Controller
        name="provider"
        control={form.control}
        render={({ field }) => (
          <Field className="gap-1.5">
            <FieldLabel
              htmlFor={`${ids}-provider`}
              className="type-label-xs text-muted-foreground uppercase"
            >
              {t("projectContent.dialogs.embed.provider")}
            </FieldLabel>
            <Select
              value={field.value}
              onValueChange={(next) => {
                field.onChange(next)
                /* Die Adresse gehoert zum Anbieter: nach dem Wechsel wird
                   sie neu geprueft, statt bis zum Absenden gueltig zu
                   scheinen. */
                void form.trigger("embedUrl")
              }}
            >
              <SelectTrigger id={`${ids}-provider`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EMBED_PROVIDERS.map((entry) => (
                  <SelectItem key={entry} value={entry}>
                    {t(`projectContent.provider.${entry}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
      />

      <Controller
        name="embedUrl"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid} className="gap-1.5">
            <FieldLabel
              htmlFor={field.name}
              className="type-label-xs text-muted-foreground uppercase group-data-[invalid=true]/field:text-destructive"
            >
              {t("projectContent.dialogs.embed.url")}
            </FieldLabel>
            <Input
              {...field}
              id={field.name}
              type="url"
              inputMode="url"
              aria-invalid={fieldState.invalid}
              aria-describedby={`${ids}-url-hint`}
            />
            <FieldDescription id={`${ids}-url-hint`}>
              {t("projectContent.dialogs.embed.urlHint", {
                hosts: ALLOWED_EMBED_HOSTS[provider].join(", "),
              })}
            </FieldDescription>
            {fieldState.invalid && (
              <FieldError errors={[{ message: messageOf(fieldState.error) }]} />
            )}
          </Field>
        )}
      />

      <Controller
        name="height"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid} className="gap-1.5">
            <FieldLabel
              htmlFor={field.name}
              className="type-label-xs text-muted-foreground uppercase group-data-[invalid=true]/field:text-destructive"
            >
              {t("projectContent.dialogs.embed.height")}
            </FieldLabel>
            <Input
              id={field.name}
              type="number"
              inputMode="numeric"
              min={EMBED_HEIGHT_MIN}
              max={EMBED_HEIGHT_MAX}
              value={String(field.value)}
              onChange={(event) => field.onChange(Number(event.target.value))}
              aria-invalid={fieldState.invalid}
              aria-describedby={`${ids}-height-hint`}
            />
            <FieldDescription id={`${ids}-height-hint`}>
              {t("projectContent.dialogs.embed.heightHint", {
                min: EMBED_HEIGHT_MIN,
                max: EMBED_HEIGHT_MAX,
              })}
            </FieldDescription>
            {fieldState.invalid && (
              <FieldError errors={[{ message: messageOf(fieldState.error) }]} />
            )}
          </Field>
        )}
      />
    </BlockDialogShell>
  )
}
