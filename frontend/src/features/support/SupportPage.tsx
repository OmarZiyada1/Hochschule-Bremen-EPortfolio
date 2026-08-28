import { zodResolver } from "@hookform/resolvers/zod"
import { CheckIcon, LifeBuoyIcon } from "lucide-react"
import { useEffect, useState } from "react"
import {
  Controller,
  useForm,
  type FieldError as RhfFieldError,
} from "react-hook-form"
import { useTranslation } from "react-i18next"

import { useAuth } from "@/api/auth/AuthContext"
import {
  apiErrorMessageKey,
  applyValidationErrors,
  isApiError,
} from "@/api/errors"
import type { SupportRequestCategory } from "@/api/types"
import { CharacterCounter } from "@/components/common/CharacterCounter"
import { FilterSelect } from "@/components/common/FilterSelect"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useCreateSupportRequest } from "@/features/support/hooks/useSupport"
import {
  SUPPORT_MESSAGE_MAX,
  SUPPORT_SERVER_FIELDS,
  supportFormSchema,
  type SupportFormValues,
} from "@/features/support/supportSchema"

/**
 * Die fuenf Kategorien aus Contract §2.14, in der Reihenfolge des Contracts.
 * Der Wert laeuft unveraendert durch den Code, uebersetzt wird nur die Anzeige
 * (Frontend-Regel 6).
 */
const CATEGORIES: readonly SupportRequestCategory[] = [
  "TECHNICAL_ISSUE",
  "ACCOUNT_ACCESS",
  "PROJECT_SUBMISSION",
  "ABUSE_REPORT",
  "OTHER",
]

/**
 * Das oeffentliche Kontaktformular unter {@code /support} (Template „Kontakt
 * &amp; Support", Frames {@code Öffentlich · Kontakt & Support} und
 * {@code · Gesendet}; KAN-85).
 *
 * <p><strong>Ohne Anmeldung erreichbar, und das ist der Kern.</strong> Der
 * haeufigste Support-Fall ist „ich komme nicht hinein"; ein Formular hinter der
 * Anmeldung hilft genau dort nicht (§5, Fussnote 16). Fuer angemeldete Konten
 * belegt die Seite Name und Adresse vor, laesst beide aber aenderbar: wer die
 * Anmeldung mit der eigenen Adresse gerade nicht schafft, muss eine erreichbare
 * zweite nennen koennen (§3.20).
 *
 * <p><strong>Der Server verschickt keine E-Mail</strong>, weder eine
 * Eingangsbestaetigung noch eine Antwort. Der Bestaetigungstext sagt deshalb,
 * dass sich das Team per E-Mail meldet, und verspricht keine Mail aus der
 * Anwendung.
 *
 * <p>Fehlerbilder nach §6.1: <strong>400</strong> {@code VALIDATION_FAILED} am
 * betroffenen Feld, <strong>429</strong> {@code TOO_MANY_SUPPORT_REQUESTS} als
 * Meldung ueber dem Formular. Die Bremse haengt an Adresse und IP und nicht an
 * einem Feld; sie an einer Zeile anzuzeigen legte nahe, dass ein anderer Wert
 * dort weiterhilft.
 */
