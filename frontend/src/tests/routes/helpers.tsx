import { useLocation, useRoutes } from "react-router-dom"

import { startSession } from "@/api/auth/authStore"
import type { Role, UserResponse } from "@/api/types"
import { routes } from "@/routes"

/**
 * Der echte Routenbaum unter dem MemoryRouter aus renderWithProviders:
 * getestet wird dieselbe Definition, die main.tsx in den BrowserRouter
 * gibt, nicht ein nachgebauter Ausschnitt.
 */
export function AppUnderTest() {
  return useRoutes(routes)
}

/**
 * Macht Pfad und Suchteil abfragbar, etwa fuer die /register-Umleitung und
 * fuer Filter, die laut Ticket in der URL stehen muessen (KAN-34).
 */
export function LocationProbe() {
  const location = useLocation()
  return (
    <>
      <span data-testid="pathname">{location.pathname}</span>
      <span data-testid="search">{location.search}</span>
    </>
  )
}

/**
 * Praepariert die Sitzung vor dem Rendern, wie es der Auth-Store nach
 * einem Login taete; das Aufraeumen uebernimmt setup.ts nach jedem Test.
 */
// eslint-disable-next-line react-refresh/only-export-components -- Testhilfen, kein Fast-Refresh-Modul: Komponenten und Sitzungshelfer gehoeren zusammen.
export function signInAs(role: Role): void {
  const user: UserResponse = {
    id: "00000000-0000-0000-0000-000000000001",
    email: "mira.beispiel@example.org",
    firstName: "Mira",
    lastName: "Beispiel",
    role,
    status: "ACTIVE",
  }
  startSession({
    token: "test-token",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    user,
    passwordChangeRequired: false,
  })
}
