import { zodResolver } from "@hookform/resolvers/zod"
import {
  Controller,
  useForm,
  type FieldError as RhfFieldError,
} from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Link, useNavigate } from "react-router-dom"

import {
  apiErrorMessageKey,
  applyValidationErrors,
  isApiError,
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
import { Separator } from "@/components/ui/separator"
import { AuthCardHeader } from "@/features/auth/components/AuthCardHeader"
import { AuthPageShell } from "@/features/auth/components/AuthPageShell"
import { useRegister } from "@/features/auth/hooks/useAuthMutations"
import {
  registerDetailsFormSchema,
  type RegisterDetailsFormValues,
} from "@/features/auth/RegisterDetailsForm.schema"
import { saveRegistrationFlow } from "@/features/auth/registrationFlow"

/*
 * Reihenfolge und Feldnamen der Angaben-Seite; confirmPassword bleibt im
 * Client, der Request kennt es nicht.
 */
const SERVER_FIELDS = [
  "firstName",
  "lastName",
  "hsbEmail",
  "email",
  "password",
] as const

type FieldName = keyof RegisterDetailsFormValues

/**
 * Schritt 1 der Registrierung (KAN-33, Template "Registrierung 1 –
 * Angaben"): persoenliche Angaben und Zugangsdaten, Absenden an
 * POST /auth/register, bei 201 weiter zur Bestaetigung der privaten
 * Adresse. Fortschrittspunkte 1 von 3.
 *
 * Eine Rollenauswahl gibt es nicht: die Rolle folgt allein der Domain der
 * hsbEmail (§3.1.1, Contract v41). Der Hilfetext am Feld erklaert das, und
 * der Tutor-Hinweis nimmt genau der Gruppe die Fehldeutung, die
 * redaktionell arbeitet und trotzdem eine studentische Adresse hat.
 *
 * Der Untertitel ist neutral statt "Registrierung als Studierende/r" aus
 * dem Template: seit dem Wegfall der Rollenauswahl registrieren sich hier
 * auch Mitarbeitende (Klaerungsrunde KAN-33).
 *
 * Fehlerbilder nach §6.1: 400 VALIDATION_FAILED am betroffenen Feld
 * (darunter die fremde Domain der hsbEmail), 409 RESOURCE_IN_USE als
 * eigene Meldung an der Zeile, die die Servermeldung benennt.
 */
export default function RegisterDetailsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const registerMutation = useRegister()

  const form = useForm<RegisterDetailsFormValues>({
    resolver: zodResolver(registerDetailsFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      hsbEmail: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  })

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

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const account = await registerMutation.mutateAsync({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        hsbEmail: values.hsbEmail,
        password: values.password,
      })
      /*
       * Der Server schreibt Adressen kleingeschrieben (§3.1); die Kennung
       * fuer die Verifizierungsaufrufe kommt deshalb aus der Antwort, nicht
       * aus dem Formular. Nur die hsbEmail gibt es in keiner Response, sie
       * bleibt als Anzeigewert aus dem Formular (kleingeschrieben, damit
       * die Anzeige dem gespeicherten Konto entspricht).
       */
      saveRegistrationFlow({
        email: account.email ?? values.email.toLowerCase(),
        hsbEmail: values.hsbEmail.toLowerCase(),
        emailVerified: false,
        hsbEmailVerified: false,
        status: account.status ?? "REGISTRATION_PENDING",
      })
      navigate("/register/verify-email")
    } catch (error) {
      if (!isApiError(error)) {
        throw error
      }
      if (error.errorCode === "VALIDATION_FAILED") {
        applyValidationErrors(error, SERVER_FIELDS, (name, fieldError) =>
          form.setError(name as FieldName | "root.server", fieldError)
        )
        return
      }
      if (error.errorCode === "RESOURCE_IN_USE") {
        /*
         * Die Meldung nennt das betroffene Feld im Format "feld: Text"
         * (§6.1, ConflictException.addressInUse); dargestellt wird eine
         * eigene i18n-Meldung an der richtigen Zeile, kein Formatfehler.
         * Beide Praefixe werden ausdruecklich geprueft: eine unerwartete
         * Meldung gehoert ans Formular, nicht blind an die private Zeile.
         */
        const field = error.message.startsWith("hsbEmail:")
          ? "hsbEmail"
          : error.message.startsWith("email:")
            ? "email"
            : null
        if (field !== null) {
          form.setError(field, {
            type: "server",
            message: t("register.details.addressInUse"),
          })
          return
        }
      }
      form.setError("root.server", {
        type: "server",
        message: t(apiErrorMessageKey(error), { defaultValue: error.message }),
      })
    }
  })

  const labelClass =
    "type-label-xs text-muted-foreground uppercase group-data-[invalid=true]/field:text-destructive"

  const textField = (
    name: Extract<FieldName, "firstName" | "lastName">,
    autoComplete: string
  ) => (
    <Controller
      name={name}
      control={form.control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className="gap-1.5">
          <FieldLabel htmlFor={field.name} className={labelClass}>
            {t(`register.details.${name}`)}
          </FieldLabel>
          <Input
            {...field}
            id={field.name}
            type="text"
            autoComplete={autoComplete}
            aria-invalid={fieldState.invalid}
            aria-describedby={
              fieldState.invalid ? `register-${name}-error` : undefined
            }
          />
          {fieldState.invalid && (
            <FieldError
              id={`register-${name}-error`}
              errors={[{ message: messageOf(fieldState.error) }]}
            />
          )}
        </Field>
      )}
    />
  )

  return (
    <AuthPageShell breadcrumbLabel={t("register.breadcrumb")}>
      <AuthCardHeader
        title={t("register.details.title")}
        subtitle={t("register.details.subtitle")}
        progress={1}
        brandTitle
      />

      <form onSubmit={onSubmit} noValidate>
        <FieldGroup className="gap-4.5">
          <div className="grid gap-4.5 sm:grid-cols-2">
            {textField("firstName", "given-name")}
            {textField("lastName", "family-name")}
          </div>

          <Controller
            name="hsbEmail"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1.5">
                <FieldLabel htmlFor={field.name} className={labelClass}>
                  {t("register.details.hsbEmail")}
                </FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  type="email"
                  autoComplete="off"
                  aria-invalid={fieldState.invalid}
                  aria-describedby={
                    fieldState.invalid
                      ? "register-hsbEmail-hint register-hsbEmail-error"
                      : "register-hsbEmail-hint"
                  }
                />
                {/* Rollenableitung und Tutor-Fall (Ticket-DoD): ohne den
                    ersten Satz wirkt die vergebene Rolle willkuerlich, ohne
                    den zweiten erlebt genau die Gruppe die Domainregel als
                    Fehler, die richtig arbeitet (§3.1.1). */}
                <FieldDescription id="register-hsbEmail-hint">
                  {t("register.details.hsbEmailHint")}{" "}
                  {t("register.details.tutorHint")}
                </FieldDescription>
                {fieldState.invalid && (
                  <FieldError
                    id="register-hsbEmail-error"
                    errors={[{ message: messageOf(fieldState.error) }]}
                  />
                )}
              </Field>
            )}
          />

          <Controller
            name="email"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1.5">
                <FieldLabel htmlFor={field.name} className={labelClass}>
                  {t("register.details.email")}
                </FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  type="email"
                  autoComplete="email"
                  aria-invalid={fieldState.invalid}
                  aria-describedby={
                    fieldState.invalid ? "register-email-error" : undefined
                  }
                />
                {fieldState.invalid && (
                  <FieldError
                    id="register-email-error"
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
              <Field data-invalid={fieldState.invalid} className="gap-1.5">
                <FieldLabel htmlFor={field.name} className={labelClass}>
                  {t("register.details.password")}
                </FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={fieldState.invalid}
                  aria-describedby={
                    fieldState.invalid
                      ? "register-password-hint register-password-error"
                      : "register-password-hint"
                  }
                />
                <FieldDescription id="register-password-hint">
                  {t("register.details.passwordHint")}
                </FieldDescription>
                {fieldState.invalid && (
                  <FieldError
                    id="register-password-error"
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
                  {t("register.details.confirmPassword")}
                </FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={fieldState.invalid}
                  aria-describedby={
                    fieldState.invalid
                      ? "register-confirmPassword-error"
                      : undefined
                  }
                />
                {fieldState.invalid && (
                  <FieldError
                    id="register-confirmPassword-error"
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
              ? t("register.details.pending")
              : t("register.details.submit")}
          </Button>
        </FieldGroup>
      </form>

      {/* Der Hinweis unter dem Knopf, wie im Template: private Adresse ist
          der Login, die HSB-Adresse belegt nur die Zugehoerigkeit (§3.1.1). */}
      <p className="type-caption text-center text-muted-foreground">
        {t("register.details.footnote")}
      </p>

      <Separator />

      <p className="type-body-sm text-center text-muted-foreground">
        {t("register.details.loginPrompt")}{" "}
        <Link
          to="/login"
          className="font-semibold text-primary underline-offset-4 hover:underline focus-visible:underline"
        >
          {t("register.details.loginLink")}
        </Link>
      </p>
    </AuthPageShell>
  )
}
