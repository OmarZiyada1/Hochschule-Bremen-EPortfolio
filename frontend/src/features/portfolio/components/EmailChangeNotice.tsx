import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"

import { isApiError } from "@/api/errors"
import { useApiErrorMessage } from "@/api/useApiErrorMessage"
import { ErrorState } from "@/components/common/ErrorState"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { verificationCodeSchema } from "@/features/auth/VerifyCodeForm.schema"
import {
  useResendVerificationCode,
  useVerifyCode,
} from "@/features/auth/hooks/useAuthMutations"
import { useResendCountdown } from "@/features/auth/hooks/useResendCountdown"

const emailChangeCodeSchema = z.object({ code: verificationCodeSchema })
type EmailChangeCodeValues = z.infer<typeof emailChangeCodeSchema>

/**
 * Der Zustand "Bestaetigung ausstehend" aus dem Template "Profil
 * bearbeiten" (Frame 678-3313, KAN-60): Info-Banner, Feld fuer den
 * sechsstelligen Code, "Code bestaetigen" und "Code erneut senden".
 *
 * <p><strong>Der Zweck ist EMAIL_CHANGE, und die Adresse ist die neue.</strong>
 * Bei allen anderen Zwecken traegt POST /auth/verify die private Adresse
 * als Kennung des Kontos; EMAIL_CHANGE ist die ausdrueckliche Ausnahme
 * (§6.1): eingeloest wird der Code gegen die Wunschadresse, und erst damit
 * wird sie zur Login-Kennung (§3.1).
 *
 * <p>Bis zur Bestaetigung bleibt die alte Adresse gueltig. Das Banner nennt
 * die neue, das E-Mail-Feld des Profilformulars zeigt weiter die bisherige;
 * ein Client, der die Wunschadresse schon als Kennung darstellt, verspricht
 * einen Zustand, den der Server nicht hat.
 *
 * <p>Seit KAN-105 steht die Komponente unveraendert im Dialog "Neue
 * E-Mail-Adresse bestaetigen", den das Profilformular rendert; unter dem
 * E-Mail-Feld bleibt nur die Hinweiszeile, die ihn oeffnet.
 *
 * <p>Ein 409 auf das Einloesen heisst, dass die Adresse inzwischen vergeben
 * ist (§6.1); wie jeder andere Fehlschlag laeuft er ueber die Meldung, weil
 * die Person in beiden Faellen dasselbe tun muss: eine andere Adresse
 * waehlen.
 */
