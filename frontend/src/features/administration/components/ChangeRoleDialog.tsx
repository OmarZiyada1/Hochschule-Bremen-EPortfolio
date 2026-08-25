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
import type { AdminUserResponse, Role } from "@/api/types"
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
import { ADMIN_USER_ROLES } from "@/features/administration/adminUserFilters"
import { roleValueSchema } from "@/features/administration/components/userRole.schema"
import { fullNameOf } from "@/lib/name"

const changeRoleSchema = z.object({ role: roleValueSchema })

/**
 * Der Feldname, den der Server in einem 400 VALIDATION_FAILED nennen kann
 * (§6.2, Format {@code feld: Text}). Am eigenen Konto weist er {@code role}
 * genau so ab (Contract v26).
 */
const ROLE_SERVER_FIELDS = ["role"] as const

type ChangeRoleFormValues = z.infer<typeof changeRoleSchema>

/**
 * Die Zeilenaktion „Rolle aendern" (§2.1, §3.1.1, §6.1; KAN-39): Auswahl aus
 * den drei Rollen, dazu der Hinweis auf die sofortige Wirkung.
 *
 * <p><strong>Ein Dialog und kein Untermenue.</strong> Die Aenderung greift
 * beim naechsten Request, auch bei einer bereits bestehenden Anmeldung
 * (§6.5); sie braucht deshalb einen Platz fuer diesen Satz, und ein
 * Menueeintrag hat keinen. Dazu kommt die Bedienung: ein Untermenue mit
 * Radioeintraegen ist mit der Tastatur nur ueber eine zweite Ebene
 * erreichbar, das Auswahlfeld hier nicht (SC 2.1.1).
 *
 * <p><strong>Am eigenen Konto gibt es diese Aktion nicht.</strong> Der Server
 * weist sie mit 400 VALIDATION_FAILED ab (Contract v26); das Zeilenmenue
 * blendet den Eintrag deshalb aus, und ein trotzdem eintreffender 400
 * erscheint hier als Meldung.
 */
export function ChangeRoleDialog({
  account,
  onOpenChange,
  pending,
  onSubmit,
  finalFocus,
}: {
  /** Das betroffene Konto, oder {@code null}, wenn der Dialog zu ist. */
  account: AdminUserResponse | null
  onOpenChange: (open: boolean) => void
  pending: boolean
  /** Wirft den {@code ApiError} weiter, damit er hier erscheint. */
  onSubmit: (role: Role) => Promise<void>
  finalFocus?: RefObject<HTMLElement | null>
}) {
  const { t } = useTranslation()

  const form = useForm<ChangeRoleFormValues>({
    resolver: zodResolver(changeRoleSchema),
    defaultValues: { role: account?.role },
    /* Ein zweites Oeffnen an einer anderen Zeile soll deren Rolle zeigen. */
    values: account === null ? undefined : { role: account.role },
  })

  const submit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values.role)
      onOpenChange(false)
    } catch (error) {
      if (!isApiError(error)) {
        throw error
      }
      /* Der 400 gehoert an das Auswahlfeld: der Server nennt {@code role}
         im Format „feld: Text" (§6.2), etwa am eigenen Konto (v26). */
      if (error.errorCode === "VALIDATION_FAILED") {
        applyValidationErrors(error, ROLE_SERVER_FIELDS, (name, issue) =>
          form.setError(name as "role" | "root.server", issue)
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
      open={account !== null}
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
            {t("administration.users.roleDialog.title")}
          </DialogTitle>
          <DialogDescription>
            {t("administration.users.roleDialog.description", {
              name: account === null ? "" : fullNameOf(account),
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
            name="role"
            control={form.control}
            render={({ field, fieldState }) => (
              <FilterSelect
                label={t("administration.users.column.role")}
                allLabel={t("administration.users.create.rolePlaceholder")}
                options={ADMIN_USER_ROLES.map((role) => ({
                  value: role,
                  label: t(`user.role.${role}`),
                }))}
                value={field.value ?? null}
                onValueChange={(value) => field.onChange(value)}
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
              {t("administration.users.roleDialog.confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
