import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { isSafeHref } from "@/features/project-content/blockSanitize"

/**
 * Die Adresse eines Links (Contract 2.5: {@code link} ist eine Mark, kein
 * Block).
 *
 * <p><strong>Ein Dialog und kein {@code window.prompt}.</strong> Der native
 * Dialog laesst sich nicht beschriften, nicht gestalten und in einem
 * Testlauf nicht bedienen; jsdom kennt ihn gar nicht. Vor allem aber traegt
 * er keinen Fehlertext am Feld: eine abgelehnte Adresse muesste als zweiter
 * Dialog danebengesetzt werden.
 *
 * <p><strong>Die Textauswahl ueberlebt das Oeffnen.</strong> Der Dialog
 * nimmt den Fokus und damit die sichtbare Markierung im Editor; die
 * aufrufende Stelle merkt sich deshalb die Positionen und setzt sie beim
 * Anwenden wieder ({@code SelectionToolbar}). Ohne das traefe
 * {@code setLink} den Cursor statt der Auswahl.
 */

const linkFormSchema = z.object({
  href: z
    .string()
    .min(1, "validation.blockLink.required")
    .refine((value) => isSafeHref(value.trim()), "validation.blockLink.scheme"),
})

type LinkFormValues = z.infer<typeof linkFormSchema>

export function LinkDialog({
  open,
  initialHref,
  onOpenChange,
  onSubmit,
  onRemove,
}: {
  open: boolean
  /** Vorhandene Adresse, wenn die Auswahl bereits verlinkt ist. */
  initialHref: string
  onOpenChange: (open: boolean) => void
  onSubmit: (href: string) => void
  /** Nur angeboten, wenn die Auswahl bereits einen Link traegt. */
  onRemove?: () => void
}) {
  const { t } = useTranslation()

  const form = useForm<LinkFormValues>({
    resolver: zodResolver(linkFormSchema),
    defaultValues: { href: initialHref === "" ? "https://" : initialHref },
  })

  const submit = form.handleSubmit((values) => {
    onSubmit(values.href.trim())
    onOpenChange(false)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-modal sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("projectContent.dialogs.link.title")}</DialogTitle>
          <DialogDescription>
            {t("projectContent.dialogs.link.description")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <Controller
            name="href"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1.5">
                <FieldLabel
                  htmlFor={field.name}
                  className="type-label-xs text-muted-foreground uppercase"
                >
                  {t("projectContent.dialogs.link.href")}
                </FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  aria-invalid={fieldState.invalid}
                  aria-describedby={
                    fieldState.invalid ? "link-href-hint link-href-error" : "link-href-hint"
                  }
                />
                <FieldDescription id="link-href-hint">
                  {t("projectContent.dialogs.link.hint")}
                </FieldDescription>
                {fieldState.invalid && (
                  <FieldError
                    id="link-href-error"
                    errors={[
                      {
                        message:
                          fieldState.error?.message === undefined
                            ? undefined
                            : t(fieldState.error.message),
                      },
                    ]}
                  />
                )}
              </Field>
            )}
          />

          <DialogFooter>
            {onRemove !== undefined && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  onRemove()
                  onOpenChange(false)
                }}
              >
                {t("projectContent.dialogs.link.remove")}
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              {t("common.action.cancel")}
            </Button>
            <Button type="submit">
              {t("projectContent.dialogs.link.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
