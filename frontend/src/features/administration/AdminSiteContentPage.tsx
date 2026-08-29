import { zodResolver } from "@hookform/resolvers/zod"
import { Fragment, useId, useState } from "react"
import { Controller, useForm, type FieldPath } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { applyValidationErrors, isApiError } from "@/api/errors"
import type { SiteContentEntryResponse } from "@/api/types"
import { useApiErrorMessage } from "@/api/useApiErrorMessage"
import { ErrorState } from "@/components/common/ErrorState"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  formPathOfServerField,
  SITE_CONTENT_FIELDS,
  SITE_CONTENT_SECTIONS,
  SITE_CONTENT_SERVER_FIELDS,
  siteContentFormSchema,
  type SiteContentFieldSpec,
  type SiteContentFormValues,
} from "@/features/administration/AdminSiteContentPage.schema"
import {
  useReplaceSiteContent,
  useSiteContent,
} from "@/features/administration/hooks/useSiteContent"
import { bundledSiteText } from "@/i18n/bundled"

/** Der Hausstil fuer Feldbeschriftungen, wie im CreateUserDialog daneben. */
const LABEL_CLASS =
  "type-label-xs text-muted-foreground uppercase group-data-[invalid=true]/field:text-destructive"

/** Die beiden gefuehrten Sprachen, in der Reihenfolge der Felder. */
const LANGUAGES = [
  { code: "de", valueKey: "valueDe" },
  { code: "en", valueKey: "valueEn" },
] as const

type LanguageSpec = (typeof LANGUAGES)[number]

/**
 * Die Pflege der Startseitentexte auf der Administrationsseite
 * (Contract §2.16, §3.21, §5, §6.1): fuenfzehn Stellen der oeffentlichen
 * Startseite, je deutsch und englisch, in einem Formular mit einem
 * Speichern-Knopf.
 *
 * <p><strong>Ein leeres Feld ist eine Aussage und kein Versaeumnis.</strong>
 * Es heisst „hier gilt die ausgelieferte Fassung", und der Server versteht es
 * genauso: ein leerer Wert loescht die gepflegte Zeile, und die Stelle faellt
 * auf die Sprachdatei des Frontends zurueck (§6.1). Damit diese Aussage
 * lesbar ist, steht die ausgelieferte Fassung als Vorschlag im leeren Feld.
 * Sie ist nur ein Vorschlag: gespeichert wird sie nie, sonst waere aus dem
 * Rueckfall unbemerkt eine Pflege geworden, und der Weg zurueck zur
 * mitgelieferten Fassung waere verbaut.
 *
 * <p><strong>Ein Knopf fuer alle fuenfzehn Stellen.</strong> Der Endpoint
 * nimmt die ganze Liste entgegen und ersetzt je Schluessel; ein Speichern je
 * Zeile waere derselbe Vorgang in fuenfzehn Anfragen, und ein Formular, das
 * an dreissig Stellen einzeln absendet, laesst niemanden mehr wissen, was
 * schon gespeichert ist. Geschickt werden immer alle Eintraege und in beiden
 * Sprachen, weil ein weggelassenes Feld dort nicht „bleibt wie es war"
 * bedeutet, sondern dasselbe wie ein leeres.
 *
 * <p><strong>Die Gliederung ist die der Startseite</strong>, von oben nach
 * unten: Kopfbereich, Top-10-Sektion, Abschlusssektion. Wer die Seite vor
 * Augen hat, findet die Stelle, ohne den i18n-Schluessel zu kennen; die
 * rohen Schluessel stehen deshalb nirgends in der Oberflaeche.
 *
 * <p><strong>Kein Zeichenzaehler.</strong> Die Obergrenze von 1000 Zeichen ist
 * ein Gelaender und kein Ziel: der laengste mitgelieferte Text hat rund 160
 * Zeichen. Ein Zaehler an dreissig Feldern zaehlte dreissigmal ins Leere und
 * spraeche, anders als bei Titel und Kurzbeschreibung eines Projekts, nie
 * eine Warnung aus, die jemand braucht.
 */
export default function AdminSiteContentPage() {
  const { t } = useTranslation()
  const siteContent = useSiteContent()

  return (
    <>
      <header className="flex flex-col gap-2">
        <p className="type-overline text-muted-foreground">
          {t("administration.label")}
        </p>
        <h1 className="type-title text-primary">
          {t("administration.siteContent.title")}
        </h1>
        <p className="type-body-lg text-muted-foreground">
          {t("administration.siteContent.subtitle")}
        </p>
        <p className="type-body-sm text-muted-foreground">
          {t("administration.siteContent.resetHint")}
        </p>
        <hr className="mt-2" />
      </header>

      {siteContent.error !== null && <ErrorState error={siteContent.error} />}

      {siteContent.isPending && (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="h-10 w-full rounded-control" />
            <Skeleton className="h-10 w-full rounded-control" />
            <Skeleton className="h-10 w-full rounded-control" />
          </CardContent>
        </Card>
      )}

      {/* Erst mit geladenem Stand eingehaengt: dann genuegen defaultValues,
          und es braucht kein Nachziehen der Felder aus einem Effekt, das
          eine gerade begonnene Eingabe ueberschriebe (Vorbild ProfileForm). */}
      {siteContent.data !== undefined && (
        <SiteContentForm entries={siteContent.data.entries} />
      )}
    </>
  )
}

