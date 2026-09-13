import { QueryClientProvider } from "@tanstack/react-query"
import { render } from "@testing-library/react"
import type { ReactElement } from "react"
import { MemoryRouter, type InitialEntry } from "react-router-dom"

import { AuthProvider } from "@/api/auth/AuthContext"
import { createQueryClient } from "@/api/queryClient"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toast"

import "@/i18n"

/**
 * Rendert eine Ansicht mit den Umgebungen, die sie in der Anwendung auch
 * hat: Uebersetzung, Moduswechsel, Router, Anmeldung, Datenzugriff und
 * Meldungsflaeche. Getestet wird danach ueber die sichtbare Oberflaeche,
 * nicht ueber interne Props.
 *
 * Der QueryClient kommt je Aufruf frisch aus derselben Fabrik wie in
 * main.tsx, mit zentraler Fehlerreaktion und ohne Cache-Reste des
 * vorigen Tests.
 *
 * <p>Der Toaster steht an derselben Stelle wie in main.tsx (KAN-105): eine
 * Ansicht, die nach dem Speichern toast.add ruft und weiternavigiert, zeigt
 * die Meldung im Test genauso wie im Browser. Der Manager ist ein
 * Modul-Singleton, die Toasts selbst liegen aber im Provider; mit dem
 * Aufraeumen nach jedem Test verschwinden sie samt ihren Zeitgebern, und
 * nichts laeuft in den naechsten Test hinein.
 *
 * <p>{@code route} ist in der Regel eine Adresse. Erlaubt ist seit KAN-80
 * auch der Eintrag als Objekt: nur so laesst sich der Router-State setzen,
 * ueber den eine Ansicht ihre Herkunft an den Brotkrumenpfad weitergibt.
 */
export function renderWithProviders(
  ui: ReactElement,
  route: InitialEntry = "/"
) {
  return render(
    <ThemeProvider>
      <AuthProvider>
        <QueryClientProvider client={createQueryClient()}>
          <Toaster>
            <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
          </Toaster>
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
