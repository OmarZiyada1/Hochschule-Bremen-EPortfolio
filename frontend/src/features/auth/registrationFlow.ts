import type { UserStatus } from "@/api/types"

/**
 * Schrittzustand des Registrierungsflows (KAN-33): welche Adressen angegeben
 * wurden und was der Server zuletzt ueber Flags und Status gesagt hat. Im
 * sessionStorage, damit ein Neuladen den Flow nicht zuruecksetzt (DoD), aber
 * keine fremde Browser-Sitzung ihn erbt.
 *
 * Die private Adresse ist die Kennung fuer POST /auth/verify und
 * /verify/resend, auch beim Zweck HSB_EMAIL (§6.1). Die HSB-Adresse steht
 * nur fuer die Anzeige hier: keine Response nennt sie (§3.1), die
 * Aktiviert-Seite und der Versandhinweis in Schritt 3 kommen deshalb nicht
 * ohne den Formularwert aus. Flags und Status stammen dagegen immer aus der
 * letzten Serverantwort, nie aus lokaler Zaehlung.
 */
export type RegistrationFlowState = {
  /** Private E-Mail, die Login-Kennung; Kennung aller Verifizierungsaufrufe. */
  email: string
  /** HSB-E-Mail, nur fuer die Anzeige (Versandhinweis, Zusammenfassung). */
  hsbEmail: string
  emailVerified: boolean
  hsbEmailVerified: boolean
  status: UserStatus
}

const STORAGE_KEY = "eportfolio.registration"

export function readRegistrationFlow(): RegistrationFlowState | null {
  const raw = window.sessionStorage.getItem(STORAGE_KEY)
  if (raw === null) {
    return null
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY)
    return null
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).email !== "string" ||
    typeof (parsed as Record<string, unknown>).hsbEmail !== "string" ||
    typeof (parsed as Record<string, unknown>).emailVerified !== "boolean" ||
    typeof (parsed as Record<string, unknown>).hsbEmailVerified !==
      "boolean" ||
    typeof (parsed as Record<string, unknown>).status !== "string"
  ) {
    window.sessionStorage.removeItem(STORAGE_KEY)
    return null
  }
  return parsed as RegistrationFlowState
}

export function saveRegistrationFlow(state: RegistrationFlowState): void {
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

/**
 * Uebernimmt die Antwort von POST /auth/verify in den gemerkten Zustand.
 * Ohne bestehenden Flow (direkter Seitenaufruf) passiert nichts; die Seite
 * hat dann bereits zur Angaben-Seite umgeleitet.
 */
export function updateRegistrationFlow(
  patch: Partial<Pick<RegistrationFlowState, "emailVerified" | "hsbEmailVerified" | "status">>
): void {
  const current = readRegistrationFlow()
  if (current !== null) {
    saveRegistrationFlow({ ...current, ...patch })
  }
}

export function clearRegistrationFlow(): void {
  window.sessionStorage.removeItem(STORAGE_KEY)
}
