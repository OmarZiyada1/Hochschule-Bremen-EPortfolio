import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon } from "lucide-react"
import { useId, useMemo } from "react"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  apiErrorMessageKey,
  applyValidationErrors,
  isApiError,
} from "@/api/errors"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  NAME_SERVER_FIELDS,
  nameFormSchema,
  type NameFormValues,
} from "@/features/administration/components/masterDataName.schema"
import { cn } from "@/lib/utils"

/**
 * Das Anlegefeld der einfeldrigen Stammdaten (Frames „Admin · Kategorien"
 * und „Admin · Semester", KAN-39): ein Eingabefeld mit Plus-Schaltflaeche
 * rechts daneben.
 *
 * <p><strong>Ein echtes Formular, kein Feld mit Knopf.</strong> So legt die
 * Eingabetaste an, ohne dass ein eigener Tastaturhandler danebensteht, und
 * die Pruefung laeuft ueber dasselbe zod-Schema wie das Umbenennen
 * (Frontend-Regel 12).
 *
 * <p><strong>Feld und Schaltflaeche stehen nebeneinander, nicht
 * ineinander.</strong> {@code input-group} legte die Schaltflaeche in das
 * Feld; der Frame zeichnet sie als eigene quadratische Flaeche daneben, und
 * genau das unterscheidet das Anlegefeld sichtbar vom Suchfeld links davon
 * (Befund des frontend-reviewers zu KAN-39).
 *
 * <p><strong>Der Server bleibt verbindlich.</strong> Ein bereits vergebener
 * Name ergibt <strong>409</strong> RESOURCE_IN_USE und erscheint als eigene
 * Meldung am Feld, nicht als Formatfehler; ein 400 VALIDATION_FAILED nennt
 * das Feld im Format {@code feld: Text} (§6.2) und landet ueber
 * {@code applyValidationErrors} ebenfalls dort. Alles andere steht als
 * Meldung darunter.
 */
export function NameCreateForm({
  label,
  placeholder,
  maxLength,
  tooLongMessageKey,
  submitLabel,
  pending,
  onSubmit,
  className,
}: {
  /** Sichtbar nur fuer Hilfsmittel: der Entwurf zeigt allein den Platzhalter. */
  label: string
  placeholder: string
  maxLength: number
  tooLongMessageKey: string
  /** Zugaenglicher Name der Plus-Schaltflaeche. */
  submitLabel: string
  pending: boolean
  /** Wirft den {@code ApiError} weiter, damit er hier am Feld landet. */
  onSubmit: (name: string) => Promise<void>
  className?: string
}) {
  const { t } = useTranslation()
  const fieldId = useId()

  const schema = useMemo(
    () => nameFormSchema(maxLength, tooLongMessageKey),
    [maxLength, tooLongMessageKey]
  )

  const form = useForm<NameFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  })

  const submit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values.name.trim())
      form.reset({ name: "" })
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
    <form
      onSubmit={submit}
      noValidate
      className={cn("flex flex-col gap-2", className)}
    >
      <Controller
        name="name"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid} className="gap-1.5">
            <FieldLabel htmlFor={fieldId} className="sr-only">
              {label}
            </FieldLabel>
            <div className="flex items-start gap-2">
              <Input
                {...field}
                id={fieldId}
                type="text"
                autoComplete="off"
                placeholder={placeholder}
                className="h-11"
                aria-invalid={fieldState.invalid}
                aria-describedby={
                  fieldState.invalid ? `${fieldId}-error` : undefined
                }
              />
              <Button
                type="submit"
                size="icon"
                className="size-11 shrink-0"
                disabled={pending}
              >
                <PlusIcon aria-hidden="true" />
                <span className="sr-only">{submitLabel}</span>
              </Button>
            </div>
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
      {rootError !== undefined && (
        <p role="alert" className="type-body-sm text-destructive">
          {rootError}
        </p>
      )}
    </form>
  )
}
