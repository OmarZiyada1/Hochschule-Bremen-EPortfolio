import { zodResolver } from "@hookform/resolvers/zod"
import { useId, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { useAuth } from "@/api/auth/AuthContext"
import { resolveApiUrl } from "@/api/client"
import { applyValidationErrors, apiErrorMessageKey, isApiError } from "@/api/errors"
import type { OwnPortfolioResponse, UserResponse } from "@/api/types"
import { PasswordInput } from "@/components/common/PasswordInput"
import { UserAvatar } from "@/components/common/UserAvatar"
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
import { Textarea } from "@/components/ui/textarea"
import { EmailChangeNotice } from "@/features/portfolio/components/EmailChangeNotice"
import { useUpdateOwnPortfolio, useUpdateOwnProfile, useUploadAvatar } from "@/features/portfolio/hooks/useProfileMutations"
import {
  isEmailChange,
  profileFormSchema,
  type ProfileFormValues,
} from "@/features/portfolio/ProfileForm.schema"

/** Die Feldnamen fuer die Zuordnung eines 400 VALIDATION_FAILED (§6.2). */
const FORM_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "currentPassword",
  "biography",
  "avatarUrl",
] as const

/** Was der jeweilige Request bewirkt hat, fuer die Meldung am Ende. */
type SaveResult = { profileSaved: boolean; portfolioSaved: boolean }

/**
 * Das Profilformular nach Template "Profil bearbeiten" (KAN-34).
 *
 * <p><strong>Ein Formular, zwei Endpoints.</strong> Vorname, Nachname und
 * der E-Mail-Wunsch gehoeren zum User und laufen ueber PUT /api/auth/me;
 * Biografie und Avatar gehoeren zum Portfolio und laufen ueber
 * PUT /api/portfolio/me (§6.1). Die beiden Requests gehen nacheinander
 * raus, und die Meldung am Ende benennt, was gespeichert wurde und was
 * nicht. Innerhalb von PUT /auth/me gibt es dagegen keinen Teilerfolg: der
 * Endpoint uebernimmt alles oder nichts (§6.1, v40), scheitert der
 * E-Mail-Wechsel, bleibt auch die Namensaenderung aus.
 *
 * <p><strong>Die Komponente wird erst mit geladenen Daten eingehaengt.</strong>
 * Deshalb genuegen defaultValues, und es braucht kein Nachziehen aus einem
 * Effekt: die Seite darueber zeigt bis dahin ihren Ladezustand.
 *
 * <p>Die HSB-Adresse steht als nicht bearbeitbares Feld im Template, wird
 * aber bewusst leer gelassen: sie verlaesst den Server ausschliesslich ueber
 * AdminUserResponse (§3.1), und keine der Antworten dieser Seite fuehrt sie.
 * Das Feld sagt damit genau das, was gilt: die Adresse existiert und ist
 * hier weder sichtbar noch aenderbar.
 */
