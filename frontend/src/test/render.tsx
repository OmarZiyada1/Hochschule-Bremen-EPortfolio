import { render } from "@testing-library/react"
import type { ReactElement } from "react"
import { MemoryRouter } from "react-router-dom"

import { ThemeProvider } from "@/components/theme-provider"

import "@/i18n"

/**
 * Rendert eine Ansicht mit den Umgebungen, die sie in der Anwendung auch
 * hat: Uebersetzung, Moduswechsel und Router. Getestet wird danach ueber
 * die sichtbare Oberflaeche, nicht ueber interne Props.
 */
export function renderWithProviders(ui: ReactElement, route = "/") {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </ThemeProvider>
  )
}
