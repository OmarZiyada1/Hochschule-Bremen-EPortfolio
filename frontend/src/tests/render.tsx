import { QueryClientProvider } from "@tanstack/react-query"
import { render } from "@testing-library/react"
import type { ReactElement } from "react"
import { MemoryRouter } from "react-router-dom"

import { AuthProvider } from "@/api/auth/AuthContext"
import { createQueryClient } from "@/api/queryClient"
import { ThemeProvider } from "@/components/theme-provider"

import "@/i18n"

/**
 * Rendert eine Ansicht mit den Umgebungen, die sie in der Anwendung auch
 * hat: Uebersetzung, Moduswechsel, Router, Anmeldung und Datenzugriff.
 * Getestet wird danach ueber die sichtbare Oberflaeche, nicht ueber
 * interne Props.
 *
 * Der QueryClient kommt je Aufruf frisch aus derselben Fabrik wie in
 * main.tsx, mit zentraler Fehlerreaktion und ohne Cache-Reste des
 * vorigen Tests.
 */
export function renderWithProviders(ui: ReactElement, route = "/") {
  return render(
    <ThemeProvider>
      <AuthProvider>
        <QueryClientProvider client={createQueryClient()}>
          <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