export function ProfileForm({
  user,
  portfolio,
}: {
  user: UserResponse
  portfolio: OwnPortfolioResponse | undefined
}) {
  const { t } = useTranslation()
  const { refreshUser } = useAuth()
  const updateProfile = useUpdateOwnProfile()
  const updatePortfolio = useUpdateOwnPortfolio()
  const upload = useUploadAvatar()
  const avatarInputId = useId()

  const [result, setResult] = useState<SaveResult | null>(null)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  /* Die Login-Kennung. Waehrend eines laufenden Wechsels bleibt sie die
     alte; die Wunschadresse steht allein in pendingEmail (§3.1). */
  const currentEmail = user.email ?? ""
  const pendingEmail = user.pendingEmail ?? null

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema(currentEmail)),
    defaultValues: {
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? "",
      email: currentEmail,
      currentPassword: "",
      biography: portfolio?.biography ?? "",
      avatarUrl: portfolio?.avatarUrl ?? "",
    },
  })

  /* useWatch statt form.watch: vertraeglich mit dem React Compiler
     (Lint react-hooks/incompatible-library), wie im VerifyCodeStep. */
  const enteredEmail = useWatch({ control: form.control, name: "email" })
  const avatarUrl = useWatch({ control: form.control, name: "avatarUrl" })
  const emailChanged = isEmailChange(enteredEmail, currentEmail)

  const messageOf = (
    error: { message?: string; type?: string } | undefined
  ): string | undefined => {
    if (error?.message === undefined) {
      return undefined
    }
    return error.type === "server" ? error.message : t(error.message)
  }

  /* Brücke zwischen applyValidationErrors (kennt nur Feldnamen als String)
     und der typisierten setError-Signatur von react-hook-form. */
  const setServerFieldError = (
    name: string,
    fieldError: { type: "server"; message: string }
  ) => {
    form.setError(name as Parameters<typeof form.setError>[0], fieldError)
  }

  /**
   * Der Upload macht das Bild noch nicht zum Profilbild: er liefert nur die
   * Referenz /api/files/{id}, gespeichert wird sie mit dem Formular
   * (Entscheidung aus der Klaerungsrunde). Im Profil steht damit immer die
   * Referenz und nie Base64 oder eine Speicheradresse (§3.15.1).
   */
  const onAvatarSelected = async (file: File | undefined) => {
    if (file === undefined) {
      return
    }
    setAvatarError(null)
    try {
      const stored = await upload.mutateAsync(file)
      if (stored.url !== undefined) {
        form.setValue("avatarUrl", stored.url, { shouldDirty: true })
      }
    } catch (error) {
      if (!isApiError(error)) {
        throw error
      }
      /* FILE_TYPE_NOT_ALLOWED und FILE_TOO_LARGE entscheidet der Server
         (§3.15); die Allowlist wird im Client nicht nachgebaut. */
      setAvatarError(
        t(apiErrorMessageKey(error), { defaultValue: error.message })
      )
    }
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setResult(null)
    setAvatarError(null)

    /*
     * email geht nur mit, wenn die Adresse geaendert wurde oder ein Wechsel
     * laeuft: im zweiten Fall bricht die aktuelle Adresse ihn ab, und genau
     * das ist der im Contract vorgesehene Weg zurueck (§6.1). Ohne
     * laufenden Wechsel bleibt eine reine Namensaenderung passwortfrei.
     */
    const sendEmail = emailChanged || pendingEmail !== null

    let profileSaved = false
    let portfolioSaved = false

    try {
      const updated = await updateProfile.mutateAsync({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        ...(sendEmail ? { email: values.email.trim() } : {}),
        ...(emailChanged ? { currentPassword: values.currentPassword } : {}),
      })
      profileSaved = true
      /* Die Antwort traegt die weiterhin gueltige Kennung; die Wunschadresse
         steht in pendingEmail und erscheint allein im Hinweis. */
      form.setValue("email", updated.email ?? currentEmail)
      form.setValue("currentPassword", "")
    } catch (error) {
      if (!isApiError(error)) {
        throw error
      }
      if (error.errorCode === "LOGIN_FAILED") {
        form.setError("currentPassword", {
          type: "server",
          message: t("portfolio.profile.error.wrongPassword"),
        })
      } else if (error.errorCode === "RESOURCE_IN_USE") {
        form.setError("email", {
          type: "server",
          message: t("portfolio.profile.error.emailInUse"),
        })
      } else if (error.errorCode === "VALIDATION_FAILED") {
        applyValidationErrors(error, FORM_FIELDS, setServerFieldError)
      } else {
        form.setError("root.server", {
          type: "server",
          message: t(apiErrorMessageKey(error), {
            defaultValue: error.message,
          }),
        })
      }
    }

    try {
      /*
       * PUT beschreibt den Zielzustand: null und weggelassen loeschen den
       * Wert gleichermassen (§6.1, §6.3). Weggelassen wird hier gewaehlt,
       * weil die generierte schema.d.ts fuer beide Felder string und nicht
       * string | null fuehrt; ein null waere ein handgeschriebener Typ
       * neben dem generierten (Frontend-Regel 2).
       */
      await updatePortfolio.mutateAsync({
        biography: values.biography === "" ? undefined : values.biography,
        avatarUrl: values.avatarUrl === "" ? undefined : values.avatarUrl,
      })
      portfolioSaved = true
    } catch (error) {
      if (!isApiError(error)) {
        throw error
      }
      if (error.errorCode === "VALIDATION_FAILED") {
        applyValidationErrors(error, FORM_FIELDS, setServerFieldError)
      } else {
        form.setError("root.server", {
          type: "server",
          message: t(apiErrorMessageKey(error), {
            defaultValue: error.message,
          }),
        })
      }
    }

    if (profileSaved) {
      /* Der Sitzungszustand wird an genau einer Stelle geschrieben
         (KAN-30): NavBar und Profilkarte zeigen danach den neuen Namen,
         und pendingEmail steuert den Hinweis unten. */
      await refreshUser()
    }
    setResult({ profileSaved, portfolioSaved })
  })

  const person = {
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
  }
  const bothSaved = result?.profileSaved === true && result.portfolioSaved
  const noneSaved = result !== null && !result.profileSaved && !result.portfolioSaved

  return (
    <>
      <div className="flex flex-col items-center gap-2">
        <UserAvatar
          person={person}
          imageUrl={avatarUrl === "" ? null : resolveApiUrl(avatarUrl)}
          size="lg"
          className="size-24 type-h2"
        />
        {/*
         * Label statt Knopf: das Dateifeld bleibt ein echtes input und
         * damit ohne Nachbau bedienbar. Es ist sr-only und trotzdem
         * fokussierbar; peer-focus-visible macht den Fokus am Label
         * sichtbar, sonst waere er unsichtbar (SC 2.4.7).
         */}
        <input
          id={avatarInputId}
          type="file"
          accept="image/*"
          className="peer sr-only"
          disabled={upload.isPending}
          onChange={(event) => void onAvatarSelected(event.target.files?.[0])}
        />
        <FieldLabel
          htmlFor={avatarInputId}
          className="type-body-sm cursor-pointer font-semibold text-primary underline-offset-4 hover:underline peer-focus-visible:underline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring"
        >
          {upload.isPending
            ? t("portfolio.profile.avatarPending")
            : t("portfolio.profile.changeAvatar")}
        </FieldLabel>
        {avatarError !== null && (
          <p role="alert" className="type-body-sm text-destructive">
            {avatarError}
          </p>
        )}
      </div>

      <h1 className="type-h2 font-semibold text-primary">
        {t("portfolio.profile.title")}
      </h1>

      <form onSubmit={onSubmit} noValidate>
        <FieldGroup className="gap-4.5">
          <div className="grid gap-4.5 sm:grid-cols-2">
            <Controller
              name="firstName"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="gap-1.5">
                  <FieldLabel
                    htmlFor={field.name}
                    className="type-label-xs text-muted-foreground uppercase group-data-[invalid=true]/field:text-destructive"
                  >
                    {t("portfolio.profile.firstName")}
                  </FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    autoComplete="given-name"
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      fieldState.invalid ? "profile-firstName-error" : undefined
                    }
                  />
                  {fieldState.invalid && (
                    <FieldError
                      id="profile-firstName-error"
                      errors={[{ message: messageOf(fieldState.error) }]}
                    />
                  )}
                </Field>
              )}
            />

            <Controller
              name="lastName"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="gap-1.5">
                  <FieldLabel
                    htmlFor={field.name}
                    className="type-label-xs text-muted-foreground uppercase group-data-[invalid=true]/field:text-destructive"
                  >
                    {t("portfolio.profile.lastName")}
                  </FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    autoComplete="family-name"
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      fieldState.invalid ? "profile-lastName-error" : undefined
                    }
                  />
                  {fieldState.invalid && (
                    <FieldError
                      id="profile-lastName-error"
                      errors={[{ message: messageOf(fieldState.error) }]}
                    />
                  )}
                </Field>
              )}
            />
          </div>

          <Controller
            name="email"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1.5">
                <FieldLabel
                  htmlFor={field.name}
                  className="type-label-xs text-muted-foreground uppercase group-data-[invalid=true]/field:text-destructive"
                >
                  {t("portfolio.profile.email")}
                </FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  type="email"
                  autoComplete="email"
                  aria-invalid={fieldState.invalid}
                  aria-describedby={
                    fieldState.invalid ? "profile-email-error" : undefined
                  }
                />
                {fieldState.invalid && (
                  <FieldError
                    id="profile-email-error"
                    errors={[{ message: messageOf(fieldState.error) }]}
                  />
                )}
              </Field>
            )}
          />

          {/* Nur bei geaenderter Adresse, wie im Frame 677-3243. Die Pflicht
              dahinter steht im zod-Schema, nicht hier. */}
          {emailChanged && (
            <Controller
              name="currentPassword"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="gap-1.5">
                  <FieldLabel
                    htmlFor={field.name}
                    className="type-label-xs text-muted-foreground uppercase group-data-[invalid=true]/field:text-destructive"
                  >
                    {t("portfolio.profile.currentPassword")}
                  </FieldLabel>
                  <PasswordInput
                    {...field}
                    id={field.name}
                    autoComplete="current-password"
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      fieldState.invalid
                        ? "profile-currentPassword-hint profile-currentPassword-error"
                        : "profile-currentPassword-hint"
                    }
                  />
                  <FieldDescription id="profile-currentPassword-hint">
                    {t("portfolio.profile.currentPasswordHint")}
                  </FieldDescription>
                  {fieldState.invalid && (
                    <FieldError
                      id="profile-currentPassword-error"
                      errors={[{ message: messageOf(fieldState.error) }]}
                    />
                  )}
                </Field>
              )}
            />
          )}

          {pendingEmail !== null && (
            <EmailChangeNotice
              pendingEmail={pendingEmail}
              onConfirmed={() => {
                /*
                 * Das Einloesen macht die Wunschadresse zur Login-Kennung
                 * (§3.1, §6.1). Erst GET /auth/me nachziehen, damit die
                 * Regel des Schemas die neue Adresse als die aktuelle
                 * kennt, dann das Feld nachziehen: umgekehrt hielte das
                 * Schema die neue Adresse fuer einen weiteren Wechsel und
                 * verlangte erneut ein Passwort.
                 */
                void refreshUser().then(() => {
                  form.setValue("email", pendingEmail)
                  setResult(null)
                })
              }}
            />
          )}

          <Field className="gap-1.5">
            <FieldLabel
              htmlFor="profile-hsbEmail"
              className="type-label-xs text-muted-foreground uppercase"
            >
              {t("portfolio.profile.hsbEmail")}
            </FieldLabel>
            {/* Bewusst ohne Wert: die HSB-Adresse verlaesst den Server nur
                in der Admin-Nutzerverwaltung (§3.1). Das Feld belegt, dass
                es sie gibt und dass sie hier nicht zu aendern ist. */}
            <Input
              id="profile-hsbEmail"
              type="email"
              value=""
              readOnly
              disabled
              aria-describedby="profile-hsbEmail-hint"
            />
            <FieldDescription id="profile-hsbEmail-hint">
              {t("portfolio.profile.hsbEmailHint")}
            </FieldDescription>
          </Field>

          <Controller
            name="biography"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-1.5">
                <FieldLabel
                  htmlFor={field.name}
                  className="type-label-xs text-muted-foreground uppercase group-data-[invalid=true]/field:text-destructive"
                >
                  {t("portfolio.profile.biography")}
                </FieldLabel>
                <Textarea
                  {...field}
                  id={field.name}
                  rows={4}
                  aria-invalid={fieldState.invalid}
                  aria-describedby={
                    fieldState.invalid ? "profile-biography-error" : undefined
                  }
                />
                {fieldState.invalid && (
                  <FieldError
                    id="profile-biography-error"
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

          {/*
           * Der Ausgang wird benannt, nicht angedeutet: zwei Requests
           * koennen verschieden ausgehen, und "gespeichert" waere dann
           * schlicht falsch. Die Aussage steht im Text, nicht in der Farbe
           * (Skill frontend-design, Abschnitt 4).
           */}
          {result !== null && (
            <Alert variant={noneSaved ? "destructive" : "default"}>
              <AlertTitle>
                {bothSaved
                  ? t("portfolio.profile.saved.all")
                  : noneSaved
                    ? t("portfolio.profile.saved.none")
                    : result.profileSaved
                      ? t("portfolio.profile.saved.profileOnly")
                      : t("portfolio.profile.saved.portfolioOnly")}
              </AlertTitle>
            </Alert>
          )}

          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? t("portfolio.profile.pending")
              : t("portfolio.profile.submit")}
          </Button>
        </FieldGroup>
      </form>
    </>
  )
}
