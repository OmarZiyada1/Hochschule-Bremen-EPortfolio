import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowRightIcon } from "lucide-react"
import { useEffect, useState } from "react"
import {
  Controller,
  useForm,
  type FieldError as RhfFieldError,
} from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Link, useNavigate } from "react-router-dom"

import { useAuth } from "@/api/auth/AuthContext"
import { consumeRequestedRoute } from "@/api/auth/redirect"
import { useApiErrorMessage } from "@/api/useApiErrorMessage"
import { landingPathFor } from "@/routes/landingPath"
import { applyValidationErrors, isApiError, type ErrorCode } from "@/api/errors"
import { PasswordInput } from "@/components/common/PasswordInput"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { AuthCardHeader } from "@/features/auth/components/AuthCardHeader"
import { AuthPageShell } from "@/features/auth/components/AuthPageShell"
import {
  loginFormSchema,
  type LoginFormValues,
} from "@/features/auth/LoginForm.schema"
import { saveRegistrationFlow } from "@/features/auth/registrationFlow"

/**
 * Login-Seite (Ticket KAN-8) nach der Vorlage "Login (Auth)": Anmelden gegen
 * POST /auth/login, danach zur Projektliste.
 *
 * Aufbau wie im Template: Brotkrumenleiste, darunter mittig eine Karte aus
 * Markenkachel, Titel mit Untertitel, den beiden Feldern, der Schaltflaeche,
 * dem Weg zur Registrierung und dem Hinweis fuer Externe. NavBar und
 * Fusszeile blendet das Template hier aus, das erledigt AuthLayout.
 *
 * Zwei bewusste Abweichungen von der Vorlage, beide zugunsten des Contracts:
 * das dortige Auswahlfeld "ROLLE (DEMO)" entsteht nicht, weil POST
 * /auth/login nur E-Mail und Passwort kennt und die Rolle am Konto haengt
 * (Contract 2.1; eine Auswahl daneben waere eine Attrappe nach
 * Frontend-Regel 10). Und der Hinweis unter dem E-Mail-Feld bleibt stehen,
 * obwohl die Vorlage ihn nicht fuehrt: sie zeigt als Platzhalter eine
 * HSB-Adresse, und mit der meldet sich niemand an (Contract 3.1).
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
  const apiMessage = useApiErrorMessage()
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
   * Bei 401 REGISTRATION_NOT_COMPLETED (KAN-68) merkt sich die Seite die
   * eingegebene Adresse, damit die Meldung den Wiedereinstieg in die
   * Verifizierung anbieten kann. Bei ACCOUNT_NOT_ACTIVE (deaktiviertes
   * Konto) bleibt es bei der Meldung ohne Aktion: das kann nur die
   * Administration aufloesen. Entschieden wird ueber den errorCode, nie
   * ueber den Meldungstext (Frontend-Regel 3).
   */
  const [pendingRegistrationEmail, setPendingRegistrationEmail] = useState<
    string | null
  >(null)

  /*
   * Saet den Schrittzustand neu, wie ihn die Angaben-Seite nach 201 anlegt:
   * hsbEmail bleibt leer, denn die Verify-Schritte kommen seit KAN-68 ohne
   * die Adresse aus (seit Contract v50 stuende sie in der Antwort, gebraucht
   * wird sie hier nicht). Beide Flags
   * false und der Einstieg bei Schritt 2: welcher Schritt wirklich offen
   * ist, laesst sich nicht abfragen (/verify/resend antwortet aus
   * Enumeration-Schutz immer 204, Contract 6.1); dort fuehrt der
   * Weiterschalter weiter, verbindlich bleibt die Antwort auf /verify.
   */
  const continueRegistration = (email: string) => {
    saveRegistrationFlow({
      email: email.toLowerCase(),
      hsbEmail: "",
      emailVerified: false,
      hsbEmailVerified: false,
      status: "REGISTRATION_PENDING",
    })
    navigate("/register/verify-email")
  }

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
    setPendingRegistrationEmail(null)
    try {
      const user = await login(values.email, values.password)
      /*
       * Zurueck zu der Route, die vor der Umleitung zum Login angefragt
       * war (Klaerungsrunde KAN-33): ein geteilter Link auf ein Projekt
       * fuehrt nach dem Anmelden weiterhin dorthin. Neu ist allein das
       * Ersatzziel (KAN-83): statt der oeffentlichen Projektbibliothek der
       * Ort, an dem die jeweilige Rolle arbeitet. Haengt am Konto ein
       * Passwortzwang, greift auf der Zielroute der Wrapper beziehungsweise
       * die zentrale 403-Reaktion aus KAN-30 und leitet zur Passwortseite
       * um (Contract 6.7).
       */
      navigate(consumeRequestedRoute() ?? landingPathFor(user.role))
    } catch (error) {
      if (!isApiError(error)) {
        throw error
      }
      if (error.errorCode === "VALIDATION_FAILED") {
        applyValidationErrors(
          error,
          ["email", "password"],
          (name, fieldError) =>
            form.setError(
              name as "email" | "password" | "root.server",
              fieldError
            )
        )
        return
      }
      if (error.errorCode === "REGISTRATION_NOT_COMPLETED") {
        setPendingRegistrationEmail(values.email)
      }
      form.setError("root.server", {
        type: "server",
        message: apiMessage(error),
      })
    }
  })

  return (
    /* Brotkrumenleiste und Karte kommen seit KAN-33 aus der gemeinsamen
       Huelle der Auth-Seiten; der Titel bleibt in foreground, wie das
       Template ihn fuehrt (anders als die Registrierungs-Frames). */
    <AuthPageShell breadcrumbLabel={t("login.breadcrumb")}>
      <AuthCardHeader title={t("login.title")} subtitle={t("login.subtitle")} />

      {notice !== null && (
        <Alert>
          <AlertTitle>{t(`apiError.${notice}`)}</AlertTitle>
        </Alert>
      )}

      <form onSubmit={onSubmit} noValidate>
        <FieldGroup className="gap-4.5">
          <Controller
            name="email"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1.5">
                {/* Versalien und 11px wie im Template. Grossbuchstaben
                        entstehen ueber CSS und nicht im Schluessel: der
                        zugaengliche Name bleibt dadurch "E-Mail" und wird
                        nicht buchstabiert. */}
                <FieldLabel
                  htmlFor={field.name}
                  className="type-label-xs text-muted-foreground uppercase group-data-[invalid=true]/field:text-destructive"
                >
                  {t("login.email")}
                </FieldLabel>
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
                {/* Bleibt stehen, obwohl das Template ihn nicht fuehrt:
                        dort steht als Platzhalter eine HSB-Adresse, und
                        genau die ist es nicht (Contract 3.1, hsbEmail ist
                        nicht die Anmeldekennung). Ohne den Satz probieren
                        Studierende die falsche Adresse. */}
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
              <Field data-invalid={fieldState.invalid} className="gap-1.5">
                <FieldLabel
                  htmlFor={field.name}
                  className="type-label-xs text-muted-foreground uppercase group-data-[invalid=true]/field:text-destructive"
                >
                  {t("login.password")}
                </FieldLabel>
                <PasswordInput
                  {...field}
                  id={field.name}
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
                {/* Nicht im Figma-Template, aber entschieden
                        (Klaerungsrunde KAN-33): ohne diesen Einstieg
                        waere /forgot-password nur per URL erreichbar. */}
                <Link
                  to="/forgot-password"
                  className="type-body-sm self-end font-semibold text-primary underline-offset-4 hover:underline focus-visible:underline"
                >
                  {t("login.forgotPassword")}
                </Link>
              </Field>
            )}
          />

          {form.formState.errors.root?.server && (
            <Alert variant="destructive">
              <AlertTitle>
                {form.formState.errors.root.server.message}
              </AlertTitle>
              {pendingRegistrationEmail !== null && (
                <AlertDescription>
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 font-semibold"
                    onClick={() =>
                      continueRegistration(pendingRegistrationEmail)
                    }
                  >
                    {t("login.continueRegistration")}
                  </Button>
                </AlertDescription>
              )}
            </Alert>
          )}

          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? t("login.pending")
              : t("login.submit")}
          </Button>
        </FieldGroup>
      </form>

      {/* Der Weg zur Registrierung: die Kopfleiste fuehrt nach Template nur
              noch "Anmelden" (Review zu KAN-8), also haengt der Einstieg hier. */}
      <p className="type-body-sm text-center text-muted-foreground">
        {t("login.registerPrompt")}{" "}
        <Link
          to="/register"
          className="font-semibold text-primary underline-offset-4 hover:underline focus-visible:underline"
        >
          {t("login.registerLink")}
        </Link>
      </p>

      {/* Der oeffentliche Weg aus dem Template: wer nichts einreichen
              will, braucht kein Konto (Contract 5, PUBLIC sieht alles
              Veroeffentlichte). Ohne diesen Hinweis endet die Seite fuer
              Externe in einer Sackgasse. */}
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="type-caption text-muted-foreground">
          {t("login.publicHint")}
        </p>
        <Link
          to="/projects"
          className="type-body-sm inline-flex items-center gap-2 rounded-control font-semibold text-primary underline-offset-4 hover:underline focus-visible:underline"
        >
          <ArrowRightIcon aria-hidden="true" className="size-3.5" />
          {t("login.publicLink")}
        </Link>
      </div>
    </AuthPageShell>
  )
}
