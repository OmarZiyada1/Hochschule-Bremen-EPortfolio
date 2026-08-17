import { zodResolver } from "@hookform/resolvers/zod"
import {
  Controller,
  useForm,
  type FieldError as RhfFieldError,
} from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Link, Navigate, useNavigate } from "react-router-dom"

import { useAuth } from "@/api/auth/AuthContext"
import { setPasswordChangeRequired } from "@/api/auth/authStore"
import { consumeRequestedRoute, LOGIN_PATH } from "@/api/auth/redirect"
import {
  apiErrorMessageKey,
  applyValidationErrors,
  isApiError,
} from "@/api/errors"
import { PasswordInput } from "@/components/common/PasswordInput"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Separator } from "@/components/ui/separator"
import {
  changePasswordFormSchema,
  type ChangePasswordFormValues,
} from "@/features/auth/ChangePasswordForm.schema"
import { AuthCardHeader } from "@/features/auth/components/AuthCardHeader"
import { AuthPageShell } from "@/features/auth/components/AuthPageShell"
import { useChangePassword } from "@/features/auth/hooks/useAuthMutations"

/**
 * Passwort aendern (KAN-33, §6.7): PUT /auth/password mit aktuellem und
 * neuem Passwort. Die Seite dient beiden Faellen, der erzwungenen
 * Aenderung eines Initialpassworts (dann mit Hinweis) und der freiwilligen.
 *
 * Kein Template: die drei Passwort-Seiten entstehen rahmenlos als
 * Auth-Karte im Stil von Login und Registrierung (Klaerungsrunde KAN-33).
 *
 * Die Route liegt bewusst nicht im RequireAuth-Wrapper: der leitet bei
 * gesetztem Flag genau hierher um und wuerde auf dieser Seite eine
 * Schleife bauen. Der Anmelde-Guard steht deshalb lokal. Nach Erfolg wird
 * das Flag im Store zurueckgesetzt und die urspruenglich angefragte Route
 * angesteuert (Ticket), ersatzweise die Projektliste.
 *
 * Wer das Initialpasswort nicht mehr weiss, kommt ueber "Passwort
 * vergessen?" weiter: §6.7 nimmt die beiden Ruecksetz-Endpoints genau
 * dafuer vom Gate aus (Klaerungsrunde KAN-33).
 */
export default function ChangePasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isAuthenticated, passwordChangeRequired } = useAuth()
  const changeMutation = useChangePassword()

  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  })

  if (!isAuthenticated) {
    return <Navigate to={LOGIN_PATH} replace />
  }

  const messageOf = (error: RhfFieldError | undefined): string | undefined => {
    if (error?.message === undefined) {
      return undefined
    }
    return error.type === "server" ? error.message : t(error.message)
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await changeMutation.mutateAsync({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
      setPasswordChangeRequired(false)
      navigate(consumeRequestedRoute() ?? "/projects")
    } catch (error) {
      if (!isApiError(error)) {
        throw error
      }
      if (error.errorCode === "LOGIN_FAILED") {
        /*
         * §6.7: das falsche aktuelle Passwort antwortet mit 401
         * LOGIN_FAILED. Die generische Login-Meldung waere hier irrefuehrend,
         * die eigene gehoert an das betroffene Feld.
         */
        form.setError("currentPassword", {
          type: "server",
          message: t("changePassword.currentPasswordWrong"),
        })
        return
      }
      if (error.errorCode === "VALIDATION_FAILED") {
        applyValidationErrors(
          error,
          ["currentPassword", "newPassword"],
          (name, fieldError) =>
            form.setError(
              name as "currentPassword" | "newPassword" | "root.server",
              fieldError
            )
        )
        return
      }
      form.setError("root.server", {
        type: "server",
        message: t(apiErrorMessageKey(error), { defaultValue: error.message }),
      })
    }
  })

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
          <FieldLabel htmlFor={field.name} className={labelClass}>
            {t(`changePassword.${name}`)}
          </FieldLabel>
          <PasswordInput
            {...field}
            id={field.name}
            autoComplete={autoComplete}
            aria-invalid={fieldState.invalid}
            aria-describedby={
              [hintId, fieldState.invalid ? `change-${name}-error` : undefined]
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
              id={`change-${name}-error`}
              errors={[{ message: messageOf(fieldState.error) }]}
            />
          )}
        </Field>
      )}
    />
  )

  return (
    <AuthPageShell breadcrumbLabel={t("changePassword.breadcrumb")}>
      <AuthCardHeader
        title={t("changePassword.title")}
        subtitle={t("changePassword.subtitle")}
      />

      {passwordChangeRequired && (
        <Alert>
          <AlertTitle>{t("changePassword.requiredNotice")}</AlertTitle>
        </Alert>
      )}

      <form onSubmit={onSubmit} noValidate>
        <FieldGroup className="gap-4.5">
          {passwordField("currentPassword", "current-password")}
          {passwordField("newPassword", "new-password", "change-newPassword-hint")}
          {passwordField("confirmPassword", "new-password")}

          {form.formState.errors.root?.server && (
            <Alert variant="destructive">
              <AlertTitle>{form.formState.errors.root.server.message}</AlertTitle>
            </Alert>
          )}

          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? t("changePassword.pending")
              : t("changePassword.submit")}
          </Button>
        </FieldGroup>
      </form>

      <Separator />

      <p className="type-body-sm text-center text-muted-foreground">
        {t("changePassword.forgotPrompt")}{" "}
        <Link
          to="/forgot-password"
          className="font-semibold text-primary underline-offset-4 hover:underline focus-visible:underline"
        >
          {t("changePassword.forgotLink")}
        </Link>
      </p>
    </AuthPageShell>
  )
}