export default function SupportPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const createMutation = useCreateSupportRequest()
  const [sent, setSent] = useState(false)

  const form = useForm<SupportFormValues>({
    resolver: zodResolver(supportFormSchema),
    defaultValues: {
      name: "",
      email: "",
      category: "TECHNICAL_ISSUE",
      subject: "",
      message: "",
    },
  })

  /*
   * Das versteckte Feld gegen automatisierte Einsendungen (§6.1). Es liegt
   * bewusst ausserhalb von react-hook-form und ausserhalb des zod-Schemas:
   * es wird nie geprueft, sondern nur mitgeschickt. Waere es Teil des
   * Formulars, erschiene es in Fehlerlisten und im Zustand, und die erste
   * Nacharbeit haette es "der Vollstaendigkeit halber" validiert.
   */
  const [website, setWebsite] = useState("")

  const { reset } = form

  /*
   * Vorbelegen erst, wenn das Konto da ist: der Auth-Kontext laedt die
   * Identitaet nach, und ein defaultValues aus dem ersten Rendern bliebe
   * leer. Ueberschrieben wird nur, was die Person noch nicht angefasst hat
   * (isDirty je Feld waere zu grob, deshalb der Vergleich auf den leeren
   * Anfangswert).
   */
  useEffect(() => {
    if (user === null) {
      return
    }
    reset(
      (previous) => ({
        ...previous,
        name:
          previous.name === ""
            ? `${user.firstName} ${user.lastName}`.trim()
            : previous.name,
        email: previous.email === "" ? user.email : previous.email,
      }),
      { keepDirtyValues: true }
    )
  }, [user, reset])

  /*
   * Zod hinterlegt i18n-Schluessel, applyValidationErrors den Meldungstext
   * des Servers (type "server"); uebersetzt wird nur, was aus dem Schema
   * kommt (Muster aus KAN-33).
   */
  const messageOf = (error: RhfFieldError | undefined): string | undefined => {
    if (error?.message === undefined) {
      return undefined
    }
    return error.type === "server" ? error.message : t(error.message)
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await createMutation.mutateAsync({ ...values, website })
      setSent(true)
    } catch (error) {
      if (!isApiError(error)) {
        throw error
      }
      if (error.errorCode === "VALIDATION_FAILED") {
        applyValidationErrors(
          error,
          SUPPORT_SERVER_FIELDS,
          (name, fieldError) =>
            form.setError(
              name as keyof SupportFormValues | "root.server",
              fieldError
            )
        )
        return
      }
      /*
       * Alles Uebrige, einschliesslich 429, erscheint ueber dem Formular.
       * Uebersetzt wird nach errorCode und nie nach dem Meldungstext
       * (Frontend-Regel 3); der Text des Servers ist nur Rueckfallebene.
       */
      form.setError("root.server", {
        type: "server",
        message: t(apiErrorMessageKey(error), { defaultValue: error.message }),
      })
    }
  })

  const labelClass =
    "type-label-xs text-muted-foreground uppercase group-data-[invalid=true]/field:text-destructive"

  const formError = form.formState.errors.root?.server?.message

  return (
    <div className="mx-auto flex w-full max-w-118 flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <p className="type-overline text-muted-foreground">
          {t("support.label")}
        </p>
        <h1 className="type-title flex items-center gap-2 text-primary">
          <LifeBuoyIcon aria-hidden="true" className="size-6 shrink-0" />
          {t("support.title")}
        </h1>
        <p className="type-body-sm text-muted-foreground">
          {t("support.subtitle")}
        </p>
      </header>

      {sent ? (
        <Card>
          {/*
            Der Bestaetigungszustand ersetzt das Formular, wie im Template.
            role="status" meldet ihn an, ohne den Fokus zu verschieben: die
            Karte traegt danach nur noch eine Schaltflaeche, und ein
            erzwungener Fokussprung dorthin naehme der Person die Moeglichkeit,
            den Satz darueber ueberhaupt zu lesen (SC 4.1.3).
          */}
          <CardContent
            role="status"
            className="flex flex-col items-center gap-4 py-10 text-center"
          >
            <span
              aria-hidden="true"
              className="flex size-12 items-center justify-center rounded-full bg-pill-success-bg text-pill-success-fg"
            >
              <CheckIcon className="size-6" />
            </span>
            <h2 className="type-h3">{t("support.sent.title")}</h2>
            <p className="type-body-sm text-muted-foreground">
              {t("support.sent.description")}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                /*
                 * Zurueck ins leere Formular, nicht in die vorige Eingabe:
                 * eine weitere Anfrage ist eine andere Anfrage. Name und
                 * Adresse belegt der Effekt oben fuer angemeldete Konten
                 * gleich wieder vor.
                 */
                form.reset()
                setWebsite("")
                setSent(false)
              }}
            >
              {t("support.sent.again")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <form
              onSubmit={onSubmit}
              noValidate
              className="flex flex-col gap-5"
            >
              {formError !== undefined && (
                <Alert variant="destructive">
                  <AlertTitle>{formError}</AlertTitle>
                </Alert>
              )}

              <div className="grid gap-5 sm:grid-cols-2">
                <Controller
                  name="name"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="gap-1.5"
                    >
                      <FieldLabel htmlFor={field.name} className={labelClass}>
                        {t("support.form.name")}
                      </FieldLabel>
                      <Input
                        {...field}
                        id={field.name}
                        type="text"
                        autoComplete="name"
                        aria-invalid={fieldState.invalid}
                        aria-describedby={
                          fieldState.invalid ? "support-name-error" : undefined
                        }
                      />
                      {fieldState.invalid && (
                        <FieldError
                          id="support-name-error"
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
                    <Field
                      data-invalid={fieldState.invalid}
                      className="gap-1.5"
                    >
                      <FieldLabel htmlFor={field.name} className={labelClass}>
                        {t("support.form.email")}
                      </FieldLabel>
                      <Input
                        {...field}
                        id={field.name}
                        type="email"
                        autoComplete="email"
                        aria-invalid={fieldState.invalid}
                        aria-describedby={
                          fieldState.invalid ? "support-email-error" : undefined
                        }
                      />
                      {fieldState.invalid && (
                        <FieldError
                          id="support-email-error"
                          errors={[{ message: messageOf(fieldState.error) }]}
                        />
                      )}
                    </Field>
                  )}
                />
              </div>

              {/*
                Das Auswahlfeld ist dieselbe Huelle wie in der Filterleiste und
                im Metadatenformular (FilterSelect). Ohne Sammeleintrag: die
                Kategorie ist Pflicht (§3.20), „alle" waere hier kein Zustand.
              */}
              <Controller
                name="category"
                control={form.control}
                render={({ field, fieldState }) => (
                  <FilterSelect
                    id={field.name}
                    label={t("support.form.category")}
                    options={CATEGORIES.map((value) => ({
                      value,
                      label: t(`support.category.${value}`),
                    }))}
                    value={field.value}
                    onValueChange={(next) => {
                      if (next !== null) {
                        field.onChange(next)
                      }
                    }}
                    includeAllOption={false}
                    error={
                      fieldState.invalid
                        ? messageOf(fieldState.error)
                        : undefined
                    }
                  />
                )}
              />

              <Controller
                name="subject"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="gap-1.5">
                    <FieldLabel htmlFor={field.name} className={labelClass}>
                      {t("support.form.subject")}
                    </FieldLabel>
                    <Input
                      {...field}
                      id={field.name}
                      type="text"
                      aria-invalid={fieldState.invalid}
                      aria-describedby={
                        fieldState.invalid ? "support-subject-error" : undefined
                      }
                    />
                    {fieldState.invalid && (
                      <FieldError
                        id="support-subject-error"
                        errors={[{ message: messageOf(fieldState.error) }]}
                      />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="message"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="gap-1.5">
                    <FieldLabel htmlFor={field.name} className={labelClass}>
                      {t("support.form.message")}
                    </FieldLabel>
                    <Textarea
                      {...field}
                      id={field.name}
                      rows={6}
                      placeholder={t("support.form.messagePlaceholder")}
                      aria-invalid={fieldState.invalid}
                      /* Der Zaehler haengt ueber aria-describedby am Feld:
                         ohne ihn laeuft es fuer einen Screenreader ohne
                         Vorwarnung voll (SC 4.1.3). */
                      aria-describedby={
                        fieldState.invalid
                          ? "support-message-counter support-message-error"
                          : "support-message-counter"
                      }
                    />
                    <div className="flex justify-end">
                      <CharacterCounter
                        id="support-message-counter"
                        value={field.value}
                        max={SUPPORT_MESSAGE_MAX}
                      />
                    </div>
                    {fieldState.invalid && (
                      <FieldError
                        id="support-message-error"
                        errors={[{ message: messageOf(fieldState.error) }]}
                      />
                    )}
                  </Field>
                )}
              />

              {/*
                Die Falle (§6.1). Sie steht im Fluss des Formulars, ist aber
                weder sichtbar noch fokussierbar noch fuer Hilfsmittel
                vorhanden: tabIndex -1 und aria-hidden halten sie aus der
                Tastaturreihenfolge und aus dem Zugaenglichkeitsbaum heraus,
                autoComplete="off" verhindert, dass ein Browser sie von selbst
                fuellt und damit einen Menschen aussperrt.

                Verborgen wird ueber eine eigene Klasse und nicht ueber
                sr-only: sr-only laesst das Feld fuer Screenreader
                ausdruecklich stehen, und genau das ist hier falsch.
              */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden"
              >
                <label htmlFor="support-website">
                  {t("support.form.website")}
                </label>
                <input
                  id="support-website"
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                />
              </div>

              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending
                  ? t("support.form.submitting")
                  : t("support.form.submit")}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
