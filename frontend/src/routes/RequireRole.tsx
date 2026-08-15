import { Navigate, Outlet } from "react-router-dom"

import { useAuth } from "@/api/auth/AuthContext"
import { LOGIN_PATH } from "@/api/auth/redirect"
import type { Role } from "@/api/types"
import { AccessDeniedPage } from "@/routes/AccessDeniedPage"

/**
 * Rollengebundene Zugriffsebene (Ticket KAN-7, Umfang 3): erst die Frage
 * nach der Anmeldung, dann die Rolle. PUBLIC ist keine gespeicherte Rolle,
 * sondern der Zustand "nicht angemeldet" (Contract 2.1); es gibt keinen
 * Rollenwert, gegen den ein Gast verglichen werden koennte.
 *
 * Die erlaubten Rollen kommen als Prop, weil ein festes
 * RequireRole="STUDENT" an den Projektrouten Redakteur:innen aussperren
 * wuerde, die der Server durchlaesst (Contract 5, Fussnote 10). Ohne
 * Anmeldung geht es zum Login; mit falscher Rolle erscheint eine sichtbare
 * Meldung, keine leere Seite. Verbindlich prueft der Server (§5).
 */
export function RequireRole({ roles }: { roles: Role[] }) {
  const { isAuthenticated, role } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to={LOGIN_PATH} replace />
  }
  if (role === null || !roles.includes(role)) {
    return <AccessDeniedPage />
  }
  return <Outlet />
}
