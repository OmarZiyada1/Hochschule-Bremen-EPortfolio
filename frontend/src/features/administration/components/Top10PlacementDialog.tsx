import { zodResolver } from "@hookform/resolvers/zod"
import { type RefObject } from "react"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { apiErrorMessageKey, isApiError } from "@/api/errors"
import type { ProjectCardResponse } from "@/api/types"
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

/**
 * Der Aufnahme-Dialog der Projektverwaltung (§3.11, §3.11.1, §6.1;
 * Nacharbeit an KAN-87): auf welchen Platz kommt dieses Projekt?
 *
 * <p><strong>Warum ueberhaupt ein Dialog.</strong> Der Vorgang schreibt
 * unmittelbar auf die oeffentliche Startseite; ein Menueeintrag, der das
 * wortlos tut, waere die folgenreichste Zeile des Menues und zugleich die
 * einzige ohne Rueckfrage. Der Dialog nennt die Folge und laesst den Platz
 * waehlen, statt ihn zu erraten.
 *
 * <p><strong>Zur Auswahl stehen nur freie Plaetze.</strong> {@code PUT
 * /admin/top10} raeumt keinen belegten Platz; wer ein Projekt auf einen
 * belegten Platz setzen will, sortiert in der Top-10-Verwaltung um. Bei zehn
 * belegten Plaetzen erscheint dieser Dialog gar nicht erst, der Menueeintrag
 * ist dann gesperrt und begruendet sich.
 *
 * <p><strong>Vorbelegt ist der erste freie Platz</strong> und nicht der
 * beste. Anders als beim Annehmen gibt es hier keine vorgeschlagene Stufe,
 * aus der sich ein Bereich ableiten liesse (§2.13): niemand hat etwas
 * vorgeschlagen, die Administration entscheidet unmittelbar. Ein leeres Feld
 * waere die ehrlichere, aber muehsamere Wahl; der erste freie Platz ist die,
 * die der Projekt-Picker der Top-10-Verwaltung ohne Nachfrage trifft.
 *
 * <p><strong>Dasselbe Schema wie der Annahme-Dialog.</strong> Beide Formulare
 * haben genau ein Feld mit derselben Zusage: ein Platz zwischen 1 und 10
 * (§3.11). Ein zweites Schema danebenzustellen hiesse, dieselbe Regel zweimal
 * zu pflegen (Frontend-Regel 12).
 *
 * <p><strong>Fehler stehen am Dialog, nicht am Feld.</strong> Die Nutzlast
 * von {@code PUT /admin/top10} ist die ganze Belegung und kein Feld
 * {@code position}; ein 409 {@code PROJECT_NOT_PUBLISHED} oder ein 400
 * {@code VALIDATION_FAILED} sagt deshalb nichts ueber den gewaehlten Platz
 * aus, sondern darueber, dass sich der Stand geaendert hat. Entschieden wird
 * ueber {@code errorCode} (Frontend-Regel 3), den Text liefert i18n.
 */
export function Top10PlacementDialog({
  project,
  freePositions,
  onOpenChange,
  pending,
  onSubmit,
  finalFocus,
}: {
  /** Das betroffene Projekt, oder {@code null}, wenn der Dialog zu ist. */
  project: ProjectCardResponse | null
  /** Die noch unbesetzten Plaetze, aufsteigend (§3.11.1 Regel 3). */
  freePositions: readonly number[]
  onOpenChange: (open: boolean) => void
  pending: boolean
  /** Wirft den {@code ApiError} weiter, damit er hier erscheint. */
  onSubmit: (position: number) => Promise<void>
  finalFocus?: RefObject<HTMLElement | null>
}) {
  const { t } = useTranslation()

  const defaults = {
    position: freePositions.length === 0 ? "" : String(freePositions[0]),
  }

  const form = useForm<AcceptNominationFormValues>({
    resolver: zodResolver(acceptNominationSchema),
    defaultValues: defaults,
    /* Ein zweites Oeffnen an einer anderen Zeile soll den dann ersten freien
       Platz zeigen und nicht den des vorigen Projekts. */
    values: project === null ? undefined : defaults,
  })

  const submit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(Number(values.position))
      onOpenChange(false)
    } catch (error) {
      if (!isApiError(error)) {
        throw error
      }
      form.setError("root.server", {
        type: "server",
        message: t(apiErrorMessageKey(error), { defaultValue: error.message }),
      })
    }
  })

  const rootError = form.formState.errors.root?.server?.message

  return (
    <Dialog
      open={project !== null}
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
          <DialogTitle>{t("administration.top10.place.title")}</DialogTitle>
          <DialogDescription>
            {project === null
              ? ""
              : t("administration.top10.place.description", {
                  title: project.title,
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
                description={t("administration.top10.place.positionHint")}
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
              {t("administration.top10.place.confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
