import { zodResolver } from "@hookform/resolvers/zod"
import { useId, useMemo, type RefObject } from "react"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  apiErrorMessageKey,
  applyValidationErrors,
  isApiError,
} from "@/api/errors"
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
import { Input } from "@/components/ui/input"
import {
  NAME_SERVER_FIELDS,
  nameFormSchema,
  type NameFormValues,
} from "@/features/administration/components/masterDataName.schema"

/**
 * Das Umbenennen einer einfeldrigen Stammdatenzeile (KAN-39): Kategorie und
 * Semester tragen nur einen Namen, und beide benutzen deshalb denselben
 * Dialog.
 *
 * <p>Er prueft ueber dasselbe zod-Schema wie das Anlegefeld
 * ({@code NameCreateForm}) und behandelt dieselben zwei Serverfehler am
 * Feld: <strong>409</strong> RESOURCE_IN_USE bei bereits vergebenem Namen
 * und <strong>400</strong> VALIDATION_FAILED im Format {@code feld: Text}
 * (§6.2).
 *
 * <p>Kein {@code alertdialog}: der Dialog traegt ein Formular, und die Rolle
 * ist Rueckfragen ohne Eingabe vorbehalten (Skill frontend-design).
 */
export function NameEditDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  currentName,
  maxLength,
  tooLongMessageKey,
  pending,
  onSubmit,
  finalFocus,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  label: string
  /** Der bisherige Name; er steht beim Oeffnen im Feld. */
  currentName: string
  maxLength: number
  tooLongMessageKey: string
  pending: boolean
  /** Wirft den {@code ApiError} weiter, damit er hier am Feld landet. */
  onSubmit: (name: string) => Promise<void>
  finalFocus?: RefObject<HTMLElement | null>
}) {
  const { t } = useTranslation()
  const fieldId = useId()

  const schema = useMemo(
    () => nameFormSchema(maxLength, tooLongMessageKey),
    [maxLength, tooLongMessageKey]
  )

  const form = useForm<NameFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: currentName },
    /* Ein zweites Oeffnen an einer anderen Zeile soll deren Namen zeigen und
       nicht den der vorigen: values gewinnt gegen defaultValues, sobald sich
       der Wert aendert. */
    values: { name: currentName },
  })

  const submit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values.name.trim())
      onOpenChange(false)
    } catch (error) {
      if (!isApiError(error)) {
        throw error
      }
      if (error.errorCode === "RESOURCE_IN_USE") {
        form.setError("name", {
          type: "server",
          message: t("administration.masterData.nameInUse"),
        })
        return
      }
      if (error.errorCode === "VALIDATION_FAILED") {
        applyValidationErrors(error, NAME_SERVER_FIELDS, (name, issue) =>
          form.setError(name as "name" | "root.server", issue)
        )
        return
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
      open={open}
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
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          {rootError !== undefined && (
            <Alert variant="destructive">
              <AlertTitle>{rootError}</AlertTitle>
            </Alert>
          )}

          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1.5">
                <FieldLabel
                  htmlFor={fieldId}
                  className="type-label-xs text-muted-foreground uppercase group-data-[invalid=true]/field:text-destructive"
                >
                  {label}
                </FieldLabel>
                <Input
                  {...field}
                  id={fieldId}
                  type="text"
                  autoComplete="off"
                  aria-invalid={fieldState.invalid}
                  aria-describedby={
                    fieldState.invalid ? `${fieldId}-error` : undefined
                  }
                />
                {fieldState.invalid && (
                  <FieldError id={`${fieldId}-error`}>
                    {fieldState.error?.type === "server"
                      ? fieldState.error.message
                      : t(fieldState.error?.message ?? "")}
                  </FieldError>
                )}
              </Field>
            )}
          />

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="ghost" />}>
              {t("common.action.cancel")}
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {t("common.action.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
