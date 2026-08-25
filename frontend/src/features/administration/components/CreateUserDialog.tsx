import { zodResolver } from "@hookform/resolvers/zod"
import {
  CheckIcon,
  CopyIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
} from "lucide-react"
import { useId, useState, type RefObject } from "react"
import {
  Controller,
  useForm,
  useWatch,
  type FieldError as RhfFieldError,
} from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  apiErrorMessageKey,
  applyValidationErrors,
  isApiError,
} from "@/api/errors"
import type { AdminUserResponse } from "@/api/types"
import { FilterSelect } from "@/components/common/FilterSelect"
import { PasswordInput } from "@/components/common/PasswordInput"
import { Alert, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ADMIN_USER_ROLES } from "@/features/administration/adminUserFilters"
import {
  CREATE_USER_SERVER_FIELDS,
  createUserFormSchema,
  type CreateUserFormValues,
} from "@/features/administration/components/CreateUserDialog.schema"
import { useCreateUser } from "@/features/administration/hooks/useAdminUsers"
import { DetailRow } from "@/features/administration/components/DetailRow"
import { generateInitialPassword } from "@/features/administration/initialPassword"
import { copyText } from "@/lib/clipboard"
import { fullNameOf } from "@/lib/name"

/** Der Hausstil fuer Feldbeschriftungen, wie im FilterSelect daneben. */
const LABEL_CLASS =
  "type-label-xs text-muted-foreground uppercase group-data-[invalid=true]/field:text-destructive"

type FieldName = keyof CreateUserFormValues

/**
 * Der modale Dialog „Konto anlegen" (Template „Konto anlegen", KAN-39),
 * ausgeloest vom primaeren Knopf rechts oben in der Nutzerverwaltung.
 *
 * <p><strong>Alle fuenf Zustaende des Entwurfs stecken in dieser einen
 * Komponente</strong>, weil es fuenf Zustaende eines Vorgangs sind und nicht
 * fuenf Dialoge: leer, ausgefuellt (mit dem Hinweis an der Rolle ADMIN),
 * Feldfehler, Bestaetigung und die Meldungsleiste ohne Feldbezug.
 *
 * <p><strong>Feldfehler und Meldungsleiste sind zwei verschiedene
 * Dinge.</strong> Was der Server einem Feld zuordnet, erscheint am Feld:
 * §6.2 liefert die Meldung im Format {@code feld: Text}, sowohl beim 400
 * VALIDATION_FAILED (fremde Domain der HSB-Adresse) als auch beim 409
 * RESOURCE_IN_USE (bereits vergebene Adresse). Die Leiste am Kopf bleibt
 * dem vorbehalten, was keinem Feld zuzuordnen ist, etwa einem 403.
 *
 * <p><strong>Das Initialpasswort erzeugt der Client</strong> (Contract v27,
 * §6.1). Der Server nimmt es entgegen und gibt es nicht zurueck; deshalb
 * haelt der Dialog es nach dem Anlegen selbst, damit „Zugangsdaten
 * kopieren" es noch nennen kann. Ohne die drei Aktionen am Feld und in der
 * Bestaetigung tippt die Administration das Passwort ab, das sie
 * weitergeben muss, und erzeugt genau die schwachen Passwoerter, gegen die
 * §6.7 den erzwungenen Wechsel setzt.
 *
 * <p><strong>Kein {@code alertdialog}.</strong> Der Dialog traegt ein
 * Formular; die Rolle ist fuer Rueckfragen ohne Eingabe gedacht (Skill
 * frontend-design).
 */