/**
 * Die Ausgangswerte der Felder: fuer jede der fuenfzehn Stellen ein Eintrag,
 * auch fuer die ungepflegten.
 *
 * <p>Die Antwort fuehrt nur gepflegte Stellen (§6.1). Ein fehlender
 * Schluessel wird hier zum leeren Feld und nicht zu einer fehlenden Zeile:
 * die Reihenfolge der Eintraege ist zugleich die Indexordnung des Requests,
 * an der der Server seine Feldfehler festmacht.
 */
function valuesOf(
  entries: readonly SiteContentEntryResponse[]
): SiteContentFormValues["entries"] {
  return SITE_CONTENT_FIELDS.map((field) => {
    const maintained = entries.find((entry) => entry.key === field.key)
    return {
      key: field.key,
      valueDe: maintained?.valueDe ?? "",
      valueEn: maintained?.valueEn ?? "",
    }
  })
}

function SiteContentForm({
  entries,
}: {
  entries: readonly SiteContentEntryResponse[]
}) {
  const { t } = useTranslation()
  const apiMessage = useApiErrorMessage()
  const replace = useReplaceSiteContent()
  const fieldId = useId()
  const [notice, setNotice] = useState("")

  const form = useForm<SiteContentFormValues>({
    resolver: zodResolver(siteContentFormSchema),
    defaultValues: { entries: valuesOf(entries) },
  })

  /*
   * Zod hinterlegt i18n-Schluessel, applyValidationErrors den Meldungstext
   * des Servers (type "server"); uebersetzt wird nur, was aus dem Schema
   * kommt (Muster aus KAN-8).
   */
  const messageOf = (
    error: { message?: string; type?: string } | undefined
  ): string | undefined => {
    if (error?.message === undefined) {
      return undefined
    }
    return error.type === "server" ? error.message : t(error.message)
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setNotice("")
    try {
      /*
       * Zurueckgesetzt wird auf die Antwort und nicht auf das Abgeschickte:
       * sie ist der neue Gesamtstand. Ein Feld aus reinem Leerraum kommt
       * darin geloescht zurueck und steht danach leer da, mit der
       * ausgelieferten Fassung als Vorschlag, genau wie es die Startseite
       * ab jetzt zeigt.
       */
      const saved = await replace.mutateAsync(values.entries)
      form.reset({ entries: valuesOf(saved.entries) })
      setNotice(t("administration.siteContent.saved"))
    } catch (error) {
      if (!isApiError(error)) {
        throw error
      }
      /*
       * Der Server nennt das betroffene Feld mit Index in der Schreibweise
       * der Bean-Validation (§6.2). Uebersetzt in den Pfad von
       * react-hook-form landet die Meldung an der Zeile und der Sprache,
       * die sie ausgeloest hat; was sich keinem Feld zuordnen laesst, steht
       * als Meldung ueber dem Formular.
       */
      if (error.errorCode === "VALIDATION_FAILED") {
        applyValidationErrors(
          error,
          SITE_CONTENT_SERVER_FIELDS,
          (name, issue) =>
            form.setError(
              formPathOfServerField(name) as
                FieldPath<SiteContentFormValues> | "root.server",
              issue
            )
        )
        return
      }
      form.setError("root.server", {
        type: "server",
        message: apiMessage(error),
      })
    }
  })

  const formError = form.formState.errors.root?.server?.message

  /** Ein Sprachfeld einer Stelle, deutsch oder englisch. */
  const languageField = (
    index: number,
    field: SiteContentFieldSpec,
    language: LanguageSpec
  ) => {
    const name = `entries.${index}.${language.valueKey}` as const
    const controlId = `${fieldId}-${index}-${language.code}`
    const hintId =
      field.requiredPlaceholders.length > 0 ? `${fieldId}-${index}-hint` : null
    /*
     * Der Vorschlag ist der rohe Text der Sprachdatei und nicht das Ergebnis
     * von t(): der Ressourcenspeicher traegt nach einem Besuch der
     * Startseite bereits den gepflegten Text, und t() liesse ausserdem einen
     * Platzhalter ohne uebergebenen Wert ersatzlos verschwinden.
     */
    const bundled = bundledSiteText(field.key, language.code) ?? ""

    return (
      <Controller
        key={language.code}
        name={name}
        control={form.control}
        render={({ field: control, fieldState }) => {
          const errorId = fieldState.invalid ? `${controlId}-error` : null
          const describedBy = [hintId, errorId].filter(Boolean).join(" ")
          const shared = {
            ...control,
            id: controlId,
            placeholder: bundled,
            /*
             * Diese Seite ist die einzige der Anwendung, die deutschen und
             * englischen Inhalt nebeneinander zeigt. Ohne lang liest eine
             * Sprachausgabe den englischen Wert und den englischen Vorschlag
             * mit deutscher Aussprache vor, und umgekehrt im englischen
             * Betrieb (SC 3.1.2, Language of Parts).
             */
            lang: language.code,
            "aria-invalid": fieldState.invalid,
            "aria-describedby": describedBy === "" ? undefined : describedBy,
          }

          return (
            <Field data-invalid={fieldState.invalid} className="gap-1.5">
              <FieldLabel htmlFor={controlId} className={LABEL_CLASS}>
                {t(`administration.siteContent.language.${language.code}`)}
              </FieldLabel>
              {field.multiline === true ? (
                <Textarea {...shared} rows={3} />
              ) : (
                <Input {...shared} type="text" autoComplete="off" />
              )}
              {fieldState.invalid && (
                <FieldError
                  id={errorId ?? undefined}
                  errors={[{ message: messageOf(fieldState.error) }]}
                />
              )}
            </Field>
          )
        }}
      />
    )
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={onSubmit} noValidate>
      {/* Was keinem Feld zuzuordnen ist, etwa ein 403: die Eingaben bleiben
          stehen. */}
      {formError !== undefined && <ErrorState message={formError} />}

      {SITE_CONTENT_SECTIONS.map((section) => (
        <section
          key={section.id}
          aria-labelledby={`${fieldId}-${section.id}`}
          className="flex flex-col gap-4"
        >
          <h2 id={`${fieldId}-${section.id}`} className="type-h2">
            {t(section.titleKey)}
          </h2>
          <Card>
            <CardContent className="flex flex-col gap-6">
              {section.fields.map((field) => {
                const index = SITE_CONTENT_FIELDS.indexOf(field)
                const hintId = `${fieldId}-${index}-hint`

                return (
                  <FieldSet key={field.key} className="gap-2">
                    <FieldLegend variant="label">
                      {t(field.labelKey)}
                    </FieldLegend>
                    {/* Der Pflichtplatzhalter steht neben beiden Sprachen und
                        nicht in der Fehlermeldung: er gilt fuer beide, und
                        wer ihn kennt, macht den Fehler gar nicht erst. Die
                        Klammern kommen aus der Liste und sind deshalb kein
                        Oberflaechentext (Frontend-Regel 7). */}
                    {field.requiredPlaceholders.length > 0 && (
                      <FieldDescription id={hintId}>
                        {t("administration.siteContent.placeholderHint")}{" "}
                        {field.requiredPlaceholders.map(
                          (placeholder, position) => (
                            <Fragment key={placeholder}>
                              {position > 0 && " "}
                              <code className="rounded-control bg-muted px-1 py-0.5">
                                {`{{${placeholder}}}`}
                              </code>
                            </Fragment>
                          )
                        )}
                      </FieldDescription>
                    )}
                    <div className="grid gap-4 lg:grid-cols-2">
                      {LANGUAGES.map((language) =>
                        languageField(index, field, language)
                      )}
                    </div>
                  </FieldSet>
                )
              })}
            </CardContent>
          </Card>
        </section>
      ))}

      <Card>
        <CardContent className="flex flex-col gap-3">
          {/* Gespeichert wird ohne sichtbare Aenderung an den Feldern: sie
              stehen danach da wie zuvor, weil form.reset dieselben Werte
              zurueckschreibt. Der Erfolg gehoert deshalb sichtbar auf die
              Seite und nicht nur in eine Ansage fuer die Sprachausgabe.
              role="status" statt des assertiven Standards der Primitive:
              das ist eine Auskunft und keine Fehlermeldung, und angesagt
              wird dieselbe Meldung, die auch dasteht (SC 4.1.3). */}
          {notice !== "" && (
            <Alert role="status">
              <AlertTitle>{notice}</AlertTitle>
            </Alert>
          )}
          <div className="flex flex-wrap items-center justify-end gap-3">
            {/* Der Knopf wird nicht nur inaktiv, sondern sagt auch, warum:
                dreissig Felder in einer Anfrage brauchen einen Augenblick. */}
            <Button type="submit" disabled={replace.isPending}>
              {replace.isPending
                ? t("administration.siteContent.submitPending")
                : t("administration.siteContent.submit")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
