import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import {
  Controller,
  useForm,
  type FieldError as RhfFieldError,
} from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Link, useNavigate } from "react-router-dom"

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
import { Separator } from "@/components/ui/separator"
import { AuthCardHeader } from "@/features/auth/components/AuthCardHeader"
import { AuthPageShell } from "@/features/auth/components/AuthPageShell"
import { useRequestPasswordReset } from "@/features/auth/hooks/useAuthMutations"
import {
  forgotPasswordFormSchema,
  type ForgotPasswordFormValues,
} from "@/features/auth/ForgotPasswordForm.schema"

/**
 * Passwort vergessen (KAN-33, §6.1): POST /auth/forgot-password mit der
 * privaten Adresse. Die Antwort ist immer 204, auch bei unbekannter
 * Adresse oder nicht aktivem Konto (§3.16, v35); die Seite zeigt deshalb
 * in jedem Fall dieselbe Bestaetigung und schliesst aus dem Ausgang
 * nichts ueber die Existenz des Kontos.
 *
 * Kein Template: rahmenlose Auth-Karte wie Login und Registrierung
 * (Klaerungsrunde KAN-33). Nach der Bestaetigung geht es zur Eingabeseite
 * des Codes; die Adresse laeuft als Router-State mit, damit sie dort
 * nicht erneut getippt werden muss.
 */
export default function ForgotPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const requestReset = useRequestPasswordReset()
  const [confirmedEmail, setConfirmedEmail] = useState<string | null>(null)

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordFormSchema),
    defaultValues: { email: "" },
  })

  const messageOf = (error: RhfFieldError | undefined): string | undefined => {
    if (error?.message === undefined) {
      return undefined
    }
    return error.type === "server" ? error.message : t(error.message)
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await requestReset.mutateAsync({ email: values.email })
      setConfirmedEmail(values.email)
    } catch (error) {
      if (!isApiError(error)) {
        throw error
      }
      /*
       * Fachlich scheitert dieser Aufruf nie (immer 204); was hier
       * ankommt, ist das Rate-Limit-429 oder ein Transportfehler, beides
       * als Meldung am Formular.
       */
      form.setError("root.server", {
        type: "server",
        message: t(apiErrorMessageKey(error), { defaultValue: error.message }),
      })
    }
  })

  return (
    <AuthPageShell breadcrumbLabel={t("forgotPassword.breadcrumb")}>
      <AuthCardHeader
        title={t("forgotPassword.title")}
        subtitle={t("forgotPassword.subtitle")}
      />

      {confirmedEmail !== null ? (
        <>
          {/* Dieselbe Bestaetigung fuer jede Adresse (§6.1): der Text
              behauptet keinen Versand, sondern beschreibt die Bedingung. */}
          <Alert>
            <AlertTitle>{t("forgotPassword.confirmation")}</AlertTitle>
          </Alert>
          <Button
            type="button"
            onClick={() =>
              navigate("/reset-password", {
                state: { email: confirmedEmail },
              })
            }
          >
            {t("forgotPassword.toReset")}
          </Button>
        </>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup className="gap-4.5">
            <Controller
              name="email"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="gap-1.5">
                  <FieldLabel
                    htmlFor={field.name}
                    className="type-label-xs text-muted-foreground uppercase group-data-[invalid=true]/field:text-destructive"
                  >
                    {t("forgotPassword.email")}
                  </FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    type="email"
                    autoComplete="email"
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      fieldState.invalid
                        ? "forgot-email-hint forgot-email-error"
                        : "forgot-email-hint"
                    }
                  />
                  <FieldDescription id="forgot-email-hint">
                    {t("forgotPassword.emailHint")}
                  </FieldDescription>
                  {fieldState.invalid && (
                    <FieldError
                      id="forgot-email-error"
                      errors={[{ message: messageOf(fieldState.error) }]}
                    />
                  )}
                </Field>
              )}
            />

            {form.formState.errors.root?.server && (
              <Alert variant="destructive">
                <AlertTitle>
                  {form.formState.errors.root.server.message}
                </AlertTitle>
              </Alert>
            )}

            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting
                ? t("forgotPassword.pending")
                : t("forgotPassword.submit")}
            </Button>
          </FieldGroup>
        </form>
      )}

      <Separator />

      <p className="type-body-sm text-center">
        <Link
          to="/login"
          className="font-semibold text-primary underline-offset-4 hover:underline focus-visible:underline"
        >
          {t("forgotPassword.backToLogin")}
        </Link>
      </p>
    </AuthPageShell>
  )
}
