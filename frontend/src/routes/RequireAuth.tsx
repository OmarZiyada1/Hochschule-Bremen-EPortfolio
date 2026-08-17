import { Navigate, Outlet, useLocation } from "react-router-dom"

import { useAuth } from "@/api/auth/AuthContext"
import {
  CHANGE_PASSWORD_PATH,
  LOGIN_PATH,
  rememberRequestedRoute,
} from "@/api/auth/redirect"

/**
 * Zugriffsebene "angemeldet" (Ticket KAN-7, Umfang 3): die Profilrouten
 * stehen jeder angemeldeten Rolle offen, auch ADMIN (Contract 5, Zeile
 * "Eigenes Portfolio bearbeiten"). Ohne Anmeldung geht es sichtbar zum
 * Login statt auf eine leere Seite; die angefragte Route wird gemerkt und
 * nach der Anmeldung wieder angesteuert (Klaerungsrunde KAN-33).
 *
 * Bei gesetztem passwordChangeRequired fuehrt jede geschuetzte Route zur
 * Passwortseite (Contract 6.7, KAN-33): der Server antwortete ohnehin auf
 * fast alles mit 403, die Umleitung hier erspart den sichtbaren Fehlschlag.
 *
 * Gefragt wird der Auth-Kontext aus KAN-30, nicht der localStorage: eine
 * zweite Tokenpruefung waere eine zweite Stelle, die bei jeder Aenderung
 * mitgepflegt werden muss. Verbindlich prueft ohnehin der Server (§5);
 * dieser Wrapper ist Bequemlichkeit, keine Sicherheitsmassnahme.
 */
export function RequireAuth() {
  const { isAuthenticated, passwordChangeRequired } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    /*
     * Schreiben waehrend des Renderns ist hier unbedenklich: der Eintrag
     * ist idempotent und die Komponente ersetzt sich sofort durch die
     * Navigation.
     */
    rememberRequestedRoute(location.pathname + location.search)
    return <Navigate to={LOGIN_PATH} replace />
  }
  if (passwordChangeRequired) {
    rememberRequestedRoute(location.pathname + location.search)
    return <Navigate to={CHANGE_PASSWORD_PATH} replace />
  }
  return <Outlet />
}
