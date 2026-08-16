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
import {
  apiErrorMessageKey,
  applyValidationErrors,
  isApiError,
  type ErrorCode,
} from "@/api/errors"
import { Alert, AlertTitle } from "@/components/ui/alert"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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
      form.setError("root.server", {
        type: "server",
        message: t(apiErrorMessageKey(error), { defaultValue: error.message }),
      })
    }
  })

  return (
    <>
      {/* Brotkrumenleiste des Templates. Sie steht hier und nicht im
          AuthLayout: bislang fuehrt allein diese Seite eine, und ein
          generischer Mechanismus aus Routentiteln entsteht erst, wenn die
          uebrigen Seiten ihn brauchen (Projekte, Projektdetail). */}
      <div className="border-b bg-card">
        <div className="mx-auto w-full max-w-6xl px-4 py-3.5">
          <Breadcrumb className="inline-flex rounded-control border px-3 py-2">
            <BreadcrumbList className="type-body-sm">
              <BreadcrumbItem>
                {/* Der Weg zurueck steht im Template in primary, die
                    aktuelle Ebene in muted-foreground; die Registry haelt
                    es genau umgekehrt. */}
                <BreadcrumbLink
                  render={<Link to="/" />}
                  className="font-medium text-primary hover:text-primary-hover"
                >
                  {t("common.nav.home")}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-muted-foreground">
                  {t("login.breadcrumb")}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-16">
        {/* 460px breit und 40px Innenabstand wie im Template; der
            Zeilenabstand von 18px laeuft ueber gap statt ueber Abstaende an
            den einzelnen Bloecken. */}
        <Card className="w-full max-w-115 gap-4.5 px-10 py-10">
          {/* Markenkachel. aria-hidden, weil die Initialen keine Auskunft
              geben, die der Untertitel darunter nicht ausgeschrieben
              enthaelt; vorgelesen waere "H B" nur Buchstabensalat. */}
          <div
            aria-hidden="true"
            className="mx-auto flex size-14 items-center justify-center rounded-modal bg-surface-brand text-surface-brand-foreground"
          >
            <span className="type-avatar-lg">{t("app.initials")}</span>
          </div>

          <div className="flex flex-col items-center gap-1 text-center">
            {/* Ohne Farbutility: das Template fuehrt den Titel hier in
                foreground, anders als den Seitentitel der Projektbibliothek
                (Kommentar in tokens.css). */}
            <h1 className="type-h1">{t("login.title")}</h1>
            <p className="type-body-sm text-muted-foreground">
              {t("login.subtitle")}
            </p>
          </div>

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
                  <AlertTitle>
                    {form.formState.errors.root.server.message}
                  </AlertTitle>
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
        </Card>
      </div>
    </>
  )
}
