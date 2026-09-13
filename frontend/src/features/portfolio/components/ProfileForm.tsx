import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useId, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { Controller, useController, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { useAuth } from "@/api/auth/AuthContext"
import { resolveApiUrl } from "@/api/client"
import { applyValidationErrors, isApiError } from "@/api/errors"
import { reactToSessionError } from "@/api/queryClient"
import type { OwnPortfolioResponse, UserResponse } from "@/api/types"
import { useApiErrorMessage } from "@/api/useApiErrorMessage"
import { CharacterCounter } from "@/components/common/CharacterCounter"
import { ErrorState } from "@/components/common/ErrorState"
import { PasswordInput } from "@/components/common/PasswordInput"
import { UserAvatar } from "@/components/common/UserAvatar"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import {
  useUpdateOwnPortfolio,
  useUpdateOwnProfile,
  useUploadAvatar,
} from "@/features/portfolio/hooks/useProfileMutations"
import {
  BIOGRAPHY_MAX_LENGTH,
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

/** Was die sr-only-Statuszeile am Profilbild zuletzt angesagt hat (KAN-105). */
type AvatarNotice = "removed" | "restored"

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
 * <p>Die HSB-Adresse steht als nicht bearbeitbares Feld im Template und
 * zeigt seit Contract v50 die eigene Adresse aus GET /auth/me (KAN-69):
 * die Auth-Antworten gehen an die Person selbst, und die eigene
 * Hochschuladresse ist kein Geheimnis vor sich selbst (§3.1). Aenderbar
 * ist sie weiterhin nicht, und Dritte sehen sie nirgends.
 *
 * <p><strong>Wohin es danach geht, entscheidet die Seite</strong> (KAN-105).
 * Das Formular kennt keine Route: es meldet ein vollstaendiges Speichern,
 * eine bestaetigte und eine abgebrochene Adressaenderung ueber Rueckrufe
 * nach oben, und {@code ProfileEditPage} leitet weiter oder bleibt stehen.
 * Wie bei {@code ProjectMetadataForm} entscheidet also die Seite ueber den
 * Weg; anders als dort setzt das Formular seine Requests weiter selbst ab
 * und meldet nur ihren Ausgang.
 *
 * <p><strong>Der laufende Wechsel steht im Dialog</strong> (KAN-105). Unter
 * dem E-Mail-Feld bleibt nur eine Hinweiszeile mit dem Knopf "Code
 * eingeben"; Code-Feld, erneutes Senden und Abbruch stehen im Dialog
 * "Neue E-Mail-Adresse bestaetigen". Den Offen-Zustand haelt die Seite,
 * weil sie ihn nach dem Speichern auch ohne Klick setzt. Hinweis und Dialog
 * rendert trotzdem das Formular: Abbruch und Bestaetigung ziehen Felder
 * nach, und ungespeicherte Eingaben duerfen dabei nicht verloren gehen.
 */
export function ProfileForm({
  user,
  portfolio,
  onDirtyChange,
  onSaved,
  emailDialogOpen,
  onEmailDialogOpenChange,
  onEmailChangeConfirmed,
  onEmailChangeCancelled,
}: {
  user: UserResponse
  portfolio: OwnPortfolioResponse | undefined
  /**
   * Meldet nach oben, ob ungespeicherte Eingaben vorliegen. Die Seite
   * braucht das fuer die Rueckfrage, bevor ein anderer Weg sie verwirft
   * (Skill frontend-design, Abschnitt 5).
   */
  onDirtyChange?: (dirty: boolean) => void
  /**
   * Nach einem vollstaendigen Speichern, also wenn beide Requests
   * durchgegangen sind. Teilerfolg und Fehlschlag melden nichts, die
   * Meldung steht dann am Formular. {@code pendingEmail} kommt aus der
   * Antwort von PUT /auth/me und nicht aus {@code user}: das Prop zieht erst
   * mit dem naechsten GET /auth/me nach (§3.1).
   */
  onSaved: (outcome: { pendingEmail: string | null }) => void
  /** Ob der Dialog "Neue E-Mail-Adresse bestaetigen" offen sein soll. */
  emailDialogOpen: boolean
  onEmailDialogOpenChange: (open: boolean) => void
  /** Der Code ist eingeloest, die Wunschadresse ist jetzt die Kennung. */
  onEmailChangeConfirmed: () => void
  /** Der laufende Wechsel ist zurueckgenommen (§6.1). */
  onEmailChangeCancelled: () => void
}) {
  const { t } = useTranslation()
  const apiMessage = useApiErrorMessage()
  const { refreshUser } = useAuth()
  const updateProfile = useUpdateOwnProfile()
  const updatePortfolio = useUpdateOwnPortfolio()
  const upload = useUploadAvatar()
  const avatarInputId = useId()

  /* Ziele fuer den Fokus, wenn der geklickte Knopf verschwindet (SC 2.4.3):
     Entfernen und Wiederherstellen tauschen ihren Platz, und der Dialog
     braucht beim Schliessen ein Ziel, weil er nach dem Speichern ohne
     Ausloeser aufgeht. */
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const removeAvatarRef = useRef<HTMLButtonElement>(null)
  const restoreAvatarRef = useRef<HTMLButtonElement>(null)
  const enterCodeRef = useRef<HTMLButtonElement>(null)

  const [result, setResult] = useState<SaveResult | null>(null)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [avatarNotice, setAvatarNotice] = useState<AvatarNotice | null>(null)
  /* Der Fehlerzweig des Abbruchs steht im Dialog und nicht in der
     Gesamtmeldung des Speicherns: er gehoert zu einer eigenen Handlung, und
     der Dialog bleibt bei einem Fehlschlag offen (Skill frontend-design,
     Abschnitt 5). */
  const [cancelError, setCancelError] = useState<string | null>(null)
  /* Laeuft der Abbruch des Wechsels? Vom Klick bis zum Ende des Vorgangs,
     damit ein zweiter Klick kein zweites PUT samt zweitem Toast schickt
     (Befund aus dem Review zu KAN-105). Der Ref faengt den zweiten Klick
     schon vor dem naechsten Rendern ab, den ein Prop nie erreicht; der
     State sperrt den Knopf ueber aria-disabled auch sichtbar. */
  const cancellingRef = useRef(false)
  const [cancelling, setCancelling] = useState(false)

  /* Die Login-Kennung. Waehrend eines laufenden Wechsels bleibt sie die
     alte; die Wunschadresse steht allein in pendingEmail (§3.1). */
  const currentEmail = user.email
  const pendingEmail = user.pendingEmail ?? null

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema(currentEmail)),
    defaultValues: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: currentEmail,
      currentPassword: "",
      biography: portfolio?.biography ?? "",
      avatarUrl: portfolio?.avatarUrl ?? "",
    },
  })

  /* useWatch statt form.watch: vertraeglich mit dem React Compiler
     (Lint react-hooks/incompatible-library), wie im VerifyCodeStep. */
  const enteredEmail = useWatch({ control: form.control, name: "email" })
  const emailChanged = isEmailChange(enteredEmail, currentEmail)

  /*
   * Das Profilbild ist ein registriertes Feld ohne Eingabeelement (KAN-105).
   * resetField wirkt in react-hook-form nur auf registrierte Felder; mit
   * blossem setValue und useWatch bliebe "Profilbild wiederherstellen" still
   * wirkungslos. Der Wert entsteht weiterhin allein aus dem Upload.
   */
  const { field: avatarField } = useController({
    control: form.control,
    name: "avatarUrl",
  })
  const avatarUrl = avatarField.value
  /*
   * Das zuletzt gespeicherte Bild. formState.defaultValues wandert mit dem
   * form.reset nach dem Speichern mit (react-hook-form setzt dabei die
   * Ausgangswerte neu); "wiederherstellen" holt also den gespeicherten Stand
   * zurueck und nicht den beim Oeffnen der Seite.
   */
  const savedAvatarUrl = form.formState.defaultValues?.avatarUrl ?? ""

  /* Der einzige Weg, den Zustand des Formulars nach aussen zu geben: er
     lebt in react-hook-form, und die Seite darueber muss ihn kennen, ohne
     das Formular zu besitzen. */
  const isDirty = form.formState.isDirty
  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

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
    setAvatarNotice(null)
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
      setAvatarError(apiMessage(error))
    }
  }

  /**
   * "Profilbild entfernen" (KAN-105), ohne Rueckfrage: geloescht wird nichts,
   * das Feld wird nur geleert. Wirksam wird das erst mit dem Speichern, das
   * bei leerem Feld avatarUrl weglaesst (PortfolioUpdateRequest in
   * /v3/api-docs), und bis dahin nimmt
   * "Profilbild wiederherstellen" es mit einem Klick zurueck (SC 3.3.4).
   *
   * <p>Der geklickte Knopf verschwindet dabei. flushSync rendert den Tausch
   * sofort, damit der Fokus auf dem Gegenknopf landen kann; gibt es keinen
   * (kein gespeichertes Bild), geht er auf den Dateiwaehler, dessen Fokus
   * das Label ueber peer-focus-visible zeigt (SC 2.4.3).
   */
  const onRemoveAvatar = () => {
    /* Waehrend eines Uploads ohne Wirkung (am Knopf aria-disabled statt
       disabled, damit der Fokus bleibt): sonst setzte das Ende des Uploads
       ein neues Bild ueber das gerade entfernte, der Fokus fiele mit dem
       Gegenknopf auf body, und die Statuszeile behauptete weiter "entfernt"
       (Befund aus dem Review zu KAN-105). */
    if (upload.isPending) {
      return
    }
    setAvatarError(null)
    flushSync(() => {
      form.setValue("avatarUrl", "", { shouldDirty: true })
      setAvatarNotice("removed")
    })
    const nextFocus = restoreAvatarRef.current ?? avatarInputRef.current
    nextFocus?.focus()
  }

  /** "Profilbild wiederherstellen": Wert und Dirty-Zustand des Feldes zurueck. */
  const onRestoreAvatar = () => {
    /* Waehrend eines Uploads ohne Wirkung, aus demselben Grund wie oben. */
    if (upload.isPending) {
      return
    }
    setAvatarError(null)
    flushSync(() => {
      form.resetField("avatarUrl")
      setAvatarNotice("restored")
    })
    removeAvatarRef.current?.focus()
  }

  /**
   * GET /auth/me nachziehen, ohne dass ein Fehlschlag den Vorgang davor
   * aufhaelt (Befund aus dem Review zu KAN-105).
   *
   * <p>Gerufen wird es erst, wenn der eigentliche Servervorgang durch ist:
   * Speichern, Einloesen des Codes oder Abbruch des Wechsels. Scheitert
   * danach allein das Nachladen, ist nichts misslungen, was die Person tun
   * koennte, und eine Fehlermeldung behauptete das Gegenteil. Die Seite liest
   * ihre Person ohnehin aus authQueries.me, das die Mutationen selbst
   * nachziehen; zurueck bleibt nur der Sitzungsstand im Store, und den holt
   * der naechste Abruf ein. Ohne diesen Fang entfielen Toast, Schliessen und
   * Weiterleitung, und die Ablehnung liefe unbehandelt ins Leere.
   *
   * <p>Still bleiben darf dabei nur, was die Sitzung nicht beendet. Ein 401
   * geht an die zentrale Fehlerreaktion weiter: refreshUser ruft den Client
   * direkt und laeuft damit an Query- und Mutation-Cache vorbei, an denen
   * reactToSessionError sonst haengt (Skill frontend-api, Abschnitt 3,
   * Befund aus der Nachpruefung zu KAN-105).
   */
  const refreshSession = async () => {
    try {
      await refreshUser()
    } catch (error) {
      if (!isApiError(error)) {
        throw error
      }
      reactToSessionError(error)
    }
  }

  /**
   * Der Weg zurueck aus dem Dialog (KAN-83, seit KAN-105 im Dialog). §6.1:
   * die aktuelle Adresse zu senden nimmt den Wechsel zurueck. Name und
   * Adresse gehen unveraendert mit, weil PUT /auth/me alles oder nichts
   * uebernimmt (§6.1, v40); ein Passwort braucht es nicht, denn die Adresse
   * aendert sich dabei nicht.
   */
  const onCancelEmailChange = () => {
    if (cancellingRef.current) {
      return
    }
    cancellingRef.current = true
    setCancelling(true)
    void (async () => {
      setCancelError(null)
      try {
        await updateProfile.mutateAsync({
          firstName: user.firstName,
          lastName: user.lastName,
          email: currentEmail,
        })
        await refreshSession()
        /* resetField statt setValue: das Feld kehrt zum gespeicherten Stand
           zurueck und gilt danach auch fuer die Rueckfrage der Seite nicht
           mehr als veraendert. */
        form.resetField("email")
        form.setValue("currentPassword", "")
        setResult(null)
        onEmailChangeCancelled()
      } catch (error) {
        /* Ohne diesen Zweig verschluckte der Abbruch jeden Serverfehler: die
           Person saehe nichts, der Dialog bliebe stehen, und es entstuende
           eine unbehandelte Ablehnung (Befund des frontend-reviewers). Das
           Nachladen danach faengt refreshSession selbst ab; hier kommt nur
           der Fehlschlag des PUT an. */
        if (!isApiError(error)) {
          throw error
        }
        setCancelError(apiMessage(error))
      } finally {
        cancellingRef.current = false
        setCancelling(false)
      }
    })()
  }

  /**
   * Das Einloesen macht die Wunschadresse zur Login-Kennung (§3.1, §6.1).
   * Erst GET /auth/me nachziehen, damit die Regel des Schemas die neue
   * Adresse als die aktuelle kennt, dann das Feld nachziehen: umgekehrt
   * hielte das Schema die neue Adresse fuer einen weiteren Wechsel und
   * verlangte erneut ein Passwort. Die neue Adresse wird dabei auch zum
   * Ausgangswert des Feldes (KAN-105): sie ist gespeichert, und die Seite
   * entscheidet anhand der ungespeicherten Eingaben, ob sie weiterleitet.
   */
  const onEmailConfirmed = (confirmedEmail: string) => {
    void (async () => {
      await refreshSession()
      form.resetField("email", { defaultValue: confirmedEmail })
      setResult(null)
      setCancelError(null)
      onEmailChangeConfirmed()
    })()
  }

  /*
   * Rueckgabeziel des Dialogs (Skill frontend-design, Abschnitt 5). Nach dem
   * Speichern geht er ohne Ausloeser auf, der Fokus fiele sonst auf body.
   * Ziel ist der Knopf der Hinweiszeile; nach Bestaetigung oder Abbruch ist
   * die Zeile weg, dann das E-Mail-Feld, dessen Inhalt sich gerade
   * geaendert hat (SC 2.4.3).
   */
  const emailDialogFinalFocus = () => {
    if (enterCodeRef.current !== null) {
      return enterCodeRef.current
    }
    form.setFocus("email")
    return false
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setResult(null)
    setAvatarError(null)

    /*
     * email geht nur mit, wenn die Adresse tatsaechlich geaendert wurde
     * (KAN-83). Bis dahin ging sie auch bei laufendem Wechsel mit, damit
     * die aktuelle Adresse ihn abbricht; das ist zwar der im Contract
     * vorgesehene Weg zurueck (§6.1), er lag hier aber als Falle: wer
     * waehrend der Wartezeit einen Tippfehler im Vornamen korrigierte,
     * verlor unbemerkt den Wechsel und den bereits verschickten Code. Der
     * Weg zurueck steht seither als eigene Schaltflaeche im Dialog "Neue
     * E-Mail-Adresse bestaetigen", wo er als Handlung erkennbar ist.
     */
    const sendEmail = emailChanged

    let profileSaved = false
    let portfolioSaved = false
    let pendingEmailAfterSave: string | null = null

    try {
      const updated = await updateProfile.mutateAsync({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        ...(sendEmail ? { email: values.email.trim() } : {}),
        ...(emailChanged ? { currentPassword: values.currentPassword } : {}),
      })
      profileSaved = true
      pendingEmailAfterSave = updated.pendingEmail ?? null
      /* Die Antwort traegt die weiterhin gueltige Kennung; die Wunschadresse
         steht in pendingEmail und erscheint allein in Hinweis und Dialog. */
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
          message: apiMessage(error),
        })
      }
    }

    try {
      /*
       * PUT beschreibt den Zielzustand: null und weggelassen loeschen den
       * Wert gleichermassen (Entscheidung zu KAN-22). Festgehalten ist das
       * in der maschinenlesbaren Fassung des Contracts, der Beschreibung von
       * PortfolioUpdateRequest in /v3/api-docs ("null oder weggelassen
       * entfernt es"); genau so entfernt "Profilbild entfernen" das Bild
       * (KAN-105). Weggelassen statt null, weil ein leeres Feld im Formular
       * "" ist und der Body damit fuer beide Felder derselbe Fall bleibt.
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
          message: apiMessage(error),
        })
      }
    }

    if (profileSaved) {
      /* Der Sitzungszustand wird an genau einer Stelle geschrieben
         (KAN-30): NavBar und Profilkarte zeigen danach den neuen Namen,
         und pendingEmail steuert Hinweiszeile und Dialog. */
      await refreshSession()
    }
    if (portfolioSaved) {
      /* Das Bild ist mit PUT /portfolio/me gespeichert, "entfernt, wirksam
         mit dem Speichern" stimmt also nicht mehr. Bleibt die Seite stehen
         (offener Adresswechsel, Teilerfolg), waere die Statuszeile sonst im
         Lesemodus weiter erreichbar (Befund aus dem Review zu KAN-105).
         Scheitert allein das Portfolio, bleibt sie, dort stimmt sie noch. */
      setAvatarNotice(null)
    }
    setResult({ profileSaved, portfolioSaved })
    if (profileSaved && portfolioSaved) {
      /*
       * Der gespeicherte Stand ist der neue Ausgangspunkt: ohne dieses
       * reset bliebe isDirty fuer immer true, und die Rueckfrage vor dem
       * Verlassen der Seite kaeme, obwohl nichts mehr offen ist (Befund
       * aus dem Review zu KAN-69). Die Adresse kommt aus dem Formular, das
       * die Antwort oben schon nachgezogen hat.
       */
      form.reset({ ...form.getValues(), currentPassword: "" })
      /* Nur der vollstaendige Erfolg geht nach oben; bei einem Teilerfolg
         bleibt die Seite stehen, und die Meldung unten benennt ihn. */
      onSaved({ pendingEmail: pendingEmailAfterSave })
    }
  })

  const person = {
    firstName: user.firstName,
    lastName: user.lastName,
  }
  const bothSaved = result?.profileSaved === true && result.portfolioSaved
  const noneSaved =
    result !== null && !result.profileSaved && !result.portfolioSaved

  /* Beschriftung des Dateiwaehlers nach Lage, wie im CoverImageField. */
  const chooseAvatarLabel = upload.isPending
    ? t("portfolio.profile.avatarPending")
    : avatarUrl === ""
      ? t("portfolio.profile.avatar.choose")
      : t("portfolio.profile.avatar.replace")

  return (
    <>
      <div className="flex flex-col items-center gap-2">
        {/* 96px wie in der Profilkarte, damit beide Seiten dasselbe Bild
            in derselben Groesse zeigen. */}
        <UserAvatar
          person={person}
          imageUrl={avatarUrl === "" ? null : resolveApiUrl(avatarUrl)}
          size="xl"
        />
        {/* Dateiwaehler und Entfernen beziehungsweise Wiederherstellen
            nebeneinander, auf schmalen Schirmen umbrechend (KAN-105). */}
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          {/*
           * Label statt Knopf: das Dateifeld bleibt ein echtes input und
           * damit ohne Nachbau bedienbar. Es ist sr-only und trotzdem
           * fokussierbar; peer-focus-visible macht den Fokus am Label
           * sichtbar, sonst waere er unsichtbar (SC 2.4.7).
           */}
          <input
            ref={avatarInputRef}
            id={avatarInputId}
            type="file"
            accept="image/*"
            className="peer sr-only"
            disabled={upload.isPending}
            onChange={(event) => {
              const file = event.target.files?.[0]
              /* Geleert, damit dieselbe Datei nach "entfernen" erneut
                 gewaehlt werden kann: ein unveraenderter Wert loest im
                 Browser kein change aus (KAN-105). */
              event.target.value = ""
              void onAvatarSelected(file)
            }}
          />
          <FieldLabel
            htmlFor={avatarInputId}
            className="type-body-sm cursor-pointer font-semibold text-primary underline-offset-4 peer-focus-visible:underline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring hover:underline"
          >
            {chooseAvatarLabel}
          </FieldLabel>
          {avatarUrl !== "" ? (
            <Button
              key="remove"
              ref={removeAvatarRef}
              type="button"
              variant="ghost"
              size="sm"
              /* Die Registry-Primitive kennt nur disabled: als Zustand; die
                 Sperre ueber aria-disabled wird hier sichtbar gemacht, wie
                 im CommentPanel und am PrintTrigger. */
              className="aria-disabled:opacity-50"
              aria-disabled={upload.isPending}
              onClick={onRemoveAvatar}
            >
              {t("portfolio.profile.avatar.remove")}
            </Button>
          ) : savedAvatarUrl !== "" ? (
            <Button
              key="restore"
              ref={restoreAvatarRef}
              type="button"
              variant="ghost"
              size="sm"
              className="aria-disabled:opacity-50"
              aria-disabled={upload.isPending}
              onClick={onRestoreAvatar}
            >
              {t("portfolio.profile.avatar.restore")}
            </Button>
          ) : null}
        </div>
        {/* Dauerhaft im Baum, nur der Text wechselt: eine Live-Region, die
            zusammen mit ihrem Inhalt entsteht, sagt bei einigen
            Screenreadern nichts (SC 4.1.3, Vorbild CoverImageField). */}
        <p role="status" className="sr-only">
          {avatarNotice === null
            ? ""
            : t(`portfolio.profile.avatar.${avatarNotice}`)}
        </p>
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
            /*
             * Die Hinweiszeile zum laufenden Wechsel (KAN-105), auch nach
             * einem Neuladen, solange pendingEmail gesetzt ist. role=status
             * statt der alert-Vorgabe der Primitive: der Hinweis beschreibt
             * einen Zustand und ist keine dringende Meldung, die beim
             * Betreten der Seite wie ein Fehler vorgelesen wird.
             */
            <Alert
              role="status"
              className="gap-2 bg-pill-info-bg text-pill-info-fg"
            >
              <AlertTitle
                id="profile-email-pending-hint"
                className="font-normal"
              >
                {t("portfolio.profile.emailChange.hint", {
                  address: pendingEmail,
                })}
              </AlertTitle>
              {/* type=button: der Knopf liegt im Profilformular und darf es
                  nicht abschicken. aria-haspopup sagt wie am Ausloeser von
                  "Passwort aendern", dass ein Dialog aufgeht; die
                  Beschreibung nennt beim Zurueckkehren des Fokus, worum es
                  geht. */}
              <Button
                ref={enterCodeRef}
                type="button"
                variant="outline"
                size="sm"
                className="justify-self-start"
                aria-haspopup="dialog"
                aria-describedby="profile-email-pending-hint"
                onClick={() => onEmailDialogOpenChange(true)}
              >
                {t("portfolio.profile.emailChange.enterCode")}
              </Button>
            </Alert>
          )}

          <Field className="gap-1.5">
            <FieldLabel
              htmlFor="profile-hsbEmail"
              className="type-label-xs text-muted-foreground uppercase"
            >
              {t("portfolio.profile.hsbEmail")}
            </FieldLabel>
            {/* Nicht aenderbar, aber sichtbar (§3.1, seit v50): das Feld
                zeigt die eigene HSB-Adresse aus GET /auth/me und belegt
                damit, mit welcher Adresse das Konto nachgewiesen wurde. */}
            <Input
              id="profile-hsbEmail"
              type="email"
              value={user.hsbEmail}
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
                {/*
                 * Bewusst ohne maxLength: ein eingefuegter laengerer Text
                 * bliebe sonst stillschweigend gekappt im Feld stehen, und
                 * wer ihn aus einem anderen Dokument holt, merkt den Verlust
                 * erst spaeter. Stattdessen bleibt er stehen und wird
                 * beanstandet, mit dem Zaehler daneben, der sagt, um wie
                 * viel es zu viel ist (SC 3.3.1).
                 */}
                <Textarea
                  {...field}
                  id={field.name}
                  rows={4}
                  aria-invalid={fieldState.invalid}
                  aria-describedby={
                    fieldState.invalid
                      ? "profile-biography-counter profile-biography-error"
                      : "profile-biography-counter"
                  }
                />
                <CharacterCounter
                  id="profile-biography-counter"
                  value={field.value}
                  max={BIOGRAPHY_MAX_LENGTH}
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
            <ErrorState message={form.formState.errors.root.server.message} />
          )}

          {/*
           * Der Ausgang wird benannt, nicht angedeutet: zwei Requests
           * koennen verschieden ausgehen, und "gespeichert" waere dann
           * schlicht falsch. Die Aussage steht im Text, nicht in der Farbe
           * (Skill frontend-design, Abschnitt 4). Sichtbar bleibt sie seit
           * KAN-105 bei Teilerfolg, Fehlschlag und dann, wenn die Seite nach
           * dem Speichern wegen eines offenen Wechsels stehen bleibt.
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

      {/*
       * Der Dialog steht ausserhalb des form-Elements: sein Inhalt ist ein
       * eigener Vorgang (POST /auth/verify, erneut senden, abbrechen) und
       * soll das Profilformular weder abschicken noch dessen Tastaturweg
       * erben. Offen ist er nur mit Wunschadresse; ist sie nach Bestaetigung
       * oder Abbruch fort, schliesst er auch dann, wenn die Seite ihren
       * Zustand noch nicht nachgezogen hat.
       */}
      <Dialog
        open={emailDialogOpen && pendingEmail !== null}
        onOpenChange={(open) => {
          if (!open) {
            /* Eine alte Fehlermeldung des Abbruchs gehoert nicht in den
               naechsten Anlauf. */
            setCancelError(null)
          }
          onEmailDialogOpenChange(open)
        }}
      >
        <DialogContent
          className="rounded-modal"
          finalFocus={emailDialogFinalFocus}
        >
          <DialogHeader>
            <DialogTitle>
              {t("portfolio.profile.emailChange.dialogTitle")}
            </DialogTitle>
          </DialogHeader>

          {pendingEmail !== null && (
            <EmailChangeNotice
              pendingEmail={pendingEmail}
              cancelPending={cancelling}
              onCancel={onCancelEmailChange}
              onConfirmed={() => onEmailConfirmed(pendingEmail)}
            />
          )}

          {cancelError !== null && (
            /* role=alert: der Abbruch ist eine ausdrueckliche Handlung, ihr
               Fehlschlag wird angesagt und nicht nur angezeigt. Er steht im
               Dialog, der dabei offen bleibt. */
            <Alert role="alert" variant="destructive">
              <AlertTitle>{cancelError}</AlertTitle>
            </Alert>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
