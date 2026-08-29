import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import {
  Controller,
  useForm,
  useWatch,
  type FieldError as RhfFieldError,
} from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Link, useLocation, useNavigate } from "react-router-dom"

import { useAuth } from "@/api/auth/AuthContext"
import { setPasswordChangeRequired } from "@/api/auth/authStore"
import { isApiError } from "@/api/errors"
import { useApiErrorMessage } from "@/api/useApiErrorMessage"
import { ErrorState } from "@/components/common/ErrorState"
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
import { Input } from "@/components/ui/input"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { Separator } from "@/components/ui/separator"
import { AuthCardHeader } from "@/features/auth/components/AuthCardHeader"
import { AuthPageShell } from "@/features/auth/components/AuthPageShell"
import {
  useRequestPasswordReset,
  useResetPassword,
} from "@/features/auth/hooks/useAuthMutations"
import { useResendCountdown } from "@/features/auth/hooks/useResendCountdown"
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
 *
 * <p><strong>Ein neuer Code laesst sich hier anfordern</strong> (KAN-69):
 * derselbe Aufruf wie beim Vergessen, POST /auth/forgot-password mit der
 * Adresse aus dem Feld. Ohne ihn muesste jemand, dessen Code abgelaufen
 * ist, die Seite verlassen und den Weg von vorn beginnen. Die Sperrfrist
 * ist dieselbe wie bei den Bestaetigungscodes (useResendCountdown); sie
 * laeuft ab dem Betreten der Seite, denn dorthin kommt man mit einem
 * gerade verschickten Code.
 *
 * <p>Wer aus dem Profil kommt ("Passwort vergessen" im Dialog "Passwort
 * aendern"), traegt {@code codeSent} im Router-State: der Code ist dann
 * schon angefordert, und die Seite sagt das, statt die Person raten zu
 * lassen, ob sie noch etwas ausloesen muss.
 */
export default function ResetPasswordPage() {
  const { t } = useTranslation()
  const apiMessage = useApiErrorMessage()
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, logout } = useAuth()
  const resetMutation = useResetPassword()
  const requestReset = useRequestPasswordReset()
  const { remaining, ready, restart } = useResendCountdown()
  const [succeeded, setSucceeded] = useState(false)
  const [resendConfirmed, setResendConfirmed] = useState(false)

  const routerState = location.state as {
    email?: unknown
    codeSent?: unknown
  } | null
  const prefilledEmail =
    typeof routerState?.email === "string" ? routerState.email : ""
  const arrivedWithCode = routerState?.codeSent === true

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: {
      email: prefilledEmail,
      code: "",
      newPassword: "",
      confirmPassword: "",
    },
  })

  /* useWatch statt form.watch: vertraeglich mit dem React Compiler, wie im
     ProfileForm. Die Adresse bleibt editierbar, der neue Code geht deshalb
     an das, was gerade im Feld steht. */
  const enteredEmail = useWatch({ control: form.control, name: "email" })

  const messageOf = (error: RhfFieldError | undefined): string | undefined => {
    if (error?.message === undefined) {
      return undefined
    }
    return error.type === "server" ? error.message : t(error.message)
  }

  const onResend = async () => {
    setResendConfirmed(false)
    /* Ohne gueltige Adresse liefe der Aufruf in ein 400; das beantwortet
       das Schema billiger und am Feld. */
    if (!(await form.trigger("email"))) {
      return
    }
    try {
      await requestReset.mutateAsync({ email: enteredEmail })
      restart()
      setResendConfirmed(true)
    } catch (error) {
      if (!isApiError(error)) {
        throw error
      }
      /* Fachlich scheitert der Aufruf nie (§3.16, immer 204); was hier
         ankommt, ist das Rate-Limit-429 oder ein Transportfehler. */
      form.setError("root.server", {
        type: "server",
        message: apiMessage(error),
      })
    }
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
      /*
       * Wer aus dem Profil hierher kam, ist noch angemeldet: das Token ist
       * zustandslos und ueberlebt den Passwortwechsel (§6.5). Genau das
       * soll es nicht: nach einem neuen Passwort gehoert die alte Sitzung
       * beendet, und erst dann stimmt auch die Ansage "Sie koennen sich
       * jetzt anmelden" (Befund aus dem Review zu KAN-69).
       */
      if (isAuthenticated) {
        await logout()
      }
      setSucceeded(true)
    } catch (error) {
      if (!isApiError(error)) {
        throw error
      }
      form.setError("root.server", {
        type: "server",
        message: apiMessage(error),
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

      {arrivedWithCode && (
        /* role=status statt des assertiven Standards der Primitive: das
           hier ist eine Auskunft und keine Fehlermeldung (Befund aus dem
           Review zu KAN-69). */
        <Alert role="status">
          <AlertTitle>
            {t("resetPassword.codeSentNotice", { address: prefilledEmail })}
          </AlertTitle>
        </Alert>
      )}

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

                {/* Bis zum Ablauf der Sperrfrist steht dort der Countdown
                    und kein Knopf, damit niemand ins Rate-Limit laeuft. Ohne
                    Adresse im Feld gaebe es kein Ziel, dann bleibt er
                    deaktiviert. */}
                {ready ? (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0"
                    disabled={requestReset.isPending || enteredEmail === ""}
                    onClick={() => void onResend()}
                  >
                    {t("resetPassword.resend")}
                  </Button>
                ) : (
                  <FieldDescription>
                    {t("resetPassword.resendCountdown", {
                      seconds: remaining,
                    })}
                  </FieldDescription>
                )}

                <p role="status" className="type-body-sm text-muted-foreground">
                  {resendConfirmed && t("resetPassword.resendConfirmed")}
                </p>
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
                <PasswordInput
                  {...field}
                  id={field.name}
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
                <PasswordInput
                  {...field}
                  id={field.name}
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
            <ErrorState message={form.formState.errors.root.server.message} />
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
