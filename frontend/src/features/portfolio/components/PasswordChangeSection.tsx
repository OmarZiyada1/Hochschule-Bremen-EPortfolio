import { zodResolver } from "@hookform/resolvers/zod"
import { useId, useState } from "react"
import {
  Controller,
  useForm,
  type FieldError as RhfFieldError,
} from "react-hook-form"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"

import { apiErrorMessageKey, isApiError } from "@/api/errors"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  changePasswordFormSchema,
  type ChangePasswordFormValues,
} from "@/features/auth/ChangePasswordForm.schema"
import {
  useChangePassword,
  useRequestPasswordReset,
} from "@/features/auth/hooks/useAuthMutations"

/**
 * Der Bereich "Passwort aendern" aus "Profil bearbeiten" (KAN-69): ein Knopf,
 * der einen Dialog mit den drei Feldern aktuelles, neues und wiederholtes
 * Passwort oeffnet, gegen PUT /auth/password.
 *
 * <p><strong>Im Dialog und nicht als Abschnitt im Formular</strong>
 * (Sichtpruefung zu KAN-69): drei weitere Passwortfelder unter dem
 * Profilformular liessen die Seite wie ein einziges langes Formular
 * aussehen, obwohl es zwei getrennte Vorgaenge sind. Der Dialog trennt sie
 * sichtbar und laesst die Profileingaben unberuehrt stehen.
 *
 * <p><strong>Ohne E-Mail-Code</strong>, anders als der Weg "Passwort
 * vergessen" (Entscheidung aus der Klaerungsrunde zu KAN-69): wer angemeldet
 * ist und sein aktuelles Passwort kennt, braucht keinen zweiten Nachweis.
 *
 * <p><strong>"Passwort vergessen" nimmt fuer Angemeldete die Abkuerzung</strong>
 * (Sichtpruefung zu KAN-69): die Adresse ist bekannt, deshalb fordert der
 * Knopf den Code selbst an (POST /auth/forgot-password) und fuehrt direkt
 * zur Code-Eingabe auf {@code /reset-password}; die Seite zur Adresseingabe
 * entfaellt auf diesem Weg. Das nimmt die Entscheidung aus KAN-34 zurueck,
 * dort nicht zu navigieren: der Wechsel geschieht jetzt aus dem Dialog
 * heraus und nach ausdruecklichem Klick, nicht als Nebenwirkung des
 * Speicherns.
 */
