import { zodResolver } from "@hookform/resolvers/zod"
import { type RefObject } from "react"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"

import {
  apiErrorMessageKey,
  applyValidationErrors,
  isApiError,
} from "@/api/errors"
import type { CategoryResponse } from "@/api/types"
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

/**
 * Zielkategorie des Zusammenfuehrens (§6.1, KAN-46).
 *
 * <p>Pflichtfeld, wie serverseitig auch: ohne {@code targetCategoryId}
 * antwortet der Endpoint mit 400. Dass Quelle und Ziel verschieden sein
 * muessen, prueft das Formular gar nicht erst, denn die Quelle steht in der
 * Auswahl nicht zur Wahl; verbindlich bleibt der Server, der denselben Fall
 * mit 400 abweist.
 */
const mergeSchema = z.object({
  targetCategoryId: z
    .string({ message: "validation.masterData.targetRequired" })
    .min(1, "validation.masterData.targetRequired"),
})

type MergeFormValues = z.infer<typeof mergeSchema>

/**
 * Der Feldname, den der Server in einem 400 VALIDATION_FAILED nennen kann
 * (§6.2, Format {@code feld: Text}).
 */
const MERGE_SERVER_FIELDS = ["targetCategoryId"] as const

/**
 * Der Dialog „Kategorie zusammenfuehren" (§6.1, {@code POST
 * /admin/categories/{id}/merge}, KAN-39).
 *
 * <p><strong>Warum es das ueberhaupt gibt.</strong> Eine referenzierte
 * Kategorie laesst sich nicht loeschen (409 RESOURCE_IN_USE), und umhaengen
 * lassen sich ihre Projekte sonst nirgends. Eine versehentlich doppelt
 * angelegte Kategorie waere damit dauerhaft nicht aufraeumbar; das
 * Zusammenfuehren ist der fehlende dritte Weg neben Anlegen und Loeschen.
 *
 * <p><strong>Der Vorgang ist nicht umkehrbar</strong>, und der Dialog sagt
 * das: die Projekte haengen danach an der Zielkategorie und die Quelle ist
 * geloescht. Er erfasst auch veroeffentlichte Projekte, die dabei eine neue
 * version bekommen (§6.4); §4.1 steht dem nicht entgegen, weil hier die
 * Administration Stammdaten aufraeumt und nicht die Projektseite Inhalte
 * bearbeitet.
 */
export function CategoryMergeDialog({
  source,
  categories,
  onOpenChange,
  pending,
  onSubmit,
  finalFocus,
}: {
  /** Die Quellkategorie, oder {@code null}, wenn der Dialog zu ist. */
  source: CategoryResponse | null
  /** Alle Kategorien; die Quelle wird hier herausgenommen. */
  categories: readonly CategoryResponse[]
  onOpenChange: (open: boolean) => void
  pending: boolean
  /** Wirft den {@code ApiError} weiter, damit er hier erscheint. */
  onSubmit: (targetCategoryId: string) => Promise<void>
  finalFocus?: RefObject<HTMLElement | null>
}) {
  const { t } = useTranslation()

  const form = useForm<MergeFormValues>({
    resolver: zodResolver(mergeSchema),
    defaultValues: { targetCategoryId: "" },
    values: { targetCategoryId: "" },
  })

  const targets = categories.filter((entry) => entry.id !== source?.id)

  const submit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values.targetCategoryId)
      onOpenChange(false)
    } catch (error) {
      if (!isApiError(error)) {
        throw error
      }
      /*
       * Der 400 gehoert an das Auswahlfeld und nicht an den Kopf des
       * Dialogs: er trifft die Zielkategorie, und der Server nennt sie im
       * Format {@code feld: Text} (§6.2). Erreichbar ist er im Betrieb, auch
       * wenn die Quelle in der Auswahl fehlt: raeumt eine zweite
       * Admin-Person die Zielkategorie zwischen Listenaufbau und Absenden
       * weg, ergibt das genau diesen Fehler (§6.1, v32).
       */
      if (error.errorCode === "VALIDATION_FAILED") {
        applyValidationErrors(error, MERGE_SERVER_FIELDS, (name, issue) =>
          form.setError(name as "targetCategoryId" | "root.server", issue)
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
      open={source !== null}
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
            {t("administration.categories.mergeDialog.title")}
          </DialogTitle>
          <DialogDescription>
            {t("administration.categories.mergeDialog.description", {
              name: source?.name ?? "",
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
            name="targetCategoryId"
            control={form.control}
            render={({ field, fieldState }) => (
              <FilterSelect
                label={t("administration.categories.mergeDialog.targetLabel")}
                allLabel={t(
                  "administration.categories.mergeDialog.targetPlaceholder"
                )}
                options={targets.map((entry) => ({
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
                description={t(
                  "administration.categories.mergeDialog.targetHint"
                )}
              />
            )}
          />

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="ghost" />}>
              {t("common.action.cancel")}
            </DialogClose>
            <Button type="submit" disabled={pending || targets.length === 0}>
              {t("administration.categories.mergeDialog.confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
