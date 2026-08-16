import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useState } from "react"
import {
  Controller,
  useForm,
  type FieldError as RhfFieldError,
} from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Link, useNavigate } from "react-router-dom"

import { useAuth } from "@/api/auth/AuthContext"
import {
  apiErrorMessageKey,
  applyValidationErrors,
  isApiError,
  type ErrorCode,
} from "@/api/errors"
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
  loginFormSchema,
  type LoginFormValues,
} from "@/features/auth/LoginForm.schema"

/**
 * Minimale Login-Seite des Durchstichs (Ticket KAN-8): Anmelden gegen
 * POST /auth/login, danach zur Projektliste. Die ausgestaltete Seite nach
 * Template entsteht mit KAN-33; hier steht nur, was die Kette Ende zu Ende
 * traegt.
 *
 * Formular nach Frontend-Regel 12: react-hook-form mit zod-Schema
 * (LoginForm.schema.ts), Verdrahtung ueber Controller wie in der
 * shadcn-Formulardoku (data-invalid am Field, aria-invalid am Input,
 * FieldError mit errors). Verbindlich bleibt der Server: sein 400
 * VALIDATION_FAILED erscheint am betroffenen Feld, alle uebrigen Codes als
 * Meldung am Formular, entschieden ueber errorCode (Skill frontend-api).
 */
export default function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { login, sessionNotice, clearSessionNotice } = useAuth()

  /*
   * Warum die letzte Sitzung endete (TOKEN_EXPIRED, ...), gesetzt von der
   * zentralen 401-Reaktion aus KAN-30. Diese Seite zeigt den Hinweis und
   * raeumt ihn im Store ab (Klaerungsrunde KAN-30); lokal bleibt er stehen,
   * sonst verschwaende die Meldung mit dem Abraeumen sofort wieder.
   * Uebernommen wird waehrend des Renderns (React-Muster "Zustand an
   * geaenderte Props anpassen"); der Effekt schreibt nur den externen
   * Store, nie React-Zustand.
   */
  const [notice, setNotice] = useState<ErrorCode | null>(sessionNotice)
  if (sessionNotice !== null && sessionNotice !== notice) {
    setNotice(sessionNotice)
  }
  useEffect(() => {
    if (sessionNotice !== null) {
      clearSessionNotice()
    }
  }, [sessionNotice, clearSessionNotice])

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: "", password: "" },
  })

  /*
   * Zod hinterlegt i18n-Schluessel (LoginForm.schema.ts),
   * applyValidationErrors dagegen den Meldungstext des Servers (type
   * "server", Contract 6.2). Uebersetzt wird deshalb nur, was aus dem
   * Schema kommt.
   */
  const messageOf = (error: RhfFieldError | undefined): string | undefined => {
    if (error?.message === undefined) {
      return undefined
    }
    return error.type === "server" ? error.message : t(error.message)
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await login(values.email, values.password)
      /*
       * Ziel des Durchstichs ist die echte Projektliste (Klaerungsrunde
       * KAN-8). Haengt am Konto ein Passwortzwang, faengt die zentrale
       * 403-Reaktion aus KAN-30 den naechsten Request ab und leitet zur
       * Passwortseite um; hier passiert dafuer bewusst nichts Eigenes
       * (Contract 6.7).
       */
      navigate("/projects")
    } catch (error) {
      if (!isApiError(error)) {
        throw error
      }
      if (error.errorCode === "VALIDATION_FAILED") {
        applyValidationErrors(error, ["email", "password"], (name, fieldError) =>
          form.setError(name as "email" | "password" | "root.server", fieldError)
        )
        return
      }
      form.setError("root.server", {
        type: "server",
        message: t(apiErrorMessageKey(error), { defaultValue: error.message }),
      })
    }
  })

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-16">
      <h1 className="type-h1">{t("login.title")}</h1>

      {notice !== null && (
        <Alert>
          <AlertTitle>{t(`apiError.${notice}`)}</AlertTitle>
        </Alert>
      )}

      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <Controller
            name="email"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{t("login.email")}</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  type="email"
                  autoComplete="email"
                  aria-invalid={fieldState.invalid}
                  /* Der Fehler haengt mit am Feld: role="alert" sagt ihn nur
                     beim Erscheinen an, wer spaeter zurueck zum Feld tabbt,
                     hoerte sonst nur "ungueltig" ohne Grund. */
                  aria-describedby={
                    fieldState.invalid
                      ? "login-email-hint login-email-error"
                      : "login-email-hint"
                  }
                />
                <FieldDescription id="login-email-hint">
                  {t("login.emailHint")}
                </FieldDescription>
                {fieldState.invalid && (
                  <FieldError
                    id="login-email-error"
                    errors={[{ message: messageOf(fieldState.error) }]}
                  />
                )}
              </Field>
            )}
          />
          <Controller
            name="password"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>
                  {t("login.password")}
                </FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={fieldState.invalid}
                  aria-describedby={
                    fieldState.invalid ? "login-password-error" : undefined
                  }
                />
                {fieldState.invalid && (
                  <FieldError
                    id="login-password-error"
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
            {form.formState.isSubmitting ? t("login.pending") : t("login.submit")}
          </Button>
        </FieldGroup>
      </form>

      {/* Der Weg zur Registrierung: die Kopfleiste fuehrt nach Template nur
          noch "Anmelden" (Review zu KAN-8), also haengt der Einstieg hier. */}
      <p className="type-body-sm text-center text-muted-foreground">
        {t("login.registerPrompt")}{" "}
        <Link
          to="/register"
          className="font-medium text-primary underline-offset-4 hover:underline focus-visible:underline"
        >
          {t("login.registerLink")}
        </Link>
      </p>
    </div>
  )
}
