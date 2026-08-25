import { zodResolver } from "@hookform/resolvers/zod"
import { useId, useMemo, type RefObject } from "react"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  apiErrorMessageKey,
  applyValidationErrors,
  isApiError,
} from "@/api/errors"
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  parentFieldOf,
  studyStructureSchema,
  type StudyStructureFormValues,
  type StudyStructureKind,
} from "@/features/administration/components/StudyStructureDialog.schema"

const LABEL_CLASS =
  "type-label-xs text-muted-foreground uppercase group-data-[invalid=true]/field:text-destructive"

/**
 * Das Formular der Studienstruktur (§3.7 bis §3.9, KAN-39), fuer alle drei
 * Ebenen und fuer Anlegen wie Aendern.
 *
 * <p><strong>Warum ein Dialog und kein Feld in der Spalte.</strong> Der Frame
 * zeichnet je Spalte ein Textfeld mit Plus-Schaltflaeche. Fuer die Fakultaet
 * reicht das nicht: {@code abbreviation} ist unique und not null (§3.8), ein
 * Name allein ergaebe 400. Entschieden ist deshalb, dass jedes Plus dieses
 * Formular oeffnet (Klaerungsrunde zu KAN-39); das Feld aus dem Frame bleibt
 * als Einstieg stehen und der getippte Name steht schon darin. Dasselbe
 * Formular traegt das Aendern, sonst gaebe es zwei Fassungen derselben drei
 * Felder.
 *
 * <p><strong>Die uebergeordnete Zeile ist waehlbar und nicht fest.</strong>
 * Sie ist beim Oeffnen die gerade ausgewaehlte Spalte links, laesst sich aber
 * aendern: genau so haengt ein Studiengang an eine andere Fakultaet um, ohne
 * dass es dafuer eine eigene Aktion braucht.
 */
export function StudyStructureDialog({
  kind,
  open,
  onOpenChange,
  mode,
  initial,
  parents,
  pending,
  onSubmit,
  finalFocus,
}: {
  kind: StudyStructureKind
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  initial: StudyStructureFormValues
  /** Waehlbare uebergeordnete Zeilen; bei der Fakultaet leer. */
  parents: readonly { id: string; name: string }[]
  pending: boolean
  /** Wirft den {@code ApiError} weiter, damit er hier am Feld landet. */
  onSubmit: (values: StudyStructureFormValues) => Promise<void>
  finalFocus?: RefObject<HTMLElement | null>
}) {
  const { t } = useTranslation()
  const fieldId = useId()

  const schema = useMemo(() => studyStructureSchema(kind), [kind])
  const parentField = parentFieldOf(kind)

  const form = useForm<StudyStructureFormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial,
    /* Ein zweites Oeffnen an einer anderen Zeile soll deren Werte zeigen. */
    values: initial,
  })

  const submit = form.handleSubmit(async (values) => {
    try {
      await onSubmit({
        name: values.name.trim(),
        abbreviation: values.abbreviation.trim(),
        parentId: values.parentId,
      })
      onOpenChange(false)
    } catch (error) {
      if (!isApiError(error)) {
        throw error
      }
      /*
       * Nur die Fakultaet hat hier eine eindeutige Spalte, und das ist ihr
       * Kuerzel (§3.8). Studiengang und Modul tragen keine; ein 409 haette
       * an ihnen kein Feld, an das er gehoerte, und laeuft deshalb in die
       * Meldung am Kopf (Befund des contract-pruefers).
       */
      if (error.errorCode === "RESOURCE_IN_USE" && kind === "faculty") {
        form.setError("abbreviation", {
          type: "server",
          message: t("administration.masterData.nameInUse"),
        })
        return
      }
      if (error.errorCode === "VALIDATION_FAILED") {
        const fields = [
          "name",
          "abbreviation",
          ...(parentField === null ? [] : [parentField]),
        ]
        applyValidationErrors(error, fields, (name, issue) => {
          /* Der Server nennt facultyId beziehungsweise studyProgramId; im
             Formular heisst beides parentId (Schema-Kommentar). */
          const target =
            parentField !== null && name === parentField ? "parentId" : name
          form.setError(
            target as keyof StudyStructureFormValues | "root.server",
            issue
          )
        })
        return
      }
      form.setError("root.server", {
        type: "server",
        message: t(apiErrorMessageKey(error), { defaultValue: error.message }),
      })
    }
  })

  const rootError = form.formState.errors.root?.server?.message

  const textField = (
    name: "name" | "abbreviation",
    label: string,
    optional: boolean
  ) => (
    <Controller
      name={name}
      control={form.control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className="gap-1.5">
          <FieldLabel htmlFor={`${fieldId}-${name}`} className={LABEL_CLASS}>
            {label}
            {optional && (
              <span className="ml-1 lowercase">
                {t("administration.masterData.optional")}
              </span>
            )}
          </FieldLabel>
          <Input
            {...field}
            id={`${fieldId}-${name}`}
            type="text"
            autoComplete="off"
            aria-invalid={fieldState.invalid}
            aria-describedby={
              fieldState.invalid ? `${fieldId}-${name}-error` : undefined
            }
          />
          {fieldState.invalid && (
            <FieldError id={`${fieldId}-${name}-error`}>
              {fieldState.error?.type === "server"
                ? fieldState.error.message
                : t(fieldState.error?.message ?? "")}
            </FieldError>
          )}
        </Field>
      )}
    />
  )

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
          <DialogTitle>
            {t(`administration.studyStructure.dialog.${mode}.${kind}`)}
          </DialogTitle>
          <DialogDescription>
            {t(`administration.studyStructure.dialog.description.${kind}`)}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          {rootError !== undefined && (
            <Alert variant="destructive">
              <AlertTitle>{rootError}</AlertTitle>
            </Alert>
          )}

          {textField(
            "name",
            t("administration.studyStructure.field.name"),
            false
          )}
          {textField(
            "abbreviation",
            t("administration.studyStructure.field.abbreviation"),
            kind !== "faculty"
          )}

          {parentField !== null && (
            <Controller
              name="parentId"
              control={form.control}
              render={({ field, fieldState }) => (
                <FilterSelect
                  label={t(
                    `administration.studyStructure.field.${parentField}`
                  )}
                  allLabel={t(
                    `administration.studyStructure.parentPlaceholder.${kind}`
                  )}
                  options={parents.map((entry) => ({
                    value: entry.id,
                    label: entry.name,
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
          )}

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
