import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Navigate } from "react-router-dom"

import { AuthCardHeader } from "@/features/auth/components/AuthCardHeader"
import { AuthPageShell } from "@/features/auth/components/AuthPageShell"
import { VerifyCodeStep } from "@/features/auth/components/VerifyCodeStep"
import { readRegistrationFlow } from "@/features/auth/registrationFlow"

/**
 * Schritt 3 der Registrierung (KAN-33, Template "Registrierung 3 –
 * HSB-E-Mail"): Bestaetigung der Hochschuladresse per Code,
 * Fortschrittspunkte 3 von 3. Kein "Zurueck" wie im Template.
 *
 * Der Versandhinweis nennt die HSB-Adresse; der Verifizierungsaufruf
 * selbst traegt trotzdem die private Adresse als Kennung (§6.1,
 * VerifyCodeStep). Guards wie auf der privaten Seite: ohne Zustand zur
 * Angaben-Seite, bei ACTIVE zur Aktiviert-Seite, bei bereits bestaetigter
 * HSB-Adresse zur noch offenen privaten Bestaetigung.
 */
export default function RegisterVerifyHsbEmailPage() {
  const { t } = useTranslation()
  const [flow] = useState(readRegistrationFlow)

  if (flow === null) {
    return <Navigate to="/register/details" replace />
  }
  if (flow.status === "ACTIVE") {
    return <Navigate to="/register/done" replace />
  }
  if (flow.hsbEmailVerified) {
    return <Navigate to="/register/verify-email" replace />
  }

  return (
    <AuthPageShell breadcrumbLabel={t("register.breadcrumb")}>
      <AuthCardHeader
        title={t("register.verify.HSB_EMAIL.title")}
        subtitle={t("register.verify.HSB_EMAIL.subtitle")}
        progress={3}
        brandTitle
      />
      <VerifyCodeStep purpose="HSB_EMAIL" flow={flow} />
    </AuthPageShell>
  )
}
