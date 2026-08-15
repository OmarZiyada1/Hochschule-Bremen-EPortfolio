import { Navigate, Outlet } from "react-router-dom"

import { useAuth } from "@/api/auth/AuthContext"
import { LOGIN_PATH } from "@/api/auth/redirect"

/**
 * Zugriffsebene "angemeldet" (Ticket KAN-7, Umfang 3): die Profilrouten
 * stehen jeder angemeldeten Rolle offen, auch ADMIN (Contract 5, Zeile
 * "Eigenes Portfolio bearbeiten"). Ohne Anmeldung geht es sichtbar zum
 * Login statt auf eine leere Seite.
 *
 * Gefragt wird der Auth-Kontext aus KAN-30, nicht der localStorage: eine
 * zweite Tokenpruefung waere eine zweite Stelle, die bei jeder Aenderung
 * mitgepflegt werden muss. Verbindlich prueft ohnehin der Server (§5);
 * dieser Wrapper ist Bequemlichkeit, keine Sicherheitsmassnahme.
 */
export function RequireAuth() {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to={LOGIN_PATH} replace />
  }
  return <Outlet />
}