export function EmailChangeNotice({
  pendingEmail,
  onConfirmed,
  onCancel,
  cancelPending = false,
}: {
  /** Wunschadresse aus pendingEmail (§3.1); nie die aktuelle Kennung. */
  pendingEmail: string
  /**
   * Nach erfolgreichem Einloesen. Das Profilformular zieht GET /auth/me und
   * das E-Mail-Feld nach, die Seite entscheidet ueber Toast und
   * Weiterleitung (KAN-105).
   */
  onConfirmed: () => void
  /**
   * Nimmt den laufenden Wechsel zurueck (KAN-83). Der Contract sieht dafuer
   * vor, die <em>aktuelle</em> Adresse zu senden (§6.1); das tat bis dahin
   * jedes gewoehnliche Speichern nebenbei mit, und wer waehrend der
   * Wartezeit einen Tippfehler im Namen korrigierte, verlor unbemerkt den
   * Wechsel. Jetzt ist es eine benannte Handlung.
   */
  onCancel: () => void
  /** Laeuft der Abbruch gerade? Sperrt den Knopf gegen den zweiten Klick. */
  cancelPending?: boolean
}) {
  const { t } = useTranslation()
  const apiMessage = useApiErrorMessage()
  const verify = useVerifyCode()
  const resend = useResendVerificationCode()
  const { remaining, ready, restart } = useResendCountdown()
  const [resendConfirmed, setResendConfirmed] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<EmailChangeCodeValues>({
    resolver: zodResolver(emailChangeCodeSchema),
    defaultValues: { code: "" },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null)
    setResendConfirmed(false)
    try {
      await verify.mutateAsync({
        email: pendingEmail,
        purpose: "EMAIL_CHANGE",
        code: values.code,
      })
      form.reset({ code: "" })
      onConfirmed()
    } catch (error) {
      if (!isApiError(error)) {
        throw error
      }
      setServerError(apiMessage(error))
    }
  })

  const onResend = async () => {
    setServerError(null)
    setResendConfirmed(false)
    try {
      await resend.mutateAsync({
        email: pendingEmail,
        purpose: "EMAIL_CHANGE",
      })
      /* 204 kommt immer, unabhaengig vom Versand (§6.1); die Bestaetigung
         ist deshalb in jedem Fall dieselbe. */
      setResendConfirmed(true)
      restart()
    } catch (error) {
      if (!isApiError(error)) {
        throw error
      }
      setServerError(apiMessage(error))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Alert className="bg-pill-info-bg text-pill-info-fg">
        <AlertTitle className="font-normal">
          {t("portfolio.profile.emailChange.pending", {
            address: pendingEmail,
          })}
        </AlertTitle>
      </Alert>

      <Controller
        name="code"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid} className="gap-1.5">
            <FieldLabel
              htmlFor={field.name}
              className="type-label-xs text-muted-foreground uppercase group-data-[invalid=true]/field:text-destructive"
            >
              {t("portfolio.profile.emailChange.codeLabel")}
            </FieldLabel>
            <Input
              {...field}
              id={field.name}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder={t("portfolio.profile.emailChange.codePlaceholder")}
              aria-invalid={fieldState.invalid}
              aria-describedby={
                fieldState.invalid ? "email-change-code-error" : undefined
              }
            />
            {fieldState.invalid && fieldState.error?.message && (
              <FieldError
                id="email-change-code-error"
                errors={[{ message: t(fieldState.error.message) }]}
              />
            )}
          </Field>
        )}
      />

      {serverError !== null && <ErrorState message={serverError} />}

      <div className="flex flex-wrap items-center gap-4">
        {/* type=button: bis KAN-105 lag dieser Knopf im Profilformular und
            durfte es nicht abschicken. Seither steht er im Dialog ausserhalb
            davon; type=button bleibt, damit kein umgebendes Formular ihn zum
            Absenden macht. Abgesetzt wird allein POST /auth/verify. */}
        <Button
          type="button"
          variant="outline"
          onClick={() => void onSubmit()}
          disabled={verify.isPending}
        >
          {verify.isPending
            ? t("portfolio.profile.emailChange.confirmPending")
            : t("portfolio.profile.emailChange.confirm")}
        </Button>

        {ready ? (
          <Button
            type="button"
            variant="link"
            className="type-body-sm h-auto p-0 font-semibold"
            onClick={onResend}
            disabled={resend.isPending}
          >
            {t("portfolio.profile.emailChange.resend")}
          </Button>
        ) : (
          <p className="type-body-sm text-muted-foreground">
            {t("portfolio.profile.emailChange.resendCountdown", {
              seconds: remaining,
            })}
          </p>
        )}

        {/* Der Weg zurueck steht seit KAN-83 hier und nicht mehr als
            Nebenwirkung des Speicherns. Er schickt die aktuelle Adresse,
            genau wie §6.1 es vorsieht, und braucht deshalb kein Passwort. */}
        <Button
          type="button"
          variant="link"
          className="type-body-sm h-auto p-0 font-semibold text-muted-foreground aria-disabled:opacity-50"
          /* aria-disabled statt disabled, wie am PrintTrigger: eine
             Schaltflaeche, die im Augenblick des Klicks disabled wird,
             verliert den Fokus an den Seitenanfang (SC 2.4.3). Den zweiten
             Aufruf faengt der Handler ab. */
          onClick={() => {
            if (cancelPending) {
              return
            }
            onCancel()
          }}
          aria-disabled={cancelPending}
        >
          {t("portfolio.profile.emailChange.cancel")}
        </Button>
      </div>

      {/* role=status sagt die Bestaetigung beim Erscheinen an, ohne den
          Fokus zu bewegen. */}
      <p role="status" className="type-body-sm text-muted-foreground">
        {resendConfirmed && t("portfolio.profile.emailChange.resendConfirmed")}
      </p>
    </div>
  )
}
