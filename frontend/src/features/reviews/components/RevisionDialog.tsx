import { zodResolver } from "@hookform/resolvers/zod"
import { useId, type RefObject } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { apiErrorMessageKey, isApiError } from "@/api/errors"
import { CharacterCounter } from "@/components/common/CharacterCounter"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import {
  REVISION_REASON_MAX,
  revisionSchema,
  type RevisionFormValues,
} from "@/features/reviews/components/RevisionDialog.schema"

/**
 * „Zur Ueberarbeitung" mit Begruendung (§4.1, §6.1; KAN-37).
 *
 * <p>Die Begruendung wird serverseitig zu einem {@code CHANGE_REQUEST} mit
 * Stand {@code OPEN} und landet nicht in der Statushistorie (§4.1). Der
 * Dialog sagt das, damit niemand hier eine interne Notiz vermutet: der Text
 * geht an die Projektseite.
 *
 * <p>Ohne Begruendung geht kein Request hinaus, das zod-Schema haelt ihn
 * auf. Verbindlich bleibt der Server mit 400 {@code VALIDATION_FAILED}.
 */
export function RevisionDialog({
  open,
  onOpenChange,
  pending,
  error,
  onSubmit,
  finalFocus,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pending: boolean
  error: unknown
  onSubmit: (reason: string) => void
  /**
   * Ziel des Fokus beim Schliessen, aus demselben Grund wie am
   * {@code VersionConflictDialog}: sonst faellt er auf {@code body}
   * (SC 2.4.3).
   */
  finalFocus?: RefObject<HTMLElement | null>
}) {
  const { t } = useTranslation()
  const reasonId = useId()
  const counterId = useId()

  const form = useForm<RevisionFormValues>({
    resolver: zodResolver(revisionSchema),
    defaultValues: { reason: "" },
  })

  /* useWatch statt form.watch: vertraeglich mit dem React Compiler
     (Lint react-hooks/incompatible-library), wie im Metadatenformular. */
  const reason = useWatch({ control: form.control, name: "reason" })
  const failed = isApiError(error) ? error : null

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          form.reset({ reason: "" })
        }
        onOpenChange(next)
      }}
    >
      <DialogContent
        className="rounded-modal sm:max-w-lg"
        finalFocus={finalFocus}
      >
        <DialogHeader>
          <DialogTitle>{t("review.detail.revision.title")}</DialogTitle>
          <DialogDescription>
            {t("review.detail.revision.description")}
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit((values) => onSubmit(values.reason))}
        >
          <Field data-invalid={form.formState.errors.reason ? true : undefined}>
            <FieldLabel htmlFor={reasonId}>
              {t("review.detail.revision.label")}
            </FieldLabel>
            <Textarea
              id={reasonId}
              rows={5}
              placeholder={t("review.detail.revision.placeholder")}
              aria-describedby={counterId}
              {...form.register("reason")}
            />
            <CharacterCounter
              id={counterId}
              value={reason}
              max={REVISION_REASON_MAX}
            />
            {form.formState.errors.reason?.message && (
              <FieldError>{t(form.formState.errors.reason.message)}</FieldError>
            )}
          </Field>

          {failed !== null && (
            <Alert variant="destructive">
              <AlertTitle>
                {t(apiErrorMessageKey(failed), {
                  defaultValue: failed.message,
                })}
              </AlertTitle>
            </Alert>
          )}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("common.action.cancel")}
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {t("review.detail.revision.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
