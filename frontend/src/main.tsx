/*
 * Schriften lokal ueber Fontsource, kein Aufruf an Google Fonts zur
 * Laufzeit (KAN-6, Abschnitt 6). Zilla Slab kommt ausschliesslich als
 * SemiBold (600) ins Projekt; Source Sans 3 in den Schnitten 400 bis 800,
 * wobei ExtraBold (800) die Metrik hinter --lh-num-rank liefert.
 */
import "@fontsource/zilla-slab/600.css"
import "@fontsource/source-sans-3/400.css"
import "@fontsource/source-sans-3/500.css"
import "@fontsource/source-sans-3/600.css"
import "@fontsource/source-sans-3/700.css"
import "@fontsource/source-sans-3/800.css"

/* Einziger CSS-Einstiegspunkt: Tailwind, shadcn und die Tokenschicht. */
import "./index.css"

import "./i18n"

import { QueryClientProvider } from "@tanstack/react-query"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router-dom"

import { AuthProvider } from "@/api/auth/AuthContext"
import { setAuthNavigate } from "@/api/auth/redirect"
import { createQueryClient } from "@/api/queryClient"
import { ThemeProvider } from "@/components/theme-provider"
import { router } from "@/routes"

/*
 * Die zentrale Fehlerreaktion (401, Passwortzwang, Tokenablauf) laeuft
 * ausserhalb von Komponenten und leitet ueber diese Bruecke um; der
 * Router-Singleton ist die navigate-Funktion der Anwendung.
 */
setAuthNavigate((to) => void router.navigate(to))

const queryClient = createQueryClient()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>
)
