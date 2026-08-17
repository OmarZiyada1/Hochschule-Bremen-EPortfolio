import { CheckIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Navigate, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { AuthCardHeader } from "@/features/auth/components/AuthCardHeader"
import { AuthPageShell } from "@/features/auth/components/AuthPageShell"
import {
  clearRegistrationFlow,
  readRegistrationFlow,
} from "@/features/auth/registrationFlow"

/**
 * Abschluss der Registrierung (KAN-33, Template "Registrierung 4 –
 * Aktiviert"): Bestaetigung, Zusammenfassung beider Adressen samt Status,
 * Weg zur Anmeldung. Fortschrittspunkte 3 von 3, alle Eingabeschritte
 * sind erledigt.
 *
 * Erreicht ist die Seite nur mit status = ACTIVE aus der letzten
 * verify-Antwort (Template); private Adresse und Status stammen aus den
 * Serverantworten im Schrittzustand, die HSB-Adresse aus der Eingabe,
 * weil keine Response sie nennt (§3.1). Der Knopf "Zur Anmeldung" raeumt
 * den Schrittzustand ab: der Flow ist zu Ende, ein Rest im sessionStorage
 * wuerde eine spaetere Registrierung am selben Rechner in die falschen
 * Schritte leiten.
 */
export default function RegisterDonePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [flow] = useState(readRegistrationFlow)

  if (flow === null) {
    return <Navigate to="/register/details" replace />
  }
  if (flow.status !== "ACTIVE") {
    return (
      <Navigate
        to={
          flow.emailVerified
            ? "/register/verify-hsb-email"
            : "/register/verify-email"
        }
        replace
      />
    )
  }

  const toLogin = () => {
    clearRegistrationFlow()
    navigate("/login")
  }

  return (
    <AuthPageShell breadcrumbLabel={t("register.breadcrumb")}>
      <AuthCardHeader
        title={t("register.done.title")}
        subtitle={t("register.done.subtitle")}
        progress={3}
        brandTitle
      />

      <div
        aria-hidden="true"
        className="mx-auto flex size-10 items-center justify-center rounded-card bg-pill-success-bg text-pill-success-fg"
      >
        <CheckIcon className="size-5" />
      </div>

      <p className="type-body-sm text-center text-muted-foreground">
        {t("register.done.hint")}
      </p>

      {/* Zusammenfassung wie im Template: Beschriftung links, Wert rechts
          mit Haekchen, Status ohne Haekchen. Eine Beschreibungsliste,
          weil genau das die Semantik ist: Begriff und Wert. */}
      <dl className="flex flex-col gap-2.5 rounded-control border bg-muted px-4 py-3.5">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="type-body-sm text-muted-foreground">
            {t("register.done.emailLabel")}
          </dt>
          <dd className="type-body-sm flex items-center gap-1.5 font-semibold text-primary">
            <CheckIcon aria-hidden="true" className="size-3.5" />
            {flow.email}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="type-body-sm text-muted-foreground">
            {t("register.done.hsbEmailLabel")}
          </dt>
          <dd className="type-body-sm flex items-center gap-1.5 font-semibold text-primary">
            <CheckIcon aria-hidden="true" className="size-3.5" />
            {/* Nach dem Wiedereinstieg ueber den Login (KAN-68) ist die
                HSB-Adresse unbekannt: keine Response nennt sie (Contract
                3.1). Bestaetigt ist sie trotzdem, sonst waere der Status
                nicht ACTIVE. */}
            {flow.hsbEmail !== ""
              ? flow.hsbEmail
              : t("register.done.hsbEmailFallback")}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="type-body-sm text-muted-foreground">
            {t("register.done.statusLabel")}
          </dt>
          <dd className="type-body-sm font-semibold">
            {t(`user.status.${flow.status}`)}
          </dd>
        </div>
      </dl>

      <Button type="button" onClick={toLogin}>
        {t("register.done.toLogin")}
      </Button>
    </AuthPageShell>
  )
}