export function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
  finalFocus,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Meldung fuer die Live-Region der Seite, sobald das Konto steht. */
  onCreated?: (account: AdminUserResponse) => void
  /** Ziel des Fokus beim Schliessen, sonst faellt er auf body (SC 2.4.3). */
  finalFocus?: RefObject<HTMLElement | null>
}) {
  const { t } = useTranslation()
  const fieldId = useId()
  const create = useCreateUser()

  /*
   * Der angelegte Zustand haelt das Passwort mit: die Antwort des Servers
   * fuehrt es nicht (Contract v27), und die Bestaetigung braucht es fuer
   * „Zugangsdaten kopieren".
   */
  const [created, setCreated] = useState<{
    account: AdminUserResponse
    password: string
  } | null>(null)
  const [copyNotice, setCopyNotice] = useState("")
  const [confirmLeave, setConfirmLeave] = useState(false)

  const form = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      hsbEmail: "",
      role: undefined,
      password: "",
    },
  })

  /* useWatch statt form.watch: vertraeglich mit dem React Compiler
     (Lint react-hooks/incompatible-library), wie im BulkStatusDialog.
     Beobachtet wird allein das Passwort, weil der Kopierknopf ausserhalb
     seines Feldes steht; die Rolle liest ihr eigener Controller. */
  const password = useWatch({ control: form.control, name: "password" })

  /*
   * Zod hinterlegt i18n-Schluessel, applyValidationErrors den Meldungstext
   * des Servers (type "server"); uebersetzt wird nur, was aus dem Schema
   * kommt (Muster aus KAN-8).
   */
  const messageOf = (error: RhfFieldError | undefined): string | undefined => {
    if (error?.message === undefined) {
      return undefined
    }
    return error.type === "server" ? error.message : t(error.message)
  }

  function reset() {
    form.reset()
    form.clearErrors()
    setCreated(null)
    setCopyNotice("")
    setConfirmLeave(false)
    create.reset()
  }

  async function copy(text: string, doneKey: string) {
    const ok = await copyText(text)
    setCopyNotice(ok ? t(doneKey) : t("administration.users.create.copyFailed"))
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const account = await create.mutateAsync({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim(),
        hsbEmail: values.hsbEmail.trim(),
        role: values.role,
        password: values.password,
      })
      setCreated({ account, password: values.password })
      onCreated?.(account)
    } catch (error) {
      if (!isApiError(error)) {
        throw error
      }
      /*
       * Beide Fehlerbilder nennen das Feld im selben Format (§6.2): der 400
       * bei fremder Domain der HSB-Adresse, der 409 bei bereits vergebener
       * Adresse. Sie laufen deshalb durch dieselbe Zuordnung; was sich
       * keinem Feld zuordnen laesst, landet als Meldung am Formular und
       * erscheint als Leiste am Kopf des Koerpers.
       */
      if (
        error.errorCode === "VALIDATION_FAILED" ||
        error.errorCode === "RESOURCE_IN_USE"
      ) {
        applyValidationErrors(error, CREATE_USER_SERVER_FIELDS, (name, issue) =>
          form.setError(name as FieldName | "root.server", issue)
        )
        return
      }
      form.setError("root.server", {
        type: "server",
        message: t(apiErrorMessageKey(error), { defaultValue: error.message }),
      })
    }
  })

  const formError = form.formState.errors.root?.server?.message
  /*
   * Beim Rendern gelesen und nicht erst im Handler: react-hook-form meldet
   * ueber einen Proxy nur die Teile des formState an, die waehrend des
   * Renderns abgefragt werden. Ein isDirty, das ausschliesslich in einem
   * Klickhandler steht, bliebe deshalb dauerhaft false.
   */
  const isDirty = form.formState.isDirty

  /**
   * Schliesst der Dialog gerade ein begonnenes Formular weg?
   *
   * <p>Escape und der Klick daneben werfen sonst sechs ausgefuellte Felder
   * und ein erzeugtes Initialpasswort ohne Rueckfrage fort; das Haus fragt an
   * solchen Stellen zurueck (Vorbild ProjectMetadataPage). Nach dem Anlegen
   * ist nichts mehr zu verlieren: das Konto steht, und die Zusammenfassung
   * darf zugehen.
   */
  function loosesInput() {
    return created === null && isDirty
  }

  const textField = (
    name: Extract<FieldName, "firstName" | "lastName" | "email" | "hsbEmail">,
    options: { type?: string; autoComplete?: string; description?: string } = {}
  ) => (
    <Controller
      name={name}
      control={form.control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className="gap-1.5">
          <FieldLabel htmlFor={`${fieldId}-${name}`} className={LABEL_CLASS}>
            {t(`administration.users.create.field.${name}`)}
          </FieldLabel>
          <Input
            {...field}
            id={`${fieldId}-${name}`}
            type={options.type ?? "text"}
            autoComplete={options.autoComplete ?? "off"}
            placeholder={t(`administration.users.create.placeholder.${name}`)}
            aria-invalid={fieldState.invalid}
            aria-describedby={
              fieldState.invalid
                ? `${fieldId}-${name}-error`
                : options.description !== undefined
                  ? `${fieldId}-${name}-hint`
                  : undefined
            }
          />
          {/* Der Hilfetext weicht im Fehlerfall der Meldung, wie im Entwurf:
              beides untereinander schoebe die Fusszeile aus dem Blick. */}
          {fieldState.invalid ? (
            <FieldError
              id={`${fieldId}-${name}-error`}
              errors={[{ message: messageOf(fieldState.error) }]}
            />
          ) : (
            options.description !== undefined && (
              <FieldDescription id={`${fieldId}-${name}-hint`}>
                {options.description}
              </FieldDescription>
            )
          )}
        </Field>
      )}
    />
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && loosesInput()) {
          setConfirmLeave(true)
          return
        }
        if (!next) {
          reset()
        }
        onOpenChange(next)
      }}
    >
      <DialogContent
        className="rounded-modal sm:max-w-xl"
        finalFocus={finalFocus}
      >
        <DialogHeader>
          <DialogTitle>{t("administration.users.create.title")}</DialogTitle>
          <DialogDescription>
            {created === null
              ? t("administration.users.create.subtitle")
              : t("administration.users.create.doneSubtitle")}
          </DialogDescription>
        </DialogHeader>

        {created === null ? (
          <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
            {/* Zustand 5: die Meldungsleiste steht oben im Koerper und
                traegt nur, was keinem Feld zuzuordnen ist. Die Eingaben
                bleiben stehen. */}
            {formError !== undefined && (
              <Alert variant="destructive">
                <AlertTitle>{formError}</AlertTitle>
              </Alert>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              {textField("firstName", { autoComplete: "given-name" })}
              {textField("lastName", { autoComplete: "family-name" })}
            </div>

            {textField("email", {
              type: "email",
              description: t("administration.users.create.hint.email"),
            })}
            {textField("hsbEmail", {
              type: "email",
              description: t("administration.users.create.hint.hsbEmail"),
            })}

            <Controller
              name="role"
              control={form.control}
              render={({ field, fieldState }) => (
                <div className="flex flex-col gap-2">
                  <FilterSelect
                    id={`${fieldId}-role`}
                    label={t("administration.users.create.field.role")}
                    allLabel={t("administration.users.create.rolePlaceholder")}
                    options={ADMIN_USER_ROLES.map((entry) => ({
                      value: entry,
                      label: t(
                        `administration.users.create.roleOption.${entry}`
                      ),
                    }))}
                    value={field.value ?? null}
                    onValueChange={(value) => field.onChange(value)}
                    error={
                      fieldState.invalid
                        ? messageOf(fieldState.error)
                        : undefined
                    }
                  />
                  {/* Zustand 2: der Hinweis erscheint erst mit der Wahl
                      ADMIN. Er warnt nicht, er erklaert, was das Konto
                      danach darf (§2.1). */}
                  {field.value === "ADMIN" && (
                    <p className="type-body-sm flex items-start gap-2 rounded-control bg-accent px-3 py-2 text-accent-foreground">
                      <ShieldAlertIcon
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0"
                      />
                      {t("administration.users.create.adminHint")}
                    </p>
                  )}
                </div>
              )}
            />

            <Controller
              name="password"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="gap-1.5">
                  <FieldLabel
                    htmlFor={`${fieldId}-password`}
                    className={LABEL_CLASS}
                  >
                    {t("administration.users.create.field.password")}
                  </FieldLabel>
                  <PasswordInput
                    {...field}
                    id={`${fieldId}-password`}
                    autoComplete="new-password"
                    placeholder={t(
                      "administration.users.create.placeholder.password"
                    )}
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      fieldState.invalid
                        ? `${fieldId}-password-error`
                        : `${fieldId}-password-hint`
                    }
                  />
                  {fieldState.invalid ? (
                    <FieldError
                      id={`${fieldId}-password-error`}
                      errors={[{ message: messageOf(fieldState.error) }]}
                    />
                  ) : (
                    <FieldDescription id={`${fieldId}-password-hint`}>
                      {t("administration.users.create.hint.password")}
                    </FieldDescription>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const generated = generateInitialPassword()
                        form.setValue("password", generated, {
                          shouldValidate: true,
                          shouldDirty: true,
                        })
                        setCopyNotice(
                          t("administration.users.create.passwordGenerated")
                        )
                      }}
                    >
                      <RefreshCwIcon aria-hidden="true" />
                      {t("administration.users.create.generatePassword")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      /* Leer ist nichts zu kopieren; der Entwurf zeigt den
                         Knopf im Zustand „leer" ausdruecklich gesperrt. */
                      disabled={password === ""}
                      onClick={() => {
                        void copy(
                          password,
                          "administration.users.create.passwordCopied"
                        )
                      }}
                    >
                      <CopyIcon aria-hidden="true" />
                      {t("administration.users.create.copyPassword")}
                    </Button>
                  </div>
                </Field>
              )}
            />

            <DialogFooter>
              {/* Kein DialogClose: der Abbruch laeuft ueber dieselbe
                  Rueckfrage wie Escape und der Klick daneben. */}
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  if (loosesInput()) {
                    setConfirmLeave(true)
                    return
                  }
                  reset()
                  onOpenChange(false)
                }}
              >
                {t("common.action.cancel")}
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {t("administration.users.create.submit")}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Zustand 4: der Koerper wird durch die Zusammenfassung
                ersetzt. Das neue Konto steht danach in der Liste und die
                Zaehlung ist gestiegen. */}
            <p className="flex items-center gap-2 font-semibold">
              <CheckIcon
                aria-hidden="true"
                className="size-5 shrink-0 text-pill-success-fg"
              />
              {fullNameOf(created.account)}
            </p>
            <dl className="flex flex-col gap-3">
              <DetailRow
                label={t("administration.users.create.field.email")}
                value={created.account.email}
              />
              <DetailRow
                label={t("administration.users.create.field.hsbEmail")}
                value={created.account.hsbEmail}
              />
              <DetailRow
                label={t("administration.users.create.field.role")}
                value={t(`user.role.${created.account.role}`)}
              />
            </dl>
            <p className="type-body-sm text-muted-foreground">
              {t("administration.users.create.doneHint")}
            </p>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void copy(
                    t("administration.users.create.credentials", {
                      name: fullNameOf(created.account),
                      email: created.account.email,
                      password: created.password,
                    }),
                    "administration.users.create.credentialsCopied"
                  )
                }}
              >
                <CopyIcon aria-hidden="true" />
                {t("administration.users.create.copyCredentials")}
              </Button>
              <DialogClose render={<Button type="button" />}>
                {t("administration.users.create.done")}
              </DialogClose>
            </DialogFooter>
          </div>
        )}

        {/* Kopieren aendert nichts Sichtbares: ohne Ansage bliebe der Erfolg
            und vor allem der Misserfolg unbemerkt (SC 4.1.3). */}
        <span className="sr-only" role="status">
          {copyNotice}
        </span>

        <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
          <AlertDialogContent className="rounded-modal">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("administration.users.create.leave.title")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("administration.users.create.leave.description")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>
                {t("administration.users.create.leave.cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                type="button"
                variant="destructive"
                onClick={() => {
                  reset()
                  onOpenChange(false)
                }}
              >
                {t("administration.users.create.leave.confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  )
}
