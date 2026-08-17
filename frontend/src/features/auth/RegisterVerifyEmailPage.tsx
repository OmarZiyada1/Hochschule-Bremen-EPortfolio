import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Navigate } from "react-router-dom"

import { AuthCardHeader } from "@/features/auth/components/AuthCardHeader"
import { AuthPageShell } from "@/features/auth/components/AuthPageShell"
import { VerifyCodeStep } from "@/features/auth/components/VerifyCodeStep"
import { readRegistrationFlow } from "@/features/auth/registrationFlow"

/**
 * Schritt 2 der Registrierung (KAN-33, Template "Registrierung 2 –
 * Private E-Mail"): Bestaetigung der Login-Adresse per Code,
 * Fortschrittspunkte 2 von 3.
 *
 * Der Schrittzustand kommt aus dem sessionStorage und uebersteht damit
 * einen Reload (DoD); ohne Zustand (direkter Aufruf) geht es zur
 * Angaben-Seite, bei bereits bestaetigter Adresse zum jeweils naechsten
 * Schritt. Gelesen wird einmal je Einhaengen: die Seite selbst schreibt
 * den Zustand nur unmittelbar vor einer Navigation.
 */
export default function RegisterVerifyEmailPage() {
  const { t } = useTranslation()
  const [flow] = useState(readRegistrationFlow)

  if (flow === null) {
    return <Navigate to="/register/details" replace />
  }
  if (flow.status === "ACTIVE") {
    return <Navigate to="/register/done" replace />
  }
  if (flow.emailVerified) {
    return <Navigate to="/register/verify-hsb-email" replace />
  }

  return (
    <AuthPageShell breadcrumbLabel={t("register.breadcrumb")}>
      <AuthCardHeader
        title={t("register.verify.PRIVATE_EMAIL.title")}
        subtitle={t("register.verify.PRIVATE_EMAIL.subtitle")}
        progress={2}
        brandTitle
      />
      <VerifyCodeStep purpose="PRIVATE_EMAIL" flow={flow} />
    </AuthPageShell>
  )
}
