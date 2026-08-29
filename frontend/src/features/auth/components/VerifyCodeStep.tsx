import { zodResolver } from "@hookform/resolvers/zod"
import { MailIcon } from "lucide-react"
import { useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { Trans, useTranslation } from "react-i18next"
import { Link, useNavigate } from "react-router-dom"

import { isApiError } from "@/api/errors"
import { useApiErrorMessage } from "@/api/useApiErrorMessage"
import { ErrorState } from "@/components/common/ErrorState"
import { Button } from "@/components/ui/button"
import { Field, FieldError } from "@/components/ui/field"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { Separator } from "@/components/ui/separator"
import {
  useResendVerificationCode,
  useVerifyCode,
} from "@/features/auth/hooks/useAuthMutations"
import { useResendCountdown } from "@/features/auth/hooks/useResendCountdown"
import type { VerificationPurpose } from "@/api/types"
import {
  updateRegistrationFlow,
  type RegistrationFlowState,
} from "@/features/auth/registrationFlow"
import {
  verifyCodeFormSchema,
  type VerifyCodeFormValues,
} from "@/features/auth/VerifyCodeForm.schema"

/**
 * Karteninhalt der beiden Bestaetigungsseiten (KAN-33, Templates
 * "Registrierung 2" und "3"): Versandhinweis, sechsstellige Code-Eingabe,
 * "Code bestaetigen", "Neuen Code anfordern" mit Countdown, auf der
 * privaten Seite zusaetzlich "Zurueck".
 *
 * POST /auth/verify traegt immer die private Adresse, auch beim Zweck
 * HSB_EMAIL: sie ist die Kennung des Kontos, der Zweck sagt nur, welche
 * Adresse der Code bestaetigt (§6.1). Nur der Versandhinweis nennt beim
 * HSB-Schritt die HSB-Adresse.
 *
 * Weiter geht es allein nach dem Feld status der Antwort: ACTIVE fuehrt
 * zur Aktiviert-Seite, sonst zum jeweils fehlenden Schritt. Ein lokal
 * mitgezaehlter Schritt wuerde die Reihenfolge raten, die dem Server
 * ausdruecklich egal ist.
 *
 * Fehler laufen gesammelt ueber eine Meldung: ungueltiger, abgelaufener
 * und verbrauchter Code wie unbekannte Adresse sind serverseitig ein und
 * derselbe Fall (400 VERIFICATION_CODE_INVALID), und das Rate-Limit-429
 * gehoert an beide Aufrufe, weil verify und resend sich den Zaehler
 * teilen (§6.5).
 */
export function VerifyCodeStep({
  purpose,
  flow,
}: {
  /* Aus dem Contract-Enum abgeleitet statt von Hand geschrieben: die
     Registrierung kennt nur die beiden Adress-Zwecke, PASSWORD_RESET und
     EMAIL_CHANGE gehoeren anderen Flows (§2.11). */
  purpose: Extract<VerificationPurpose, "PRIVATE_EMAIL" | "HSB_EMAIL">
  flow: RegistrationFlowState
}) {
  const { t } = useTranslation()
  const apiMessage = useApiErrorMessage()
  const navigate = useNavigate()
  const verify = useVerifyCode()
  const resend = useResendVerificationCode()
  const { remaining, ready, restart } = useResendCountdown()
  const [resendConfirmed, setResendConfirmed] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<VerifyCodeFormValues>({
    resolver: zodResolver(verifyCodeFormSchema),
    defaultValues: { code: "" },
  })
  /*
   * useWatch statt form.watch: dieselbe Beobachtung, aber vertraeglich mit
   * dem React Compiler (Lint react-hooks/incompatible-library).
   */
  const code = useWatch({ control: form.control, name: "code" })

  const sentTo = purpose === "PRIVATE_EMAIL" ? flow.email : flow.hsbEmail

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null)
    try {
      const result = await verify.mutateAsync({
        email: flow.email,
        purpose,
        code: values.code,
      })
      const status = result.status ?? "REGISTRATION_PENDING"
      updateRegistrationFlow({
        emailVerified: result.emailVerified ?? flow.emailVerified,
        hsbEmailVerified: result.hsbEmailVerified ?? flow.hsbEmailVerified,
        status,
      })
      if (status === "ACTIVE") {
        navigate("/register/done")
      } else if (purpose === "PRIVATE_EMAIL") {
        navigate("/register/verify-hsb-email")
      } else {
        navigate("/register/verify-email")
      }
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
      await resend.mutateAsync({ email: flow.email, purpose })
      /*
       * 204 kommt immer, unabhaengig davon, ob eine Mail rausging (§6.1);
       * die Bestaetigung ist deshalb bewusst dieselbe in jedem Fall.
       */
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
    <>
      <div
        aria-hidden="true"
        className="mx-auto flex size-10 items-center justify-center rounded-card bg-pill-info-bg text-pill-info-fg"
      >
        <MailIcon className="size-5" />
      </div>

      <p className="type-body-sm text-center text-muted-foreground">
        {/* Nach dem Wiedereinstieg ueber den Login (KAN-68) ist die
            HSB-Adresse unbekannt: keine Response nennt sie (Contract 3.1),
            der Hinweis kommt dann ohne Adresse aus. */}
        {sentTo !== "" ? (
          <Trans
            i18nKey="register.verify.sentHint"
            values={{ address: sentTo }}
            components={{
              address: <span className="font-semibold text-primary" />,
            }}
          />
        ) : (
          t("register.verify.sentHintFallback")
        )}
      </p>

      <form onSubmit={onSubmit} noValidate>
        <div className="flex flex-col gap-4.5">
          <Controller
            name="code"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field
                data-invalid={fieldState.invalid}
                className="items-center gap-1.5"
              >
                <InputOTP
                  maxLength={6}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  disabled={verify.isPending}
                  aria-label={t("register.verify.codeLabel")}
                  aria-invalid={fieldState.invalid}
                  aria-describedby={
                    fieldState.invalid ? "verify-code-error" : undefined
                  }
                  containerClassName="justify-center gap-2"
                >
                  {/* Jeder Slot in einer eigenen Gruppe: so bekommt jedes
                      Kaestchen vollen Rand und Radius, wie die sechs
                      getrennten Felder im Template. */}
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <InputOTPGroup key={index}>
                      <InputOTPSlot
                        index={index}
                        className="size-10 rounded-control"
                      />
                    </InputOTPGroup>
                  ))}
                </InputOTP>
                {fieldState.invalid && fieldState.error?.message && (
                  <FieldError
                    id="verify-code-error"
                    errors={[{ message: t(fieldState.error.message) }]}
                  />
                )}
              </Field>
            )}
          />

          {serverError !== null && (
            <ErrorState message={serverError} />
          )}

          <Button
            type="submit"
            disabled={code.length !== 6 || verify.isPending}
          >
            {verify.isPending
              ? t("register.verify.pending")
              : t("register.verify.submit")}
          </Button>
        </div>
      </form>

      <div className="flex flex-col items-center gap-1 text-center">
        {/* role=status sagt die Bestaetigung beim Erscheinen an, ohne den
            Fokus zu bewegen. */}
        <p role="status" className="type-body-sm text-muted-foreground">
          {resendConfirmed && t("register.verify.resendConfirmed")}
        </p>
        {ready ? (
          <Button
            type="button"
            variant="link"
            className="type-body-sm h-auto p-0 font-semibold"
            onClick={onResend}
            disabled={resend.isPending}
          >
            {t("register.verify.resend")}
          </Button>
        ) : (
          <p className="type-body-sm text-muted-foreground">
            {t("register.verify.resendCountdown", { seconds: remaining })}
          </p>
        )}
      </div>

      {purpose === "PRIVATE_EMAIL" && (
        <>
          <Separator />
          {/* Weiterschalter fuer den Wiedereinstieg (KAN-68): der Einstieg
              landet immer bei Schritt 2, weil der offene Schritt nicht
              abfragbar ist (/verify/resend antwortet aus Enumeration-Schutz
              immer 204, Contract 6.1). Bewusst ohne updateRegistrationFlow:
              ein lokal gesetztes emailVerified machte den Klick zur
              Einbahnstrasse (der Guard von Schritt 2 leitete fortan nach
              vorn um), und der Guard von Schritt 3 braucht das Flag nicht.
              Die Flags setzt allein die Serverantwort auf POST /auth/verify
              (Review-Befund zu KAN-68). */}
          <div className="flex flex-col items-center gap-1 text-center">
            <Button
              type="button"
              variant="link"
              className="type-body-sm h-auto p-0 font-semibold"
              onClick={() => navigate("/register/verify-hsb-email")}
            >
              {t("register.verify.alreadyVerified")}
            </Button>
            <Link
              to="/register/details"
              className="type-body-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:underline"
            >
              {t("register.verify.back")}
            </Link>
          </div>
        </>
      )}
    </>
  )
}
