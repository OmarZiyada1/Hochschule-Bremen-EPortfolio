import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import {
  Controller,
  useForm,
  type FieldError as RhfFieldError,
} from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Link, useLocation, useNavigate } from "react-router-dom"

import { setPasswordChangeRequired } from "@/api/auth/authStore"
import { apiErrorMessageKey, isApiError } from "@/api/errors"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Separator } from "@/components/ui/separator"
import { AuthCardHeader } from "@/features/auth/components/AuthCardHeader"
import { AuthPageShell } from "@/features/auth/components/AuthPageShell"
import { useResetPassword } from "@/features/auth/hooks/useAuthMutations"
import {
  resetPasswordFormSchema,
  type ResetPasswordFormValues,
} from "@/features/auth/ResetPasswordForm.schema"

/**
 * Passwort zuruecksetzen (KAN-33, §6.1): POST /auth/reset-password mit
 * privater Adresse, sechsstelligem Code aus der Mail (§2.11,
 * PASSWORD_RESET) und neuem Passwort nach §3.1.1. Die Zustellung ist ein
 * Code und kein Link (§2.11), deshalb dieselbe Code-Eingabe wie auf den
 * Bestaetigungsseiten und keine Token-Route.
 *
 * Kein Template: rahmenlose Auth-Karte (Klaerungsrunde KAN-33). Die
 * Adresse kommt als Router-State von der Vergessen-Seite mit und bleibt
 * editierbar; ein direkter Aufruf startet mit leerem Feld.
 *
 * Fehlerbild nach §6.1 (v35): unbekannte Adresse, nicht aktives Konto und
 * falscher, abgelaufener oder verbrauchter Code antworten alle identisch
 * mit 400 VERIFICATION_CODE_INVALID; die Seite zeigt dafuer genau eine
 * Meldung und schliesst nichts ueber das Konto. Das Rate-Limit-429
 * erscheint als Wartehinweis (§6.5, seit v34 auch an diesem Endpoint).
 */
export default function ResetPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const resetMutation = useResetPassword()
  const [succeeded, setSucceeded] = useState(false)

  const prefilledEmail =
    typeof (location.state as { email?: unknown } | null)?.email === "string"
      ? ((location.state as { email: string }).email)
      : ""

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: {
      email: prefilledEmail,
      code: "",
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

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await resetMutation.mutateAsync({
        email: values.email,
        code: values.code,
        newPassword: values.newPassword,
      })
      /*
       * Der Server setzt passwordChangeRequired mit dem Zuruecksetzen auf
       * false (§6.1). Wer den Weg aus dem Passwortzwang heraus gegangen
       * ist, traegt das Flag sonst lokal weiter und wuerde vom Wrapper
       * unnoetig zur Aenderungsseite geleitet; ohne Sitzung tut der Aufruf
       * nichts.
       */
      setPasswordChangeRequired(false)
      setSucceeded(true)
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

  const labelClass =
    "type-label-xs text-muted-foreground uppercase group-data-[invalid=true]/field:text-destructive"

  if (succeeded) {
    return (
      <AuthPageShell breadcrumbLabel={t("resetPassword.breadcrumb")}>
        <AuthCardHeader
          title={t("resetPassword.successTitle")}
          subtitle={t("resetPassword.subtitle")}
        />
        <Alert>
          <AlertTitle>{t("resetPassword.successHint")}</AlertTitle>
        </Alert>
        <Button type="button" onClick={() => navigate("/login")}>
          {t("resetPassword.toLogin")}
        </Button>
      </AuthPageShell>
    )
  }

  return (
    <AuthPageShell breadcrumbLabel={t("resetPassword.breadcrumb")}>
      <AuthCardHeader
        title={t("resetPassword.title")}
        subtitle={t("resetPassword.subtitle")}
      />

      <form onSubmit={onSubmit} noValidate>
        <FieldGroup className="gap-4.5">
          <Controller
            name="email"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1.5">
                <FieldLabel htmlFor={field.name} className={labelClass}>
                  {t("resetPassword.email")}
                </FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  type="email"
                  autoComplete="email"
                  aria-invalid={fieldState.invalid}
                  aria-describedby={
                    fieldState.invalid ? "reset-email-error" : undefined
                  }
                />
                {fieldState.invalid && (
                  <FieldError
                    id="reset-email-error"
                    errors={[{ message: messageOf(fieldState.error) }]}
                  />
                )}
              </Field>
            )}
          />

          <Controller
            name="code"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field
                data-invalid={fieldState.invalid}
                className="items-center gap-1.5"
              >
                <FieldLabel htmlFor={field.name} className={labelClass}>
                  {t("resetPassword.code")}
                </FieldLabel>
                {/* id landet auf dem echten Input der Primitive; das
                    sichtbare Label benennt das Feld, ein doppeltes
                    aria-label entfaellt (Review zu KAN-33). */}
                <InputOTP
                  id={field.name}
                  maxLength={6}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  disabled={resetMutation.isPending}
                  aria-invalid={fieldState.invalid}
                  aria-describedby={
                    fieldState.invalid ? "reset-code-error" : undefined
                  }
                  containerClassName="justify-center gap-2"
                >
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <InputOTPGroup key={index}>
                      <InputOTPSlot
                        index={index}
                        className="size-10 rounded-control"
                      />
                    </InputOTPGroup>
                  ))}
                </InputOTP>
                {fieldState.invalid && fieldState.error?.message && (
                  <FieldError
                    id="reset-code-error"
                    errors={[{ message: messageOf(fieldState.error) }]}
                  />
                )}
              </Field>
            )}
          />

          <Controller
            name="newPassword"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1.5">
                <FieldLabel htmlFor={field.name} className={labelClass}>
                  {t("resetPassword.newPassword")}
                </FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={fieldState.invalid}
                  aria-describedby={
                    fieldState.invalid
                      ? "reset-newPassword-hint reset-newPassword-error"
                      : "reset-newPassword-hint"
                  }
                />
                <FieldDescription id="reset-newPassword-hint">
                  {t("resetPassword.newPasswordHint")}
                </FieldDescription>
                {fieldState.invalid && (
                  <FieldError
                    id="reset-newPassword-error"
                    errors={[{ message: messageOf(fieldState.error) }]}
                  />
                )}
              </Field>
            )}
          />

          <Controller
            name="confirmPassword"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1.5">
                <FieldLabel htmlFor={field.name} className={labelClass}>
                  {t("resetPassword.confirmPassword")}
                </FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={fieldState.invalid}
                  aria-describedby={
                    fieldState.invalid
                      ? "reset-confirmPassword-error"
                      : undefined
                  }
                />
                {fieldState.invalid && (
                  <FieldError
                    id="reset-confirmPassword-error"
                    errors={[{ message: messageOf(fieldState.error) }]}
                  />
                )}
              </Field>
            )}
          />

          {form.formState.errors.root?.server && (
            <Alert variant="destructive">
              <AlertTitle>{form.formState.errors.root.server.message}</AlertTitle>
            </Alert>
          )}

          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? t("resetPassword.pending")
              : t("resetPassword.submit")}
          </Button>
        </FieldGroup>
      </form>

      <Separator />

      <p className="type-body-sm text-center">
        <Link
          to="/login"
          className="font-semibold text-primary underline-offset-4 hover:underline focus-visible:underline"
        >
          {t("resetPassword.backToLogin")}
        </Link>
      </p>
    </AuthPageShell>
  )
}
