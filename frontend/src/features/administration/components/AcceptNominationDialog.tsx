import { zodResolver } from "@hookform/resolvers/zod"
import { type RefObject } from "react"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  apiErrorMessageKey,
  applyValidationErrors,
  isApiError,
} from "@/api/errors"
import type { Top10NominationResponse } from "@/api/types"
import { FilterSelect } from "@/components/common/FilterSelect"
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
import {
  acceptNominationSchema,
  type AcceptNominationFormValues,
} from "@/features/administration/components/AcceptNominationDialog.schema"
import { fullNameOf } from "@/lib/name"

/**
 * Der Feldname, den der Server in einem 400 VALIDATION_FAILED nennt (§6.2,
 * Format {@code feld: Text}), etwa bei einem Platz ausserhalb von 1 bis 10.
 */
const ACCEPT_SERVER_FIELDS = ["position"] as const

/**
 * Der Annahme-Dialog der Top-10-Verwaltung (§3.11.1, §6.1; KAN-40): welchen
 * Platz bekommt dieser Vorschlag?
 *
 * <p><strong>Ein Dialog und kein Auswahlfeld in der Zeile.</strong> Der
 * Frame {@code Admin · Top 10} zeigt die Platzwahl inline; die Annahme legt
 * aber einen Eintrag auf der oeffentlichen Startseite an und ist der einzige
 * Weg, der {@code proposedPosition} nachtraegt (§3.11.1 Regel 5). Sie
 * braucht deshalb den Platz fuer die Stufe, den Hinweis auf die freien
 * Plaetze und die Fehlermeldung, und ein Auswahlfeld zwischen zwei Knoepfen
 * hat keinen (Klaerungsrunde zu KAN-40).
 *
 * <p><strong>Zur Auswahl stehen nur freie Plaetze.</strong> {@code accept}
 * raeumt keinen belegten Platz, sondern antwortet mit 409
 * {@code RESOURCE_IN_USE} und aendert nichts (§3.11.1). Wer ein Projekt auf
 * einen belegten Platz setzen will, sortiert stattdessen um. Der 409 wird
 * trotzdem behandelt: zwei Personen koennen gleichzeitig arbeiten, und die
 * Liste hier ist der Stand des letzten Ladevorgangs.
 *
 * <p><strong>Die vorgeschlagene Stufe steht als Hinweis daneben, nicht als
 * Zwang.</strong> Sie belegt den ersten freien Platz ihres Bereichs vor
 * (§2.13), bindet die Entscheidung aber nicht: der Server prueft den
 * Zusammenhang nicht, und die Administration kann jeden freien Platz
 * vergeben. {@code proposedPosition} taugt seit Contract v68 nicht mehr als
 * Vorbelegung, es ist das Feld der Administration und bleibt leer, solange
 * der Vorschlag offen ist.
 */
export function AcceptNominationDialog({
  nomination,
  freePositions,
  suggestedPosition,
  onOpenChange,
  pending,
  onSubmit,
  finalFocus,
}: {
  /** Der betroffene Vorschlag, oder {@code null}, wenn der Dialog zu ist. */
  nomination: Top10NominationResponse | null
  /** Die noch unbesetzten Plaetze, aufsteigend (§3.11.1). */
  freePositions: readonly number[]
  /**
   * Vorbelegung aus der vorgeschlagenen Stufe, oder {@code null}, wenn im
   * Bereich der Stufe kein Platz mehr frei ist. Dann bleibt das Feld leer
   * und verlangt eine ausdrueckliche Wahl.
   */
  suggestedPosition: number | null
  onOpenChange: (open: boolean) => void
  pending: boolean
  /** Wirft den {@code ApiError} weiter, damit er hier erscheint. */
  onSubmit: (position: number) => Promise<void>
  finalFocus?: RefObject<HTMLElement | null>
}) {
  const { t } = useTranslation()

  const defaults = {
    position: suggestedPosition === null ? "" : String(suggestedPosition),
  }

  const form = useForm<AcceptNominationFormValues>({
    resolver: zodResolver(acceptNominationSchema),
    defaultValues: defaults,
    /* Ein zweites Oeffnen an einer anderen Zeile soll deren Vorbelegung
       zeigen und nicht die des vorigen Vorschlags. */
    values: nomination === null ? undefined : defaults,
  })

  const submit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(Number(values.position))
      onOpenChange(false)
    } catch (error) {
      if (!isApiError(error)) {
        throw error
      }
      if (error.errorCode === "VALIDATION_FAILED") {
        applyValidationErrors(error, ACCEPT_SERVER_FIELDS, (name, issue) =>
          form.setError(name as "position" | "root.server", issue)
        )
        return
      }
      /* Die drei 409er gehoeren nicht an das Feld, sondern an den Dialog:
         der eingetragene Wert ist nicht falsch, der Stand hat sich
         geaendert. Entschieden wird ueber errorCode (Frontend-Regel 3),
         den Text liefert i18n. */
      form.setError("root.server", {
        type: "server",
        message: t(apiErrorMessageKey(error), { defaultValue: error.message }),
      })
    }
  })

  const rootError = form.formState.errors.root?.server?.message

  return (
    <Dialog
      open={nomination !== null}
      onOpenChange={(next) => {
        if (!next) {
          form.clearErrors()
        }
        onOpenChange(next)
      }}
    >
      <DialogContent
        className="rounded-modal sm:max-w-lg"
        finalFocus={finalFocus}
      >
        <DialogHeader>
          <DialogTitle>{t("administration.top10.accept.title")}</DialogTitle>
          <DialogDescription>
            {nomination === null
              ? ""
              : t("administration.top10.accept.description", {
                  title: nomination.project.title,
                  person: fullNameOf(nomination.nominatedBy),
                  tier: t(`top10.tier.${nomination.proposedTier}`),
                })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          {rootError !== undefined && (
            <Alert variant="destructive">
              <AlertTitle>{rootError}</AlertTitle>
            </Alert>
          )}

          <Controller
            name="position"
            control={form.control}
            render={({ field, fieldState }) => (
              <FilterSelect
                label={t("administration.top10.accept.positionLabel")}
                allLabel={t("administration.top10.accept.positionPlaceholder")}
                description={t("administration.top10.accept.positionHint")}
                options={freePositions.map((position) => ({
                  value: String(position),
                  label: t("top10.position", { position }),
                }))}
                value={field.value === "" ? null : field.value}
                onValueChange={(value) => field.onChange(value ?? "")}
                error={
                  fieldState.invalid
                    ? fieldState.error?.type === "server"
                      ? fieldState.error.message
                      : t(fieldState.error?.message ?? "")
                    : undefined
                }
              />
            )}
          />

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="ghost" />}>
              {t("common.action.cancel")}
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {t("administration.top10.accept.confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
