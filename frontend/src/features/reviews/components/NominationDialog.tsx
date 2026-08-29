import { zodResolver } from "@hookform/resolvers/zod"
import { useId, type RefObject } from "react"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { isApiError } from "@/api/errors"
import type { NominationTier } from "@/api/types"
import { ErrorState } from "@/components/common/ErrorState"
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
import { Field, FieldError, FieldLegend } from "@/components/ui/field"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  NOMINATION_TIERS,
  nominationSchema,
  type NominationFormValues,
} from "@/features/reviews/components/NominationDialog.schema"
import { tierIcons } from "@/features/reviews/nominations"
import { cn } from "@/lib/utils"

/**
 * „Fuer Top 10 nominieren" (§3.11.1, §6.1; KAN-37): Projekttitel und die
 * Wahl der Stufe aus §2.13.
 *
 * <p><strong>Eine Stufe und kein Platz.</strong> Wer nominiert, kennt die
 * uebrige Liste nicht; der Platz kommt spaeter von der Administration und
 * ist an die Stufe nicht gebunden (§3.11.1 Regel 4). Die Platzbereiche im
 * Dialog sind deshalb Erlaeuterung und keine Zusage.
 *
 * <p><strong>Zwei 409er werden sichtbar behandelt</strong>, beide ohne
 * zweiten Versuch: {@code PROJECT_NOT_PUBLISHED}, wenn das Projekt den
 * Status inzwischen verlassen hat, und {@code RESOURCE_IN_USE}, wenn es
 * bereits in der Top-10 steht oder schon eine offene Nominierung traegt.
 * Das Zeilenmenue sperrt beide Faelle vorher, aber es kennt nur den Stand
 * des letzten Ladevorgangs; verbindlich bleibt der Server.
 *
 * <p>Fokusfang, Escape-Behandlung und Fokusrueckgabe bringt die
 * Dialog-Primitive mit (SC 2.1.2, SC 2.4.3); nachgebaut wird davon nichts.
 */
export function NominationDialog({
  open,
  onOpenChange,
  projectTitle,
  pending,
  error,
  onSubmit,
  finalFocus,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectTitle: string
  pending: boolean
  error: unknown
  onSubmit: (proposedTier: NominationTier) => void
  /**
   * Ziel des Fokus beim Schliessen. Pflicht und nicht Kosmetik: der
   * Ausloeser ist ein Eintrag des Zeilenmenues, und der ist beim Oeffnen
   * bereits abgebaut. Ohne dieses Ziel faellt der Fokus auf {@code body},
   * und wer mit der Tastatur arbeitet, beginnt wieder ganz oben
   * (SC 2.4.3), wie an {@code VersionConflictDialog} begruendet.
   */
  finalFocus?: RefObject<HTMLElement | null>
}) {
  const { t } = useTranslation()

  const legendId = useId()

  const form = useForm<NominationFormValues>({
    resolver: zodResolver(nominationSchema),
    defaultValues: { proposedTier: "TOP_10" },
  })

  const failed = isApiError(error) ? error : null

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          form.reset({ proposedTier: "TOP_10" })
        }
        onOpenChange(next)
      }}
    >
      <DialogContent
        className="rounded-modal sm:max-w-lg"
        finalFocus={finalFocus}
      >
        <DialogHeader>
          <DialogTitle>{t("review.nomination.dialog.title")}</DialogTitle>
          <DialogDescription>
            {t("review.nomination.dialog.description", {
              title: projectTitle,
            })}
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit((values) =>
            onSubmit(values.proposedTier)
          )}
        >
          <Controller
            control={form.control}
            name="proposedTier"
            render={({ field }) => (
              <Field
                data-invalid={
                  form.formState.errors.proposedTier ? true : undefined
                }
              >
                {/* FieldLegend statt FieldLabel: ein Label ohne htmlFor und
                    ohne umschlossenes Bedienelement zeigt auf nichts. Die
                    Gruppe traegt ihren Namen ueber aria-labelledby. */}
                <FieldLegend id={legendId}>
                  {t("review.nomination.dialog.tier")}
                </FieldLegend>
                <RadioGroup
                  value={field.value}
                  onValueChange={(value) => field.onChange(value)}
                  aria-labelledby={legendId}
                  className="flex flex-col gap-2"
                >
                  {NOMINATION_TIERS.map((tier) => {
                    const TierIcon = tierIcons[tier]
                    const selected = field.value === tier
                    return (
                      <Label
                        key={tier}
                        className={cn(
                          "flex items-start gap-3 rounded-control border p-3",
                          selected && "border-primary bg-muted"
                        )}
                      >
                        <RadioGroupItem value={tier} className="mt-1" />
                        <TierIcon
                          aria-hidden="true"
                          className="mt-0.5 size-5 shrink-0 text-primary"
                        />
                        <span className="flex flex-col gap-0.5">
                          <span className="type-body-sm font-semibold">
                            {t(`top10.tier.${tier}`)}
                          </span>
                          <span className="type-label-xs text-muted-foreground">
                            {t(`review.nomination.tier.${tier}.hint`)}
                          </span>
                          <span className="type-label-xs text-muted-foreground">
                            {t(`review.nomination.tier.${tier}.range`)}
                          </span>
                        </span>
                      </Label>
                    )
                  })}
                </RadioGroup>
                {form.formState.errors.proposedTier?.message && (
                  <FieldError>
                    {t(form.formState.errors.proposedTier.message)}
                  </FieldError>
                )}
              </Field>
            )}
          />

          {failed !== null && <ErrorState error={failed} />}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("common.action.cancel")}
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {t("review.nomination.dialog.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