export function PasswordChangeSection({
  email,
  unsavedChanges = false,
  headingLevel = 2,
}: {
  /** Die private Adresse; an sie geht der Ruecksetzcode (§6.1). */
  email: string
  /**
   * Traegt das Profilformular ungespeicherte Eingaben? Dann fragt der Weg
   * "Passwort vergessen" nach, bevor er die Seite verlaesst (Skill
   * frontend-design, Abschnitt 5).
   */
  unsavedChanges?: boolean
  headingLevel?: 2 | 3
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const changeMutation = useChangePassword()
  const requestReset = useRequestPasswordReset()
  const [open, setOpen] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [changed, setChanged] = useState(false)
  const formId = useId()
  const Heading = `h${headingLevel}` as "h2" | "h3"

  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  })

  const messageOf = (error: RhfFieldError | undefined): string | undefined => {
    if (error?.message === undefined) {
      return undefined
    }
    return error.type === "server" ? error.message : t(error.message)
  }

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      /* Beim erneuten Oeffnen ist die alte Bestaetigung ueberholt. */
      setChanged(false)
    } else {
      /* Ein geschlossener Dialog laesst keine getippten Passwoerter und
         keine alte Fehlermeldung stehen. */
      form.reset()
    }
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setChanged(false)
    try {
      await changeMutation.mutateAsync({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
      form.reset()
      setOpen(false)
      setChanged(true)
    } catch (error) {
      if (!isApiError(error)) {
        throw error
      }
      if (error.errorCode === "LOGIN_FAILED") {
        form.setError("currentPassword", {
          type: "server",
          message: t("changePassword.currentPasswordWrong"),
        })
        return
      }
      form.setError("root.server", {
        type: "server",
        message: t(apiErrorMessageKey(error), { defaultValue: error.message }),
      })
    }
  })

  /**
   * Der Weg verlaesst die Profilseite. Traegt das Formular ungespeicherte
   * Eingaben, wird vorher gefragt (Skill frontend-design, Abschnitt 5);
   * sonst geht es direkt weiter, denn ein Klick mehr ohne Grund ist auch
   * keine Freundlichkeit.
   *
   * <p><strong>Der Passwortdialog bleibt dabei offen</strong> und die
   * Rueckfrage legt sich darueber. Zwei Gruende, beide aus dem Review zu
   * KAN-69: ein Abbruch stellt so den Zustand von vorher wieder her, statt
   * den Dialog schon halb geschlossen zu hinterlassen, und eine
   * Fehlermeldung aus dem Aufruf hat weiterhin ihren Platz. Base UI kennt
   * geschachtelte Dialoge und regelt Fokus und Escape-Reihenfolge selbst.
   */
  const onForgottenClick = () => {
    if (unsavedChanges) {
      setConfirmLeave(true)
      return
    }
    void onForgotten()
  }

  const onForgotten = async () => {
    setConfirmLeave(false)
    try {
      await requestReset.mutateAsync({ email })
      setOpen(false)
      /* Die Adresse laeuft als Router-State mit, damit sie dort nicht
         erneut getippt werden muss; codeSent traegt den Hinweis, dass der
         Code bereits unterwegs ist. */
      navigate("/reset-password", { state: { email, codeSent: true } })
    } catch (error) {
      if (!isApiError(error)) {
        throw error
      }
      /* Fachlich scheitert der Aufruf nie (§3.16, immer 204); was hier
         ankommt, ist das Rate-Limit-429 oder ein Transportfehler. */
      form.setError("root.server", {
        type: "server",
        message: t(apiErrorMessageKey(error), { defaultValue: error.message }),
      })
    }
  }

  const labelClass =
    "type-label-xs text-muted-foreground uppercase group-data-[invalid=true]/field:text-destructive"

  const passwordField = (
    name: keyof ChangePasswordFormValues,
    autoComplete: string,
    hintId?: string
  ) => (
    <Controller
      name={name}
      control={form.control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className="gap-1.5">
          <FieldLabel htmlFor={`profile-${name}`} className={labelClass}>
            {t(`changePassword.${name}`)}
          </FieldLabel>
          <PasswordInput
            {...field}
            id={`profile-${name}`}
            autoComplete={autoComplete}
            aria-invalid={fieldState.invalid}
            aria-describedby={
              [hintId, fieldState.invalid ? `profile-${name}-error` : undefined]
                .filter((id) => id !== undefined)
                .join(" ") || undefined
            }
          />
          {hintId !== undefined && (
            <FieldDescription id={hintId}>
              {t("changePassword.newPasswordHint")}
            </FieldDescription>
          )}
          {fieldState.invalid && (
            <FieldError
              id={`profile-${name}-error`}
              errors={[{ message: messageOf(fieldState.error) }]}
            />
          )}
        </Field>
      )}
    />
  )

  return (
    <section className="flex flex-col items-start gap-3">
      <Heading className="type-h3 font-semibold text-primary">
        {t("portfolio.profile.passwordChange.title")}
      </Heading>
      <p className="type-body-sm text-muted-foreground">
        {t("portfolio.profile.passwordChange.description")}
      </p>

      {changed && (
        /* role=status: die Bestaetigung wird beim Erscheinen angesagt, ohne
           den Fokus zu verschieben. Sie steht im Abschnitt und nicht im
           Dialog, denn der ist dann bereits geschlossen. */
        <p role="status" className="type-body-sm text-muted-foreground">
          {t("portfolio.profile.passwordChange.success")}
        </p>
      )}

      <Dialog open={open} onOpenChange={onOpenChange}>
        {/* type=button: der Trigger liegt unterhalb des Profilformulars und
            darf es nicht absenden. */}
        <DialogTrigger render={<Button type="button" variant="outline" />}>
          {t("portfolio.profile.passwordChange.open")}
        </DialogTrigger>

        <DialogContent className="rounded-modal">
          <DialogHeader>
            <DialogTitle>
              {t("portfolio.profile.passwordChange.dialogTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("portfolio.profile.passwordChange.dialogDescription")}
            </DialogDescription>
          </DialogHeader>

          {/*
           * Das Formular traegt eine id, und der Absendeknopf steht ueber
           * form= darin, obwohl er in der Fussleiste sitzt: DialogFooter
           * bringt aus der Registry negative Aussenabstaende mit und ist auf
           * "letztes Kind der Popup-Flaeche" gebaut. Steckte er im Formular,
           * saesse die abgesetzte Leiste mitten im Dialog (Befund aus dem
           * Review zu KAN-69).
           */}
          <form id={formId} onSubmit={onSubmit} noValidate>
            <FieldGroup className="gap-4.5">
              {passwordField("currentPassword", "current-password")}
              {passwordField(
                "newPassword",
                "new-password",
                "profile-newPassword-hint"
              )}
              {passwordField("confirmPassword", "new-password")}

              {form.formState.errors.root?.server && (
                <Alert variant="destructive">
                  <AlertTitle>
                    {form.formState.errors.root.server.message}
                  </AlertTitle>
                </Alert>
              )}
            </FieldGroup>
          </form>

          <p className="type-body-sm text-muted-foreground">
            {t("changePassword.forgotPrompt")}{" "}
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 align-baseline font-semibold"
              disabled={requestReset.isPending}
              onClick={onForgottenClick}
            >
              {t("changePassword.forgotLink")}
            </Button>{" "}
            {t("portfolio.profile.passwordChange.forgotLeavesPage")}
          </p>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("portfolio.profile.passwordChange.cancel")}
            </DialogClose>
            <Button
              type="submit"
              form={formId}
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting
                ? t("changePassword.pending")
                : t("portfolio.profile.passwordChange.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Die Rueckfrage vor dem Verlassen der Seite, ueber dem noch offenen
          Passwortdialog. Ein Abbruch fuehrt damit genau dorthin zurueck, wo
          der Klick begann. */}
      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent className="rounded-modal">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("portfolio.profile.passwordChange.leaveDialog.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("portfolio.profile.passwordChange.leaveDialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("portfolio.profile.passwordChange.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={requestReset.isPending}
              onClick={() => void onForgotten()}
            >
              {t("portfolio.profile.passwordChange.leaveDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
