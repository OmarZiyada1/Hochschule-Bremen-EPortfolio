import type { Role } from "@/api/types"

/**
 * Wohin eine Rolle nach dem Anmelden fuehrt (KAN-83).
 *
 * <p>Bis dahin landete jede Rolle auf `/projects`, der oeffentlichen
 * Projektbibliothek. Das war das Pauschalziel des Durchstichs aus KAN-8 und
 * fuer niemanden der Ort, an dem die eigene Arbeit beginnt: Studierende
 * suchen ihr Portfolio, die Redaktion ihre offenen Reviews, die
 * Administration ihre Seite.
 *
 * <p><strong>Ein `Record` ueber den Rollentyp und kein `switch` mit
 * Standardzweig.</strong> Kaeme eine vierte Rolle dazu, bricht hier der
 * Typecheck, statt dass sie still auf einem Ersatzziel landet. Dasselbe
 * Muster fuehrt `STATUS_COLORS` in der Nutzerstatistik.
 *
 * <p><strong>Die Vererbung aus KAN-82 aendert daran nichts.</strong> Ein
 * Konto traegt weiterhin genau einen Rollenwert; dass ADMIN die Rechte von
 * STUDENT und EDITOR erbt, heisst nur, dass die Navigation ihm „Meine
 * Reviews" und „Mein Portfolio" zusaetzlich anbietet (`navLinks.ts`).
 */
const LANDING_PATHS: Record<Role, string> = {
  STUDENT: "/my-portfolio",
  EDITOR: "/reviews",
  ADMIN: "/administration",
}

/**
 * Das Startziel dieser Rolle.
 *
 * <p>Ohne Rolle bleibt es bei `/projects`: das ist der oeffentliche Stand,
 * und ohne Anmeldung gibt es keinen persoenlichen Bereich, auf den sich
 * umleiten liesse.
 */
export function landingPathFor(role: Role | null | undefined): string {
  if (role === null || role === undefined) {
    return "/projects"
  }
  return LANDING_PATHS[role]
}
