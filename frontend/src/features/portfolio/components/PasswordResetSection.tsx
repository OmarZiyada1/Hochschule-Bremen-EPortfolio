import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"

import { apiErrorMessageKey, isApiError } from "@/api/errors"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useRequestPasswordReset } from "@/features/auth/hooks/useAuthMutations"

/**
 * Der Bereich "Passwort zuruecksetzen" aus dem Template "Profil
 * bearbeiten": Hinweistext und der Knopf "Code senden" gegen
 * POST /auth/forgot-password (§6.1, KAN-43).
 *
 * <p>Der Aufruf antwortet immer 204, auch bei unbekannter Adresse oder
 * nicht aktivem Konto (§3.16, v35). Hier ist die Adresse ohnehin die eigene
 * und damit bekannt; die Bestaetigung behauptet trotzdem keinen Versand,
 * sondern beschreibt die Bedingung, wie auf der Seite "Passwort vergessen".
 *
 * <p>Nach dem Versand steht der Weg zur Code-Eingabe daneben, statt sofort
 * dorthin zu navigieren (Entscheidung aus der Klaerungsrunde zu KAN-34):
 * das Profilformular darueber kann ungespeicherte Aenderungen tragen, und
 * eine Navigation wuerfe sie ohne Rueckfrage weg. Die Adresse laeuft als
 * Router-State mit, damit sie dort nicht erneut getippt werden muss.
 */
export function PasswordResetSection({
  email,
  headingLevel = 2,
}: {
  /** Die private Adresse; an sie geht der Ruecksetzcode (§6.1). */
  email: string
  headingLevel?: 2 | 3
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const requestReset = useRequestPasswordReset()
  const [sent, setSent] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const Heading = `h${headingLevel}` as "h2" | "h3"

  const onSend = async () => {
    setServerError(null)
    try {
      await requestReset.mutateAsync({ email })
      setSent(true)
    } catch (error) {
      if (!isApiError(error)) {
        throw error
      }
      /* Fachlich scheitert der Aufruf nie; was hier ankommt, ist das
         Rate-Limit-429 oder ein Transportfehler. */
      setServerError(
        t(apiErrorMessageKey(error), { defaultValue: error.message })
      )
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <Heading className="type-h3 font-semibold text-primary">
        {t("portfolio.profile.passwordReset.title")}
      </Heading>
      <p className="type-body-sm text-muted-foreground">
        {t("portfolio.profile.passwordReset.description")}
      </p>

      {serverError !== null && (
        <Alert variant="destructive">
          <AlertTitle>{serverError}</AlertTitle>
        </Alert>
      )}

      {sent ? (
        <div className="flex flex-col items-start gap-3">
          {/* role=status: die Bestaetigung wird beim Erscheinen angesagt,
              ohne den Fokus aus dem Formular zu reissen. */}
          <p role="status" className="type-body-sm text-muted-foreground">
            {t("portfolio.profile.passwordReset.confirmation")}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/reset-password", { state: { email } })}
          >
            {t("portfolio.profile.passwordReset.toReset")}
          </Button>
        </div>
      ) : (
        /* type=button: der Bereich liegt unter dem Profilformular und darf
           es nicht absenden. */
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={onSend}
          disabled={requestReset.isPending}
        >
          {requestReset.isPending
            ? t("portfolio.profile.passwordReset.pending")
            : t("portfolio.profile.passwordReset.send")}
        </Button>
      )}
    </section>
  )
}
